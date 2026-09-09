import { createHmac, timingSafeEqual } from 'node:crypto';

const TOKEN_VERSION = 1;

export interface PagingShortcutClaims {
  v: 1;
  sub: string;
  iat: number;
}

function secret(): string {
  const value = process.env.PAGING_SHORTCUT_SECRET;
  if (!value) throw new Error('PAGING_SHORTCUT_SECRET is not configured');
  return value;
}

function signature(payload: string): Buffer {
  return createHmac('sha256', secret()).update(payload).digest();
}

export function signPagingShortcutToken(email: string): string {
  const claims: PagingShortcutClaims = {
    v: TOKEN_VERSION,
    sub: email.trim().toLowerCase(),
    iat: Math.floor(Date.now() / 1000),
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${payload}.${signature(payload).toString('base64url')}`;
}

export function verifyPagingShortcutToken(
  token: string
): PagingShortcutClaims | null {
  try {
    const [payload, encodedSignature, extra] = token.split('.');
    if (!payload || !encodedSignature || extra) return null;
    const actual = Buffer.from(encodedSignature, 'base64url');
    const expected = signature(payload);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      return null;
    }
    const claims = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8')
    ) as Partial<PagingShortcutClaims>;
    if (
      claims.v !== TOKEN_VERSION ||
      typeof claims.sub !== 'string' ||
      !claims.sub.includes('@') ||
      typeof claims.iat !== 'number'
    ) {
      return null;
    }
    return claims as PagingShortcutClaims;
  } catch {
    return null;
  }
}
