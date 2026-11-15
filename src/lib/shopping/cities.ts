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
];

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
 * The city id a store belongs to, or null.
 * 1. A non-zero City code is authoritative (a store *named* "…באר שבע" with
 *    code 666 is in Omer).
 * 2. A Hebrew City value is matched against the aliases.
 * 3. Only when City is empty/0 do we fall back to the store name — never the
 *    address (a store at "תל אביב 11" is on a street in Haifa).
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
  return CITIES.find((c) => c.aliases.some((a) => hasWord(hay, a)))?.id ?? null;
}
