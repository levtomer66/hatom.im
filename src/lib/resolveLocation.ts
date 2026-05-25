// Multi-strategy location resolver for /mekafkefim reviews.
//
//   1. If the review has a mapsUrl, extract the coords from it. The
//      human already disambiguated the cafe when they pasted the share
//      link, so this is the most authoritative source we have.
//   2. Otherwise, fall back to Israel-biased Nominatim on the placeName.
//   3. Otherwise, return null and the review stays pinless on the map.

import { coordsFromMapsUrl } from './coordsFromMapsUrl';
import { forwardGeocode } from './forwardGeocode';

export interface ResolvedLocation {
  latitude: number;
  longitude: number;
  locationLabel?: string;
  // Diagnostic — useful for logging and the backfill script's progress.
  source: 'mapsUrl' | 'nominatim';
}

export async function resolveLocation(opts: {
  placeName?: string;
  mapsUrl?: string;
}): Promise<ResolvedLocation | null> {
  const fromUrl = await coordsFromMapsUrl(opts.mapsUrl);
  if (fromUrl) {
    return {
      latitude: fromUrl.latitude,
      longitude: fromUrl.longitude,
      // No automatic label when we extract from the URL — placeName is
      // already shown prominently in the popup, so leaving the
      // secondary "locationLabel" line empty is fine.
      locationLabel: undefined,
      source: 'mapsUrl',
    };
  }

  if (opts.placeName) {
    const fromName = await forwardGeocode(opts.placeName);
    if (fromName) {
      return {
        latitude: fromName.latitude,
        longitude: fromName.longitude,
        locationLabel: fromName.label,
        source: 'nominatim',
      };
    }
  }

  return null;
}
