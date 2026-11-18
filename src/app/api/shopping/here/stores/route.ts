import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { CITIES } from '@/lib/shopping/cities';
import { israelLocalNow } from '@/lib/shopping/snapshot';
import { storeInfo, type HereStoresResponse } from '@/lib/shopping/api-types';
import { getStoresFor, storeLoc } from '@/models/ShoppingCatalog';
import { getStoresWithManualPrices } from '@/models/ShoppingManualPrice';

// GET ?city=<city id> — the city's physical stores for the "אני בסופר"
// picker, each with its location when known. The page sorts them by distance
// on the device: the user's position never comes here.
export async function GET(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'shopping');
  if (caller instanceof NextResponse) return caller;
  const city = request.nextUrl.searchParams.get('city') ?? '';
  if (!CITIES.some((c) => c.id === city)) return NextResponse.json({ error: 'Unknown city' }, { status: 400 });
  try {
    const stores = (await getStoresFor(city)).filter((s) => s.kind === 'physical' && s.city === city);
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
