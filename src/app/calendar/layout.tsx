import type { Metadata } from 'next';
import { Secular_One } from 'next/font/google';
import './calendar.css';

// Display face for the tear-off page numerals and headings. next/font
// self-hosts it, so no CSP change is needed.
const secularOne = Secular_One({
  subsets: ['hebrew', 'latin'],
  weight: '400',
  variable: '--font-cal-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: '📅 לוח שנה',
  description: 'ימי הולדת, ימי שנה ואירועים שבדרך',
};

export default function CalendarLayout({ children }: { children: React.ReactNode }) {
  return <div className={`cal-root ${secularOne.variable}`}>{children}</div>;
}
