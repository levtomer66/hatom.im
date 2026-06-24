// Domain types + option constants + validation helpers for the /coffee-order
// feature. Mirrors src/types/spa.ts: string-literal unions, option arrays the
// UI maps over, and coercion/validation helpers the API uses so a stale or
// malicious client can't smuggle bad values into Mongo.

export type CoffeeDrink = 'espresso' | 'lungo' | 'cappuccino';
export type CoffeeMilk = 'none' | 'regular' | 'soy' | 'lactose-free' | 'oat';
export type CoffeeSugar = 'none' | '1' | '2' | '3';
export type DeliveryType = 'now' | 'scheduled';

export interface CoffeeOption<T extends string> {
  id: T;
  label: string;
  emoji?: string;
}

// Labels are Hebrew (the page UI is Hebrew/RTL). `id`s stay English — they are
// the stored values and the validation keys; only the display label changes.
export const COFFEE_DRINKS: readonly CoffeeOption<CoffeeDrink>[] = [
  { id: 'espresso',   label: 'אספרסו',   emoji: '⚡' },
  { id: 'lungo',      label: 'לונגו',    emoji: '🫗' },
  { id: 'cappuccino', label: 'קפוצ׳ינו', emoji: '☕' },
];

export const COFFEE_MILKS: readonly CoffeeOption<CoffeeMilk>[] = [
  { id: 'none',         label: 'ללא'          },
  { id: 'regular',      label: 'רגיל'         },
  { id: 'soy',          label: 'סויה'         },
  { id: 'lactose-free', label: 'נטול לקטוז'   },
  { id: 'oat',          label: 'שיבולת שועל'  },
];

export const COFFEE_SUGARS: readonly CoffeeOption<CoffeeSugar>[] = [
  { id: 'none', label: 'ללא' },
  { id: '1',    label: '1'   },
  { id: '2',    label: '2'   },
  { id: '3',    label: '3'   },
];

export const MAX_PUMPS = 6;

// The shared drink-config subset — "an order minus identity and time". Both
// CoffeeOrder and CoffeeFavorite extend it so they stay in lockstep.
export interface CoffeeDrinkConfig {
  drink: CoffeeDrink;
  milk: CoffeeMilk;
  sugar: CoffeeSugar;
  vanillaPumps: number;
  caramelPumps: number;
  notes: string;
}

export interface CoffeeOrder extends CoffeeDrinkConfig {
  id: string;
  userEmail: string;
  userName: string;
  deliveryType: DeliveryType;
  scheduledAt?: string; // ISO 8601, present iff deliveryType === 'scheduled'
  createdAt: string;    // ISO 8601
}

export interface CoffeeFavorite extends CoffeeDrinkConfig {
  id: string;
  userEmail: string;
  name: string;
  createdAt: string;    // ISO 8601
}

export interface CreateCoffeeOrderDto extends CoffeeDrinkConfig {
  deliveryType: DeliveryType;
  scheduledAt?: string;
}

export interface CreateCoffeeFavoriteDto extends CoffeeDrinkConfig {
  name: string;
}

const DRINK_IDS = new Set<string>(COFFEE_DRINKS.map((d) => d.id));
const MILK_IDS = new Set<string>(COFFEE_MILKS.map((m) => m.id));
const SUGAR_IDS = new Set<string>(COFFEE_SUGARS.map((s) => s.id));

export function isValidDrink(v: unknown): v is CoffeeDrink {
  return typeof v === 'string' && DRINK_IDS.has(v);
}
export function isValidMilk(v: unknown): v is CoffeeMilk {
  return typeof v === 'string' && MILK_IDS.has(v);
}
export function isValidSugar(v: unknown): v is CoffeeSugar {
  return typeof v === 'string' && SUGAR_IDS.has(v);
}

// Clamp an arbitrary client value into an integer in [0, MAX_PUMPS].
export function clampPumps(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(MAX_PUMPS, Math.max(0, Math.round(n)));
}

export function drinkLabel(id: CoffeeDrink): string {
  return COFFEE_DRINKS.find((d) => d.id === id)?.label ?? id;
}
export function milkLabel(id: CoffeeMilk): string {
  return COFFEE_MILKS.find((m) => m.id === id)?.label ?? id;
}

// One-line Hebrew summary used in the ntfy push body, the post-submit recap,
// and the favorite/history cards, e.g.
//   "קפוצ׳ינו · חלב שיבולת שועל · כפית סוכר · וניל ×2"
export function drinkSummary(c: CoffeeDrinkConfig): string {
  const parts: string[] = [drinkLabel(c.drink)];
  parts.push(c.milk === 'none' ? 'ללא חלב' : `חלב ${milkLabel(c.milk)}`);
  if (c.sugar !== 'none') {
    parts.push(c.sugar === '1' ? 'כפית סוכר' : `${c.sugar} כפיות סוכר`);
  }
  if (c.vanillaPumps > 0) parts.push(`וניל ×${c.vanillaPumps}`);
  if (c.caramelPumps > 0) parts.push(`קרמל ×${c.caramelPumps}`);
  return parts.join(' · ');
}

// The default config the form starts from.
export function defaultDrinkConfig(): CoffeeDrinkConfig {
  return {
    drink: 'cappuccino',
    milk: 'regular',
    sugar: 'none',
    vanillaPumps: 0,
    caramelPumps: 0,
    notes: '',
  };
}
