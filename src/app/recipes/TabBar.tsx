'use client';

// The book's floating bottom tabs (spec 2026-11-25 § Book): שלי · פיד switch the
// book's view; רשימה goes to the household shopping list. Book only.

import Link from 'next/link';
import { FaBookOpen, FaClipboardList, FaUsers } from 'react-icons/fa';
import { SHOPPING_BASE_PATH } from '@/lib/shopping/config';

export type View = 'mine' | 'feed';

export default function TabBar({ view, onView, showList }: { view: View; onView: (v: View) => void; showList: boolean }) {
  const tab = (v: View, label: string, Icon: typeof FaBookOpen) => (
    <button type="button" className={`rc-tab ${view === v ? 'is-on' : ''}`} aria-current={view === v ? 'page' : undefined} onClick={() => onView(v)}>
      <Icon aria-hidden /><span>{label}</span>
    </button>
  );
  return (
    <nav className="rc-tabbar" aria-label="ניווט מתכונים">
      {tab('mine', 'שלי', FaBookOpen)}
      {tab('feed', 'פיד', FaUsers)}
      {showList ? <Link href={SHOPPING_BASE_PATH} className="rc-tab"><FaClipboardList aria-hidden /><span>רשימה</span></Link> : null}
    </nav>
  );
}
