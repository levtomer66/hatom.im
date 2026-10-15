// Laundry instructions for our LG 8 kg front-loader — data + the pure step
// builder behind /laundry. Kept import-free so
// src/lib/__tests__/laundry.test.ts can load it under `node --test`.
//
// Doses, temperatures and spins are copied from the handwritten notes on the
// laundry-room door. Don't "normalise" the measures (פקק ורוד, פקק קטן,
// חצי כוס שקופה) — they're the actual cups on the shelf. The notes don't name
// a program; Cotton / Mixed Fabric per load was chosen on top of them.

export type LoadId = 'white' | 'black' | 'towels' | 'rugs' | 'colored';

// Where a product goes. `main` is the large left drawer compartment marked
// II (main wash); `softener` is the blue insert (the notes call it the
// "middle" compartment); `drum` is straight into the drum, not the drawer.
// The small front-right compartment (I, pre-wash) is never used.
export type Slot = 'main' | 'softener' | 'drum';

export type ProductId =
  | 'detergent'
  | 'black-detergent'
  | 'stain-remover'
  | 'bleach'
  | 'dettol'
  | 'softener'
  | 'scent-beads';

export type MeasureId = 'small-cap' | 'pink-80' | 'pink-120' | 'half-clear-cup';

export type ProgramId = 'cotton' | 'mixed-fabric';

export interface Product {
  name: string;
  slot: Slot;
}

export interface Measure {
  label: string;
  // Millilitres marked on the pink cup, when the measure is one.
  ml?: number;
}

export interface Program {
  // Exactly as printed next to the dial.
  dialLabel: string;
  hebrew: string;
  // That label on the panel photo, and half its width (for the pill marker).
  dialSpot: SpotName;
  labelR: number;
}

export interface Dose {
  product: ProductId;
  measure: MeasureId;
}

export interface LoadType {
  id: LoadId;
  name: string;
  // What belongs in this load, for the picker card.
  hint: string;
  doses: Dose[];
  program: ProgramId;
  tempC: number;
  spin: number;
}

export const PRODUCTS: Record<ProductId, Product> = {
  detergent: { name: 'נוזל כביסה', slot: 'main' },
  'black-detergent': { name: 'נוזל כביסה שחור', slot: 'main' },
  'stain-remover': { name: 'מסיר כתמים', slot: 'main' },
  // Not on the "where does it go" note; it's a liquid dosed with the
  // detergent, so it shares the main-wash compartment.
  bleach: { name: 'מלבין', slot: 'main' },
  dettol: { name: 'דטול', slot: 'softener' },
  softener: { name: 'מרכך כביסה', slot: 'softener' },
  'scent-beads': { name: 'כדוריות ריח', slot: 'drum' },
};

export const MEASURES: Record<MeasureId, Measure> = {
  'small-cap': { label: 'פקק קטן' },
  'pink-80': { label: 'פקק ורוד – 80 מ״ל', ml: 80 },
  'pink-120': { label: 'פקק ורוד – 120 מ״ל', ml: 120 },
  'half-clear-cup': { label: 'חצי כוס שקופה' },
};

export const PROGRAMS: Record<ProgramId, Program> = {
  cotton: { dialLabel: 'Cotton', hebrew: 'כותנה', dialSpot: 'dialCotton', labelR: 0.03 },
  'mixed-fabric': { dialLabel: 'Mixed Fabric', hebrew: 'בדים מעורבים', dialSpot: 'dialMixedFabric', labelR: 0.04 },
};

export interface SlotInfo {
  name: string;
  where: string;
  // Where the slot is on the photos, how far to zoom, and the marker size.
  spot: SpotName;
  zoom: number;
  markerR: number;
}

export const SLOTS: Record<Slot, SlotInfo> = {
  main: { name: 'תא שמאלי (II)', where: 'לתא השמאלי הגדול במגירה (II)', spot: 'mainCompartment', zoom: 1.15, markerR: 0.2 },
  softener: {
    name: 'תא כחול',
    where: 'לתא הכחול במגירה (מרכך) — לא מעל הקו MAX',
    spot: 'softenerCompartment',
    zoom: 1.15,
    markerR: 0.17,
  },
  drum: { name: 'ישר לתוף', where: 'ישר לתוף, יחד עם הכביסה — לא למגירה', spot: 'door', zoom: 1, markerR: 0.28 },
};

const BASE: Dose[] = [
  { product: 'dettol', measure: 'small-cap' },
  { product: 'softener', measure: 'small-cap' },
];
const BEADS: Dose = { product: 'scent-beads', measure: 'half-clear-cup' };

// Picker order = the sorting note's order.
export const LOAD_TYPES: LoadType[] = [
  {
    id: 'white',
    name: 'כביסה לבנה',
    hint: 'בגדים לבנים',
    doses: [
      ...BASE,
      { product: 'detergent', measure: 'pink-80' },
      { product: 'bleach', measure: 'pink-120' },
      BEADS,
    ],
    program: 'cotton',
    tempC: 40,
    spin: 600,
  },
  {
    id: 'black',
    name: 'כביסה שחורה',
    hint: 'בגדים שחורים',
    doses: [...BASE, { product: 'black-detergent', measure: 'pink-80' }, BEADS],
    program: 'mixed-fabric',
    tempC: 30,
    spin: 600,
  },
  {
    id: 'towels',
    name: 'מגבות',
    hint: 'מגבות מטבח + פנים',
    doses: [
      ...BASE,
      { product: 'detergent', measure: 'pink-80' },
      { product: 'stain-remover', measure: 'pink-80' },
      BEADS,
    ],
    program: 'cotton',
    tempC: 60,
    spin: 600,
  },
  {
    id: 'rugs',
    name: 'שטיחים + סמרטוטים',
    hint: 'שטיחונים וסמרטוטים',
    doses: [
      ...BASE,
      { product: 'detergent', measure: 'pink-80' },
      { product: 'stain-remover', measure: 'pink-80' },
    ],
    program: 'cotton',
    tempC: 60,
    spin: 800,
  },
  {
    id: 'colored',
    name: 'כביסה צבעונית',
    hint: 'בגדים שהם לא שחור ולא לבן',
    doses: [
      ...BASE,
      { product: 'detergent', measure: 'pink-80' },
      { product: 'stain-remover', measure: 'pink-80' },
      BEADS,
    ],
    program: 'mixed-fabric',
    tempC: 30,
    spin: 600,
  },
];

export function getLoadType(id: string | null | undefined): LoadType | undefined {
  return LOAD_TYPES.find((t) => t.id === id);
}

// ---- Photos ---------------------------------------------------------------

export type PhotoId = 'drawer' | 'panel';

// The shipped JPEGs; aspect = width / height.
export const PHOTOS: Record<PhotoId, { src: string; aspect: number }> = {
  drawer: { src: '/laundry/drawer.jpg', aspect: 900 / 1200 },
  panel: { src: '/laundry/panel.jpg', aspect: 1400 / 1050 },
};

// Points of interest as fractions of the photo's width / height.
export const SPOTS = {
  mainCompartment: { photo: 'drawer', x: 0.325, y: 0.42 },
  softenerCompartment: { photo: 'drawer', x: 0.625, y: 0.31 },
  drawerOverview: { photo: 'drawer', x: 0.5, y: 0.45 },
  door: { photo: 'panel', x: 0.45, y: 0.86 },
  power: { photo: 'panel', x: 0.199, y: 0.518 },
  dial: { photo: 'panel', x: 0.314, y: 0.412 },
  dialCotton: { photo: 'panel', x: 0.158, y: 0.357 },
  dialMixedFabric: { photo: 'panel', x: 0.179, y: 0.408 },
  temp: { photo: 'panel', x: 0.874, y: 0.346 },
  spin: { photo: 'panel', x: 0.867, y: 0.395 },
  start: { photo: 'panel', x: 0.456, y: 0.517 },
} as const satisfies Record<string, { photo: PhotoId; x: number; y: number }>;

export interface StepPhoto {
  photo: PhotoId;
  // Point the frame centres on (clamped so the photo still fills the frame).
  x: number;
  y: number;
  zoom: number;
  // Spotlight drawn over the photo: `r` is half its width as a fraction of
  // the photo's width; `aspect` > 1 stretches it into a pill for text labels.
  marker?: { x: number; y: number; r: number; aspect?: number };
}

export interface Step {
  id: string;
  title: string;
  detail?: string;
  // Dose steps only: what goes in, and the measuring-cup chip beside the title.
  product?: ProductId;
  measure?: MeasureId;
  photo: StepPhoto;
}

export type SpotName = keyof typeof SPOTS;

interface Shot {
  zoom?: number;
  // Spotlight on `spot`: half-width, and > 1 aspect for a pill.
  markerR?: number;
  markerAspect?: number;
  // Centre the frame on another spot (e.g. the dial, while marking its label).
  centre?: SpotName;
}

// A photo framed on `spot`, optionally spotlighting it.
function shot(spot: SpotName, { zoom = 1, markerR, markerAspect, centre = spot }: Shot = {}): StepPhoto {
  const s = SPOTS[spot];
  const c = SPOTS[centre];
  return {
    photo: s.photo,
    x: c.x,
    y: c.y,
    zoom,
    marker: markerR ? { x: s.x, y: s.y, r: markerR, aspect: markerAspect } : undefined,
  };
}

function doseStep(d: Dose, i: number): Step {
  const product = PRODUCTS[d.product];
  const slot = SLOTS[product.slot];
  return {
    id: `dose-${i}-${d.product}`,
    title: `שמים ${MEASURES[d.measure].label} ${product.name}`,
    detail: slot.where,
    product: d.product,
    measure: d.measure,
    photo: shot(slot.spot, { zoom: slot.zoom, markerR: slot.markerR }),
  };
}

const PANEL_ZOOM = 2.2;

// Wrap Latin/number runs in an LTR isolate so RTL text doesn't flip "40°"
// into "°40" (digits alone don't set a direction).
export const ltr = (s: string | number) => `\u2066${s}\u2069`;

// The full ordered checklist for one load: fill the drum, dose the drawer,
// then set the machine. Drum-slot products (scent beads) go right after the
// clothes, before the door closes.
export function buildSteps(load: LoadType): Step[] {
  const indexed = load.doses.map((d, i) => ({ d, i }));
  const inSlot = (slot: Slot) => indexed.filter(({ d }) => PRODUCTS[d.product].slot === slot);
  const program = PROGRAMS[load.program];
  const button = (spot: SpotName, markerR: number, markerAspect?: number) =>
    shot(spot, { zoom: PANEL_ZOOM, markerR, markerAspect });

  return [
    {
      id: 'load',
      title: `מכניסים לתוף רק ${load.name}`,
      detail: load.hint,
      photo: shot('door', { markerR: 0.3 }),
    },
    ...inSlot('drum').map(({ d, i }) => doseStep(d, i)),
    { id: 'close-door', title: 'סוגרים את הדלת', photo: shot('door') },
    {
      id: 'open-drawer',
      title: 'פותחים את מגירת הסבון',
      detail: 'משמאל למעלה, מעל הדלת',
      photo: shot('drawerOverview'),
    },
    ...inSlot('main').map(({ d, i }) => doseStep(d, i)),
    ...inSlot('softener').map(({ d, i }) => doseStep(d, i)),
    { id: 'close-drawer', title: 'סוגרים את המגירה', photo: shot('drawerOverview') },
    { id: 'power', title: 'מדליקים את המכונה', detail: 'כפתור ההפעלה ⏻ מתחת לחוגה', photo: button('power', 0.045) },
    {
      id: 'program',
      title: `מסובבים את החוגה ל־${program.dialLabel}`,
      detail: `תוכנית ${program.hebrew}`,
      photo: shot(program.dialSpot, { zoom: PANEL_ZOOM, markerR: program.labelR, markerAspect: 2.6, centre: 'dial' }),
    },
    {
      id: 'temp',
      title: `לוחצים Temp עד ${ltr(`${load.tempC}°`)}`,
      detail: 'כל לחיצה מחליפה טמפרטורה — בודקים על המסך',
      photo: button('temp', 0.035, 2.2),
    },
    {
      id: 'spin',
      title: `לוחצים Spin עד ${load.spin}`,
      detail: 'כל לחיצה מחליפה מהירות סחיטה — בודקים על המסך',
      photo: button('spin', 0.035, 2.2),
    },
    { id: 'start', title: 'לוחצים ▶︎‖ להפעלה', detail: 'זהו, המכונה עובדת 🎉', photo: button('start', 0.045) },
  ];
}

// ---- Photo framing ----------------------------------------------------------

export interface Frame {
  // All percentages of the frame: the photo's width, and its offset.
  width: number;
  left: number;
  top: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// Position a photo inside a fixed-aspect frame so (x, y) sits as close to the
// centre as possible without exposing the frame behind it. `zoom` 1 = photo
// as wide as the frame; it's raised as needed for a wide photo to fill a
// taller frame. Aspects are width / height.
export function focusFrame(
  x: number,
  y: number,
  zoom: number,
  photoAspect: number,
  frameAspect: number,
): Frame {
  const z = Math.max(1, zoom, photoAspect / frameAspect);
  const width = z * 100;
  // Photo height as a percentage of the frame's height.
  const height = (width * frameAspect) / photoAspect;
  return {
    width,
    left: clamp(50 - x * width, 100 - width, 0),
    top: clamp(50 - y * height, 100 - height, 0),
  };
}
