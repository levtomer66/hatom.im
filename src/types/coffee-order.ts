// Domain types + option constants + validation helpers for the /coffee-order
// feature. Mirrors src/types/spa.ts: string-literal unions, option arrays the
// UI maps over, and coercion/validation helpers the API uses so a stale or
// malicious client can't smuggle bad values into Mongo.

export type CoffeeDrink = 'espresso' | 'lungo' | 'cappuccino' | 'iced-coffee';
export type CoffeeMilk = 'none' | 'regular' | 'soy' | 'lactose-free' | 'oat';
export type CoffeeSugar = 'none' | '1' | '2' | '3';
export type CoffeeSource =
  | 'tomer-coffee'
  | 'boulangerie'
  | 'cafe-beit'
  | 'kibbutz-cafe'
  | 'hamalabiya'
  | 'boutique-central'
  | 'easy';
export type CoffeeCapsule =
  | 'vanille'
  | 'hazelnut'
  | 'blonde'
  | 'caramel'
  | 'guatemala';
export type CoffeeGlassColor = 'gray' | 'green' | 'black' | 'pink';
export type DeliveryType = 'now' | 'scheduled';
export type OrderStatus = 'open' | 'done';

// Who sees the barista board (/coffee-order/board) and may flip order status.
// Deliberately narrower than OWNER_EMAILS — the board belongs to whoever
// actually makes the coffee.
export const BARISTA_EMAILS: readonly string[] = ['levtomer66@gmail.com'];

export function isBaristaEmail(email: string | null | undefined): boolean {
  return !!email && BARISTA_EMAILS.includes(email.toLowerCase());
}

export interface CoffeeOption<T extends string> {
  id: T;
  label: string;
  emoji?: string;
}

// Labels are Hebrew (the page UI is Hebrew/RTL). `id`s stay English — they are
// the stored values and the validation keys; only the display label changes.
export const COFFEE_DRINKS: readonly CoffeeOption<CoffeeDrink>[] = [
  { id: 'espresso',    label: 'אספרסו',   emoji: '⚡' },
  { id: 'lungo',       label: 'לונגו',    emoji: '🫗' },
  { id: 'cappuccino',  label: 'קפוצ׳ינו', emoji: '☕' },
  { id: 'iced-coffee', label: 'קפה קר',   emoji: '🧊' },
];

export const COFFEE_MILKS: readonly CoffeeOption<CoffeeMilk>[] = [
  { id: 'none',         label: 'ללא'          },
  { id: 'regular',      label: 'רגיל'         },
  { id: 'soy',          label: 'סויה'         },
  { id: 'lactose-free', label: 'נטול לקטוז'   },
  { id: 'oat',          label: 'שיבולת שועל'  },
];

export const COFFEE_SUGARS: readonly CoffeeOption<CoffeeSugar>[] = [
  { id: 'none', label: 'ללא' },
  { id: '1',    label: '1'   },
  { id: '2',    label: '2'   },
  { id: '3',    label: '3'   },
];

// Where the coffee is ordered from. The default is Tomer's own machine; the
// rest are cafés. Docs written before this field existed have no `source` —
// readers fall back to DEFAULT_COFFEE_SOURCE (see resolveSource / pickConfig).
export const COFFEE_SOURCES: readonly CoffeeOption<CoffeeSource>[] = [
  { id: 'tomer-coffee',     label: 'הקפה של תומר' },
  { id: 'boulangerie',      label: 'בולונז׳רי'    },
  { id: 'cafe-beit',        label: 'קפה בית'      },
  { id: 'kibbutz-cafe',     label: 'קפה בקיבוץ'   },
  { id: 'hamalabiya',       label: 'המלביה'       },
  { id: 'boutique-central', label: 'בוטיק סנטרל'  },
  { id: 'easy',             label: 'איזי'         },
];

export const DEFAULT_COFFEE_SOURCE: CoffeeSource = 'tomer-coffee';

export const COFFEE_CAPSULES: readonly CoffeeOption<CoffeeCapsule>[] = [
  { id: 'vanille',   label: 'וניל'       },
  { id: 'hazelnut',  label: 'אגוזי לוז'  },
  { id: 'blonde',    label: 'בלונד'      },
  { id: 'caramel',   label: 'קרמל'       },
  { id: 'guatemala', label: 'גואטמלה'    },
];

export const DEFAULT_CAPSULE: CoffeeCapsule = 'vanille';

// Labels are feminine to agree with כוס ("כוס ירוקה").
export const GLASS_COLORS: readonly CoffeeOption<CoffeeGlassColor>[] = [
  { id: 'gray',  label: 'אפורה' },
  { id: 'green', label: 'ירוקה' },
  { id: 'black', label: 'שחורה' },
  { id: 'pink',  label: 'ורודה' },
];

export const DEFAULT_GLASS_COLOR: CoffeeGlassColor = 'gray';

export const MAX_PUMPS = 6;

// The shared drink-config subset — "an order minus identity and time". Both
// CoffeeOrder and CoffeeFavorite extend it so they stay in lockstep.
export interface CoffeeDrinkConfig {
  drink: CoffeeDrink;
  milk: CoffeeMilk;
  sugar: CoffeeSugar;
  source: CoffeeSource;
  capsule: CoffeeCapsule;
  glassColor: CoffeeGlassColor;
  vanillaPumps: number;
  caramelPumps: number;
  notes: string;
}

export interface CoffeeOrder extends CoffeeDrinkConfig {
  id: string;
  userEmail: string;
  userName: string;
  deliveryType: DeliveryType;
  scheduledAt?: string; // ISO 8601, present iff deliveryType === 'scheduled'
  status: OrderStatus;  // barista-controlled; docs predating the field read as 'open'
  createdAt: string;    // ISO 8601
}

export interface CoffeeFavorite extends CoffeeDrinkConfig {
  id: string;
  userEmail: string;
  name: string;
  createdAt: string;    // ISO 8601
}

export interface CreateCoffeeOrderDto extends CoffeeDrinkConfig {
  deliveryType: DeliveryType;
  scheduledAt?: string;
}

export interface CreateCoffeeFavoriteDto extends CoffeeDrinkConfig {
  name: string;
}

const DRINK_IDS = new Set<string>(COFFEE_DRINKS.map((d) => d.id));
const MILK_IDS = new Set<string>(COFFEE_MILKS.map((m) => m.id));
const SUGAR_IDS = new Set<string>(COFFEE_SUGARS.map((s) => s.id));
const SOURCE_IDS = new Set<string>(COFFEE_SOURCES.map((s) => s.id));
const CAPSULE_IDS = new Set<string>(COFFEE_CAPSULES.map((c) => c.id));
const GLASS_COLOR_IDS = new Set<string>(GLASS_COLORS.map((g) => g.id));

export function isValidDrink(v: unknown): v is CoffeeDrink {
  return typeof v === 'string' && DRINK_IDS.has(v);
}
export function isValidMilk(v: unknown): v is CoffeeMilk {
  return typeof v === 'string' && MILK_IDS.has(v);
}
export function isValidSugar(v: unknown): v is CoffeeSugar {
  return typeof v === 'string' && SUGAR_IDS.has(v);
}

// Missing source → default (payloads/docs that predate the field); a present
// but unknown value → null, which the API rejects with a 400.
export function resolveSource(v: unknown): CoffeeSource | null {
  if (v === undefined || v === null) return DEFAULT_COFFEE_SOURCE;
  return typeof v === 'string' && SOURCE_IDS.has(v) ? (v as CoffeeSource) : null;
}

// Same contract as resolveSource: missing → default, unknown → null → 400.
export function resolveCapsule(v: unknown): CoffeeCapsule | null {
  if (v === undefined || v === null) return DEFAULT_CAPSULE;
  return typeof v === 'string' && CAPSULE_IDS.has(v) ? (v as CoffeeCapsule) : null;
}

export function resolveGlassColor(v: unknown): CoffeeGlassColor | null {
  if (v === undefined || v === null) return DEFAULT_GLASS_COLOR;
  return typeof v === 'string' && GLASS_COLOR_IDS.has(v)
    ? (v as CoffeeGlassColor)
    : null;
}

// Clamp an arbitrary client value into an integer in [0, MAX_PUMPS].
export function clampPumps(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(MAX_PUMPS, Math.max(0, Math.round(n)));
}

export function drinkLabel(id: CoffeeDrink): string {
  return COFFEE_DRINKS.find((d) => d.id === id)?.label ?? id;
}
export function milkLabel(id: CoffeeMilk): string {
  return COFFEE_MILKS.find((m) => m.id === id)?.label ?? id;
}
export function sourceLabel(id: CoffeeSource): string {
  return COFFEE_SOURCES.find((s) => s.id === id)?.label ?? id;
}
export function capsuleLabel(id: CoffeeCapsule): string {
  return COFFEE_CAPSULES.find((c) => c.id === id)?.label ?? id;
}
export function glassColorLabel(id: CoffeeGlassColor): string {
  return GLASS_COLORS.find((g) => g.id === id)?.label ?? id;
}

// One-line Hebrew summary used in the ntfy push body, the post-submit recap,
// and the favorite/history cards, e.g.
//   "קפוצ׳ינו · חלב שיבולת שועל · כפית סוכר · וניל ×2"
export function drinkSummary(c: CoffeeDrinkConfig): string {
  const parts: string[] = [drinkLabel(c.drink)];
  parts.push(c.milk === 'none' ? 'ללא חלב' : `חלב ${milkLabel(c.milk)}`);
  if (c.sugar !== 'none') {
    parts.push(c.sugar === '1' ? 'כפית סוכר' : `${c.sugar} כפיות סוכר`);
  }
  if (c.vanillaPumps > 0) parts.push(`וניל ×${c.vanillaPumps}`);
  if (c.caramelPumps > 0) parts.push(`קרמל ×${c.caramelPumps}`);
  // Guards: docs saved before these fields existed carry no value — skip.
  if (c.capsule) parts.push(`קפסולת ${capsuleLabel(c.capsule)}`);
  if (c.glassColor) parts.push(`כוס ${glassColorLabel(c.glassColor)}`);
  if (c.source) parts.push(sourceLabel(c.source));
  return parts.join(' · ');
}

// The default config the form starts from.
export function defaultDrinkConfig(): CoffeeDrinkConfig {
  return {
    drink: 'cappuccino',
    milk: 'regular',
    sugar: 'none',
    source: DEFAULT_COFFEE_SOURCE,
    capsule: DEFAULT_CAPSULE,
    glassColor: DEFAULT_GLASS_COLOR,
    vanillaPumps: 0,
    caramelPumps: 0,
    notes: '',
  };
}
