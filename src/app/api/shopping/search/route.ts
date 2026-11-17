import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { CITIES } from '@/lib/shopping/cities';
import { imgByOf, type SearchHit } from '@/lib/shopping/api-types';
import { priceSourceOf } from '@/lib/shopping/collections';
import { rankHits, searchPatterns } from '@/lib/shopping/search-rank';

/**
 * Regex path only (no Atlas Search): with no hit at all, try again allowing
 * one wrong or missing letter per word, over names only. The typo patterns
 * scan slowly (seconds on 54k items), so this stays a last resort; on Atlas
 * the fuzzy $search covers typos.
 */
const TYPO_RETRY_BELOW = 1;
import { findItems, getStoresFor, searchItemsAtlas } from '@/models/ShoppingCatalog';

const MAX_HITS = 30;

// GET ?q=<words or barcode>&city=<city id> — items whose name or maker matches every word, spelling-tolerant (see searchPatterns),
// best name match first (see rankHits), then the most widely sold, with the city's regular price range.
export async function GET(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'shopping');
  if (caller instanceof NextResponse) return caller;

  const q = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 80);
  const city = request.nextUrl.searchParams.get('city') ?? '';
  if (!CITIES.some((c) => c.id === city)) return NextResponse.json({ error: 'Unknown city' }, { status: 400 });
  const barcode = /^\d{8,14}$/.test(q) ? q : null;
  const terms = searchPatterns(q);
  let loose: string[] | undefined;
  if (!barcode && (!terms.length || q.length < 2)) return NextResponse.json([]);

  try {
    // Atlas Search first (fuzzy, so no retry pass); the regex search where
    // there is no Atlas Search (Docker) or for a barcode.
    const [atlas, stores] = await Promise.all([barcode ? null : searchItemsAtlas(q), getStoresFor(city)]);
    const found = atlas ?? (await findItems(terms, barcode));
    let docs = found;
    if (atlas) loose = searchPatterns(q, { typos: true }); // rank Atlas's fuzzy matches like typo matches
    if (!atlas && !barcode && docs.length < TYPO_RETRY_BELOW) {
      loose = searchPatterns(q, { typos: true });
      const more = await findItems(loose, null, { namesOnly: true });
      const seen = new Set(docs.map((d) => d._id));
      docs = [...docs, ...more.filter((d) => !seen.has(d._id))];
    }
    const local = stores.filter((s) => s.kind === 'physical').map((s) => ({
      k: String(s.k), src: s.source ?? priceSourceOf(s.chainId), chainName: s.chainName, name: s.name,
    }));
    const hits: (SearchHit & { aka?: string })[] = docs.map((d) => {
      const selling = local.filter((s) => d.p[s.k] !== undefined);
      const prices = selling.map((s) => d.p[s.k]);
      const sources = [...new Set(selling.map((s) => s.src))];
      const low = selling.reduce<(typeof selling)[number] | null>((b, s) => (!b || d.p[s.k] < d.p[b.k] ? s : b), null);
      return {
        key: d._id,
        name: d.n,
        manufacturer: d.m,
        w: d.w,
        minPrice: prices.length ? Math.min(...prices) : null,
        maxPrice: prices.length ? Math.max(...prices) : null,
        stores: prices.length,
        sources,
        cheapest: low ? { chainName: low.chainName, name: low.name } : null,
        img: d.img ?? null,
        imgBy: imgByOf(d),
        // Ranking only, not sent: other chains' names and makers.
        aka: (d as { s?: string }).s,
      };
    });
    const ranked: SearchHit[] = rankHits(hits, terms, loose).slice(0, MAX_HITS).map((h) => {
      const { aka, ...hit } = h;
      void aka; // ranking only
      return hit;
    });
    return NextResponse.json(ranked);
  } catch (error) {
    console.error('Error searching shopping items:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
