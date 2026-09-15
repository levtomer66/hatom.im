// Domain types + category registry + scoring for the /mekafkefim coffee
// journal. Mirrors src/types/coffee-order.ts: string-literal union, an option
// array the UI maps over, and a resolve* helper the API uses so a stale or
// malicious client can't smuggle bad values into Mongo.
//
// This file must stay import-free: src/lib/__tests__/coffee-score.test.ts
// imports it relatively for `node --test`, whose type-stripping can't resolve
// the `@/…` path alias.

export type CoffeeCategory =
  | 'coffee' | 'food' | 'pastry' | 'atmosphere';

// The scored numeric rating fields, split out of CoffeeReview so the category
// registry can type its field pointers as `keyof` rather than `string`. Price
// used to be a scored category too (tom/tomerPriceRating); it's now a single
// descriptive place-level `priceLevel` on CoffeeReview, out of the score.
export interface CoffeeReviewRatings {
  tomCoffeeRating: number;
  tomFoodRating: number;
  tomAtmosphereRating: number;
  tomerCoffeeRating: number;
  tomerFoodRating: number;
  tomerAtmosphereRating: number;
  tomPastryRating: number;
  tomerPastryRating: number;
}

export interface TriedItem {
  name: string;
  priceIls?: number;
}

// Index 0 = Sunday … 6 = Saturday. null = closed that day.
export type DayHours = { open: string; close: string } | null;
export type OpeningHours = DayHours[];

export interface CoffeeCategoryDef {
  id: CoffeeCategory;
  label: string; // Hebrew — the page UI is Hebrew/RTL. ids stay English.
  tomField: keyof CoffeeReviewRatings;
  tomerField: keyof CoffeeReviewRatings;
}

// The single source of truth for what gets rated. Both forms and the review
// card map over this instead of hand-writing four near-identical blocks.
export const COFFEE_CATEGORIES: readonly CoffeeCategoryDef[] = [
  { id: 'coffee',     label: 'קפה',    tomField: 'tomCoffeeRating',     tomerField: 'tomerCoffeeRating'     },
  { id: 'food',       label: 'אוכל',   tomField: 'tomFoodRating',       tomerField: 'tomerFoodRating'       },
  { id: 'pastry',     label: 'מאפים',  tomField: 'tomPastryRating',     tomerField: 'tomerPastryRating'     },
  { id: 'atmosphere', label: 'אווירה', tomField: 'tomAtmosphereRating', tomerField: 'tomerAtmosphereRating' },
];

// Descriptive place-level price rating (not scored, not per-reviewer). A
// non-numeric slider maps over PRICE_LEVELS, so the array order IS the slider
// order — most-expensive → cheapest, matching how the labels read. Same
// registry+resolver shape as COFFEE_TAGS/COFFEE_AREAS.
export type PriceLevel =
  | 'very-expensive' | 'expensive' | 'standard' | 'cheap' | 'very-cheap';

export interface PriceLevelDef { id: PriceLevel; label: string }

export const PRICE_LEVELS: readonly PriceLevelDef[] = [
  { id: 'very-expensive', label: 'יקר ממש' },
  { id: 'expensive',      label: 'יקר' },
  { id: 'standard',       label: 'סטנדרטי' },
  { id: 'cheap',          label: 'זול' },
  { id: 'very-cheap',     label: 'זול ממש' },
];

const PRICE_LEVEL_ID_SET = new Set<string>(PRICE_LEVELS.map((l) => l.id));

// undefined/null/'' → undefined ("not specified"); a valid id → itself;
// anything else → null, which the API turns into a 400. The tri-state lets the
// route tell "field omitted" from "field present but invalid".
export function resolvePriceLevel(v: unknown): PriceLevel | null | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'string' && PRICE_LEVEL_ID_SET.has(v)) return v as PriceLevel;
  return null;
}

// Cheapness rank for sorting: cheaper → smaller, so ascending = cheapest first.
// unset → null (blanks sort last, like every other metric). very-cheap → 1 …
// very-expensive → 5.
export function priceLevelRank(id: PriceLevel | undefined): number | null {
  if (!id) return null;
  const idx = PRICE_LEVELS.findIndex((l) => l.id === id); // 0 = most expensive
  if (idx < 0) return null;
  return PRICE_LEVELS.length - idx;
}

export function priceLevelLabel(id: PriceLevel | undefined): string | null {
  if (!id) return null;
  return PRICE_LEVELS.find((l) => l.id === id)?.label ?? null;
}

export interface CoffeeReview extends CoffeeReviewRatings {
  id: string;
  placeName: string;
  // Categories this place doesn't have at all (a café with no kitchen).
  // Absent on every document written before this field existed, and absent
  // reads as [] — nothing disabled, i.e. the historic behaviour.
  disabledCategories?: CoffeeCategory[];
  // Descriptive place-level price rating; absent = not specified. Replaced the
  // old per-reviewer, scored `price` category.
  priceLevel?: PriceLevel;
  photoUrl?: string;
  mapsUrl?: string;
  instagramUrl?: string;
  coffeePriceIls?: number;
  coffeeDrinkLabel?: string;
  triedItems?: TriedItem[];
  tomNotes?: string;
  tomerNotes?: string;
  tags?: string[];
  area?: string;
  lat?: number;
  lng?: number;
  openingHours?: OpeningHours;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCoffeeReviewDto extends CoffeeReviewRatings {
  placeName: string;
  disabledCategories?: CoffeeCategory[];
  // null = the edit form explicitly cleared it (JSON keeps the key, so the
  // PATCH route can $unset). undefined/absent = leave unset / untouched.
  priceLevel?: PriceLevel | null;
  photoUrl?: string;
  mapsUrl?: string;
  instagramUrl?: string;
  coffeePriceIls?: number;
  coffeeDrinkLabel?: string;
  triedItems?: TriedItem[];
  tomNotes?: string;
  tomerNotes?: string;
  tags?: string[];
  area?: string;
  lat?: number;
  lng?: number;
  openingHours?: OpeningHours;
}

export interface CoffeeTagDef { id: string; label: string; emoji: string }

export const COFFEE_TAGS: readonly CoffeeTagDef[] = [
  { id: 'work',     label: 'ידידותי לעבודה',   emoji: '💻' },
  { id: 'outdoor',  label: 'ישיבה בחוץ',        emoji: '🌳' },
  { id: 'dogs',     label: 'ידידותי לכלבים',    emoji: '🐕' },
  { id: 'brunch',   label: 'בראנץ׳',            emoji: '🥑' },
  { id: 'vegan',    label: 'אופציות טבעוניות',  emoji: '🌱' },
  { id: 'takeaway', label: 'טייק-אווי',         emoji: '🥡' },
  { id: 'quiet',    label: 'שקט/רגוע',          emoji: '🤫' },
  { id: 'groups',   label: 'מתאים לקבוצות',     emoji: '👥' },
  { id: 'ac',       label: 'מיזוג',             emoji: '❄️' },
  { id: 'bitter',   label: 'קפה מר',            emoji: '😖' },
];

const TAG_IDS = new Set<string>(COFFEE_TAGS.map((t) => t.id));

export function resolveTags(v: unknown): string[] | null {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) return null;
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== 'string' || !TAG_IDS.has(item)) return null;
    if (!out.includes(item)) out.push(item);
  }
  return out;
}

export const COFFEE_AREAS: readonly string[] = [
  'פלורנטין', 'נווה צדק', 'לב העיר/מרכז', 'הצפון הישן', 'הצפון החדש',
  'כרם התימנים', 'רוטשילד', 'שפירא', 'באזל', 'יפו', 'אחר',
];

const AREA_SET = new Set<string>(COFFEE_AREAS);
export function isValidArea(v: unknown): boolean {
  return typeof v === 'string' && AREA_SET.has(v);
}

// ₪ thresholds for a standard coffee, tuned to Tel Aviv. Tweak here only.
export function priceTier(ils?: number): 0 | 1 | 2 | 3 {
  if (ils === undefined || ils === null || !(ils > 0)) return 0;
  if (ils <= 15) return 1;
  if (ils <= 20) return 2;
  return 3;
}

const CATEGORY_IDS = new Set<string>(COFFEE_CATEGORIES.map((c) => c.id));

// Missing/null → [] (payloads and documents that predate the field); a valid
// array → itself, de-duplicated; anything else → null, which the API turns
// into a 400. Same contract as resolveSource/resolveCapsule in coffee-order.ts.
export function resolveDisabledCategories(v: unknown): CoffeeCategory[] | null {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) return null;

  const out: CoffeeCategory[] = [];
  for (const item of v) {
    if (typeof item !== 'string' || !CATEGORY_IDS.has(item)) return null;
    const id = item as CoffeeCategory;
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

// ─── Scoring ────────────────────────────────────────────────────────────────
// One implementation, used by the API sort, the list page and the card. Before
// this existed there were three that disagreed with each other.

export type ScorableReview = Partial<CoffeeReviewRatings> & {
  disabledCategories?: CoffeeCategory[];
};

export interface CategoryScore {
  id: CoffeeCategory;
  label: string;
  tom: number;       // 0 when not rated
  tomer: number;     // 0 when not rated
  combined: number;  // 0 when neither reviewer rated it
  disabled: boolean;
}

export interface ReviewScores {
  // Always all four, in COFFEE_CATEGORIES order, so the card can render a
  // disabled ring in its grid position instead of reflowing.
  categories: CategoryScore[];
  tom: number;
  tomer: number;
  combined: number;
}

// Mean of the values that count. `0` means "not rated" and never counts — the
// rule the page and the card each implemented separately as `nonZeroAvg`.
// Returns 0, not NaN, when nothing counts.
function meanOfRated(values: number[]): number {
  const rated = values.filter((v) => v > 0);
  return rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : 0;
}

export function scoreReview(review: ScorableReview): ReviewScores {
  const disabled = review.disabledCategories ?? [];

  const categories: CategoryScore[] = COFFEE_CATEGORIES.map((def) => {
    const isDisabled = disabled.includes(def.id);
    const tom = isDisabled ? 0 : review[def.tomField] ?? 0;
    const tomer = isDisabled ? 0 : review[def.tomerField] ?? 0;
    return {
      id: def.id,
      label: def.label,
      tom,
      tomer,
      combined: meanOfRated([tom, tomer]),
      disabled: isDisabled,
    };
  });

  const active = categories.filter((c) => !c.disabled);
  const tom = meanOfRated(active.map((c) => c.tom));
  const tomer = meanOfRated(active.map((c) => c.tomer));

  // Mean of the two reviewer averages — unchanged from the pre-existing
  // formula. Exclusion is per-place, so it hits both reviewers symmetrically
  // and no existing score shifts.
  return { categories, tom, tomer, combined: meanOfRated([tom, tomer]) };
}

export function reviewerGap(review: ScorableReview): number {
  const s = scoreReview(review);
  if (s.tom <= 0 || s.tomer <= 0) return 0;
  return Math.abs(s.tom - s.tomer);
}

export function isOpenNow(hours: OpeningHours | undefined, at: Date = new Date()): boolean {
  if (!Array.isArray(hours) || hours.length !== 7) return false;
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = fmt.formatToParts(at);
  const wk = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const hh = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const mm = parts.find((p) => p.type === 'minute')?.value ?? '00';
  const dayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wk);
  if (dayIndex < 0) return false;
  const entry = hours[dayIndex];
  if (!entry) return false;
  const now = `${hh}:${mm}`;
  return entry.open <= now && now < entry.close; // zero-padded HH:MM compares lexically
}

// ─── Sort + filter ──────────────────────────────────────────────────────────

export type SortMetric =
  | 'coffee' | 'overall' | 'food' | 'pastry' | 'atmosphere' | 'value'
  | 'coffeePrice' | 'date' | 'name';
export type SortPerspective = 'combined' | 'tom' | 'tomer';
export interface SortSpec { metric: SortMetric; perspective: SortPerspective; dir: 'asc' | 'desc' }
export interface CoffeeFilters {
  q?: string; areas?: string[]; tags?: string[]; tiers?: (1|2|3)[];
  minCoffee?: number; hasPhoto?: boolean; hideUnrated?: boolean; openNow?: boolean;
}

function metricValue(r: CoffeeReview, m: SortMetric, p: SortPerspective): number | null {
  if (m === 'coffeePrice') return typeof r.coffeePriceIls === 'number' && r.coffeePriceIls > 0 ? r.coffeePriceIls : null;
  // 'value' now sorts by the descriptive price level (cheapest first when asc),
  // not a scored category. Place-level, so perspective doesn't apply.
  if (m === 'value') return priceLevelRank(r.priceLevel);
  if (m === 'date') return new Date(r.createdAt).getTime();
  if (m === 'name') return null; // handled by caller (string compare)
  const s = scoreReview(r);
  const pick = (v: { tom: number; tomer: number; combined: number }) =>
    p === 'tom' ? v.tom : p === 'tomer' ? v.tomer : v.combined;
  let v: number;
  if (m === 'overall') v = pick(s);
  else {
    const cat = s.categories.find((c) => c.id === (m as CoffeeCategory))!;
    v = pick(cat);
  }
  return v > 0 ? v : null;
}

export function sortReviews<T extends CoffeeReview>(reviews: T[], spec: SortSpec): T[] {
  const { metric, perspective, dir } = spec;
  const sign = dir === 'asc' ? 1 : -1;
  return [...reviews].sort((a, b) => {
    if (metric === 'name') return a.placeName.localeCompare(b.placeName, 'he') * sign;
    const av = metricValue(a, metric, perspective);
    const bv = metricValue(b, metric, perspective);
    if (av === null && bv === null) return 0;
    if (av === null) return 1;   // blanks always last
    if (bv === null) return -1;
    return (av - bv) * sign;
  });
}

// A forgiving name match for the search box: the query's characters must appear
// in order somewhere in the text (a subsequence), so "בוקר" matches "קפה בוקר"
// and a dropped letter still hits. Case-insensitive; whitespace in the query is
// ignored so "cafe boker" and "cafeboker" behave the same.
export function fuzzyMatch(text: string, query: string): boolean {
  const t = text.toLowerCase();
  const q = query.toLowerCase().replace(/\s+/g, '');
  if (!q) return true;
  let i = 0;
  for (let k = 0; k < t.length && i < q.length; k++) {
    if (t[k] === q[i]) i++;
  }
  return i === q.length;
}

export function filterReviews<T extends CoffeeReview>(reviews: T[], f: CoffeeFilters, at: Date = new Date()): T[] {
  const q = f.q?.trim();
  return reviews.filter((r) => {
    if (q && !fuzzyMatch(r.placeName, q)) return false;
    if (f.areas?.length && !(r.area && f.areas.includes(r.area))) return false;
    if (f.tags?.length && !f.tags.every((t) => r.tags?.includes(t))) return false;
    if (f.tiers?.length && !f.tiers.includes(priceTier(r.coffeePriceIls) as 1|2|3)) return false;
    if (typeof f.minCoffee === 'number') {
      const c = scoreReview(r).categories.find((x) => x.id === 'coffee')!.combined;
      if (!(c >= f.minCoffee)) return false;
    }
    if (f.hasPhoto && !r.photoUrl) return false;
    if (f.hideUnrated && scoreReview(r).combined <= 0) return false;
    if (f.openNow && !isOpenNow(r.openingHours, at)) return false;
    return true;
  });
}

// ─── Controls (URL/localStorage (de)serialization) + stats ─────────────────

export interface CoffeeControls {
  sort: SortSpec;
  filters: CoffeeFilters;
}

export const DEFAULT_CONTROLS: CoffeeControls = {
  sort: { metric: 'coffee', perspective: 'combined', dir: 'desc' },
  filters: {},
};

const SORT_METRICS = new Set<string>([
  'coffee', 'overall', 'food', 'pastry', 'atmosphere', 'value',
  'coffeePrice', 'date', 'name',
]);
const SORT_PERSPECTIVES = new Set<string>(['combined', 'tom', 'tomer']);

export function serializeControls(c: CoffeeControls): string {
  const params = new URLSearchParams();
  const { sort, filters } = c;

  if (sort.metric !== DEFAULT_CONTROLS.sort.metric) params.set('sort', sort.metric);
  if (sort.perspective !== DEFAULT_CONTROLS.sort.perspective) params.set('persp', sort.perspective);
  if (sort.dir !== DEFAULT_CONTROLS.sort.dir) params.set('dir', sort.dir);

  if (filters.q) params.set('q', filters.q);
  if (filters.areas?.length) params.set('areas', filters.areas.join(','));
  if (filters.tags?.length) params.set('tags', filters.tags.join(','));
  if (filters.tiers?.length) params.set('tiers', filters.tiers.join(','));
  if (typeof filters.minCoffee === 'number') params.set('minCoffee', String(filters.minCoffee));
  if (filters.hasPhoto) params.set('photo', '1');
  if (filters.hideUnrated) params.set('hideUnrated', '1');
  if (filters.openNow) params.set('open', '1');

  return params.toString();
}

export function parseControls(query: string): CoffeeControls {
  const params = new URLSearchParams(query);

  const metric = params.get('sort');
  const perspective = params.get('persp');
  const dir = params.get('dir');

  const sort: SortSpec = {
    metric: metric && SORT_METRICS.has(metric) ? (metric as SortMetric) : DEFAULT_CONTROLS.sort.metric,
    perspective: perspective && SORT_PERSPECTIVES.has(perspective)
      ? (perspective as SortPerspective)
      : DEFAULT_CONTROLS.sort.perspective,
    dir: dir === 'asc' || dir === 'desc' ? dir : DEFAULT_CONTROLS.sort.dir,
  };

  const filters: CoffeeFilters = {};
  const q = params.get('q');
  if (q) filters.q = q;

  const areas = params.get('areas');
  if (areas) filters.areas = areas.split(',').filter(Boolean);

  const tags = params.get('tags');
  if (tags) filters.tags = tags.split(',').filter(Boolean);

  const tiers = params.get('tiers');
  if (tiers) {
    const parsed = tiers.split(',')
      .map((s) => Number(s))
      .filter((n): n is 1 | 2 | 3 => n === 1 || n === 2 || n === 3);
    if (parsed.length) filters.tiers = parsed;
  }

  const minCoffee = params.get('minCoffee');
  if (minCoffee !== null && minCoffee !== '' && !Number.isNaN(Number(minCoffee))) {
    filters.minCoffee = Number(minCoffee);
  }

  if (params.get('photo') === '1') filters.hasPhoto = true;
  if (params.get('hideUnrated') === '1') filters.hideUnrated = true;
  if (params.get('open') === '1') filters.openNow = true;

  return { sort, filters };
}

export function computeStats(reviews: CoffeeReview[]): {
  count: number;
  kingOfCoffee?: { name: string; score: number };
  cheapest?: { name: string; price: number };
  mostControversial?: { name: string; gap: number };
  avgPrice?: number;
} {
  let kingOfCoffee: { name: string; score: number } | undefined;
  let cheapest: { name: string; price: number } | undefined;
  let mostControversial: { name: string; gap: number } | undefined;
  let priceSum = 0;
  let priceCount = 0;

  for (const r of reviews) {
    const s = scoreReview(r);

    const coffee = s.categories.find((c) => c.id === 'coffee')!.combined;
    if (coffee > 0 && (!kingOfCoffee || coffee > kingOfCoffee.score)) {
      kingOfCoffee = { name: r.placeName, score: coffee };
    }

    if (typeof r.coffeePriceIls === 'number' && r.coffeePriceIls > 0) {
      priceSum += r.coffeePriceIls;
      priceCount += 1;
      if (!cheapest || r.coffeePriceIls < cheapest.price) {
        cheapest = { name: r.placeName, price: r.coffeePriceIls };
      }
    }

    const gap = reviewerGap(r);
    if (gap > 0 && (!mostControversial || gap > mostControversial.gap)) {
      mostControversial = { name: r.placeName, gap };
    }
  }

  return {
    count: reviews.length,
    kingOfCoffee,
    cheapest,
    mostControversial,
    avgPrice: priceCount ? Math.round(priceSum / priceCount) : undefined,
  };
}

export function resolveTriedItems(v: unknown): TriedItem[] | null {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.length > 20) return null;
  const out: TriedItem[] = [];
  for (const raw of v) {
    if (typeof raw !== 'object' || raw === null) return null;
    const obj = raw as Record<string, unknown>;
    const name = typeof obj.name === 'string' ? obj.name.trim() : null;
    if (name === null || name.length > 60) return null;
    if (name === '') continue; // drop blank rows
    const price = obj.priceIls;
    if (price !== undefined) {
      if (typeof price !== 'number' || !(price >= 0)) return null;
      out.push({ name, priceIls: price });
    } else {
      out.push({ name });
    }
  }
  return out;
}

const HHMM = /^\d{2}:\d{2}$/;
export function resolveOpeningHours(v: unknown): OpeningHours | null {
  if (!Array.isArray(v) || v.length !== 7) return null;
  const out: OpeningHours = [];
  for (const entry of v) {
    if (entry === null) { out.push(null); continue; }
    if (typeof entry !== 'object') return null;
    const { open, close } = entry as Record<string, unknown>;
    if (typeof open !== 'string' || typeof close !== 'string') return null;
    if (!HHMM.test(open) || !HHMM.test(close) || !(close > open)) return null;
    out.push({ open, close });
  }
  return out;
}
