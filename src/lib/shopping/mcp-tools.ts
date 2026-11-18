// /shopping tools for the MCP server (src/app/api/mcp/route.ts): what people
// ask an AI assistant about groceries — "add milk and 2 cottage to my list",
// "is ₪7.90 for Bamba cheap?", "where should I shop for my list?". Answers are
// plain text the model reads back, prices in ₪ with each price's source.
// Products can be named in free text, a barcode or an item key: free text is
// searched and the best match used, with the runner-ups named so the model
// can correct. Server-only; the queries are the page's (service.ts).

import { CITIES } from '@/lib/shopping/cities';
import { MAX_LIST_ITEMS, MAX_QTY, linesAdded, normalizeQty, type ListLine } from '@/lib/shopping/home';
import type { SearchHit, StoreInfo } from '@/lib/shopping/api-types';
import { compareBasket, itemPrices, searchProducts } from '@/lib/shopping/service';
import { ensureMyItems, householdFor, setList } from '@/models/ShoppingHome';
import { getShoppingSettings, updateShoppingSettings } from '@/models/ShoppingUserSettings';

export interface ShoppingToolCaller {
  userEmail: string;
  userName: string;
}

export interface ShoppingTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>, caller: ShoppingToolCaller) => Promise<string>;
}

// ── helpers ──────────────────────────────────────────────────────────────

const shekels = (agorot: number) => `₪${(agorot / 100).toFixed(2)}`;
const str = (args: Record<string, unknown>, key: string) => (typeof args[key] === 'string' ? (args[key] as string).trim() : '');
const SOURCE_NOTE: Record<string, string> = { official: '', wolt: ' (Wolt delivery price)', manual: ' (price typed by users)' };

function storeLabel(s: StoreInfo | undefined): string {
  if (!s) return 'unknown store';
  const where = s.kind === 'online' ? 'online' : s.walkMin !== null ? `${s.walkMin} min walk` : s.address;
  // Branch names often repeat the chain ("סופר-פארם פלורנטין", "שופרסל ONLINE").
  const name = s.name.replace(/\s+/g, ' ').trim();
  const label = name.startsWith(s.chainName) ? name : `${s.chainName} ${name}`;
  return label.trim() + (where ? ` (${where})` : '') + (SOURCE_NOTE[s.source] ?? '');
}

/** A maker worth naming: has letters, isn't a placeholder. */
const maker = (m: string) => (/[a-zא-ת]{2}/i.test(m) && !/^(לא ידוע|כללי|unknown)$/i.test(m.trim()) ? m.trim() : '');

const CITY_ALIASES: Record<string, string> = {
  'tel aviv': 'tel-aviv', telaviv: 'tel-aviv', 'תל אביב': 'tel-aviv', 'תל אביב-יפו': 'tel-aviv', 'ת"א': 'tel-aviv', tlv: 'tel-aviv',
  'ramat gan': 'ramat-gan', 'רמת גן': 'ramat-gan', 'ר"ג': 'ramat-gan',
  'beer sheva': 'beer-sheva', "be'er sheva": 'beer-sheva', beersheba: 'beer-sheva', 'באר שבע': 'beer-sheva', 'ב"ש': 'beer-sheva',
};
const CITY_LIST = CITIES.map((c) => `${c.id} (${c.name})`).join(', ');

function parseCity(raw: string): string | null {
  const k = raw.toLowerCase().replace(/["׳״]/g, (c) => (c === '״' ? '"' : c)).trim();
  if (CITIES.some((c) => c.id === k)) return k;
  return CITY_ALIASES[k] ?? null;
}

/** The city given, else the caller's saved one, else an error the model can act on. */
async function cityFor(args: Record<string, unknown>, caller: ShoppingToolCaller): Promise<string> {
  const given = str(args, 'city');
  if (given) {
    const c = parseCity(given);
    if (!c) throw new Error(`Unknown city "${given}". Cities: ${CITY_LIST}.`);
    return c;
  }
  const saved = (await getShoppingSettings(caller.userEmail)).city;
  if (saved) return saved;
  throw new Error(`Which city should I price in? Pass city (${CITY_LIST}), or save one with shopping_set_city.`);
}

/** The caller's household's one shopping list (built from My items on the page with "מה חסר?"). */
async function theList(caller: { userEmail: string }): Promise<{ id: string; name: string; items: ListLine[] }> {
  const h = await householdFor(caller.userEmail);
  return { id: h.id, name: 'the shopping list', items: h.list };
}

const isKey = (s: string) => /^\d{8,14}$/.test(s) || /^\d{13}:[^\s]+$/.test(s) || /^wolt:/.test(s) || /^manual:/.test(s);

/**
 * A product named in free text, a barcode or a key → the best hit and the
 * runner-ups. The search's own ranking (the page's) decides, except that a
 * top hit no nearby store sells gives way to the first one that is sold.
 * The runner-ups go back to the model so it can correct a wrong pick.
 */
async function resolveProduct(q: string, city: string): Promise<{ hit: SearchHit; others: SearchHit[] } | null> {
  const hits = await searchProducts(q.slice(0, 80), city);
  if (!hits.length) return null;
  const hit = hits[0].stores > 0 ? hits[0] : (hits.slice(0, 5).find((h) => h.stores > 0) ?? hits[0]);
  return { hit, others: hits.filter((h) => h !== hit).slice(0, 3) };
}

function hitLine(h: SearchHit): string {
  const price =
    h.minPrice === null ? 'not sold nearby'
      : `${shekels(h.minPrice)}${h.maxPrice !== null && h.maxPrice !== h.minPrice ? `–${shekels(h.maxPrice)}` : ''}${h.w ? '/kg' : ''} at ${h.stores} store${h.stores === 1 ? '' : 's'}`
        + (h.cheapest ? `, cheapest at ${h.cheapest.chainName} ${h.cheapest.name}` : '') + (h.onSale ? ' (on sale)' : '');
  return `${h.name}${maker(h.manufacturer) ? ` (${maker(h.manufacturer)})` : ''} — ${price} [key ${h.key}]`;
}

const listLine = (it: ListLine) => `${it.name} × ${it.qty}${it.w ? ' kg' : ''} [key ${it.key}]`;

// ── tools ────────────────────────────────────────────────────────────────

const cityProp = {
  type: 'string',
  description: `City to price in: ${CITY_LIST}. Optional when the user saved one (shopping_set_city).`,
};

export const SHOPPING_TOOLS: ShoppingTool[] = [
  {
    name: 'shopping_search',
    description:
      'Search grocery products by name (Hebrew or English, typos ok) or barcode. Returns the best matches with their price range in the city, how many nearby stores sell them, the cheapest store, and each product\'s key for the other shopping tools.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Product name words or a barcode, e.g. "קוטג 5%" or "bamba".' }, city: cityProp },
      required: ['query'],
      additionalProperties: false,
    },
    handler: async (args, caller) => {
      const q = str(args, 'query');
      if (!q) throw new Error('query is required.');
      const city = await cityFor(args, caller);
      const hits = (await searchProducts(q.slice(0, 80), city)).slice(0, 8);
      if (!hits.length) return `No products match "${q}".`;
      return hits.map((h, i) => `${i + 1}. ${hitLine(h)}`).join('\n');
    },
  },
  {
    name: 'shopping_product_prices',
    description:
      'One product\'s price at every nearby store, cheapest first, deals applied (per unit, or per kg when sold by weight). Pass price to ask "is this cheap?": the answer compares it with the cheapest and the typical nearby price.',
    inputSchema: {
      type: 'object',
      properties: {
        product: { type: 'string', description: 'Product key, barcode, or name (the best match is used).' },
        price: { type: 'number', description: 'Optional: a price in shekels the user saw, to judge whether it is cheap.' },
        city: cityProp,
      },
      required: ['product'],
      additionalProperties: false,
    },
    handler: async (args, caller) => {
      const product = str(args, 'product');
      if (!product) throw new Error('product is required.');
      const city = await cityFor(args, caller);
      let key = product;
      let note = '';
      if (!isKey(product) || !(await itemPrices(product, city))) {
        const r = await resolveProduct(product, city);
        if (!r) return `No product matches "${product}".`;
        key = r.hit.key;
        if (r.others.length) note = `\n(Took the best match for "${product}". Other matches: ${r.others.map((o) => `${o.name} [key ${o.key}]`).join('; ')}.)`;
      }
      const res = await itemPrices(key, city);
      if (!res) return `No product with key ${key}.`;
      const unit = res.item.w ? '/kg' : '';
      const head = `${res.item.name}${maker(res.item.manufacturer) ? ` (${maker(res.item.manufacturer)})` : ''} [key ${res.item.key}]`;
      if (!res.physical.length && !res.online.length) return `${head}: not sold in any store near ${city}.${note}`;
      const row = (p: (typeof res.physical)[number]) => {
        const deal = p.cost < p.regularUnit ? ` (deal; regular ${shekels(p.regularUnit)})` : '';
        const multi = p.multi ? ` — when buying ${p.multi.qty} (${shekels(p.multi.total)} together)` : '';
        return `- ${shekels(p.cost)}${unit}${deal}${multi} at ${storeLabel(res.stores[p.store])}`;
      };
      const lines = [head, ...res.physical.slice(0, 10).map(row)];
      if (res.physical.length > 10) lines.push(`…and ${res.physical.length - 10} more stores.`);
      if (res.online.length) lines.push('Online:', ...res.online.slice(0, 3).map(row));
      const price = typeof args.price === 'number' && args.price > 0 ? Math.round(args.price * 100) : null;
      if (price !== null && res.physical.length) {
        // Judge one unit against one unit: a multi-buy's per-unit price needs several packs.
        const single = (p: (typeof res.physical)[number]) => (p.multi ? p.regularUnit : p.cost);
        const costs = res.physical.map(single).sort((a, b) => a - b);
        const low = costs[0];
        const median = costs[Math.floor((costs.length - 1) / 2)];
        const bulk = res.physical.filter((p) => p.multi && p.cost < low).sort((a, b) => a.cost - b.cost)[0];
        const verdict =
          price <= low * 1.03 ? 'cheap — as low as anywhere nearby'
            : price <= median ? 'a fair price — around or below the typical nearby price'
              : 'expensive — above the typical nearby price';
        const pct = Math.round(((price - low) / low) * 100);
        lines.push(`Verdict for ${shekels(price)}${unit} (one unit): ${verdict}. Cheapest single unit nearby ${shekels(low)}${unit}${pct > 0 ? ` (you'd pay ${pct}% more)` : ''}; typical ${shekels(median)}${unit} across ${costs.length} stores.`
          + (bulk?.multi ? ` Buying ${bulk.multi.qty} at ${storeLabel(res.stores[bulk.store])} brings it to ${shekels(bulk.cost)} each.` : ''));
      }
      return lines.join('\n') + note;
    },
  },
  {
    name: 'shopping_my_items',
    description: 'The household\'s "My items": the products it usually buys, each with its usual quantity. The shopping list is built from these.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: async (_args, caller) => {
      const { items } = await householdFor(caller.userEmail);
      if (!items.length) return 'My items is empty.';
      return [`My items (${items.length}):`, ...items.map((it) => `- ${listLine(it)}`)].join('\n');
    },
  },
  {
    name: 'shopping_get_list',
    description: 'The items on the household\'s shopping list (name, quantity, key).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: async (_args, caller) => {
      const list = await theList(caller);
      if (!list.items.length) return `"${list.name}" is empty.`;
      return [`"${list.name}" (${list.items.length} items):`, ...list.items.map((it) => `- ${listLine(it)}`)].join('\n');
    },
  },
  {
    name: 'shopping_add_items',
    description:
      'Add products to the household\'s shopping list (a product not yet among My items is saved there too). Each product can be a name ("חלב 3%", "tomatoes"), a barcode or a key; names use the best search match, and the answer says which product was picked and the alternatives. An item already on the list gets its quantity increased. Quantity is units, or kg for products sold by weight (default 1).',
    inputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          minItems: 1,
          maxItems: 30,
          items: {
            type: 'object',
            properties: {
              product: { type: 'string', description: 'Name, barcode or key.' },
              qty: { type: 'number', description: 'Units, or kg when sold by weight. Default 1.' },
            },
            required: ['product'],
            additionalProperties: false,
          },
        },
        city: cityProp,
      },
      required: ['items'],
      additionalProperties: false,
    },
    handler: async (args, caller) => {
      const wanted = Array.isArray(args.items) ? (args.items as Record<string, unknown>[]) : [];
      if (!wanted.length) throw new Error('items is required.');
      const list = await theList(caller);
      const city = await cityFor(args, caller);
      const items = [...list.items];
      const report: string[] = [];
      for (const w of wanted.slice(0, 30)) {
        const product = str(w, 'product');
        if (!product) continue;
        const r = await resolveProduct(product, city);
        if (!r) {
          report.push(`✗ "${product}": no matching product — not added.`);
          continue;
        }
        const { hit, others } = r;
        const qty = normalizeQty(typeof w.qty === 'number' && w.qty > 0 ? w.qty : 1, hit.w);
        if (qty === null) {
          report.push(`✗ "${product}": bad quantity.`);
          continue;
        }
        const have = items.find((it) => it.key === hit.key);
        const alt = others.length ? ` Other matches: ${others.map((o) => o.name).join('; ')}.` : '';
        if (have) {
          have.qty = Math.min(MAX_QTY, normalizeQty(have.qty + qty, have.w) ?? have.qty);
          report.push(`✓ ${hit.name}: now × ${have.qty}${have.w ? ' kg' : ''} (was already on the list).${alt}`);
        } else if (items.length >= MAX_LIST_ITEMS) {
          report.push(`✗ "${product}": the list is full (${MAX_LIST_ITEMS} items).`);
        } else {
          items.push({ key: hit.key, name: hit.name, qty, w: hit.w });
          const price = hit.minPrice !== null ? ` — from ${shekels(hit.minPrice)}${hit.w ? '/kg' : ''}` : ' — not sold nearby';
          report.push(`✓ "${product}" → ${hit.name} × ${qty}${hit.w ? ' kg' : ''}${price}.${alt}`);
        }
      }
      await setList(list.id, items);
      // Only the products this call put on the list: a line already there may have been removed from My items on purpose.
      await ensureMyItems(list.id, linesAdded(list.items, items), caller.userEmail);
      return [`The list (${items.length} items):`, ...report].join('\n');
    },
  },
  {
    name: 'shopping_remove_items',
    description: 'Remove products from the shopping list, by key or by (part of) the name as it appears on the list. Pass qty to lower the quantity instead of removing.',
    inputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            properties: {
              product: { type: 'string', description: 'Key, or a name or part of it.' },
              qty: { type: 'number', description: 'Optional: remove only this many units (kg).' },
            },
            required: ['product'],
            additionalProperties: false,
          },
        },
      },
      required: ['items'],
      additionalProperties: false,
    },
    handler: async (args, caller) => {
      const wanted = Array.isArray(args.items) ? (args.items as Record<string, unknown>[]) : [];
      const list = await theList(caller);
      let items = [...list.items];
      const report: string[] = [];
      for (const w of wanted) {
        const p = str(w, 'product').toLowerCase();
        if (!p) continue;
        const it = items.find((x) => x.key === p) ?? items.find((x) => x.name.toLowerCase().includes(p));
        if (!it) {
          report.push(`✗ "${p}" isn't on the list.`);
          continue;
        }
        const less = typeof w.qty === 'number' && w.qty > 0 ? w.qty : null;
        if (less !== null && less < it.qty) {
          it.qty = normalizeQty(it.qty - less, it.w) ?? it.qty;
          report.push(`✓ ${it.name}: now × ${it.qty}${it.w ? ' kg' : ''}.`);
        } else {
          items = items.filter((x) => x !== it);
          report.push(`✓ Removed ${it.name}.`);
        }
      }
      await setList(list.id, items);
      return [`The list (${items.length} items):`, ...report].join('\n');
    },
  },
  {
    name: 'shopping_compare',
    description:
      'Where to buy the shopping list: the cheapest single store, the cheapest way to split it across up to 3 nearby stores (only suggested when it saves enough), and the totals at the top stores, with what each store lacks. Deals are applied; club and coupon deals only when asked.',
    inputSchema: {
      type: 'object',
      properties: {
        city: cityProp,
        clubs: { type: 'boolean', description: 'Include club-member deals (default false).' },
      },
      additionalProperties: false,
    },
    handler: async (args, caller) => {
      const list = await theList(caller);
      if (!list.items.length) return `"${list.name}" is empty — nothing to compare.`;
      const city = await cityFor(args, caller);
      const res = await compareBasket({
        city, lines: list.items.map((it) => ({ key: it.key, qty: it.qty })), clubs: args.clubs === true, coupons: false,
      });
      const name = (k: string) => res.items[k]?.name ?? k;
      const st = (k: number) => storeLabel(res.stores[k]);
      const missing = (m: string[]) => (m.length ? ` — lacks ${m.length}: ${m.slice(0, 5).map(name).join(', ')}${m.length > 5 ? '…' : ''}` : '');
      const out: string[] = [`"${list.name}" — ${list.items.length} items, ${city}:`];
      const one = res.plans.oneStore;
      if (!one) return `${out[0]}\nNo nearby store sells anything on this list.`;
      out.push(`One store: ${shekels(one.total)} at ${st(one.stops[0].store)}${missing(one.missing)}.`);
      const cheap = res.plans.cheapest;
      if (cheap && res.plans.splitPays) {
        out.push(`Cheapest: ${shekels(cheap.total)} across ${cheap.stops.length} stores, saving ${shekels(res.plans.saving)}${missing(cheap.missing)}:`);
        for (const s of cheap.stops) {
          const its = s.basket.lines.filter((l) => l.available).map((l) => name(l.key));
          out.push(`  • ${st(s.store)}: ${shekels(s.basket.total)} — ${its.join(', ')}`);
        }
      } else {
        out.push('Splitting across stores doesn\'t save enough to be worth it.');
      }
      out.push('Top stores:', ...res.physical.slice(0, 5).map((b, i) => `${i + 1}. ${shekels(b.total)} at ${st(b.store)}${missing(b.missing)}`));
      if (res.online.length) out.push(`Online: ${shekels(res.online[0].total)} at ${st(res.online[0].store)}${missing(res.online[0].missing)}.`);
      return out.join('\n');
    },
  },
  {
    name: 'shopping_set_city',
    description: `Save the city the shopping tools price in when no city is given: ${CITY_LIST}.`,
    inputSchema: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'], additionalProperties: false },
    handler: async (args, caller) => {
      const c = parseCity(str(args, 'city'));
      if (!c) throw new Error(`Unknown city. Cities: ${CITY_LIST}.`);
      await updateShoppingSettings(caller.userEmail, { city: c });
      return `Saved: shopping prices are for ${CITIES.find((x) => x.id === c)!.name}.`;
    },
  },
];
