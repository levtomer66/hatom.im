# Shopping ingest rework: one selection stage, no dead outputs

Status: approach approved by the owner, 2026-11-18 ("One selection stage").
Branch `claude/shopping-ingest-rework`, on top of `claude/shopping-no-cities-2191e3`
(PR #11). The code is written in a cloud session; every run of the ingest
happens on the owner's Mac, where the cache is.

## Goal

The price ingest (`npm run shopping:ingest`) grew one rule at a time. Since
then the owner decided two things that make part of it obsolete:

- **Pins only pick stores.** The owner adds no pin for an area just to cover
  it; a store outside the pins is picked by hand (`places/extra.json` +
  `official.json` + `decisions.json`).
- **The app prices by live location, a radius and ★ favorites** (PR #11).
  It no longer reads the store doc's `far` or `walkMin`, and no longer
  queries stores by city.

This rework makes the job match those decisions: one place decides which
stores are kept, the outputs nobody reads are gone, and the measured slow
spots are fixed. It changes **no selection result and no item or promo doc**.

## What must not change

- Sources and politeness: official price-transparency files first, Wolt for
  small shops, never comparison sites. One request at a time per host with
  a gap of at least 1.5 s. Every response is cached and never fetched twice.
- The owner's files under `$SHOPPING_CACHE_DIR/places/` keep their format:
  `pins.json`, `<pin>.review.json`, `decisions.json`, `official.json`,
  `extra.json`, `wolt.json`, `geocode.json`, `walk.json`.
- The saved state keeps its format: `state/stores/*.json.gz`,
  `state/stores.json`, `state/keys.json`, `state/written.json`.
  `PARSER_VERSION` stays 2.
- Mongo schema of `shoppingItems`, `shoppingPromos`, `shoppingChains`,
  `shoppingMeta`. Store ids, store keys `k`, and manual-shop ids
  (`sha1(review row id)`, first 10 hex chars) stay as they are.
- The rules themselves: a pin keeps stores within its walk (or inside its
  area); a store the owner included is kept anywhere; a skipped one is left
  out; online stores follow `keepOnlineStore`; every chain keeps one priced
  store (`needsFallback`, `fallbackOrder`, `keepFallbacks`); a Wolt venue
  follows `woltVenueRule`; a manual shop is an included review row with no
  price source.
- `npm run shopping:discover` writes the same `<pin>.review.json` for the
  same inputs. `npm run shopping:photos` is untouched.

## What was measured (2026-11-18, the owner's cache: 164 stores, 97,262 items)

- An `--offline --dry-run` rebuild takes **14.0 s**. 62% of it is
  `departments.ts match`: `itemDepartment` matches the same product name
  against about 1,000 stems once per store that sells it.
- `loadState` (gunzip + `JSON.parse` of a store's items and promos) runs 3–4
  times per store per run: once to check `priceFile` in `keptPriced`, once
  per store in the fetch loop, once in `keepFallbacks`, once to build docs.
- `places/geocode.json` holds 89 misses and 86 of them were asked again on
  the day of the measurement: a miss is retried after one day, so every run
  spends about two minutes re-asking Nominatim questions it cannot answer.
- Selection route of the 164 stores: 44 included by the owner, 11 within a
  pin's walk, 8 online, 1 fallback, 12 Wolt venues, 88 manual shops.

## Design

### 1. One reader of the owner's files

Today `pinFilter` (locate.ts), `ingestWolt`, `ingestManual` and
`placeCoords` (cli.ts) each read `pins.json`, the review files,
`decisions.json` and `wolt.json` with their own row types; `placeCoords`
re-reads every review file for every Wolt venue.

New module `ingest/picks.ts`: `loadPicks(placesDir)` reads each file once
and returns one object. It holds the pins and their area rings, the review
rows (one `ReviewRow` type, shared with discover.ts), the decisions, the
hand matches and the Wolt venues, and it offers the derived views as pure
functions over that data:

- `curation()` (moved from locate.ts, same behaviour): official store ref
  `"<chainSlug>/<storeId>"` → map point, the included set, the skipped set.
- `placePoint(placeRef)`: a discovery place's point (today's `placeCoords`).
- `manualShops()`: the included review rows with no price source, with
  `placeCity(row, pin)` as the city (today's `ingestManual` loop, including
  the `manualToo` rule for Wolt venues).

No pins file is an error with a one-line fix ("create places/pins.json");
the ingest no longer has a mode without pins (see § 5).

### 2. One selection stage

New module `ingest/select.ts` holds every keep/drop rule and nothing else.
The pure rules move there unchanged (`keepRule`, `woltVenueRule`,
`needsFallback`, `fallbackOrder`, `keepFallbacks`, with their tests), and
`keepRule` takes over the online-store rule so one function covers it:
an online store is kept exactly when `keepOnlineStore` says so.

Three entry points, all built on the same `Picks` and the same locator:

- `selectOfficial(stores)`: for a list of official stores, the kept ones,
  each with the reason it was kept (`online`, `included`, `near-pin`,
  `unplaced`, `fallback`) and its map point when it has one; and the dropped
  ones with the reason, for the log.
- `selectWolt()`: the priced Wolt venues to fetch, each with its point.
- `selectManual()`: the manual shops.

Where each runs:

- A chain fetched this run: `selectOfficial` runs once on the stores of its
  Stores file, before the price listing is asked for. The fallback check
  follows as today. Those stores are **not** selected a second time.
- A chain not fetched this run (other `--chains`, or `--offline`):
  `selectOfficial` runs on its saved records from `state/stores.json`, then
  `keepFallbacks`. This is how a changed decision or pin takes effect
  without fetching, as today.
- Wolt and manual stores of a run that didn't fetch them stay as saved, as
  today.

The map point is decided here and carried on the store record (`at`). The
second placing pass that builds `loc` for the store docs
(`s.at ?? PINS.pointOf(s)` in today's step 4) goes away: `loc` is the
record's point. An official store's point is derived again on every run
(from the review match, else the geocode cache), never trusted from the
saved record, so a corrected review row moves the store.

The registry merge keeps one rule: a chain that completed this run replaces
its saved stores with the fresh ones; a chain that failed keeps its saved
stores.

### 3. Placing stores: one Nominatim client, no network when offline

- `ingest/locate.ts` keeps only placing: the geocode cache, `pointOf`,
  `near` (walk router for a pin with `walkMinutes`, else the pin's circle or
  area), `nearestPinM`. `walkMinutes()` per store is deleted with its only
  caller.
- New `ingest/geo.ts`: the one Nominatim client (gap of 1.5 s, the 429/503
  back-off), used by locate.ts and discover.ts. Today there are two copies.
- A geocode **miss is retried after 30 days**, not one. The legacy cache
  format conversion in `pinFilter` is deleted (every entry in the cache has
  the current shape).
- `--offline` makes **no network request at all**: geocode and walk answer
  from their caches only. A store whose lookup isn't cached keeps its saved
  verdict (stays kept) and is logged; an offline run never drops a store for
  a missing cache entry.

### 4. Outputs nobody reads

- `StoreDoc` loses `far`, `walkMin` and `cityRaw`; `StoreInput` loses the
  same. `isFar`, `WALK_SLACK_MIN`, the walk loop in cli.ts and their tests
  are deleted. `StoreDoc.city` stays (the store search shows the town name).
- The ingest stops creating the `{ city: 1 }` index on `shoppingStores` and
  drops it when it exists (`dropIndex`, ignoring "index not found").
- `CityConfig.picker`, `ingestCityIds` and the `picker: false` on Holon are
  deleted.

If `tsc` shows app code that still reads a removed field, make the smallest
change that keeps the app's behaviour and list it in the PR; don't redesign
app code here. (Known: `sortStores` in here.ts has a `walkMin` tie-break on
`HereStore`.)

### 5. Flags

| Flag | After |
|------|-------|
| `--chains a,b` | unchanged |
| `--full` | unchanged |
| `--dry-run` | no Mongo, as today; also no longer prunes the raw cache |
| `--offline` | no fetching and, new, no network at all (§ 3); no raw pruning |
| `--max-stores N` | a sampling smoke run: now requires `--dry-run`, so the registry and fallback code lose their `maxStores` branches |
| `--all-stores` | **removed**: it kept every store of every target city, which with Jerusalem in `CITIES` would be hundreds of stores the owner never picked |
| `--cities` | **removed**: undocumented and unused |

With `--all-stores` and `--cities` gone, no `cityIds` set is threaded
through the job: a store's city is a target city or `null`, and `cityOf`
already says which.

### 6. Speed

- `buildItemDocs` remembers `departmentOf` / `departmentOfCategory` per
  distinct string for the length of one call (a local `Map`; no module-level
  cache, since the app imports departments.ts too). Same result, same order
  of evaluation.
- Saved store state is read once per run: a small state store
  (`ingest/state.ts`) memoizes `load` and updates the memo on `save`.
- Target: the `--offline --dry-run` rebuild on the owner's cache drops from
  14 s to 6 s or less.

### 7. Module layout

`cli.ts` (624 lines, a 200-line `main`, top-level side effects) is split by
stage. Only `cli.ts` may have top-level side effects or read `process.argv`;
everything else exports functions and is importable from a `node --test`
file.

| Module (`src/lib/shopping/ingest/`) | Holds |
|---|---|
| `cli.ts` | flags, wiring, the run summary; no rules |
| `cache.ts` | cache paths, the one `readJson` / `writeJson`, `fetchCached`, `pruneRaw`, `toXml`, the run log |
| `state.ts` | saved store state (memoized load / save / prune), the store registry, key assignment |
| `picks.ts` | § 1 |
| `select.ts` | § 2 |
| `locate.ts`, `geo.ts`, `walk.ts` | § 3 |
| `official.ts` | one price-transparency chain: Stores file → selection → listings → fallback → parse and save |
| `wolt.ts` | the venue fetcher (as today) plus the Wolt run and the photo-only venues |
| `build.ts` | saved state → item, promo, store and chain docs (photos, nutrition) and the size report |
| `write.ts` | indexes, diff against `written.json`, throttled bulk writes, the meta doc |

The three `readJson` copies, the two `sleep` helpers and the second `toXml`
in discover.ts collapse into the shared ones. The orphaned doc comments in
cli.ts (above `woltPhotos`) are sorted out. Log lines say the same things;
each chain gets one line with the count per keep reason instead of two
overlapping ones.

## Tests

Test-first, `node --test`, relative `.ts` imports.

- The moved rule tests keep passing unchanged (`shopping-locate.test.ts`
  becomes `shopping-select.test.ts`; the `isFar` tests are deleted with it).
- New, pure: `keepRule` for online stores; `selectOfficial` with a fake
  locator (included / near a pin / outside / skipped / unplaced under a walk
  pin / city without a pin, and that the kept record carries the point);
  `manualShops` (an included row, an `ingested` row, a row with a Wolt venue,
  `manualToo`, a row with its own `city`); `placePoint`; the 30-day miss
  rule; the offline locator never calls `fetch` and keeps a store whose
  lookup isn't cached; the state store reads a file once.
- `shopping-snapshot.test.ts` covers that `buildItemDocs` gives the same
  docs with the memo; fixtures drop `far` / `walkMin` / `cityRaw`.

## Verification on the owner's Mac (not in the cloud)

The cloud session has no cache and must not contact any chain, Wolt,
Nominatim or the walk router. It runs `npm test`, `tsc`, lint and the build.
The rest is run locally, on copies of the cache, against Docker Mongo:

1. **Same docs.** A baseline was written with the old code
   (`--offline --full`, database `hatom-shopping-golden-base`). The new code
   runs the same command on an identical cache copy into a second database.
   Required: the same 164 store ids and keys; store docs equal once `far`,
   `walkMin` and `cityRaw` are removed from the baseline; item, promo and
   chain docs byte-equal.
2. **Offline is offline.** The same run with `fetch` replaced by a counter:
   zero calls.
3. **Discovery.** `shopping:discover` on a cache copy, network blocked: the
   three `*.review.json` files are byte-equal to before.
4. **Speed.** The `--offline --dry-run` time before and after.
5. **The fetch path** (asks the owner first: it sends live requests): one
   chain with `--dry-run` on a cache copy.

## Order of shipping

Production runs the city-based app until PR #11 is deployed, and that app
reads `far` and `walkMin`. The reworked ingest must not run against Atlas
before PR #11 is live. This branch is stacked on PR #11 so it cannot merge
first. The first Atlas run with the new code rewrites the 164 store docs
(three fields removed) and drops one index; items and promos don't move.

## Not in this change

- A single picks file replacing `extra.json` + `official.json` +
  `decisions.json` (option 3; the owner chose not to change the files now).
- Removing cities from the ingest: `cityOf` still decides which stores of a
  Stores file are candidates, names the city for geocoding and fills
  `StoreDoc.city`.
- The hourly `Price` / `Promo` delta files, new chains, Yellow / Super Yuda
  / Salach Dabach (they need a published password; the owner's call).
