import { NextRequest, NextResponse } from 'next/server';
import { requirePagePermission } from '@/lib/auth-helpers';
import { getAuthorizedEmailEntry } from '@/models/AuthorizedEmail';
import {
  PagingShortcutConfigurationError,
  loadPagingShortcutConfiguration,
  verifySuppliedPagingShortcutBearerToken,
} from '@/lib/paging-shortcut-auth';
import { isOwnerEmail } from '@/types/auth';
import type { PageSource } from '@/types/paging';

export interface PagingCaller {
  email: string;
  source: PageSource;
}

async function hasFreshPagingPermission(email: string): Promise<boolean> {
  if (isOwnerEmail(email)) return true;
  const entry = await getAuthorizedEmailEntry(email);
  return entry?.allowedPages.includes('paging') === true;
}

function shortcutSetupUnavailable(): NextResponse {
  console.error('[paging] Shortcut auth is not configured');
  return NextResponse.json(
    { error: 'Shortcut setup is not configured' },
    { status: 503 }
  );
}

function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function isBearerAuthorization(authorization: string): boolean {
  const spaceIndex = authorization.indexOf(' ');
  const scheme =
    spaceIndex === -1
      ? authorization
      : authorization.slice(0, spaceIndex);
  return scheme.toLowerCase() === 'bearer';
}

function extractBearerCredentials(authorization: string): string | null {
  const spaceIndex = authorization.indexOf(' ');
  if (spaceIndex === -1) return null;
  return authorization.slice(spaceIndex + 1);
}

export async function requirePagingCaller(
  request: NextRequest
): Promise<PagingCaller | NextResponse> {
  const authorization = request.headers.get('authorization');
  if (authorization && isBearerAuthorization(authorization)) {
    const credentials = extractBearerCredentials(authorization);
    const suppliedToken = credentials?.trim() ?? '';
    if (!suppliedToken) {
      return unauthorized();
    }

    let shortcutConfig;
    try {
      shortcutConfig = loadPagingShortcutConfiguration();
    } catch (error) {
      if (error instanceof PagingShortcutConfigurationError) {
        return shortcutSetupUnavailable();
      }
      throw error;
    }

    if (
      !verifySuppliedPagingShortcutBearerToken(
        suppliedToken,
        shortcutConfig.token
      )
    ) {
      return unauthorized();
    }

    if (!(await hasFreshPagingPermission(shortcutConfig.email))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return { email: shortcutConfig.email, source: 'shortcut' };
  }

  const gate = await requirePagePermission('paging');
  if (gate instanceof NextResponse) return gate;
  return { email: gate.session.user.email.toLowerCase(), source: 'web' };
}
