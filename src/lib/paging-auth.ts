import { NextRequest, NextResponse } from 'next/server';
import { requirePagePermission } from '@/lib/auth-helpers';
import { getAuthorizedEmailEntry } from '@/models/AuthorizedEmail';
import { verifyPagingShortcutToken } from '@/lib/paging-shortcut-token';
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

export async function requirePagingCaller(
  request: NextRequest
): Promise<PagingCaller | NextResponse> {
  const authorization = request.headers.get('authorization');
  if (authorization?.startsWith('Bearer ')) {
    const claims = verifyPagingShortcutToken(authorization.slice(7).trim());
    if (!claims) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const email = claims.sub.toLowerCase();
    if (!(await hasFreshPagingPermission(email))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return { email, source: 'shortcut' };
  }

  const gate = await requirePagePermission('paging');
  if (gate instanceof NextResponse) return gate;
  return { email: gate.session.user.email.toLowerCase(), source: 'web' };
}
