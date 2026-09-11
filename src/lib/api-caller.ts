import { NextRequest, NextResponse } from 'next/server';
import { requirePagePermission } from '@/lib/auth-helpers';
import { getAuthorizedEmailEntry } from '@/models/AuthorizedEmail';
import { getApiKeyOwner, isApiKeyFormat } from '@/models/UserApiSettings';
import { isOwnerEmail } from '@/types/auth';
import type { PermissionKey } from '@/types/permissions';

// One gate for every feature route that both a browser and a headless caller
// (Shortcut / macOS app / MCP) can reach. No Bearer header → the existing
// session permission gate. A Bearer header → resolve the personal key to its
// owner and check that owner's LIVE page permission — the key is only an
// identity, never an elevation. A permission revoked in /admin/allowlist takes
// effect on the caller's next request.
export interface FeatureCaller {
  userEmail: string;
  userName: string;
  authMode: 'session' | 'api-key';
  defaultCoffeeFavoriteId: string | null;
}

function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function isBearerAuthorization(value: string): boolean {
  const spaceIndex = value.indexOf(' ');
  const scheme = spaceIndex === -1 ? value : value.slice(0, spaceIndex);
  return scheme.toLowerCase() === 'bearer';
}

function bearerCredential(value: string): string | null {
  const spaceIndex = value.indexOf(' ');
  if (spaceIndex === -1) return null;
  const credential = value.slice(spaceIndex + 1).trim();
  return isApiKeyFormat(credential) ? credential : null;
}

async function hasCurrentPermission(
  email: string,
  permission: PermissionKey
): Promise<boolean> {
  if (isOwnerEmail(email)) return true;
  const entry = await getAuthorizedEmailEntry(email);
  return entry?.allowedPages.includes(permission) === true;
}

export async function requireFeatureCaller(
  request: NextRequest,
  permission: PermissionKey
): Promise<FeatureCaller | NextResponse> {
  const authorization = request.headers.get('authorization');
  if (authorization && isBearerAuthorization(authorization)) {
    const apiKey = bearerCredential(authorization);
    if (!apiKey) return unauthorized();

    const owner = await getApiKeyOwner(apiKey);
    if (!owner || !owner.apiKey) return unauthorized();
    if (!(await hasCurrentPermission(owner.userEmail, permission))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return {
      userEmail: owner.userEmail,
      userName: owner.userName,
      authMode: 'api-key',
      defaultCoffeeFavoriteId: owner.defaultCoffeeFavoriteId,
    };
  }

  const gate = await requirePagePermission(permission);
  if (gate instanceof NextResponse) return gate;
  const email = gate.session.user.email.toLowerCase();
  return {
    userEmail: email,
    userName: gate.session.user.name?.trim() || email.split('@')[0],
    authMode: 'session',
    defaultCoffeeFavoriteId: null,
  };
}
