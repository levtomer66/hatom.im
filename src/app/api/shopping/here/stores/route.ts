import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { PICKER_RADIUS_KM } from '@/lib/shopping/near';
import { nearFor } from '@/lib/shopping/near-server';
import { israelLocalNow } from '@/lib/shopping/snapshot';
import { storeInfo, type HereStoresResponse } from '@/lib/shopping/api-types';
import { getStoresNear, storeLoc } from '@/models/ShoppingCatalog';
import { getStoresWithManualPrices } from '@/models/ShoppingManualPrice';

// GET ?lat&lng — the "אני בסופר" picker: physical stores within
// PICKER_RADIUS_KM of you (else the household's home spot), plus ★, each with
// its location when known. The page sorts them by distance on the device.
// lat/lng are used for this request only, never stored.
export async function GET(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'shopping');
  if (caller instanceof NextResponse) return caller;
  const sp = request.nextUrl.searchParams;
  try {
    const near = await nearFor(caller.userEmail, { lat: sp.get('lat'), lng: sp.get('lng'), r: PICKER_RADIUS_KM });
    if (typeof near === 'string') return NextResponse.json({ error: near }, { status: 400 });
    const stores = (await getStoresNear(near.where, near.favs)).filter((s) => s.kind === 'physical');
    const typed = await getStoresWithManualPrices(stores.filter((s) => s.source === 'manual').map((s) => s.k));
    const res: HereStoresResponse = {
      now: israelLocalNow(),
      stores: stores.map((s) => ({ ...storeInfo(s), loc: storeLoc(s), priced: s.pricesAt !== null || typed.has(s.k) })),
    };
    return NextResponse.json(res);
  } catch (error) {
    console.error('Error listing stores for "here":', error);
    return NextResponse.json({ error: 'Failed to list stores' }, { status: 500 });
  }
}
