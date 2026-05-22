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

const GoldSparkles = dynamic(() => import('@/components/PeriodicConfetti'), {
  ssr: false,
});

type Visibility = 'public' | 'signedIn' | 'owner';

interface Feature {
  icon: IconType;
  title: string;
  description: string;
  href: string;
  linkText?: string;
  visibility: Visibility;
}

const allFeatures: Feature[] = [
  { icon: FaDog,      title: 'שמות האוליבון', description: 'כל שמות האוליבון לעולם ועד',         href: '/family-tree',             linkText: 'צפה בשמות האוליבון', visibility: 'public' },
  { icon: FaCoffee,   title: 'מקפקפים',       description: 'ביקורות על קפה מאת תומית ותומרינדי', href: '/mekafkefim',              linkText: 'צפה במקפקפים',       visibility: 'public' },
  { icon: FaVideo,    title: 'InsTomit',      description: 'סרטונים קצרים של התומים',            href: '/instomit',                linkText: 'צפה ב-InsTomit',     visibility: 'public' },
  { icon: FaRing,     title: 'Wedding Guide', description: 'מדריך חתונה בלאס וגאס',              href: '/vegas-wedding-guide.html', linkText: 'למדריך החתונה',     visibility: 'public' },
  { icon: FaDumbbell, title: 'המפלצתומים',    description: 'מעקב אימונים לתום ותומר',            href: '/workout',                 linkText: 'לאימון',             visibility: 'signedIn' },
  { icon: FaPlane,    title: 'USA & Mexico Trip', description: 'מסלול הטיול המלא 2026',         href: '/trip.html',               linkText: 'צפה במסלול',         visibility: 'signedIn' },
  { icon: FaSpa,      title: 'ספא',           description: 'תזמון עיסוי בין התומ.ים עם הזמנה ליומן', href: '/spa',                linkText: 'לתזמון עיסוי',       visibility: 'owner' },
];

function visibleFor(opts: { signedIn: boolean; isOwner: boolean }): Feature[] {
  return allFeatures.filter((f) => {
    if (f.visibility === 'public') return true;
    if (f.visibility === 'signedIn') return opts.signedIn;
    return opts.isOwner;
  });
}

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
  const isOwner = session?.user?.isOwner === true;
  const features = visibleFor({ signedIn, isOwner });

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
