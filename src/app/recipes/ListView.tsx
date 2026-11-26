'use client';

// The book's רשימה tab: the household shopping list, shown inside /recipes so
// the tab bar stays (recipes' 🛒 fills it). Lines can be removed here; prices
// and the trip are on /shopping, which links back with ?from=recipes.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FaTimes } from 'react-icons/fa';
import { SHOPPING_BASE_PATH } from '@/lib/shopping/config';
import { loadHome, saveHome, type HomeView } from '../shopping/home-client';
import { qtyLabel, Thumb } from '../shopping/ui';
import { PotArt } from './art';

export default function ListView() {
  const [home, setHome] = useState<HomeView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    loadHome().then((h) => { if (live) setHome(h); }).catch(() => { if (live) setError('הרשימה לא נטענה'); });
    return () => { live = false; };
  }, []);

  const remove = async (key: string) => {
    if (!home) return;
    const prev = home;
    setHome({ ...home, list: home.list.filter((l) => l.key !== key) });
    try {
      setHome(await saveHome({ list: prev.list.filter((l) => l.key !== key), home: prev.id }));
      setError(null);
    } catch {
      setHome(prev);
      setError('לא נמחק, נסו שוב');
    }
  };

  if (error && !home) return <p className="cal-error" role="alert">{error}</p>;
  if (!home) return <div className="cal-ring-card is-loading rc-loading" aria-label="טוען" />;
  if (!home.list.length) {
    return (
      <div className="rc-empty-state">
        <PotArt />
        <p>הרשימה ריקה. ממתכון אפשר להוסיף את המצרכים בלחיצה על 🛒</p>
      </div>
    );
  }
  return (
    <>
      {error ? <p className="cal-error" role="alert">{error}</p> : null}
      <section className="sh-card cal-meal" aria-label="רשימת הקניות">
        <ul className="cal-entries">
          {home.list.map((l) => (
            <li key={l.key} className="rc-list-line">
              <Thumb src={home.meta[l.key]?.img} by={home.meta[l.key]?.imgBy} size={40} />
              <span className="rc-list-name">{l.name}</span>
              <span className="cal-muted">{qtyLabel(l.qty, l.w)}</span>
              <button type="button" className="sh-icon-btn" aria-label={`הסרת ${l.name}`} onClick={() => void remove(l.key)}><FaTimes /></button>
            </li>
          ))}
        </ul>
      </section>
      <Link href={`${SHOPPING_BASE_PATH}?from=recipes`} className="rc-cta cal-wide rc-list-go">איפה הכי זול?</Link>
    </>
  );
}
