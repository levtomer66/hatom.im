'use client';

import React from 'react';
import { useT, formatDate } from '@/lib/workout-i18n';
import { useWorkoutLanguage } from '@/context/WorkoutLanguageContext';
import { useWorkoutUnit } from '@/context/WorkoutUnitContext';
import { formatVolume } from '@/lib/weight';
import { RECORD_ICON, type VolumeRecords } from '@/lib/workout-records';

// Record board above The Moving Car: who holds the group record (heaviest
// single shared workout) and everyone's personal best. Renders nothing until
// someone has shared a workout with volume.
export default function FeedRecords({
  records,
  currentUserId,
}: {
  records: VolumeRecords | null;
  currentUserId: string;
}) {
  const t = useT();
  const { language } = useWorkoutLanguage();
  const { unit } = useWorkoutUnit();
  if (!records?.group) return null;
  const holder = records.group;

  return (
    <section className="feed-records" aria-label={t('records.aria')}>
      <div className="feed-records-holder">
        <span className="feed-records-crown" aria-hidden="true">{RECORD_ICON.group}</span>
        <div className="feed-records-holder-text">
          <span className="feed-records-label">{t('records.group')}</span>
          <span className="feed-records-main">
            <strong>{holder.displayName}</strong> · {formatVolume(holder.kg, unit)}
            <span className="feed-records-date">
              {' · '}
              {formatDate(holder.workoutDate, language, { month: 'short', day: 'numeric' })}
            </span>
          </span>
        </div>
      </div>
      {records.byUser.length > 1 && (
        <div className="feed-records-personal">
          <span className="feed-records-label">{RECORD_ICON.personal} {t('records.personal')}</span>
          <div className="feed-records-chips">
            {records.byUser.map((r) => (
              <span
                key={r.userId}
                className={`feed-records-chip${r.userId === currentUserId ? ' mine' : ''}`}
              >
                {r.displayName} <strong>{formatVolume(r.kg, unit)}</strong>
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
