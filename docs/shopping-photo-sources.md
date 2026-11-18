# Product photo sources: research notes (2026-11-17)

Goal: more photos by barcode for the ~34.4k barcoded items that have none
(63% are 729-prefix). Current sources are in `docs/sources.md` § Product
photos. Every number below was measured on 2026-11-17 against
`nophoto-sample.tsv`: 200 barcodes with no photo today, made of 100 that sell
in the most stores ("top") and 100 picked at random from items sold in 3+
stores ("random3+"). Requests used the User-Agent `hatom-shopping-research/0.1`
and were throttled per host (1.6 s or more; 10 s on Shufersal; 5 s on Tiv Taam;
11 s on UPCitemdb).

## Summary of measured hit rates

| Source | top | random3+ | Cost | Verdict |
|---|---|---|---|---|
| Rami Levy image CDN (`img.rami-levy.co.il/product/<barcode>/…`) | **100/100** | **71/100** | free | best by far (see the caveats) |
| Open Food Facts, every barcode (not only the Israel tag) | 33/100 | 11/100 | free | finish it. Adds 1 item beyond Rami Levy |
| Wolt chain venues (Carrefour, Victory, Tiv Ta'am, Shufersal), union | 19/20 | 11/20 | free | Wolt's terms ban this; it adds 1/40 beyond Rami Levy |
| Wolt Market dark store (beer-sheva) | 0/20 | 1/20 | free | adds almost nothing beyond Florentine |
| Tiv Ta'am online (ZuZ platform, GS1 images) | **100/100** | **68/100** | free | strong second source; adds 2 beyond Rami Levy |
| Open Beauty / Open Products Facts (20 non-food items) | 1 of 20 non-food | 2 of 20 non-food | free | marginal |
| UPCitemdb trial (30 barcodes) | 5/15 found, 0 images | 2/15 found, 0 images | free trial / paid | no |
| Wikidata GTIN (P3962) | 1 item worldwide has a 729 GTIN | — | free | no |

**Rami Levy plus Open Food Facts together cover 100/100 top and 72/100
random3+ of today's photo-less sample.**

## 1. Rami Levy image CDN (new; recommended)

- **Access:** `GET https://img.rami-levy.co.il/product/<barcode>/small.jpg`
  (also `large.jpg`). You build the URL from the barcode alone; no API call
  or search is needed. A miss returns `403 application/xml` (an S3 AccessDenied
  served through Cloudflare); a hit returns `200 image/jpeg`. `small` is about
  6–20 KB, `large` about 100 KB.
  Headers: `server: cloudflare`, `cache-control: public, max-age=2073600`.
- **robots:** `https://img.rami-levy.co.il/robots.txt` reads
  `User-agent: * / Allow: /product/`. There was no challenge on the image host.
  (The main site `www.rami-levy.co.il` loads a Cloudflare JS-detection script.
  We didn't touch it beyond robots.txt and the homepage.)
- **Coverage:** 100/100 top and 71/100 random3+. The 12 photos I downloaded were
  all distinct (distinct md5) and real pack shots (spot-checked Yotvata
  chocolate milk and Elite Taami pretzel).
  It isn't limited to Rami Levy's own range. Of the sample items found in
  Rami Levy's PriceFull files (18,151 barcodes from 40 cached files), **144 of
  144 have a photo**. Of the items Rami Levy doesn't sell, **27 of 56** still
  have one.
- **Terms:** I couldn't find the site's terms page (`/he/terms`,
  `/he/takanon` and `/he/regulations` return 404, and a web search found
  nothing). Treat the photos as Rami Levy's or the brand owner's copyright.
  For our private, owner-only app, hot-linking the URL (storing only the URL, as we
  do for Wolt) is the lowest-footprint use. Don't re-host the files. Read the terms before any public use.
- **Integration effort: low.** Run one HEAD request per photo-less barcode
  (~34k requests; at 1.5 s that's ~14 h once, so do it in batches across runs),
  then cache hits and misses in `photos/ramilevy.json` with a timestamp. Re-check misses
  monthly and newly seen barcodes on every run. Store `img` =
  `…/small.jpg` (or `large.jpg` for the detail view) with `imgBy: 'ramilevy'`.
  Skip chain-internal codes (`<chainId>:<code>`) and short codes.

## 2. Open Food Facts: replace the failing search loop

- **Finding:** our cached list is `off/israel-partial.json`, a partial run
  (`page/pages/out`), and none of the 44 OFF hits below is in it. The OFF
  source has never been fully loaded, so part of the "gain" here is just
  finishing the existing source.
- **search-a-licious** (`https://search.openfoodfacts.org/search`, AGPL
  service, OpenAPI at `/openapi.json`, version 0.1.0) answered every request
  while `/api/v2/search` was failing. It takes a Lucene query, so one GET
  checks 50 barcodes:
  `?q=code:(7290000066318 OR …)&page_size=100&fields=code,image_front_url,image_url,countries_tags`.
  The Israel tag gives `count: 3554` (fewer than the v2 search's 9,256).
  Four requests covered the whole sample. Results: **55/100 top and 18/100
  random3+ exist in OFF; 33 and 11 of them have a front image.** 9 of the 33
  top hits are *not* tagged Israel (for example Toffifee, tagged France), so the
  lookup should be by our barcodes, not by country.
  Caveat: `search.openfoodfacts.org/robots.txt` is `User-agent: * / Disallow: /`
  (it asks crawlers to stay away; it is not an API policy). The API docs ask
  that "more than a few hundred products" be fetched from the downloads.
  <https://openfoodfacts.github.io/openfoodfacts-server/api/> gives the limits:
  15 req/min for product reads, 10 req/min for search, and 503 when they're exceeded.
- **Bulk exports (preferred for the full 48.5k):**
  - CSV `https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz`
    redirects to S3 `openfoodfacts-ds.s3.eu-west-3.amazonaws.com`.
    It is 1.54 GB gz (Last-Modified 2026-11-16), tab-separated, 211 columns, with
    `code`(1), `last_modified_t`(6), `countries_tags`(41), `image_url`(83) and
    `image_small_url`(84). Stream it through gunzip, keep the rows whose `code` is in our
    barcode set, and drop the rest. One download a month is enough.
  - JSONL `openfoodfacts-products.jsonl.gz`: 13.7 GB. Too big for us.
  - Daily deltas: `https://static.openfoodfacts.org/data/delta/index.txt`
    lists `openfoodfacts_products_<from>_<to>.json.gz` (~21 MB/day). Apply
    them between monthly CSV pulls if freshness matters.
  - Hugging Face `openfoodfacts/product-database`: `food.parquet` 8.06 GB,
    `beauty.parquet` 68 MB, `petfood.parquet` 8 MB. Remote DuckDB column reads
    would avoid the full download, but that adds a dependency. The CSV is simpler.
  - There's no server-side "Israel only" small file. Filtering locally is the only
    way, and it should filter on our barcodes, not on the country tag (see above).
- **Image URL rule** (<https://openfoodfacts.github.io/openfoodfacts-server/api/how-to-download-images/>):
  pad to 13 digits and split `^(...)(...)(...)(.*)$` into folders.
  A selected image is `https://images.openfoodfacts.org/images/products/729/000/006/6318/front_he.<rev>.<size>.jpg`
  (size 100/200/400/full). `<rev>` comes from `images.front_<lang>.rev`, so the
  URL can't be built from the barcode alone. Use `image_url`/`image_small_url` from
  the export.
- **Licence** (<https://world.openfoodfacts.org/terms-of-use>): the data is ODbL,
  the individual contents are DbCL, and the photos are CC BY-SA 3.0. You must name the licence and
  credit Open Food Facts, linking openfoodfacts.org or the product page.
  Share-alike applies to derivative works.
- **Sister databases:** I looked up the 20 toiletries, cleaning, paper and home items
  (product API, 4.5 s apart). Open Beauty Facts had 1 and Open Products Facts had 2. The CSV
  exports exist on the same `static.` hosts. This is low value; add it only if it's trivially shared
  with the OFF code.
- **Effort: low–medium.** Swap `ingest/off.ts`'s paginated search for a monthly
  CSV stream filter (plus SAL batches of 50 for barcodes first seen between
  pulls, ≤10 req/min).

## 3. Wolt (more venues)

- **Venue listing:** `GET https://consumer-api.wolt.com/v1/pages/venue-list/category-grocery?lat=<lat>&lon=<lon>`
  returns the grocery venues delivering to that point (`/v1/pages/restaurants?lat&lon`
  returns restaurants only). 13 points (TLV, RG, Jerusalem, Haifa, BS, Rishon,
  Netanya, Herzliya, PT, Ashdod, Holon, Ra'anana, north TLV) gave **897
  grocery venues**. Among them are **23 `wolt-market-*`** dark stores (florentine, ben-yehuda,
  bialik, beer-sheva, ashdod, haifa-kiryat-eliezer, herzliya, ramat-hasharon,
  top-dan, wolfson, rishon-lezion, harova, ness-ziona, neot-shamir,
  cinema-city-jlm, jerusalem-talpiot, netanya, petah-tikva, kiryat-ono,
  lev-haaretz, or-yehuda, raanana, kfar-saba) and chain venues: Shufersal 76,
  Tiv Ta'am 36, am:pm 35, Victory 31, Carrefour 30, Rami Levy 20, and Yellow ~70 under three names.
- **Per-venue search** (avoids crawling about 400 category pages per venue):
  `POST https://consumer-api.wolt.com/consumer-api/consumer-assortment/v1/venues/slug/<slug>/assortment/items/search?language=he`
  with body `{"q":"<words>"}`. It matches names only (a barcode as `q` returns
  nothing), and the items carry `barcode_gtin` and `images[].url`. I matched
  barcode to barcode on the first 2–3 name words of 20 top and 20 random3+
  items. Hits, as top / random3+:
  wolt-market-beer-sheva 0/20, 1/20; shufersal-beer-sheva 6/20, 0/20;
  carrefour-beer-sheva-north 13/20, 5/20; victory-beer-sheva 17/20, 6/20;
  tiv-taam-beer-sheva 15/20, 5/20. Union: 19/20, 11/20.
  **Only 1 of those 40 items was not already covered by the Rami Levy CDN.**
  Other Wolt Markets share Florentine's assortment (0/20 top at Be'er Sheva).
- **Terms: blocker.** The Wolt Israel user terms
  (<https://explore.wolt.com/en/isr/terms>) say in §12.3: "Wolt prohibits
  scraping or otherwise conducting any systematic retrieval of data or other
  content from the Wolt Service". §13.6 bars bots and automated use, access
  except through the interfaces Wolt provides, and copying information
  without consent. `wolt.com/robots.txt` allows everything, but the ToS is
  explicit. I stopped the Wolt measurement after 5 venues for this
  reason. **This also covers the Wolt sources we already use.** Rami Levy
  covers almost all of what they add, so it's worth deciding whether to keep them.

## 4. Israeli chains' own online stores

| Chain | What's reachable | Barcode-keyed images? | Terms / robots |
|---|---|---|---|
| Rami Levy | image CDN (see §1) | **yes, deterministic** | robots allows `/product/`; terms page not found |
| Shufersal online | `GET /online/he/search/results?q=:relevance&limit=100&page=N` returns JSON for the whole catalogue (25,501 products, 256 pages); `/online/he/p/P_<barcode>` redirects to the product page. Images are `res.cloudinary.com/shufersal/…/products_large/<5-char>_L_P_<code>_1.png` (prefix not derivable) | no (code `P_<barcode>`, or internal `P_<n>`; `ean` is null) | robots `Crawl-delay: 10`; **terms §95**: content is for private use only and may not be copied or displayed without prior written permission; §86.2 forbids "scanning/sampling" of the site. Not used. I didn't measure beyond 6 test requests. |
| Tiv Ta'am (ZuZ/"retailers" platform, retailer 1062) | `GET /v2/retailers/1062/branches/937/products?appId=4&size=3&filters={"must":{"term":{"barcode":"<b>"}}}` returns JSON with `image.url` = `https://d226b0iufwcjmj.cloudfront.net/gs1-products/1062/{{size}}/<barcode>-<id>/<barcode>/<ts>.jpg`. The path says the image is GS1 Israel catalogue content. A `terms` (multi-barcode) filter is ignored. | lookup by barcode, but the URL holds a timestamp, so you can't build it | robots `Crawl-delay: 4`, disallows `/search*` (not `/v2`); the terms page is a JS shell, so I couldn't read it. Sample (200 requests, 5 s apart): **100/100 top, 68/100 random3+** (66 of them `gs1-products`); 2 random3+ items not on the Rami Levy CDN |
| Victory online | `dlv1nnscfbvda.cloudfront.net/media/…` | not checked further | — |
| Carrefour (carrefour.co.il), Keshet Teamim | **403 on the homepage** (bot protection). Stopped | — | — |
| Yochananof | Next.js storefront, `/robots.txt` returns HTML; no barcode-keyed image URL on the homepage | not found | — |
| Osher Ad | homepage 200, not explored | — | — |

## 5. GS1 Israel

GS1 Israel runs a "digital item catalogue" (קטלוג פריטים דיגיטלי). Brand owners
enter the barcode, name, 360° and marketing images, nutrition and kashrut once,
and retailers and "other data users, such as app developers" receive them
(<https://www.gs1il.org/what-is-the-digital-catalog-of-items/>,
<https://www.gs1il.org/who-is-the-item-catalog-for/>). Neither page mentions
an API, a price or public access. Access is by contact (03-5198714,
<https://www.gs1il.org/contact/>). There's no free or personal route. The Tiv Ta'am
`gs1-products` image paths suggest that chain e-commerce photos, Rami Levy's
probably included, come from this catalogue.

## 6. Manufacturers

Osem's robots.txt answers 403. Strauss and Tnuva have no product sitemap.
Tara's sitemap lists product pages by Hebrew category name, and no barcodes
appear in the pages I opened. I found no product feed or barcode API at any
of them. They aren't worth the effort; GS1 Israel is the channel brands use.

## 7. Barcode lookup APIs

| Service | Test / price | Images? |
|---|---|---|
| UPCitemdb | Trial needs no key: `GET https://api.upcitemdb.com/prod/trial/lookup?upc=<b>`, 100 req/day, 6/min ([limits](https://www.upcitemdb.com/wp/docs/main/development/api-rate-limits/)). **30 sample barcodes: 7 found (4 of them 729), 0 with images**. One 729 hit was wrong (`7290003805501` returned a Fitbit band). | no |
| Barcode Lookup | $99/mo for 5k calls up to $949/mo for 500k; free test account ([api](https://www.barcodelookup.com/api)) | yes per its docs; untested (needs a key) |
| Go-UPC | $74.95/mo for 5k, $245 for 45k; trial key on request ([plans](https://go-upc.com/plans/api)) | "image" field; untested |
| EAN-Search | no free tier; trial €1 then €9/mo for 100 queries, €19/mo for 5k ([api](https://www.ean-search.org/ean-database-api.html)) | no product images (only generated barcode PNGs) |
| Open EAN/GTIN DB | `?ean=&cmd=query&queryid=<id>`, needs a registered queryid; plain-text fields only ([api](https://opengtindb.org/api.php)) | no |
| Datakick | `https://www.datakick.org/api/items/<b>` returns 404 | — |

The paid APIs are Western-retail aggregators. UPCitemdb's showing on 729 codes
suggests poor Israeli coverage. Rami Levy makes them unnecessary.

## 8. Wikimedia / Wikidata

SPARQL on `query.wikidata.org` returns **3,014 items with GTIN (P3962) worldwide,
1 with a 729 prefix, and 266 with an image (P18)**. That's useless here.

## 9. Other delivery apps

- **Yango Deli:** `deli.yango.com/robots.txt` has `Disallow: /api/*` and
  `Disallow: /*?`. Not pursued.
- **10bis / Cibus:** restaurant ordering and meal vouchers; no grocery catalogue API.
  10bis robots.txt doesn't open any API.
- **Mishloha:** restaurant delivery, no barcoded catalogue.

## Ranking (coverage gain per effort, within the rules)

1. **Rami Levy CDN: build the URL, check it with HEAD, cache the result.** It covers 100% of top and 71% of
   random3+ photo-less items, every item Rami Levy sells, and ~48% of the
   others. Low effort. Caveat: terms not located; hot-link only.
2. **Open Food Facts via the monthly CSV export filtered on our barcodes** (plus
   search-a-licious batches for new barcodes). This finishes the existing, half-loaded source.
   Together with item 1 it brings random3+ from 71 to 72 out of 100. Its real value is a CC BY-SA
   fallback with a clear licence for non-Rami-Levy items. It covers 33% top and 11% random3+ on its own.
3. **Tiv Ta'am ZuZ API by barcode.** It scores 100/100 top and 68/100 random3+ on its own, but it
   overlaps with Rami Levy (both draw on GS1 images): only 2 random3+ items are
   not on the Rami Levy CDN. Use it for the leftovers only, at its 4 s crawl-delay. It's
   also the fallback if the Rami Levy CDN ever closes. Its terms couldn't be read.
4. Drop or re-think **Wolt**. Its terms ban systematic retrieval, and nearly
   all it adds is in item 1.
5. Not recommended: Shufersal (terms §95), Carrefour and Keshet (bot protection), paid
   barcode APIs (cost, poor 729 coverage), Wikidata, manufacturers, GS1 Israel
   (no public access).

**Estimated combined coverage:** on the sample, Rami Levy plus OFF reach 100% top and 72%
random3+. Adding Tiv Ta'am brings random3+ to 74%. Extrapolating to all 34.4k photo-less barcodes: items Rami Levy sells
are ~100% covered, and the rest ~48% in the 3+-store tail, probably less in the 1–2-store
tail. Count the photo-less barcodes in Rami Levy's PriceFull files to turn this into a number.
For the items sold in 5+ stores, the 3,331/10,221 figure should rise to well over 90%.
The remaining misses are mostly chain private labels (`7296073…` is Shufersal's: 5,517 such codes in its PriceFull files; also XPO), loose produce, and non-food.
