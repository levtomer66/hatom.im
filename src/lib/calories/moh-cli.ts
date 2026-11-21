// npm run calories:foods -- [--dry-run] [--offline]
//
// Loads the Ministry of Health nutrition table into `caloriesFoods`
// (docs/superpowers/specs/2026-11-21-calories-design.md § The MoH loader).
// Reads the data.gov.il datastore API (the CSV URLs answer 403 to scripts:
// never work around that), caches the raw rows under
// $SHOPPING_CACHE_DIR/moh (default ~/.cache/hatom-shopping/moh), and writes
// only docs whose content changed. --offline reads the cache instead of the
// network; --dry-run writes nothing. Needs MONGODB_URI unless --dry-run.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { MongoClient, type AnyBulkWriteOperation } from 'mongodb';
import { buildFoodDocs, MOH_RESOURCES, type FoodDoc, type Row } from './moh.ts';

const API = 'https://data.gov.il/api/3/action/datastore_search';
const PAGE = 5000;
const COLLECTION = 'caloriesFoods';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const offline = args.has('--offline');
const cacheDir = join(process.env.SHOPPING_CACHE_DIR || join(homedir(), '.cache', 'hatom-shopping'), 'moh');

async function fetchAll(resource: string): Promise<Row[]> {
  const rows: Row[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const res = await fetch(`${API}?resource_id=${resource}&limit=${PAGE}&offset=${offset}`, { headers: { 'User-Agent': 'hatom-calories-loader' } });
    if (!res.ok) throw new Error(`datastore ${resource}: HTTP ${res.status}`);
    const body = (await res.json()) as { success: boolean; result: { records: Row[]; total: number } };
    if (!body.success) throw new Error(`datastore ${resource}: not successful`);
    rows.push(...body.result.records);
    if (rows.length >= body.result.total || !body.result.records.length) return rows;
  }
}

async function load(name: keyof typeof MOH_RESOURCES): Promise<Row[]> {
  const file = join(cacheDir, `${name}.json`);
  if (offline) {
    if (!existsSync(file)) throw new Error(`--offline: no cached ${file}`);
    return JSON.parse(readFileSync(file, 'utf8')) as Row[];
  }
  const rows = await fetchAll(MOH_RESOURCES[name]);
  writeFileSync(file, JSON.stringify(rows));
  return rows;
}

async function main() {
  mkdirSync(cacheDir, { recursive: true });
  const [foods, measures, weights] = [await load('foods'), await load('measures'), await load('unitWeights')];
  const docs = buildFoodDocs(foods, measures, weights);
  const withUnits = docs.filter((d) => d.units.length).length;
  console.log(`kept ${docs.length} of ${foods.length} foods (${withUnits} with portions), ${weights.length} unit rows`);
  if (dryRun) return;

  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set (put it in .env.shopping, or use --dry-run)');
  const mongo = new MongoClient(process.env.MONGODB_URI);
  try {
    const col = mongo.db().collection<FoodDoc>(COLLECTION);
    const have = new Map((await col.find({}, { projection: { h: 1 } }).toArray()).map((d) => [d._id, d.h]));
    const ops: AnyBulkWriteOperation<FoodDoc>[] = docs
      .filter((d) => have.get(d._id) !== d.h)
      .map((d) => ({ replaceOne: { filter: { _id: d._id }, replacement: d, upsert: true } }));
    const keep = new Set(docs.map((d) => d._id));
    const gone = [...have.keys()].filter((id) => !keep.has(id));
    if (gone.length) ops.push({ deleteMany: { filter: { _id: { $in: gone } } } });
    if (ops.length) await col.bulkWrite(ops, { ordered: false });
    console.log(`written ${ops.length - (gone.length ? 1 : 0)}, removed ${gone.length}, unchanged ${docs.length - (ops.length - (gone.length ? 1 : 0))}`);
  } finally {
    await mongo.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
