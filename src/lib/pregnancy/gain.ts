// Weight gain in pregnancy (docs/superpowers/specs/2026-11-24-pregnancy-design.md
// § Extras): the IOM 2009 total-gain band for the pre-pregnancy BMI, and the band
// at a given day — 0.5–2 kg reached by 13+6, then straight to the full band at
// 40+0. Import-free.

export interface GainBand { lo: number; hi: number; bmi: number }

const r1 = (v: number) => Math.round(v * 10) / 10;

export function gainBand(preKg: number, heightCm: number): GainBand {
  const bmi = r1(preKg / (heightCm / 100) ** 2);
  const [lo, hi] = bmi < 18.5 ? [12.5, 18] : bmi < 25 ? [11.5, 16] : bmi < 30 ? [7, 11.5] : [5, 9];
  return { lo, hi, bmi };
}

const FIRST = 97;
const END = 280;

export function bandAt(b: Pick<GainBand, 'lo' | 'hi'>, day: number): { lo: number; hi: number } {
  const d = Math.max(0, Math.min(END, day));
  if (d <= FIRST) return { lo: r1((0.5 * d) / FIRST), hi: r1((2 * d) / FIRST) };
  const k = (d - FIRST) / (END - FIRST);
  return { lo: r1(0.5 + (b.lo - 0.5) * k), hi: r1(2 + (b.hi - 2) * k) };
}

export function gainVerdict(preKg: number, heightCm: number, kgNow: number, day: number): { gain: number; lo: number; hi: number; bmi: number; verdict: 'in' | 'over' | 'under' } {
  const b = gainBand(preKg, heightCm);
  const at = bandAt(b, day);
  const gain = r1(kgNow - preKg);
  return { gain, ...at, bmi: b.bmi, verdict: gain > at.hi ? 'over' : gain < at.lo ? 'under' : 'in' };
}

/** The band every week from 0 to 40, for the tile's chart. */
export const bandLine = (b: Pick<GainBand, 'lo' | 'hi'>): { day: number; lo: number; hi: number }[] =>
  Array.from({ length: 41 }, (_, w) => ({ day: w * 7, ...bandAt(b, w * 7) }));
