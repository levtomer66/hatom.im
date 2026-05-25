#!/usr/bin/env node
// Compresses src/components/valentine/poses/*.png → WebP into an output
// directory. Resizes to ≤ 900 px on the long edge (matches the modal
// display size in sex.css; thumbnails are 160-200 px so we have headroom).
//
// Usage: node scripts/compress-valentine-poses.mjs [outDir]
//   outDir defaults to $CLAUDE_JOB_DIR/poses-compressed or ./tmp/poses-compressed.

import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const SRC = path.resolve('src/components/valentine/poses');
const OUT = path.resolve(
  process.argv[2] ??
    process.env.CLAUDE_JOB_DIR
      ? path.join(process.env.CLAUDE_JOB_DIR ?? '', 'poses-compressed')
      : 'tmp/poses-compressed',
);
const MAX_EDGE = 900;
const QUALITY = 78;

await fs.mkdir(OUT, { recursive: true });

const files = (await fs.readdir(SRC)).filter((f) => /\.(png|jpe?g)$/i.test(f));
files.sort();

const slugify = (name) =>
  name
    .replace(/\.(png|jpe?g)$/i, '')
    .replace(/Screenshot\s+/i, '')
    .replace(/[^\w]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

let totalBefore = 0;
let totalAfter = 0;
const manifest = [];

for (const f of files) {
  const src = path.join(SRC, f);
  const srcStat = await fs.stat(src);
  totalBefore += srcStat.size;

  const slug = slugify(f);
  const outName = `${slug}.webp`;
  const out = path.join(OUT, outName);

  const meta = await sharp(src).metadata();
  await sharp(src)
    .resize({
      width: MAX_EDGE,
      height: MAX_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: QUALITY, effort: 6 })
    .toFile(out);

  const outStat = await fs.stat(out);
  totalAfter += outStat.size;
  manifest.push({
    src: f,
    out: outName,
    slug,
    origBytes: srcStat.size,
    newBytes: outStat.size,
    origW: meta.width,
    origH: meta.height,
  });
}

await fs.writeFile(
  path.join(OUT, 'manifest.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), entries: manifest }, null, 2),
);

const mb = (n) => (n / 1024 / 1024).toFixed(2);
const kb = (n) => (n / 1024).toFixed(1);
const ratio = (1 - totalAfter / totalBefore) * 100;

console.log(`Compressed ${manifest.length} files`);
console.log(`Before: ${mb(totalBefore)} MB  →  After: ${mb(totalAfter)} MB  (saved ${ratio.toFixed(1)}%)`);
console.log(`Output: ${OUT}`);
console.log(`\nSmallest 3 / Largest 3:`);
const sorted = [...manifest].sort((a, b) => a.newBytes - b.newBytes);
for (const e of sorted.slice(0, 3)) console.log(`  ${kb(e.newBytes).padStart(7)} KB  ${e.out}`);
console.log('  ...');
for (const e of sorted.slice(-3)) console.log(`  ${kb(e.newBytes).padStart(7)} KB  ${e.out}`);
