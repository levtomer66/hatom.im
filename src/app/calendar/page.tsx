'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { FaChevronLeft, FaChevronRight, FaPlus } from 'react-icons/fa';
import Navbar from '@/components/Navbar';
import {
  countdownLabel,
  eventsInMonth,
  getEventKind,
  localTodayYmd,
  milestoneLabel,
  monthGrid,
  parseYmd,
  pastEvents,
  toYmd,
  upcoming,
  type CalendarEvent,
  type CalendarEventInput,
  type Occurrence,
} from '@/lib/calendar';
import EventSheet, { type SheetTarget } from './EventSheet';

const WEEKDAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

// Bare dates are built as local days (new Date(y, m-1, d)) so Intl never
// shifts them across a time zone.
function localDate(ymd: string): Date {
  const { y, m, d } = parseYmd(ymd)!;
  return new Date(y, m - 1, d);
}
const fullDate = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
const weekdayName = new Intl.DateTimeFormat('he-IL', { weekday: 'long' });
const monthYear = new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' });

const emojiOf = (e: CalendarEvent) => e.emoji || getEventKind(e.kind).emoji;

type SheetState = SheetTarget | null;

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<T>;
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  // Set after mount so server and client render agree.
  const [today, setToday] = useState<string | null>(null);
  const [view, setView] = useState<{ y: number; m: number } | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const [sheet, setSheet] = useState<SheetState>(null);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      setEvents(await request<CalendarEvent[]>('/api/calendar/events'));
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    const t = localTodayYmd();
    const { y, m } = parseYmd(t)!;
    setToday(t);
    setView({ y, m });
    load();
    // Roll "today" over when the tab comes back after midnight.
    const onVisible = () => {
      if (document.visibilityState === 'visible') setToday(localTodayYmd());
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  const coming = useMemo(() => (events && today ? upcoming(events, today) : []), [events, today]);
  const past = useMemo(() => (events && today ? pastEvents(events, today) : []), [events, today]);
  const monthEvents = useMemo(
    () => (events && view ? eventsInMonth(events, view.y, view.m) : new Map<number, CalendarEvent[]>()),
    [events, view],
  );

  const closeSheet = useCallback(() => setSheet(null), []);

  const save = async (input: CalendarEventInput) => {
    if (sheet && 'event' in sheet) {
      const updated = await request<CalendarEvent>(`/api/calendar/events/${sheet.event.id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      });
      setEvents((list) => list?.map((e) => (e.id === updated.id ? updated : e)) ?? [updated]);
    } else {
      const created = await request<CalendarEvent>('/api/calendar/events', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      setEvents((list) => [...(list ?? []), created]);
    }
    setSheet(null);
  };

  const remove = async () => {
    if (!sheet || !('event' in sheet)) return;
    const { id } = sheet.event;
    await request(`/api/calendar/events/${id}`, { method: 'DELETE' });
    setEvents((list) => list?.filter((e) => e.id !== id) ?? []);
    setSheet(null);
  };

  const shiftMonth = (delta: number) => {
    setSelectedDay(null);
    setView((v) => {
      if (!v) return v;
      const index = v.y * 12 + (v.m - 1) + delta;
      return { y: Math.floor(index / 12), m: (index % 12) + 1 };
    });
  };

  const ready = events !== null && today !== null && view !== null;
  const hero = coming.length ? coming[heroIndex % coming.length] : null;
  const selectedEvents = selectedDay !== null ? monthEvents.get(selectedDay) ?? [] : [];

  return (
    <>
      <Navbar />
      <main className="cal-page">
        <header className="cal-header">
          <h1 className="cal-title">לוח שנה</h1>
          <button type="button" className="cal-add" disabled={!today} onClick={() => today && setSheet({ date: today })}>
            <FaPlus aria-hidden /> אירוע חדש
          </button>
        </header>

        {loadError && (
          <p className="cal-error" role="alert">
            לא הצלחנו לטעון את הלוח.{' '}
            <button type="button" className="cal-link" onClick={load}>
              לנסות שוב
            </button>
          </p>
        )}

        {ready && (
          <>
            {hero ? (
              <TearOff
                occurrence={hero}
                position={coming.length > 1 ? `${(heroIndex % coming.length) + 1} מתוך ${coming.length}` : null}
                onNext={() => setHeroIndex((i) => i + 1)}
                onEdit={() => setSheet({ event: hero.event })}
              />
            ) : (
              <p className="cal-empty">אין עדיין כלום בלוח. הוסיפו יום הולדת, יום שנה או אירוע שמחכה לכם.</p>
            )}

            <section className="cal-month" aria-label="לוח חודשי">
              <div className="cal-month-head">
                <button type="button" className="cal-nav" onClick={() => shiftMonth(-1)} aria-label="החודש הקודם">
                  <FaChevronRight aria-hidden />
                </button>
                <h2 className="cal-month-name">{monthYear.format(new Date(view.y, view.m - 1, 1))}</h2>
                <button type="button" className="cal-nav" onClick={() => shiftMonth(1)} aria-label="החודש הבא">
                  <FaChevronLeft aria-hidden />
                </button>
              </div>
              <div className="cal-grid">
                {WEEKDAYS.map((w) => (
                  <span key={w} className="cal-weekday" aria-hidden>
                    {w}
                  </span>
                ))}
                {monthGrid(view.y, view.m).flat().map((day, i) => {
                  if (day === null) return <span key={`pad-${i}`} className="cal-day cal-day--pad" />;
                  const ymd = toYmd(view.y, view.m, day);
                  const dayEvents = monthEvents.get(day) ?? [];
                  const classes = [
                    'cal-day',
                    ymd === today && 'is-today',
                    selectedDay === day && 'is-selected',
                    dayEvents.length > 0 && 'has-events',
                  ]
                    .filter(Boolean)
                    .join(' ');
                  return (
                    <button
                      key={ymd}
                      type="button"
                      className={classes}
                      aria-label={`${fullDate.format(new Date(view.y, view.m - 1, day))}${
                        dayEvents.length ? `: ${dayEvents.map((e) => e.title).join(', ')}` : ''
                      }`}
                      onClick={() =>
                        dayEvents.length ? setSelectedDay(day === selectedDay ? null : day) : setSheet({ date: ymd })
                      }
                    >
                      <span className="cal-day-num">{day}</span>
                      {dayEvents.length > 0 && (
                        <span className="cal-pins" aria-hidden>
                          {dayEvents.slice(0, 3).map((e) => (
                            <span key={e.id} className={`cal-pin cal-pin--${e.kind}`} />
                          ))}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {selectedDay !== null && (
                <ul className="cal-day-list">
                  {selectedEvents.map((e) => (
                    <li key={e.id}>
                      <button type="button" className="cal-day-item" onClick={() => setSheet({ event: e })}>
                        <span aria-hidden>{emojiOf(e)}</span> {e.title}
                      </button>
                    </li>
                  ))}
                  <li>
                    <button
                      type="button"
                      className="cal-link"
                      onClick={() => setSheet({ date: toYmd(view.y, view.m, selectedDay) })}
                    >
                      הוספת אירוע ביום הזה
                    </button>
                  </li>
                </ul>
              )}
            </section>

            {coming.length > 0 && (
              <section className="cal-section">
                <h2 className="cal-section-title">מה מחכה לנו</h2>
                <ol className="cal-list">
                  {coming.map((o) => (
                    <li key={o.event.id}>
                      <button type="button" className="cal-item" onClick={() => setSheet({ event: o.event })}>
                        <span className={`cal-count cal-count--${o.event.kind}`}>
                          {o.daysUntil === 0 ? (
                            <span className="cal-count-word">היום</span>
                          ) : (
                            <>
                              <span className="cal-count-num">{o.daysUntil}</span>
                              <span className="cal-count-unit">{o.daysUntil === 1 ? 'יום' : 'ימים'}</span>
                            </>
                          )}
                        </span>
                        <span className="cal-item-body">
                          <span className="cal-item-title">
                            <span aria-hidden>{emojiOf(o.event)}</span> {o.event.title}
                          </span>
                          <span className="cal-item-meta">
                            {weekdayName.format(localDate(o.date))}, {fullDate.format(localDate(o.date))}
                            {milestoneLabel(o) && <span className="cal-item-badge">{milestoneLabel(o)}</span>}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {past.length > 0 && (
              <details className="cal-section cal-past">
                <summary className="cal-section-title">היו פעם ({past.length})</summary>
                <ul className="cal-list">
                  {past.map((e) => (
                    <li key={e.id}>
                      <button type="button" className="cal-item cal-item--past" onClick={() => setSheet({ event: e })}>
                        <span className="cal-item-body">
                          <span className="cal-item-title">
                            <span aria-hidden>{emojiOf(e)}</span> {e.title}
                          </span>
                          <span className="cal-item-meta">{fullDate.format(localDate(e.date))}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </main>

      {sheet && (
        <EventSheet
          initial={sheet}
          onSave={save}
          onDelete={'event' in sheet ? remove : undefined}
          onClose={closeSheet}
        />
      )}
    </>
  );
}

// The next milestone as a tear-off desk-calendar page. Tapping the page tears
// it off to show the one after.
function TearOff({
  occurrence,
  position,
  onNext,
  onEdit,
}: {
  occurrence: Occurrence;
  position: string | null;
  onNext: () => void;
  onEdit: () => void;
}) {
  const reduce = useReducedMotion();
  const date = localDate(occurrence.date);
  const label = milestoneLabel(occurrence);
  const { event } = occurrence;

  return (
    <section className="cal-hero" aria-label="האירוע הבא">
      <div className="cal-stack">
        <div className="cal-pad" aria-hidden />
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.button
            key={`${event.id}-${occurrence.date}`}
            type="button"
            className={`cal-tearoff cal-tearoff--${event.kind}`}
            onClick={position ? onNext : onEdit}
            aria-label={position ? 'לאירוע הבא' : 'עריכת האירוע'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, rotate: 0, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -90, rotate: -9, transition: { duration: 0.35 } }}
            transition={{ duration: 0.2 }}
          >
            <span className="cal-binding">
              <span className="cal-ring" />
              <span className="cal-binding-text">{monthYear.format(date)}</span>
              <span className="cal-ring" />
            </span>
            <span className="cal-big-day">{date.getDate()}</span>
            <span className="cal-weekday-name">{weekdayName.format(date)}</span>
            <span className="cal-hero-title">
              <span aria-hidden>{emojiOf(event)}</span> {event.title}
            </span>
            <span className="cal-hero-foot">
              <span className="cal-hero-count">{countdownLabel(occurrence.daysUntil)}</span>
              {label && <span className="cal-hero-label">{label}</span>}
            </span>
          </motion.button>
        </AnimatePresence>
      </div>
      <div className="cal-hero-actions">
        {position && <span className="cal-hero-pos">לחיצה על הדף מעבירה לבא בתור ({position})</span>}
        <button type="button" className="cal-link" onClick={onEdit}>
          עריכה
        </button>
      </div>
    </section>
  );
}
