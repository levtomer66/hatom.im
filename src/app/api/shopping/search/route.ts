import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { CITIES } from '@/lib/shopping/cities';
import { searchTerms } from '@/lib/shopping/lists';
import type { SearchHit } from '@/lib/shopping/api-types';
import { priceSourceOf } from '@/lib/shopping/collections';
import { rankHits } from '@/lib/shopping/search-rank';
import { findItems, getStoresFor } from '@/models/ShoppingCatalog';

const MAX_HITS = 30;

// GET ?q=<words or barcode>&city=<city id> — items matching every word,
// best name match first (see rankHits), then the most widely sold, with the city's regular price range.
export async function GET(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'shopping');
  if (caller instanceof NextResponse) return caller;

  const q = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 80);
  const city = request.nextUrl.searchParams.get('city') ?? '';
  if (!CITIES.some((c) => c.id === city)) return NextResponse.json({ error: 'Unknown city' }, { status: 400 });
  const barcode = /^\d{8,14}$/.test(q) ? q : null;
  const terms = searchTerms(q);
  if (!barcode && (!terms.length || q.length < 2)) return NextResponse.json([]);

  try {
    const [docs, stores] = await Promise.all([findItems(terms, barcode), getStoresFor(city)]);
    const local = stores.filter((s) => s.kind === 'physical').map((s) => ({ k: String(s.k), src: s.source ?? priceSourceOf(s.chainId) }));
    const hits: SearchHit[] = docs.map((d) => {
      const selling = local.filter((s) => d.p[s.k] !== undefined);
      const prices = selling.map((s) => d.p[s.k]);
      const sources = [...new Set(selling.map((s) => s.src))];
      return {
        key: d._id,
        name: d.n,
        manufacturer: d.m,
        w: d.w,
        minPrice: prices.length ? Math.min(...prices) : null,
        maxPrice: prices.length ? Math.max(...prices) : null,
        stores: prices.length,
        sources,
        img: d.img ?? null,
      };
    });
    return NextResponse.json(rankHits(hits, terms).slice(0, MAX_HITS));
  } catch (error) {
    console.error('Error searching shopping items:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
