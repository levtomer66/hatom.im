// Small-store discovery around pinned locations — a local job you run by hand.
//
//   npm run shopping:discover                      # every pin
//   npm run shopping:discover -- --pin bs-hazinor  # one pin
//
// Inputs, all under $SHOPPING_CACHE_DIR (default ~/.cache/hatom-shopping)/places/:
//   pins.json                    the pins (personal locations — never in the repo)
//   <osmArea>.geojson            outline of an area pin (Nominatim lookup)
//   google/<pin>-<query>.tsv     Google Maps result lists, collected by hand in a
//                                browser: name \t lat \t lng \t "category · address"
//   osm/<pin>-<cat>-<q>.json     Nominatim responses (fetched here, kept 7 days)
//   extra.json                   shops the map searches miss, added by hand:
//                                [{ pin, name, lat, lng, address, category?, city? }]
//                                (city: a CITIES id when the shop isn't in the pin's city)
//   decisions.json               { [placeId]: "include" | "skip" } — your answers
//   official.json                { [placeId]: "<chainSlug>/<storeId>" } — hand matches
//                                to an official store whose address doesn't match
// Output: <pin>.review.json and a table on stdout.
//
// Official store lists come from the Stores files the price ingest already
// downloaded (raw/<chain>/Stores*), in this cache and in SHOPPING_EXTRA_CACHE_DIRS.

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { parseArgs } from 'node:util';
import { CHAINS } from '../chains.ts';
import { cityOf } from '../cities.ts';
import { decodeXmlBytes, isGzip } from '../xml.ts';
import { parseStoresFile } from '../normalize.ts';
import {
  brandOf, circleBox, distanceM, inRing, matchOfficial, mergePlaces, placeCity, ringBox,
  type OfficialStore, type Pin, type Place, type RawPlace,
} from '../places.ts';
import { readJson, writeJson } from './cache.ts';
import { nominatim } from './geo.ts';
import type { ReviewRow } from './picks.ts';

const USER_AGENT = 'hatom-shopping-discover/0.1';
const OSM_MAX_AGE_DAYS = 7;
/** Nominatim special phrases → OSM shop=* values. */
const OSM_CATEGORIES = ['supermarket', 'convenience store', 'greengrocer', 'butcher', 'delicatessen'];

const { values: args } = parseArgs({ options: { pin: { type: 'string' } } });

const CACHE = process.env.SHOPPING_CACHE_DIR || join(homedir(), '.cache', 'hatom-shopping');
const PLACES = join(CACHE, 'places');
const OSM_DIR = join(PLACES, 'osm');
const GOOGLE_DIR = join(PLACES, 'google');
for (const d of [OSM_DIR, GOOGLE_DIR]) mkdirSync(d, { recursive: true });

const pinsFile = join(PLACES, 'pins.json');
if (!existsSync(pinsFile)) {
  console.error(`no pins: create ${pinsFile} (see the header of this file)`);
  process.exit(1);
}
const pins = readJson<Pin[]>(pinsFile, []).filter((p) => !args.pin || p.id === args.pin);
if (!pins.length) {
  console.error(`no pin ${args.pin} in ${pinsFile}`);
  process.exit(1);
}
const decisions = readJson<Record<string, 'include' | 'skip'>>(join(PLACES, 'decisions.json'), {});

// ---- official stores ------------------------------------------------------

function officialStores(): OfficialStore[] {
  const dirs = [CACHE, ...(process.env.SHOPPING_EXTRA_CACHE_DIRS ?? '').split(':').filter(Boolean)];
  const latest = new Map<string, string>(); // chain slug → newest Stores file
  for (const dir of dirs) {
    for (const chain of CHAINS.filter((c) => c.source.kind !== 'wolt' && c.source.kind !== 'manual')) {
      const raw = join(dir, 'raw', chain.slug);
      if (!existsSync(raw)) continue;
      for (const f of readdirSync(raw).filter((n) => n.startsWith('Stores'))) {
        const path = join(raw, f);
        const prev = latest.get(chain.slug);
        if (!prev || statSync(path).mtimeMs > statSync(prev).mtimeMs) latest.set(chain.slug, path);
      }
    }
  }
  const out: OfficialStore[] = [];
  for (const [chainSlug, path] of latest) {
    let bytes: Uint8Array = readFileSync(path);
    if (isGzip(bytes)) bytes = gunzipSync(bytes);
    for (const s of parseStoresFile(decodeXmlBytes(bytes)).stores) {
      out.push({ chainSlug, storeId: s.storeId, name: s.name, address: s.address, cityId: cityOf(s) });
    }
  }
  const missing = CHAINS.filter((c) => c.source.kind !== 'wolt' && c.source.kind !== 'manual' && !latest.has(c.slug)).map((c) => c.slug);
  if (missing.length) console.log(`! no cached Stores file for: ${missing.join(', ')} (run the ingest, or set SHOPPING_EXTRA_CACHE_DIRS)`);
  return out;
}

// ---- sources --------------------------------------------------------------

/** The fields of a Nominatim jsonv2 search result this job reads. */
interface NominatimRow {
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  name: string;
  type: string;
  address?: { road?: string; house_number?: string };
}

/** One request at a time, 1.5 s apart, backing off on 429 / 503 (ingest/geo.ts). */
const search = nominatim(USER_AGENT);

async function osmPlaces(pin: Pin, box: [number, number, number, number]): Promise<RawPlace[]> {
  const [w, s, e, n] = box;
  const midX = (w + e) / 2;
  const midY = (s + n) / 2;
  // Nominatim returns at most 50 per query; quarter the box so dense areas aren't cut off.
  const quads: [number, number, number, number][] = [
    [w, s, midX, midY], [midX, s, e, midY], [w, midY, midX, n], [midX, midY, e, n],
  ];
  const out: RawPlace[] = [];
  for (const cat of OSM_CATEGORIES) {
    for (const [qi, q] of quads.entries()) {
      // The box is in the name: moving a pin must not reuse the old area's results.
      const boxTag = q.map((n) => n.toFixed(4)).join('_');
      const file = join(OSM_DIR, `${pin.id}-${cat.replace(/\s+/g, '_')}-${boxTag}.json`);
      let rows: NominatimRow[];
      if (existsSync(file) && Date.now() - statSync(file).mtimeMs < OSM_MAX_AGE_DAYS * 86_400_000) {
        rows = readJson(file, []);
      } else {
        rows = await search<NominatimRow>({ format: 'jsonv2', limit: '50', bounded: '1', addressdetails: '1', countrycodes: 'il', q: cat, viewbox: q.join(',') });
        writeJson(file, rows);
        if (rows.length >= 50) console.log(`! ${pin.id}: ${cat} quadrant ${qi} hit the 50-result cap`);
      }
      for (const r of rows) {
        const a = r.address ?? {};
        out.push({
          source: 'osm',
          name: r.name || `(${r.type} ללא שם)`,
          lat: +r.lat,
          lng: +r.lon,
          address: [a.road, a.house_number].filter(Boolean).join(' '),
          category: r.type,
          ref: `${String(r.osm_type)[0].toUpperCase()}${r.osm_id}`,
        });
      }
    }
  }
  return out;
}

function googlePlaces(pin: Pin): RawPlace[] {
  const out: RawPlace[] = [];
  for (const f of readdirSync(GOOGLE_DIR).filter((n) => n.startsWith(`${pin.id}-`) && n.endsWith('.tsv'))) {
    for (const line of readFileSync(join(GOOGLE_DIR, f), 'utf8').split('\n')) {
      const [name, lat, lng, rest = ''] = line.split('\t');
      if (!name || !lat || !lng) continue;
      const parts = rest.split('·').map((s) => s.trim()).filter(Boolean);
      out.push({
        source: 'google',
        name,
        lat: +lat,
        lng: +lng,
        category: parts[0] ?? '',
        // Google pads with icon glyphs and may end with a phone number.
        address: parts.slice(1).join(' ').replace(/^[^\p{L}\p{N}]+/u, '').replace(/\s*[\d-]{9,}\s*$/, '').trim(),
        ref: `G:${name}@${(+lat).toFixed(5)},${(+lng).toFixed(5)}`,
      });
    }
  }
  return out;
}

// ---- run ------------------------------------------------------------------

type Status = ReviewRow['status'];

const official = officialStores();
// Hand matches for shops whose address differs from the chain's file (a
// misspelt street, a mall address, "unknown"): place ref → "<chainSlug>/<storeId>".
const handMatches = readJson<Record<string, string>>(join(PLACES, 'official.json'), {});
const handMatch = (p: Place) => {
  const key = p.refs.map((r) => handMatches[r]).find(Boolean);
  const hit = key ? official.find((s) => `${s.chainSlug}/${s.storeId}` === key) : undefined;
  if (key && !hit) console.log(`! places/official.json: ${key} is not in any cached Stores file`);
  return hit ?? null;
};

for (const pin of pins) {
  let box: [number, number, number, number];
  let inside: (p: { lat: number; lng: number }) => boolean;
  if (pin.osmArea) {
    const geo = readJson<{ coordinates: [number, number][][] } | null>(join(PLACES, `${pin.osmArea}.geojson`), null);
    if (!geo) throw new Error(`${pin.id}: missing ${pin.osmArea}.geojson next to pins.json`);
    const ring = geo.coordinates[0];
    box = ringBox(ring);
    inside = (p) => inRing(p, ring);
  } else {
    const r = pin.radiusM ?? 1500;
    box = circleBox(pin, r);
    inside = (p) => distanceM(pin, p) <= r;
  }

  const google = googlePlaces(pin);
  const added = readJson<{ pin: string; name: string; lat: number; lng: number; address: string; category?: string; city?: string }[]>(join(PLACES, 'extra.json'), [])
    .filter((x) => x.pin === pin.id)
    .map((x): RawPlace => ({
      source: 'added', name: x.name, lat: x.lat, lng: x.lng, address: x.address, category: x.category ?? 'added by hand',
      ref: `A:${x.name}@${x.lat.toFixed(5)},${x.lng.toFixed(5)}`,
      ...(x.city ? { city: x.city } : {}),
    }));
  // Added shops are kept even outside the search box: they were named on purpose.
  const raw = [...added, ...[...google, ...(await osmPlaces(pin, box))].filter(inside)];
  const places = mergePlaces(raw, pin);

  const rows: ReviewRow[] = places.map((p) => {
    const brand = brandOf(p.names);
    const city = placeCity(p, pin);
    const match = handMatch(p) ?? (brand?.chainSlug ? matchOfficial(p, official.filter((s) => s.cityId === city && s.chainSlug === brand.chainSlug)) : null);
    const status: Status = match ? 'ingested' : brand ? 'publishes' : 'none';
    const decision = p.refs.map((r) => decisions[r]).find(Boolean) ?? 'pending';
    return { ...p, status, retailer: brand?.retailer ?? null, official: match, decision };
  });
  writeJson(join(PLACES, `${pin.id}.review.json`), rows, 1);

  const label = { ingested: 'ingested', publishes: 'publishes', none: 'no data' } as const;
  console.log(`\n${pin.id} — ${pin.label}: ${rows.length} shops (${google.length ? 'google + osm' : 'osm only — no google/*.tsv yet'})`);
  rows.forEach((r, i) => {
    const off = r.official ? ` [${r.official.chainSlug} #${r.official.storeId}]` : r.retailer ? ` [${r.retailer}]` : '';
    const src = r.sources.map((s) => s[0].toUpperCase()).join('');
    console.log(
      `${String(i + 1).padStart(3)}. ${r.name.slice(0, 38).padEnd(38)} ${String(r.distanceM).padStart(5)} m  ${src.padEnd(2)}  ${label[r.status].padEnd(9)}${off}  ${r.address}${r.decision !== 'pending' ? `  → ${r.decision}` : ''}`,
    );
  });
}
