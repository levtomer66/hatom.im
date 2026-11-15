// Forgiving reader for the price-transparency XML files.
//
// The files are flat records (<Item>, <Store>, <Promotion>) with leaf
// children, but chains publish them in UTF-8, UTF-16 or windows-1255, with or
// without a BOM, sometimes with a broken tail. A strict XML parser rejects a
// whole file over one bad byte; scanning record blocks keeps every record that
// is intact. Import-free so `node --test` can load it.

/** Decode raw (already gunzipped) bytes, sniffing BOMs, then UTF-8, then windows-1255. */
export function decodeXmlBytes(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3));
  }
  // UTF-16 without a BOM: '<' followed by a NUL byte.
  if (bytes[0] === 0x3c && bytes[1] === 0x00) return new TextDecoder('utf-16le').decode(bytes);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1255').decode(bytes);
  }
}

/** True for gzip data (magic 1f 8b), regardless of the file's extension. */
export function isGzip(bytes: Uint8Array): boolean {
  return bytes[0] === 0x1f && bytes[1] === 0x8b;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export function decodeEntities(s: string): string {
  if (!s.includes('&')) return s;
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/**
 * Inner text of every `<tag>…</tag>` block, case-insensitively. A block left
 * unterminated by a truncated file is dropped, not merged into the next one.
 */
export function blocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}\\s*>`, 'gi');
  const out: string[] = [];
  for (const m of xml.matchAll(re)) out.push(m[1]);
  return out;
}

/** Text of the first `<tag>` in a fragment ('' when missing or self-closing). */
export function field(fragment: string, tag: string): string {
  const m = new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)</${tag}\\s*>`, 'i').exec(fragment);
  return m ? decodeEntities(m[1].trim()) : '';
}

/**
 * Leaf fields of a record, keyed by lower-cased tag name. Nested containers are
 * skipped (their leaves are reached through `blocks`). First occurrence wins.
 */
export function leafFields(fragment: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of fragment.matchAll(/<([A-Za-z_][\w.-]*)(?:\s[^>]*)?>([^<]*)<\/\1\s*>/g)) {
    const key = m[1].toLowerCase();
    if (!(key in out)) out[key] = decodeEntities(m[2].trim());
  }
  for (const m of fragment.matchAll(/<([A-Za-z_][\w.-]*)\s*\/>/g)) {
    const key = m[1].toLowerCase();
    if (!(key in out)) out[key] = '';
  }
  return out;
}
