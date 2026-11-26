// Which image URLs an import may fetch: the URL comes from a page the model
// read, so it is untrusted. https on the default port, a public-looking host
// name — no IP literals, local names or credentials. Import-free (node --test).

const LOCAL = /(^localhost$|\.localhost$|\.local$|\.internal$|\.lan$|\.home$|\.corp$)/i;

export function safeImageUrl(raw: string): string | null {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== 'https:' || u.port || u.username || u.password) return null;
  const host = u.hostname;
  if (!host.includes('.') || LOCAL.test(host)) return null;
  if (/^[\d.]+$/.test(host) || host.startsWith('[') || host.includes(':')) return null;
  return u.toString();
}
