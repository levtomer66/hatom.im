'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useWorkoutTimer } from '@/context/WorkoutTimerContext';
import { useT } from '@/lib/workout-i18n';
import { formatSeconds } from '@/lib/time';

const STEP = 15;
const MIN = 30;
const MAX = 300;

export default function TimerPrefsMenu() {
  const { prefs, setDefaultRestSec, setSound } = useWorkoutTimer();
  const [open, setOpen] = useState(false);
  const t = useT();
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('touchstart', onClick);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('touchstart', onClick);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="timer-prefs-button"
        onClick={() => setOpen(o => !o)}
        aria-label={t('timer.settings_aria')}
        aria-expanded={open}
      >
        ⏱
      </button>
      {open && (
        <div ref={popoverRef} className="timer-prefs-popover" role="dialog">
          <div className="timer-prefs-row">
            <label>{t('timer.default_label')}</label>
            <div className="timer-prefs-stepper">
              <button
                type="button"
                onClick={() => setDefaultRestSec(prefs.defaultRestSec - STEP)}
                disabled={prefs.defaultRestSec <= MIN}
                aria-label="−15s"
              >
                −
              </button>
              <span className="timer-prefs-stepper-value">{formatSeconds(prefs.defaultRestSec)}</span>
              <button
                type="button"
                onClick={() => setDefaultRestSec(prefs.defaultRestSec + STEP)}
                disabled={prefs.defaultRestSec >= MAX}
                aria-label="+15s"
              >
                +
              </button>
            </div>
          </div>
          <div className="timer-prefs-row">
            <label htmlFor="timer-sound-toggle">{t('timer.sound_label')}</label>
            <input
              id="timer-sound-toggle"
              type="checkbox"
              checked={prefs.sound}
              onChange={e => setSound(e.target.checked)}
            />
          </div>
        </div>
      )}
    </>
  );
}
