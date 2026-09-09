import { timingSafeEqual } from 'node:crypto';

const MAX_PAGING_SHORTCUT_BEARER_BYTES = 512;

export class PagingShortcutConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PagingShortcutConfigurationError';
  }
}

export interface PagingShortcutConfiguration {
  email: string;
  token: Buffer;
}

function normalizeShortcutEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes('@')) {
    throw new PagingShortcutConfigurationError('PAGING_SHORTCUT_EMAIL is invalid');
  }
  return normalized;
}

function configuredToken(): Buffer {
  const value = process.env.PAGING_SHORTCUT_TOKEN;
  if (!value || value.trim() === '') {
    throw new PagingShortcutConfigurationError(
      'PAGING_SHORTCUT_TOKEN is not configured'
    );
  }
  if (value !== value.trim()) {
    throw new PagingShortcutConfigurationError('PAGING_SHORTCUT_TOKEN is invalid');
  }
  return Buffer.from(value, 'utf8');
}

export function getPagingShortcutCallerEmail(): string {
  const value = process.env.PAGING_SHORTCUT_EMAIL;
  if (!value) {
    throw new PagingShortcutConfigurationError(
      'PAGING_SHORTCUT_EMAIL is not configured'
    );
  }
  return normalizeShortcutEmail(value);
}

export function loadPagingShortcutConfiguration(): PagingShortcutConfiguration {
  return {
    email: getPagingShortcutCallerEmail(),
    token: configuredToken(),
  };
}

export function verifySuppliedPagingShortcutBearerToken(
  suppliedToken: string,
  expectedToken: Buffer
): boolean {
  if (Buffer.byteLength(suppliedToken, 'utf8') > MAX_PAGING_SHORTCUT_BEARER_BYTES) {
    return false;
  }
  const actual = Buffer.from(suppliedToken, 'utf8');
  if (actual.length !== expectedToken.length) return false;
  return timingSafeEqual(actual, expectedToken);
}
