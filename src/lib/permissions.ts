import type { Session } from 'next-auth';
import type { PermissionKey } from '@/types/permissions';

// Pure client+server safe permission check. Owners always pass; the
// session callback fills `allowedPages` with every key for them, but
// branching off `isOwner` first keeps the intent obvious and avoids a
// hidden assumption about array contents.
//
// Lives in its own module (instead of `auth-helpers.ts`) so client
// components can import it without dragging the server-side `auth()` ->
// MongoDB adapter chain into the browser bundle.
export function hasPermission(
  session: Session | null | undefined,
  key: PermissionKey
): boolean {
  if (!session?.user) return false;
  if (session.user.isOwner) return true;
  return session.user.allowedPages?.includes(key) === true;
}
