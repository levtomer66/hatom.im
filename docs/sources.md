# Price-transparency sources (shopping feature)

Official files published under Israel's Price Transparency regulations
(חוק המזון / שקיפות מחירים) are the primary source. No third-party
comparison sites (chp, zap, pricez, …) are ever used.

**Additional source — Wolt** (approved by the owner 2026-11-16): small shops
that publish no price files but sell on Wolt. These are Wolt *delivery*
prices, typically 40–100% above the chains' shelf price for the same barcode
(e.g. Berman Active 750 g: ₪26.43 on Wolt vs ₪15.90–18.90 in 75 chain
stores), so the UI must label them. Items carry `barcode_gtin` (GTIN-14 with
a leading 0) and match the official catalogue exactly; produce is sold by
weight without a barcode and stays per venue. Endpoints and parsing:
`src/lib/shopping/wolt.ts`; fetcher `ingest/wolt.ts` (1.5 s between
requests, one cached response per venue/day/category). A large minimarket is
~100–160 requests (≈4 min). The venues to fetch are listed in
`places/wolt.json` in the cache dir, not in the repo.

## Small shops near the pins (discovery)

`npm run shopping:discover` lists the food shops around each pin in
`places/pins.json` (cache dir — personal locations, never in the repo),
merging OpenStreetMap (Nominatim category search; the Overpass API is
unreachable from the dev network) with Google Maps result lists collected by
hand in a browser (`places/google/<pin>-<query>.tsv`). Each shop is matched
against the official Stores files: *ingested* (store id found), *publishes*
(a retailer that publishes but isn't ingested yet), or *no data*. The
regulator's list of obligated retailers is
https://www.gov.il/he/pages/cpfta_prices_regulations (updated 12.08.2026);
independent markets are not obligated, so most small shops have no files.

Checked 2026-11-16 for the three pins: 171 named no-data shops, **none** with
its own online store showing prices; 8 on Wolt.

Shops the map searches miss (e.g. a supermarket OSM tags as a department
store) go in `places/extra.json` and are listed like any other discovered shop.

**Walk limit.** A pin with `walkMinutes` keeps only stores within that walk,
measured as a walking route by the OpenStreetMap foot router
(routing.openstreetmap.de, cached per point pair in `places/walk.json`); a
store farther than `walkMinutes × 60 × 1.5 m` straight-line is never routed.
Official and Wolt stores are held to it; neighbourhood (manual) shops follow
`decisions.json`, the owner's curated list, and an official store a curated
entry points to is always kept — Google and OSM routes differ by about a
minute at the edge.

**The ingest keeps only stores near the pins** when `pins.json` exists
(`--all-stores` to keep whole cities). Store files have addresses but no
coordinates, so `ingest/locate.ts` places each store by the discovery
match, else a Nominatim lookup of the cleaned address (cached per query in
`places/geocode.json`). Online stores always pass. A store it can't place is
logged and left out.

**Verified 2026-11-15** by downloading each chain's latest `Stores` file
(plus PriceFull/PromoFull for Yochananof). Store counts below are for the
three target cities, after the city rules in [City matching](#city-matching).

**Ingested** (`src/lib/shopping/chains.ts`): Shufersal, and on Cerberus
Yochananof, Rami Levy, Tiv Taam, Dor Alon, Fresh Market, Keshet and Osher Ad
(added 2026-11-16 — all parse with the default field aliases); Carrefour
(PublishPrice), Victory and Mahsani HaShuk (Laibcatalog), Bareket and City
Market (Bina), added 2026-11-17 for branches near the pins. Next: the other
Bina chains (Good Pharm, King Store, Super Sapir, …) and Super-Pharm.

## Access methods

| Method | How | Chains |
|---|---|---|
| **Cerberus (HTTPS)** | `GET https://url.publishedprices.co.il/login` → read `<meta name="csrftoken">` → `POST /login/user` with `username=<user>&password=&csrftoken=…` (302 to `/file` = success, keep the cookie) → `GET /file` for a fresh csrftoken → `POST /file/json/dir` with `sEcho=1&iDisplayStart=0&iDisplayLength=100000&sSearch=<substring>&cd=/&csrftoken=…` → JSON `aaData[{name,size,time}]` → `GET /file/d/<name>`. | Yochananof, Rami Levy, Tiv Taam, Dor Alon, Fresh Market, Keshet, Osher Ad, Stop Market, Politzer |
| Cerberus (FTP) | Same accounts on plain FTP `ftp://url.retail.publishedprices.co.il/` (passive, empty password). Works with `curl`. **FTP-over-TLS fails here** (`425 Unable to open the data connection`), which breaks the Python library's Cerberus engine (below). We use HTTPS. | (same) |
| Bina projects | `POST https://<prefix>.binaprojects.com/MainIO_Hok.aspx` with `WStore=&WDate=<dd/mm/yyyy>&WFileType=0` → JSON `[{FileNm, DateFile, …}]` for that day (a GET answers empty). `GET /Download.aspx?FileNm=<name>` → `[{SPath}]`, the real file URL. City Market's portal also lists a franchise's files under a second chain id (7290058288090) whose store numbers don't overlap the main company's — matched by store number. | Good Pharm, King Store, Super Sapir, Bareket, Maayan 2000, Shefa Birkat Hashem, Shuk HaIr, Zol VeBegadol, City Market |
| PublishPrice | `GET https://prices.<site>.co.il/` embeds today's listing as `const files = [{name,size,modified}]` and its folder as `const path = 'YYYYMMDD'`; a file is `/<path>/<name>`. The Stores file is UTF-16 XML. Carrefour's PriceFull headers carry the internal branch code (e.g. 442 for store 469) — the file name's store id is the one to trust. | Yeinot Bitan / Carrefour (`carrefour`) |
| Own multi-page site | Paged HTML table with direct blob links. | Shufersal `https://prices.shufersal.co.il/` (`?page=N`, filter by category/store) · Super-Pharm `http://prices.super-pharm.co.il/` · Hazi Hinam `https://shop.hazi-hinam.co.il/Prices` |
| Laibcatalog API | `GET https://laibcatalog.co.il/webapi/api/getfiles?edi=<chainId>` → JSON `[{branchNumber, fileName, fileType, fileDate}]` (today's files); download `/webapi/<chainId>/<fileName>`. `getbranches?edi=` gives branch names only. Overnight listings are often empty. | Victory, Mahsani HaShuk, H. Cohen |
| Wolt | `https://wm-gateway.wolt.com/isr-prices/public/v1/index.html` → per-date page `<YYYY-MM-DD>.html` → links. Full files only, no deltas. | Wolt Market |

## Chains with stores in the target cities

`TLV / RG / BS` = תל אביב-יפו / רמת גן / באר שבע. ✅ = a file was actually downloaded on the verify date.

| Chain | ChainId | Method | Username / site | TLV | RG | BS | Verified |
|---|---|---|---|---:|---:|---:|---|
| Shufersal (incl. BE, שלי, אקספרס) | 7290027600007 | own site | prices.shufersal.co.il | 33 | 10 | 13 | ✅ |
| Dor Alon (incl. AM:PM) | 7290492000005 | Cerberus | `doralon` | 31 | 4 | 1 | ✅ |
| Super-Pharm | 7290172900007 | own site | prices.super-pharm.co.il | 31 | 8 | 11 | ✅ |
| Yeinot Bitan / Carrefour | 7290055700007 | PublishPrice | `carrefour` | 23 | 3 | 5 | ✅ |
| Fresh Market / Super Dosh | 7290876100000 | Cerberus | `freshmarket` | 21 | 1 | 1 | ✅ |
| Tiv Taam | 7290873255550 | Cerberus | `TivTaam` | 19 | 1 | 2 | ✅ |
| Good Pharm | 7290058197699 | Bina | `goodpharm` | 18 | 2 | 3 | ✅ |
| Victory | 7290696200003 | Laibcatalog | edi `7290696200003` | 8 | 2 | 1 | ✅ |
| Wolt Market (online, StoreType 2) | 7290058249350 | Wolt | wm-gateway | 7 | 2 | 1 | ✅ |
| Rami Levy | 7290058140886 | Cerberus | `RamiLevi` | 6 | 1 | 3 | ✅ |
| Super Sapir | 7290058156016 | Bina | `supersapir` | 5 | 0 | 3 | ✅ |
| King Store | 7290058108879 | Bina | `kingstore` | 4 | 0 | 2 | ✅ |
| **Yochananof** | 7290803800003 | Cerberus | `yohananof` | 3 | 0 | 1 | ✅ (+ PriceFull/PromoFull) |
| Mahsani HaShuk | 7290661400001 | Laibcatalog | edi `7290661400001` | 0 | 1 | 10 | ✅ |
| Bareket | 7290875100001 | Bina | `superbareket` | 2 | 1 | 0 | ✅ |
| City Market | 7290058266241 | Bina | `citymarketkiryatgat` | 1 | 2 | 2 | ✅ |
| Keshet Teamim | 7290785400000 | Cerberus | `Keshet` | 1 | 1 | 1 | ✅ |
| Osher Ad | 7290103152017 | Cerberus | `osherad` | 1 | 0 | 1 | ✅ |
| Maayan 2000 | 7290058159628 | Bina | `maayan2000` | 0 | 0 | 3 | ✅ |
| Netiv HaHesed | 7290058160839 | own site | app.netiv-hesed.com | 0 | 1 | 0 | ✅ |

Rough total: **~215 TLV + ~40 RG + ~65 BS stores** across 20 chains.

### Checked, no stores in the target cities (per their Stores file)

Hazi Hinam (13 stores listed — the file looks partial, re-check), H. Cohen,
Stop Market (`Stop_Market`), Politzer (`politzer`), Shefa Birkat Hashem,
Shuk HaIr, Zol VeBegadol, Meshnat Yosef 1/2, City Market Shops (empty file).

### Not verified

| Chain | Why |
|---|---|
| Yellow (Paz), Super Yuda, Salach Dabach | Their Cerberus accounts need a non-empty published password. I didn't log in with those. Yellow (Paz convenience stores) very likely has TLV stores, so it's worth adding: run the verify command below with the password from the chain's transparency page. |
| Quik, Cofix, Mega, City Market Givatayim/Kiryat Ono | Defunct, merged or removed from the gov.il list. |

## Product photos

The price files carry no photos. In order of preference, an item doc's `img` is:

1. **Rami Levy's image CDN**, by barcode: `https://img.rami-levy.co.il/product/<barcode>/small.jpg`
   (200 = photo, 403 = none; robots.txt `Allow: /product/`). It covers far more
   than Rami Levy's own range. Link only — the files are never copied.
2. **Wolt, as a fallback only** (owner's call, 2026-11-17 — see Wolt's terms below):
   a priced Wolt venue's own photo, then
3. **a photo-only Wolt venue** (places/wolt.json `photosOnly`, e.g. a Wolt Market
   dark store), cached per week.
4. **Open Food Facts** (`imgBy: 'off'`): `image_url` from the monthly CSV export,
   streamed and filtered to our barcodes (never saved whole). Photos are
   CC BY-SA: credit "Open Food Facts" where shown.
5. **Borrowed by name** (`imgBy: 'name'`, `src/lib/shopping/photos.ts`): loose
   produce and other chain-internal codes take the photo of the same product
   under another code — same department, same head word, every word of the
   item in the other name. An illustration, not the exact pack.

Sources 2 and 4 are probed by `npm run shopping:photos` (`ingest/fetch-photos.ts`:
Rami Levy 1.5 s apart, most widely sold first, misses re-checked after 30
days; `--off` refreshes OFF at most monthly) into `photos/*.json`; the ingest
only reads those caches. The evaluation behind this (coverage, terms, what
was rejected): [shopping-photo-sources.md](shopping-photo-sources.md).

**Wolt's terms** (Israel, §12.3 and §13.6) prohibit scraping and systematic
retrieval. The owner kept Wolt prices, and Wolt photos only where no other
source has one (about a third of what they covered — mainly loose produce and
imports; Rami Levy has no produce photos).

## File format observations

- **Encoding:** every Cerberus `Stores` file, and Bitan's, is **UTF-16 LE with BOM**. Shufersal and Hazi Hinam are UTF-8 **with BOM**. The rest are UTF-8. Yochananof's PriceFull is UTF-8 with BOM. Detect by BOM, fall back to UTF-8, then windows-1255.
- **Compression:** Cerberus serves `.gz` for Price/Promo but plain `.xml` for Stores. Hazi Hinam names a plain XML file `….gz.xml`. Sniff the gzip magic (`1f 8b`) — don't trust the extension.
- **File naming:** `PriceFull<chain>-<subchain>-<store>-<YYYYMMDD>-<HHMMSS>.gz`. The Laibcatalog chains use `…-<YYYYMMDDHHMMSS>-<HHMMSS>`, and City Market Shops uses `StoresFull…-<YYYYMMDDHHMM>`. Parse with a tolerant regex.
- **Deltas aren't ingested (yet).** The job reads the latest `PriceFull` / `PromoFull` per store; the hourly `Price` / `Promo` delta files are ignored, which is fine for a manual once-a-day run. Applying them is the step to add if runs ever become hourly.
- **Cadence (Yochananof store 001):** PriceFull and PromoFull at ~00:40 daily, Price/Promo deltas hourly at :40. Full files are ~0.5 MB gz / 8.8 MB XML (price) and ~0.1 MB gz / 3.3 MB XML (promo) per store.
- **Promos:** Yochananof puts `DiscountedPrice`, `DiscountRate` and `MinQty` on each `PromotionItem` inside `Groups/Group/PromotionItems`. `RedemptionLimit`, `MinNoOfItemOffered` and `ClubID` sit on the `Promotion`. `ClubID` is a string like `"0 - כלל הלקוחות"`, so read the leading number.
- **The same PromotionID differs per store** (measured over 60 stores): 2,271 of 9,444 ids had different copies. Item lists differ only by items the store doesn't sell; Shufersal lists chain-wide items in every store's file, so 72% of raw promo-item links pointed at items the store doesn't stock. Percent deals publish a per-store `DiscountedPrice` (= rate × that store's price in 56% of cases, ±1 agora). Meal-voucher coupons ("ע. סיבוס / סודקסו קופון … מתנה") are attached to ~21k items with no discount at all. Each of these is handled in `buildPromoDocs`.
- **Stores with no files:** some stores in a Stores file publish no PriceFull/PromoFull at all — Yochananof 150 (pickup), Rami Levy 39 (מרלוג אינטרנט), Keshet 18 and 91 (Be'er Sheva, the Azrieli food truck) on 2026-11-16. They keep a store doc with `pricesAt: null` and the UI hides them.
- **Store type:** `StoreType` 1 on physical stores, 2 on Wolt's (online) stores. The meaning of other values still needs confirming against the regulation. Some test stores are published as real stores (e.g. "Wolt Market Israel Test Venue", City Market "איפוס ספירות מלאי"). They need a deny-list.

## City matching

`City` is a CBS settlement code in most chains, a Hebrew name in some (Mahsani HaShuk), and `0` for many (Yochananof: all 51 stores).

1. **A non-zero code wins:** 5000 = תל אביב-יפו, 8600 = רמת גן, 9000 = באר שבע. Stores named "…באר שבע" whose code is 666 (Omer) or 1271 (Lehavim) are *not* Be'er Sheva.
2. **Hebrew name in `City`:** match against the alias list (תל אביב / תל-אביב / תל אביב-יפו / ת"א / יפו, רמת גן / ר"ג, באר שבע / ב"ש).
3. **`City` is `0` or empty:** match the alias list against the **store name** as whole words. Never use the address: Keshet store 005 is at "תל אביב 11", a street in Haifa. Plain substring search on "יפו" also matches "איפוס" and "הציפורים".
4. If a store still lands in the wrong city, add a per-store override in `cities.ts` (none needed so far).
5. **Online stores** (`StoreType` 2) are always ingested, whatever their city, and listed separately (`kind: 'online'`): Shufersal ONLINE (413, coded Petah Tikva) and Yochananof הדרים פיקאפ (150, City 0).

## Reference regression example (Yochananof store 001, 2026-11-15)

Raw files are kept in `src/lib/__tests__/fixtures/shopping/yohananof/`:
`PriceFull7290803800003-000-001-20261115-004031.gz`,
`PromoFull7290803800003-000-001-20261115-004031.gz`,
`Stores7290803800003-000-20261115-010000.xml.gz`.

- Barcode `7613036984379` (סטארבקס קפסולות קולו…, 57 g): `ItemPrice` **22.90**.
- `PromotionID` **373587** "קפסולות סטארבקס 50% הנחה עד 6 יח": `DiscountedPrice` **11.40**, `DiscountRate` **50**, `RedemptionLimit` **6**, `MinNoOfItemOffered` **10**, `ClubID` "0 - כלל הלקוחות", runs 2026-11-15T00:00 → **2026-11-20T23:59**, one group of **11** barcodes.

## Open-source scraper evaluation

[`il-supermarket-scraper`](https://pypi.org/project/il-supermarket-scraper/) 1.1.1
(OpenIsraeliSupermarkets, Python):

- **Good:** an up-to-date catalog of all ~30 chains (URLs, usernames, chain IDs, engine types), plus a `scraper_stability.py` that tracks known outages. Its non-Cerberus engines worked first time for every chain above.
- **Bad:**
  - **Its Cerberus engine fails here:** it only uses FTP-over-TLS, which fails here, while plain FTP and HTTPS both work. That's 9 of our 20 chains, Yochananof included.
  - It **swallows errors**: the call returns successfully with zero files and only logs the traceback.
  - It requires Python <3.13.
  - It pulls in Playwright and pymongo.
- **Decision:** use it as the **reference catalog**, not as a runtime dependency. The ingest job implements the ~6 access methods in TypeScript, next to the app and its Mongo helpers. When a chain breaks, check the library's chain file and `scraper_stability.py` first.

## Re-verifying a Cerberus chain

```bash
B=https://url.publishedprices.co.il; U=yohananof; J=$(mktemp)
T=$(curl -s -c $J -b $J $B/login | grep -o 'csrftoken" content="[^"]*"' | sed 's/.*content="//;s/"$//')
curl -s -c $J -b $J -o /dev/null -w '%{redirect_url}\n' -d "r=&username=$U&password=&Submit=Sign+in&csrftoken=$T" $B/login/user
T=$(curl -s -c $J -b $J $B/file | grep -o 'csrftoken" content="[^"]*"' | sed 's/.*content="//;s/"$//')
curl -s -c $J -b $J -d "sEcho=1&iDisplayStart=0&iDisplayLength=50&sSearch=Stores&cd=/&csrftoken=$T" $B/file/json/dir
```
