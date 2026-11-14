'use client';

import React from 'react';
import { useT } from '@/lib/workout-i18n';
import { useWorkoutUnit } from '@/context/WorkoutUnitContext';
import { formatVolume } from '@/lib/weight';
import {
  RECORD_ICON,
  recordProgress,
  type RecordKind,
  type VolumeRecordsResponse,
} from '@/lib/workout-records';

// Live "how close am I?" bars during a workout: the volume lifted so far
// against the user's own record (any completed workout, shared or not) and
// the group record (heaviest shared workout). Volume uses the same
// load-aware math as the completion summary. The workout being logged is
// never compared with itself (resuming a completed record from History).
export default function VolumeRecordBar({
  currentKg,
  records,
  userId,
  workoutId,
}: {
  currentKg: number;
  records: VolumeRecordsResponse | null;
  userId: string;
  workoutId: string;
}) {
  const t = useT();
  const { unit } = useWorkoutUnit();

  const isThis = (id: string | undefined) => id === workoutId;
  const mine = records?.myBest && !isThis(records.myBest.workoutId) ? records.myBest : null;
  const group = records?.group && !isThis(records.group.workoutId) ? records.group : null;
  // My record IS the group record → one bar, not two identical ones.
  const sameAsGroup = !!mine && !!group && group.userId === userId && group.workoutId === mine.workoutId;

  const rows: { kind: RecordKind; label: string; recordKg: number }[] = [];
  if (mine) {
    rows.push({
      kind: sameAsGroup ? 'group' : 'personal',
      label: sameAsGroup ? t('records.you_hold') : t('records.my_record'),
      recordKg: mine.kg,
    });
  }
  if (group && !sameAsGroup) {
    rows.push({
      kind: 'group',
      label: t('records.group_holder').replace('{name}', group.displayName),
      recordKg: group.kg,
    });
  }
  const thisIsMyRecord = !!records?.myBest && isThis(records.myBest.workoutId);
  const beatMine = !!mine && currentKg > mine.kg;

  return (
    <div className="volume-records" role="group" aria-label={t('records.aria')}>
      <div className="volume-records-head">
        <span>{t('records.so_far')}</span>
        <strong>{formatVolume(currentKg, unit)}</strong>
      </div>
      {rows.map((row) => {
        const pct = (recordProgress(currentKg, row.recordKg) ?? 0) * 100;
        const done = currentKg > row.recordKg;
        return (
          <div key={row.kind} className="volume-records-row">
            <div className="volume-records-row-label">
              <span>{RECORD_ICON[row.kind]} {row.label}</span>
              <span>{formatVolume(row.recordKg, unit)}</span>
            </div>
            <div
              className="volume-records-track"
              role="progressbar"
              aria-label={row.label}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(pct)}
            >
              <div
                className={`volume-records-fill volume-records-fill-${row.kind}${done ? ' done' : ''}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
      {beatMine && <div className="volume-records-note">{t('records.beaten')}</div>}
      {thisIsMyRecord && <div className="volume-records-note muted">{t('records.this_is_record')}</div>}
      {records && !records.myBest && <div className="volume-records-note muted">{t('records.first')}</div>}
    </div>
  );
}
