'use client';

import React from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { FaDog, FaCoffee, FaVideo, FaDumbbell, FaCamera } from 'react-icons/fa';
import Navbar from '@/components/Navbar';
import CountdownTimer from '@/components/CountdownTimer';

const GoldSparkles = dynamic(() => import('@/components/PeriodicConfetti'), {
  ssr: false,
});

const features = [
  {
    icon: FaDog,
    title: 'שמות האוליבון',
    description: 'כל שמות האוליבון לעולם ועד',
    href: '/family-tree',
    linkText: 'צפה בשמות האוליבון',
  },
  {
    icon: FaCoffee,
    title: 'מקפקפים',
    description: 'ביקורות על קפה מאת תומית ותומרינדי',
    href: '/mekafkefim',
    linkText: 'צפה במקפקפים',
  },
  {
    icon: FaVideo,
    title: 'InsTomit',
    description: 'סרטונים קצרים של התומים',
    href: '/instomit',
    linkText: 'צפה ב-InsTomit',
  },
  {
    icon: FaDumbbell,
    title: 'המפלצתומים',
    description: 'מעקב אימונים לתום ותומר',
    href: '/workout',
    linkText: 'לאימון',
  },
  {
    icon: FaCamera,
    title: 'Wedding',
    description: 'Coming soon',
    href: '#',
    linkText: '',
  },
];

const heroButtons = [
  { href: '/family-tree', label: 'שמות האוליבון', icon: FaDog },
  { href: '/mekafkefim', label: 'מקפקפים', icon: FaCoffee },
  { href: '/instomit', label: 'InsTomit', icon: FaVideo },
  { href: '/workout', label: 'המפלצתומים', icon: FaDumbbell },
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
    transition: { duration: 0.5, ease: 'easeOut' },
  },
};

export default function Home() {
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
          <h1 className="birthday-title">התומ.ים מתחתנים</h1>
          <div className="gold-divider" />
          <CountdownTimer />

          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.75rem', marginTop: '1.5rem' }}>
            {heroButtons.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href}>
                <button className="birthday-button">
                  <Icon />
                  {label}
                </button>
              </Link>
            ))}
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
