'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signIn, signOut, useSession } from 'next-auth/react';
import { FaDog, FaCoffee, FaVideo, FaDumbbell, FaHome, FaRing, FaPlane, FaSpa, FaUserShield } from 'react-icons/fa';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ style?: React.CSSProperties }>;
  exact?: boolean;
  // 'public'        → always visible
  // 'signedIn'      → any authenticated session
  // 'owner'         → Tom or Tomer only
  visibility: 'public' | 'signedIn' | 'owner';
};

const allNavItems: NavItem[] = [
  { href: '/family-tree',             label: 'שמות האוליבון', icon: FaDog,       visibility: 'public' },
  { href: '/mekafkefim',              label: 'מקפקפים',       icon: FaCoffee,    visibility: 'public' },
  { href: '/instomit',                label: 'InsTomit',      icon: FaVideo,     visibility: 'public' },
  { href: '/workout',                 label: 'המפלצתומים',    icon: FaDumbbell,  visibility: 'signedIn' },
  { href: '/spa',                     label: 'ספא',           icon: FaSpa,       visibility: 'owner' },
  { href: '/vegas-wedding-guide.html', label: 'מדריך חתונה',  icon: FaRing,      visibility: 'public' },
  { href: '/trip.html',               label: 'מסלול הטיול',   icon: FaPlane,     visibility: 'signedIn' },
  { href: '/admin/allowlist',         label: 'הרשאות',        icon: FaUserShield, visibility: 'owner' },
  { href: '/',                        label: 'בית',           icon: FaHome,      exact: true, visibility: 'public' },
];

function visibleItems(opts: { signedIn: boolean; isOwner: boolean }): NavItem[] {
  return allNavItems.filter((item) => {
    if (item.visibility === 'public') return true;
    if (item.visibility === 'signedIn') return opts.signedIn;
    return opts.isOwner;
  });
}

const Navbar: React.FC = () => {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const signedIn = !!session?.user;
  const isOwner = session?.user?.isOwner === true;
  const items = visibleItems({ signedIn, isOwner });

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname === href || pathname?.startsWith(href + '/');
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-logo">
          <Link href="/">התומ.ים</Link>
        </div>
        <div className="navbar-links">
          {items.map(({ href, label, icon: Icon, exact }) => (
            <Link
              key={href}
              href={href}
              className={`navbar-link ${isActive(href, exact) ? 'active' : ''}`}
            >
              <Icon style={{ display: 'inline', verticalAlign: '-2px', marginLeft: '4px' }} />
              {label}
            </Link>
          ))}
          {status !== 'loading' && (
            <div className="navbar-auth">
              {signedIn ? (
                <button
                  type="button"
                  className="navbar-link navbar-auth-btn"
                  onClick={() => signOut({ callbackUrl: '/' })}
                  title={session.user?.email ?? undefined}
                >
                  {session.user?.image && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={session.user.image}
                      alt=""
                      width={20}
                      height={20}
                      className="navbar-avatar"
                    />
                  )}
                  <span>יציאה</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="navbar-link navbar-auth-btn"
                  onClick={() => signIn('google', { callbackUrl: pathname || '/' })}
                >
                  כניסה
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
