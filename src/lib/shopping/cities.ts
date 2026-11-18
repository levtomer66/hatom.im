// Target cities and the rules for deciding which city a store is in.
// See docs/sources.md § City matching for the false positives these rules
// exist to avoid. Import-free.

export interface CityConfig {
  id: string;
  name: string; // display name (Hebrew)
  /** CBS settlement codes (the official City value). */
  codes: string[];
  /** Spellings seen in City fields and store names, matched as whole words. */
  aliases: string[];
}

export const CITIES: CityConfig[] = [
  {
    id: 'tel-aviv',
    name: 'תל אביב-יפו',
    codes: ['5000'],
    aliases: ['תל אביב', 'תל-אביב', 'תל אביב יפו', 'תל אביב-יפו', 'ת"א', 'ת.א', 'יפו', 'tel aviv'],
  },
  {
    id: 'ramat-gan',
    name: 'רמת גן',
    codes: ['8600'],
    aliases: ['רמת גן', 'רמת-גן', 'ר"ג', 'ramat gan'],
  },
  {
    id: 'beer-sheva',
    name: 'באר שבע',
    codes: ['9000'],
    aliases: ['באר שבע', 'באר-שבע', 'ב"ש', 'beer sheva', "be'er sheva"],
  },
  {
    // No pin there: only the stores the owner picked by hand (Hazi Hinam מרכבה, 2026-11-18).
    id: 'holon',
    name: 'חולון',
    codes: ['6600'],
    aliases: ['חולון', 'holon'],
  },
  {
    // No pin there: the Beit HaKerem and Talpiot stores are picked by hand (2026-11-18).
    id: 'jerusalem',
    name: 'ירושלים',
    codes: ['3000'],
    aliases: ['ירושלים', 'י-ם', 'י"ם', 'jerusalem'],
  },
  {
    id: 'mevaseret-zion',
    name: 'מבשרת ציון',
    codes: ['1015'],
    aliases: ['מבשרת ציון', 'מבשרת', 'mevaseret'],
  },
];

/** Whether an id names a target city (the owner's files carry city ids typed by hand). */
export const isTargetCity = (id: string | null | undefined): boolean => CITIES.some((c) => c.id === id);

/** Store names that are bookkeeping/test entries, not shops. */
const NOT_A_STORE = /(איפוס|ספירות מלאי|test venue|\bטסט\b|בדיקה)/i;

const normalize = (s: string) =>
  ` ${s
    .toLowerCase()
    .replace(/[״]/g, '"')
    .replace(/[׳]/g, "'")
    .replace(/[-–,()|/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `;

const hasWord = (hay: string, alias: string) => hay.includes(normalize(alias));

/**
 * A city name followed by a house number is a street ("ראשל"צ ירושלים 120"
 * is on ירושלים street in Rishon LeZion), so a store name doesn't count it.
 */
const hasCityWord = (hay: string, alias: string) => {
  const a = normalize(alias);
  for (let i = hay.indexOf(a); i !== -1; i = hay.indexOf(a, i + 1)) {
    if (!/^\d/.test(hay.slice(i + a.length))) return true;
  }
  return false;
};

/**
 * The city id a store belongs to, or null.
 * 1. A non-zero City code is authoritative (a store *named* "…באר שבע" with
 *    code 666 is in Omer).
 * 2. A Hebrew City value is matched against the aliases.
 * 3. Only when City is empty/0 do we fall back to the store name — never the
 *    address (a store at "תל אביב 11" is on a street in Haifa) — and a city
 *    name followed by a number there is a street too.
 */
export function cityOf(store: { city: string; name: string }): string | null {
  const city = store.city.trim();
  if (NOT_A_STORE.test(store.name)) return null;
  if (/^\d+$/.test(city) && city !== '0') {
    return CITIES.find((c) => c.codes.includes(city))?.id ?? null;
  }
  if (city && city !== '0' && city.toLowerCase() !== 'unknown') {
    const hay = normalize(city);
    return CITIES.find((c) => c.aliases.some((a) => hasWord(hay, a)))?.id ?? null;
  }
  const hay = normalize(store.name);
  return CITIES.find((c) => c.aliases.some((a) => hasCityWord(hay, a)))?.id ?? null;
}
