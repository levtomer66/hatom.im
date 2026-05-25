// Extract latitude/longitude from a Google Maps share URL. When a review
// was added with a mapsUrl, that link is the most authoritative source
// of coordinates we have — the human already disambiguated the cafe by
// hand. Cheaper and 100 % accurate vs round-tripping the name through a
// geocoder.
//
// Handles the URL shapes Google currently emits:
//   • /maps/place/<name>/@LAT,LNG,Zz/data=… (most common share form)
//   • ?ll=LAT,LNG                            (legacy mobile/share)
//   • ?q=LAT,LNG  or  ?query=LAT,LNG         (search-API style)
//   • ?destination=LAT,LNG                   (directions deep link)
//   • !3dLAT!4dLNG                           (data-param coords)
//
// Short URLs (goo.gl/maps/…, maps.app.goo.gl/…) get one redirect follow
// before the same regex pass — Google encodes the coords in the resolved
// target URL.

const COORD_PATTERNS: RegExp[] = [
  /@(-?\d+\.\d+),(-?\d+\.\d+),\d+(?:\.\d+)?z/,
  /[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/,
  /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
  /[?&]query=(-?\d+\.\d+)(?:%2C|,)(-?\d+\.\d+)/i,
  /[?&]destination=(-?\d+\.\d+),(-?\d+\.\d+)/,
  /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
];

function tryExtract(url: string): { latitude: number; longitude: number } | null {
  for (const pat of COORD_PATTERNS) {
    const m = pat.exec(url);
    if (!m) continue;
    const latitude = parseFloat(m[1]);
    const longitude = parseFloat(m[2]);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude };
    }
  }
  return null;
}

const SHORT_HOST = /^https?:\/\/(?:goo\.gl\/maps|maps\.app\.goo\.gl)\//i;

export async function coordsFromMapsUrl(
  url: string | null | undefined,
): Promise<{ latitude: number; longitude: number } | null> {
  if (!url) return null;
  const direct = tryExtract(url);
  if (direct) return direct;

  if (!SHORT_HOST.test(url)) return null;

  // Follow the redirect once. Setting redirect: 'manual' lets us read the
  // Location header without auto-following further hops. Some short URLs
  // need a real GET (the server doesn't respond to HEAD), so we use that.
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { redirect: 'follow', signal: controller.signal });
    clearTimeout(timer);
    // res.url reflects the final URL after redirects.
    return tryExtract(res.url);
  } catch {
    return null;
  }
}
