'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useT } from '@/lib/workout-i18n';
import { useWorkoutUnit } from '@/context/WorkoutUnitContext';
import { useWorkoutTimer } from '@/context/WorkoutTimerContext';
import { useWorkoutSettings } from '@/context/WorkoutSettingsContext';
import { kgToDisplay, displayToKg } from '@/lib/weight';
import { formatSeconds } from '@/lib/time';
import { useClickOutside } from '@/lib/useClickOutside';
import LanguageToggle from './LanguageToggle';
import WeightUnitToggle from './WeightUnitToggle';

const STEP = 15;
const MIN = 30;
const MAX = 300;

// One header menu that folds the workout app's preferences behind a single
// avatar button: bodyweight (feature 1), language, weight unit, and rest-timer
// defaults. Replaces the previous row of three separate header toggles.
export default function ProfileMenu() {
  const { data: session } = useSession();
  const { unit } = useWorkoutUnit();
  const { prefs, setDefaultRestSec, setSound } = useWorkoutTimer();
  const { bodyweightKg, setBodyweight, ensureLoaded } = useWorkoutSettings();
  const t = useT();

  const [open, setOpen] = useState(false);
  const [bwText, setBwText] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // On open: make sure settings are loaded (standalone pages don't seed them),
  // and sync the input to the stored bodyweight in the active unit.
  useEffect(() => {
    if (!open) return;
    ensureLoaded();
    setBwText(
      bodyweightKg != null ? String(Math.round(kgToDisplay(bodyweightKg, unit) * 10) / 10) : '',
    );
  }, [open, bodyweightKg, unit, ensureLoaded]);

  useClickOutside([popoverRef, buttonRef], () => setOpen(false), open);

  // Persist the typed bodyweight (converted to canonical kg), or clear it when
  // the field is emptied. Ignores non-positive / non-numeric input.
  const commitBodyweight = () => {
    const trimmed = bwText.trim();
    if (trimmed === '') {
      if (bodyweightKg != null) setBodyweight(null);
      return;
    }
    const val = parseFloat(trimmed);
    if (!Number.isFinite(val) || val <= 0) return;
    setBodyweight(Math.round(displayToKg(val, unit) * 10) / 10);
  };

  const image = session?.user?.image;
  const name = session?.user?.name ?? session?.user?.email ?? '';
  const initial = name ? name.charAt(0).toUpperCase() : '👤';

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="profile-menu-button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t('profile.menu_aria')}
        aria-expanded={open}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="profile-menu-avatar" referrerPolicy="no-referrer" />
        ) : (
          <span className="profile-menu-avatar profile-menu-avatar-fallback">{initial}</span>
        )}
      </button>

      {open && (
        <div ref={popoverRef} className="profile-menu-popover" role="dialog">
          <div className="profile-menu-row">
            <label htmlFor="profile-bodyweight">{t('profile.bodyweight')}</label>
            <div className="profile-menu-bw">
              <input
                id="profile-bodyweight"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.1"
                value={bwText}
                onChange={(e) => setBwText(e.target.value)}
                onBlur={commitBodyweight}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    commitBodyweight();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                placeholder="—"
                className="profile-menu-bw-input"
              />
              <span className="profile-menu-bw-unit">{unit}</span>
            </div>
          </div>

          <div className="profile-menu-row">
            <label>{t('profile.language')}</label>
            <LanguageToggle size="sm" />
          </div>

          <div className="profile-menu-row">
            <label>{t('profile.units')}</label>
            <WeightUnitToggle size="sm" />
          </div>

          <div className="profile-menu-row">
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

          <div className="profile-menu-row">
            <label htmlFor="profile-timer-sound">{t('timer.sound_label')}</label>
            <input
              id="profile-timer-sound"
              type="checkbox"
              checked={prefs.sound}
              onChange={(e) => setSound(e.target.checked)}
            />
          </div>
        </div>
      )}
    </>
  );
}
