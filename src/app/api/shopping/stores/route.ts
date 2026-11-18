import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { CITIES } from '@/lib/shopping/cities';
import { storeMatches, storeQueryWords } from '@/lib/shopping/here';
import { israelLocalNow, type StoreDoc } from '@/lib/shopping/snapshot';
import { storeInfo, type HereStore, type StoresResponse } from '@/lib/shopping/api-types';
import { getPricedStores, getStoresByKeys, storeLoc } from '@/models/ShoppingCatalog';
import { householdFor } from '@/models/ShoppingHome';

/** Search results returned at most. */
const MAX_RESULTS = 30;

const cityName = (s: StoreDoc) => CITIES.find((c) => c.id === s.city)?.name ?? (s.kind === 'online' ? 'אונליין' : '');
const hereStore = (s: StoreDoc): HereStore => ({ ...storeInfo(s), loc: storeLoc(s), priced: true });

// GET ?q=<text> — every priced store, in any city, whose chain, branch, city
// or address has every word of q (2+ letters each; shorter queries return
// nothing, not every store). Without q: the household's favorites, in the
// order starred. The page sorts by distance on the device.
export async function GET(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'shopping');
  if (caller instanceof NextResponse) return caller;
  const q = request.nextUrl.searchParams.get('q');
  try {
    let stores: StoreDoc[];
    if (q === null) stores = await getStoresByKeys((await householdFor(caller.userEmail)).favStores);
    else if (!storeQueryWords(q).length) stores = [];
    else {
      stores = (await getPricedStores())
        .filter((s) => storeMatches(q, { chainName: s.chainName, name: s.name, address: s.address, cityName: cityName(s) }))
        .slice(0, MAX_RESULTS);
    }
    const res: StoresResponse = { now: israelLocalNow(), stores: stores.map(hereStore) };
    return NextResponse.json(res);
  } catch (error) {
    console.error('Error searching stores:', error);
    return NextResponse.json({ error: 'Failed to search stores' }, { status: 500 });
  }
}
