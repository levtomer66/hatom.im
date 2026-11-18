// The caller's near set inputs (near.ts) for one request: the live location
// they sent, else the household's home spot, and the household's favorites.
// Server-only (reads the household). Shared by the routes and MCP tools.

import { parseCentre, parseRadius, resolveWhere, type Near } from '@/lib/shopping/near';
import { householdFor } from '@/models/ShoppingHome';

/** A string is the 400 error (only one of lat/lng, or not a coordinate). */
export async function nearFor(email: string, given: { lat?: unknown; lng?: unknown; r?: unknown }): Promise<Near | string> {
  const live = parseCentre(given.lat, given.lng);
  if (typeof live === 'string') return live;
  const home = await householdFor(email);
  return { where: resolveWhere(live, home.homeSpot, parseRadius(given.r)), favs: home.favStores };
}
