import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { findAlternatives, getItems } from '@/models/ShoppingCatalog';

/** Words worth matching on: 3+ letters, no sizes or units ("200 גרם", "ליטר"). */
const UNIT = /^(גרם|גר|ג|קג|ק"ג|ליטר|ל|מ"ל|מל|יח|יחידות|מארז|ב|של|עם|ללא)$/;
const wordsOf = (name: string) =>
  [...new Set(name.split(/[\s,./*+()\-]+/).map((w) => w.replace(/["'״׳%]/g, '')).filter((w) => w.length >= 3 && !/\d/.test(w) && !UNIT.test(w)))];

// GET ?key=<item>&store=<store key> — for "לא היה": the cheapest items at that
// store in the same department whose name shares a word with this one.
export async function GET(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'shopping');
  if (caller instanceof NextResponse) return caller;
  const key = (request.nextUrl.searchParams.get('key') ?? '').slice(0, 60);
  const store = Number(request.nextUrl.searchParams.get('store'));
  if (!key || !Number.isInteger(store)) return NextResponse.json({ error: 'key and store are required' }, { status: 400 });
  try {
    const [item] = await getItems([key]);
    if (!item) return NextResponse.json({ error: 'No such item' }, { status: 404 });
    const words = wordsOf(item.n);
    if (!words.length) return NextResponse.json([]);
    const found = await findAlternatives(store, item.d ?? null, words, key);
    return NextResponse.json(found);
  } catch (error) {
    console.error('Error finding alternatives:', error);
    return NextResponse.json({ error: 'Failed to find alternatives' }, { status: 500 });
  }
}
