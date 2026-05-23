'use client';

import React from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { signIn, useSession } from 'next-auth/react';
import { FaDog, FaCoffee, FaVideo, FaDumbbell, FaRing, FaPlane, FaSpa, FaSignInAlt } from 'react-icons/fa';
import type { IconType } from 'react-icons';
import Navbar from '@/components/Navbar';
import CountdownTimer from '@/components/CountdownTimer';
import { hasPermission } from '@/lib/permissions';
import type { PermissionKey } from '@/types/permissions';

const GoldSparkles = dynamic(() => import('@/components/PeriodicConfetti'), {
  ssr: false,
});

interface Feature {
  icon: IconType;
  title: string;
  description: string;
  href: string;
  linkText?: string;
  permission: PermissionKey;
}

const allFeatures: Feature[] = [
  { icon: FaDog,      title: 'שמות האוליבון',      description: 'כל שמות האוליבון לעולם ועד',          href: '/family-tree',              linkText: 'צפה בשמות האוליבון', permission: 'family-tree' },
  { icon: FaCoffee,   title: 'מקפקפים',           description: 'ביקורות על קפה מאת תומית ותומרינדי',  href: '/mekafkefim',               linkText: 'צפה במקפקפים',       permission: 'mekafkefim'  },
  { icon: FaVideo,    title: 'InsTomit',          description: 'סרטונים קצרים של התומים',             href: '/instomit',                 linkText: 'צפה ב-InsTomit',     permission: 'instomit'    },
  { icon: FaRing,     title: 'Wedding Guide',     description: 'מדריך חתונה בלאס וגאס',               href: '/vegas-wedding-guide.html', linkText: 'למדריך החתונה',      permission: 'vegas-guide' },
  { icon: FaDumbbell, title: 'המפלצתומים',        description: 'מעקב אימונים לתום ותומר',             href: '/workout',                  linkText: 'לאימון',             permission: 'workout'     },
  { icon: FaPlane,    title: 'USA & Mexico Trip', description: 'מסלול הטיול המלא 2026',               href: '/trip.html',                linkText: 'צפה במסלול',         permission: 'trip'        },
  { icon: FaSpa,      title: 'ספא',               description: 'תזמון עיסוי בין התומ.ים עם הזמנה ליומן', href: '/spa',                  linkText: 'לתזמון עיסוי',       permission: 'spa'         },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' as const },
  },
};

export default function Home() {
  const { data: session, status } = useSession();
  const signedIn = !!session?.user;
  const features = allFeatures.filter((f) => hasPermission(session, f.permission));

  // Empty-state message for an allowlisted user with no granted pages yet
  // — the only signal they get otherwise is an empty grid, which feels
  // broken.
  const showNoAccessHint = status !== 'loading' && signedIn && features.length === 0;

  return (
    <>
      <Navbar />
      <GoldSparkles />

      <div className="birthday-container">
        <motion.div
          className="birthday-hero"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          <h1 className="birthday-title">💍 התומ.ים מתחתנים 💒</h1>
          <div className="gold-divider" />
          <CountdownTimer />

          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.75rem', marginTop: '1.5rem' }}>
            {features.map(({ href, title, icon: Icon }) => (
              <Link key={href} href={href}>
                <button className="birthday-button">
                  <Icon />
                  {title}
                </button>
              </Link>
            ))}
            {status !== 'loading' && !signedIn && (
              <button
                type="button"
                className="birthday-button"
                onClick={() => signIn('google', { callbackUrl: '/' })}
              >
                <FaSignInAlt />
                כניסה עם Google
              </button>
            )}
          </div>
        </motion.div>

        {showNoAccessHint && (
          <p
            style={{
              textAlign: 'center',
              marginTop: '2rem',
              color: '#c9a96e',
              fontSize: '0.95rem',
              lineHeight: 1.5,
            }}
          >
            הגעת בשלום, אבל עדיין אין לך גישה לאף עמוד.<br />
            פנה לתום או לתומר כדי שיפתחו לך הרשאות.
          </p>
        )}

        <motion.div
          className="birthday-features"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
        >
          {features.map(({ icon: Icon, title, description, href, linkText }) => (
            <motion.div key={title} className="feature-card" variants={cardVariants}>
              <div className="feature-icon">
                <Icon />
              </div>
              <h2 className="feature-title">{title}</h2>
              <p className="feature-description">{description}</p>
              {linkText && (
                <Link href={href} className="feature-link">
                  {linkText} ←
                </Link>
              )}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </>
  );
}
