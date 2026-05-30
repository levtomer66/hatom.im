'use client';

import React, { useEffect, useState } from 'react';
import { WorkoutTemplate, ExerciseDefinition } from '@/types/workout';
import { useWorkoutLanguage } from '@/context/WorkoutLanguageContext';
import { useT, exerciseCount, getLocalizedTemplateName } from '@/lib/workout-i18n';
import { getLocalizedExercise } from '@/lib/exercise-translations';

// localStorage key for the last-used tab. Per Imp 12 — persists across
// modal opens and page reloads so the user lands back where they were
// (e.g. if you mostly use "Workouts by Tomer" you don't re-tap every time).
const TAB_STORAGE_KEY = 'hatom-workout-selector-tab';

interface TemplateSelectorProps {
  isOpen: boolean;
  templates: WorkoutTemplate[];           // The caller's own templates
  sharedTemplates: WorkoutTemplate[];     // Owner-shared templates (any user with workout permission can see these)
  // Owner-only map: { templateId → number of workout sessions started from it }
  // Used to render a "Used N×" badge next to shared templates so the
  // owner can see who's running their stuff. Pass {} for non-owners.
  templateUsage?: Record<string, number>;
  exerciseMap: Record<string, ExerciseDefinition>;
  isOwner: boolean;                       // Controls visibility of the per-template share toggle
  onClose: () => void;
  onSelect: (template: WorkoutTemplate) => void;
  onEdit: (template: WorkoutTemplate) => void;
  onDelete: (template: WorkoutTemplate) => void;
  onCreateNew: () => void;
  onToggleShare: (template: WorkoutTemplate) => void;
}

type Tab = 'mine' | 'byTomer';

export default function TemplateSelector({
  isOpen,
  templates,
  sharedTemplates,
  templateUsage = {},
  exerciseMap,
  isOwner,
  onClose,
  onSelect,
  onEdit,
  onDelete,
  onCreateNew,
  onToggleShare,
}: TemplateSelectorProps) {
  const { language } = useWorkoutLanguage();
  const t = useT();
  // Lazy-initialise from localStorage so the initial paint already shows
  // the right tab — no flicker. Falls back to 'mine' for first-time users.
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window === 'undefined') return 'mine';
    const stored = window.localStorage.getItem(TAB_STORAGE_KEY);
    return stored === 'byTomer' ? 'byTomer' : 'mine';
  });

  // Persist whenever the user switches tabs.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(TAB_STORAGE_KEY, tab);
    }
  }, [tab]);

  if (!isOpen) return null;

  const visible = tab === 'mine' ? templates : sharedTemplates;
  const isMineTab = tab === 'mine';

  const tabButtonStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '10px 12px',
    fontSize: '14px',
    fontWeight: 600,
    background: active ? 'var(--workout-bg-secondary)' : 'transparent',
    color: active ? 'var(--workout-accent)' : 'var(--workout-text-muted)',
    border: 0,
    borderBottom: `2px solid ${active ? 'var(--workout-accent)' : 'transparent'}`,
    cursor: 'pointer',
    transition: 'color 0.15s, background 0.15s, border-color 0.15s',
  });

  return (
    <div className="workout-modal-overlay" onClick={onClose}>
      <div className="workout-modal" onClick={(e) => e.stopPropagation()}>
        <div className="workout-modal-header">
          <h2 className="workout-modal-title">{t('selector.title')}</h2>
          <button className="workout-modal-close" onClick={onClose} aria-label={t('generic.close')}>
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div
          role="tablist"
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--workout-border)',
            marginBottom: '4px',
          }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'mine'}
            onClick={() => setTab('mine')}
            style={tabButtonStyle(tab === 'mine')}
          >
            {t('selector.tab.mine')}
            <span style={{ marginInlineStart: 6, opacity: 0.7, fontSize: '0.8em' }}>
              {templates.length}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'byTomer'}
            onClick={() => setTab('byTomer')}
            style={tabButtonStyle(tab === 'byTomer')}
          >
            {t('selector.tab.byTomer')}
            <span style={{ marginInlineStart: 6, opacity: 0.7, fontSize: '0.8em' }}>
              {sharedTemplates.length}
            </span>
          </button>
        </div>

        <div className="workout-modal-body">
          {visible.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px 16px' }}>
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-text">
                {isMineTab ? t('selector.no_templates') : t('selector.tab.byTomer.empty')}
              </div>
              {isMineTab && (
                <button
                  className="workout-btn workout-btn-primary"
                  onClick={onCreateNew}
                  style={{ marginTop: '16px' }}
                >
                  {t('selector.create_first')}
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {visible.map(template => {
                const exercises = template.exercises ?? [];
                const exerciseNames = exercises
                  .slice(0, 3)
                  .map(e => {
                    const def = exerciseMap[e.exerciseId];
                    return def ? getLocalizedExercise(def, language).name : '?';
                  })
                  .join(', ');
                const moreCount = exercises.length > 3
                  ? ` +${exercises.length - 3}`
                  : '';
                const isShared = !!template.sharedByOwner;

                return (
                  <div
                    key={template.id}
                    className="workout-card"
                    style={{
                      padding: '16px',
                      margin: 0,
                      cursor: 'pointer',
                      transition: 'transform 0.1s, border-color 0.2s',
                    }}
                  >
                    <div
                      onClick={() => onSelect(template)}
                      style={{ flex: 1 }}
                    >
                      <div style={{
                        fontSize: '16px',
                        fontWeight: 700,
                        marginBottom: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flexWrap: 'wrap',
                      }}>
                        🏋️ {getLocalizedTemplateName(template.name, language)}
                        {/* In "Workouts by Tomer" the shared badge is implicit, so only render it on My Workouts. */}
                        {isMineTab && isShared && (
                          <span
                            style={{
                              fontSize: '11px',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              background: 'var(--workout-accent-dim, rgba(201, 168, 76, 0.18))',
                              color: 'var(--workout-accent)',
                              fontWeight: 600,
                              letterSpacing: '0.02em',
                            }}
                          >
                            ★ {t('selector.shared.badge')}
                          </span>
                        )}
                        {/* Usage count — owner-only and only shown on
                            the user's own shared templates so they can
                            see how many sessions have been started
                            from each one. (Imp 8) */}
                        {isMineTab && isShared && isOwner && (templateUsage[template.id] ?? 0) > 0 && (
                          <span
                            style={{
                              fontSize: '11px',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              background: 'var(--workout-bg-secondary)',
                              color: 'var(--workout-text-muted)',
                              fontWeight: 500,
                            }}
                            title={t('selector.usage_n').replace('{n}', String(templateUsage[template.id]))}
                          >
                            {templateUsage[template.id]}×
                          </span>
                        )}
                      </div>
                      <div style={{
                        fontSize: '13px',
                        color: 'var(--workout-text-secondary)',
                        marginBottom: '8px',
                      }}>
                        {exerciseCount(exercises.length, language)}
                      </div>
                      {exerciseNames && (
                        <div style={{
                          fontSize: '12px',
                          color: 'var(--workout-text-muted)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {exerciseNames}{moreCount}
                        </div>
                      )}
                    </div>
                    <div style={{
                      display: 'flex',
                      gap: '8px',
                      marginTop: '12px',
                      justifyContent: 'space-between',
                    }}>
                      <button
                        className="workout-btn workout-btn-primary"
                        onClick={() => onSelect(template)}
                        style={{ flex: 1, padding: '10px 16px', fontSize: '14px' }}
                      >
                        {t('selector.start')}
                      </button>

                      {/* Edit / share / delete are owner-of-template actions and only
                          live on the "My Workouts" tab. The "by Tomer" tab is a
                          read-only preview from the consumer's perspective. */}
                      {isMineTab && (
                        <>
                          {isOwner && (
                            <button
                              type="button"
                              className="workout-btn workout-btn-secondary"
                              onClick={(e) => { e.stopPropagation(); onToggleShare(template); }}
                              title={isShared ? t('selector.share.on_title') : t('selector.share.off_title')}
                              aria-label={isShared ? t('selector.share.on_title') : t('selector.share.off_title')}
                              aria-pressed={isShared}
                              style={{
                                padding: '10px 14px',
                                fontSize: '14px',
                                color: isShared ? 'var(--workout-accent)' : 'var(--workout-text-muted)',
                              }}
                            >
                              {isShared ? '★' : '☆'}
                            </button>
                          )}
                          <button
                            className="workout-btn workout-btn-secondary"
                            onClick={(e) => { e.stopPropagation(); onEdit(template); }}
                            style={{ padding: '10px 14px', fontSize: '14px' }}
                            aria-label={t('selector.edit_aria')}
                            title={t('selector.edit_aria')}
                          >
                            ✏️
                          </button>
                          <button
                            className="exercise-card-action"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`${t('selector.confirm_delete_prefix')} "${template.name}"?`)) {
                                onDelete(template);
                              }
                            }}
                            style={{
                              backgroundColor: 'var(--workout-red)',
                              color: 'white',
                            }}
                            aria-label={t('selector.delete_aria')}
                            title={t('selector.delete_aria')}
                          >
                            🗑
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Only show Create New on the user's own tab. */}
              {isMineTab && (
                <button
                  className="workout-btn workout-btn-secondary workout-btn-full"
                  onClick={onCreateNew}
                  style={{ marginTop: '8px' }}
                >
                  {t('selector.create_new')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
