'use client';

// The book's floating bottom tabs (spec 2026-11-25 § Book): שלי · פיד · רשימה
// switch the book's view (רשימה = the household shopping list, ListView). Book only.

import { FaBookOpen, FaClipboardList, FaUsers } from 'react-icons/fa';

export type View = 'mine' | 'feed' | 'list';

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
      {showList ? tab('list', 'רשימה', FaClipboardList) : null}
    </nav>
  );
}
