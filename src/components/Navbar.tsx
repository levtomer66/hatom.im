'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signIn, signOut, useSession } from 'next-auth/react';
import {
  FaDog,
  FaCoffee,
  FaVideo,
  FaDumbbell,
  FaHome,
  FaRing,
  FaPlane,
  FaSpa,
  FaHeart,
  FaUserShield,
  FaSignOutAlt,
  FaSignInAlt,
} from 'react-icons/fa';
import { hasPermission } from '@/lib/permissions';
import type { PermissionKey } from '@/types/permissions';

type Visibility =
  | 'public'
  | 'owner'
  | { permission: PermissionKey };

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ style?: React.CSSProperties }>;
  exact?: boolean;
  visibility: Visibility;
};

const allNavItems: NavItem[] = [
  { href: '/',                         label: 'בית',           icon: FaHome,       exact: true, visibility: 'public' },
  { href: '/family-tree',              label: 'שמות האוליבון', icon: FaDog,        visibility: { permission: 'family-tree' } },
  { href: '/mekafkefim',               label: 'מקפקפים',       icon: FaCoffee,     visibility: { permission: 'mekafkefim'  } },
  { href: '/instomit',                 label: 'InsTomit',      icon: FaVideo,      visibility: { permission: 'instomit'    } },
  { href: '/workout',                  label: 'המפלצתומים',    icon: FaDumbbell,   visibility: { permission: 'workout'     } },
  { href: '/spa',                      label: 'ספא',           icon: FaSpa,        visibility: { permission: 'spa'         } },
  { href: '/vegas-wedding-guide.html', label: 'מדריך חתונה',   icon: FaRing,       visibility: { permission: 'vegas-guide' } },
  { href: '/trip.html',                label: 'מסלול הטיול',   icon: FaPlane,      visibility: { permission: 'trip'        } },
  { href: '/sex',                      label: 'ולנטיין',       icon: FaHeart,      visibility: { permission: 'valentine'   } },
  { href: '/admin/allowlist',          label: 'הרשאות',        icon: FaUserShield, visibility: 'owner' },
];

const Navbar: React.FC = () => {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const signedIn = !!session?.user;
  const isOwner = session?.user?.isOwner === true;
  const [open, setOpen] = useState(false);

  const items = allNavItems.filter((item) => {
    if (item.visibility === 'public') return true;
    if (item.visibility === 'owner') return isOwner;
    return hasPermission(session, item.visibility.permission);
  });

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname === href || pathname?.startsWith(href + '/');
  };

  // Auto-close on route change so a nav tap dismisses the drawer.
  useEffect(() => { setOpen(false); }, [pathname]);

  // ESC closes; lock body scroll while the drawer is open so the
  // backdrop doesn't scroll the page behind it on mobile.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <nav className="navbar">
        <div className="navbar-container">
          <button
            type="button"
            className="navbar-hamburger"
            aria-label="פתיחת תפריט"
            aria-expanded={open}
            aria-controls="site-drawer"
            onClick={() => setOpen(true)}
          >
            <span /><span /><span />
          </button>

          <div className="navbar-logo">
            <Link href="/">התומ.ים</Link>
          </div>

          <div className="navbar-auth-compact">
            {status !== 'loading' && (
              signedIn ? (
                session.user?.image ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={session.user.image}
                    alt={session.user?.name ?? ''}
                    title={session.user?.email ?? undefined}
                    className="navbar-avatar"
                  />
                ) : (
                  <span className="navbar-avatar navbar-avatar-fallback" title={session.user?.email ?? undefined}>
                    {(session.user?.name ?? session.user?.email ?? '?').slice(0, 1).toUpperCase()}
                  </span>
                )
              ) : (
                <button
                  type="button"
                  className="navbar-auth-btn"
                  onClick={() => signIn('google', { callbackUrl: pathname || '/' })}
                >
                  <FaSignInAlt style={{ marginInlineEnd: '0.3rem' }} />
                  כניסה
                </button>
              )
            )}
          </div>
        </div>
      </nav>

      <div
        className={`drawer-backdrop ${open ? 'open' : ''}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      <aside
        id="site-drawer"
        className={`drawer ${open ? 'open' : ''}`}
        aria-hidden={!open}
      >
        <div className="drawer-header">
          <button
            type="button"
            className="drawer-close"
            aria-label="סגירת תפריט"
            onClick={() => setOpen(false)}
          >
            ✕
          </button>
          <span className="drawer-title">תפריט</span>
        </div>

        <nav className="drawer-links">
          {items.map(({ href, label, icon: Icon, exact }) => (
            <Link
              key={href}
              href={href}
              className={`drawer-link ${isActive(href, exact) ? 'active' : ''}`}
            >
              <Icon style={{ flexShrink: 0 }} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        {signedIn && (
          <div className="drawer-footer">
            <div className="drawer-user">
              <span className="drawer-user-name">{session.user?.name ?? session.user?.email}</span>
              {session.user?.name && session.user?.email && (
                <span className="drawer-user-email">{session.user.email}</span>
              )}
            </div>
            <button
              type="button"
              className="drawer-signout"
              onClick={() => signOut({ callbackUrl: '/' })}
            >
              <FaSignOutAlt />
              <span>יציאה</span>
            </button>
          </div>
        )}
      </aside>
    </>
  );
};

export default Navbar;
