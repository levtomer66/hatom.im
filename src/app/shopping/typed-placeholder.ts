'use client';

// A placeholder that types itself: each phrase is typed out, held, deleted,
// then the next one. Runs only while `active` (the box is empty) and never
// under prefers-reduced-motion, where the first phrase stays put. The input's
// aria-label carries the real name, so screen readers don't hear the typing.
import { useEffect, useState } from 'react';

const TYPE_MS = 75;
const DELETE_MS = 35;
const HOLD_MS = 1600;
const GAP_MS = 350;

export function useTypedPlaceholder(phrases: string[], active: boolean): string {
  const [text, setText] = useState(phrases[0] ?? '');

  useEffect(() => {
    if (phrases.length === 0) return;
    // Paused (the box has focus, or text): the plain first phrase, not a half-typed one beside the cursor.
    if (!active) return setText(phrases[0]);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setText(phrases[0]);
    let phrase = 0;
    let len = phrases[0].length; // start by holding the first phrase, fully typed
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const full = phrases[phrase];
      if (!deleting && len === full.length) {
        deleting = true;
        timer = setTimeout(tick, HOLD_MS);
        return;
      }
      if (deleting && len === 0) {
        deleting = false;
        phrase = (phrase + 1) % phrases.length;
        timer = setTimeout(tick, GAP_MS);
        return;
      }
      len += deleting ? -1 : 1;
      setText(phrases[phrase].slice(0, len));
      timer = setTimeout(tick, deleting ? DELETE_MS : TYPE_MS);
    };
    setText(phrases[0]);
    tick();
    return () => clearTimeout(timer);
  }, [active, phrases]);

  return text;
}
