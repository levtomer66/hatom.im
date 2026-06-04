'use client';

import React, { useState } from 'react';
import { ExerciseCategory, ExerciseDefinition } from '@/types/workout';
import { useT, TranslationKey } from '@/lib/workout-i18n';

interface AddExerciseFormProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (exercise: ExerciseDefinition) => void;
}

const CATEGORY_OPTIONS: { id: ExerciseCategory; labelKey: TranslationKey }[] = [
  { id: 'push', labelKey: 'customex.cat_push' },
  { id: 'pull', labelKey: 'customex.cat_pull' },
  { id: 'legs', labelKey: 'customex.cat_legs' },
  { id: 'calisthenics', labelKey: 'customex.cat_calisthenics' },
  { id: 'full-body', labelKey: 'customex.cat_full_body' },
];

export default function AddExerciseForm({
  isOpen,
  onClose,
  onCreated,
}: AddExerciseFormProps) {
  const t = useT();
  const [name, setName] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<Set<ExerciseCategory>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const toggleCategory = (cat: ExerciseCategory) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError(t('customex.err_name'));
      return;
    }
    if (selectedCategories.size === 0) {
      setError(t('customex.err_category'));
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // userId is derived from the session server-side — not sent here.
      const res = await fetch('/api/workout/exercises/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          categories: Array.from(selectedCategories),
        }),
      });

      if (res.ok) {
        const exercise: ExerciseDefinition = await res.json();
        onCreated(exercise);
        handleClose();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || t('customex.err_generic'));
      }
    } catch {
      setError(t('customex.err_generic'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setName('');
    setSelectedCategories(new Set());
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="workout-modal-overlay" onClick={handleClose}>
      <div className="workout-modal" onClick={(e) => e.stopPropagation()}>
        <div className="workout-modal-header">
          <h2 className="workout-modal-title">{t('customex.title')}</h2>
          <button
            className="workout-modal-close"
            onClick={handleClose}
            aria-label={t('generic.close')}
            title={t('generic.close')}
          >
            ✕
          </button>
        </div>

        <div className="workout-modal-body">
          {/* Exercise Name */}
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: 600,
                fontSize: '14px',
              }}
            >
              {t('customex.name_label')}
            </label>
            <input
              type="text"
              className="workout-input"
              placeholder={t('customex.name_placeholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          {/* Categories */}
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: 600,
                fontSize: '14px',
              }}
            >
              {t('customex.categories_label')}
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {CATEGORY_OPTIONS.map((cat) => {
                const label = t(cat.labelKey);
                const active = selectedCategories.has(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    aria-pressed={active}
                    aria-label={label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      backgroundColor: active
                        ? 'var(--workout-green-dim)'
                        : 'var(--workout-bg-secondary)',
                      border: active
                        ? '2px solid var(--workout-green)'
                        : '2px solid transparent',
                      borderRadius: '8px',
                      color: 'var(--workout-text)',
                      cursor: 'pointer',
                      textAlign: 'start',
                    }}
                  >
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '4px',
                        border: active
                          ? '2px solid var(--workout-green)'
                          : '2px solid var(--workout-border)',
                        backgroundColor: active ? 'var(--workout-green)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#000',
                        fontSize: '14px',
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {active && '✓'}
                    </div>
                    <span style={{ fontSize: '14px' }}>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div
              style={{
                padding: '12px',
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                borderRadius: '8px',
                color: 'var(--workout-red)',
                fontSize: '14px',
                marginBottom: '16px',
              }}
            >
              {error}
            </div>
          )}
        </div>

        <div className="workout-modal-footer" style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="workout-btn workout-btn-secondary"
            onClick={handleClose}
            disabled={isSubmitting}
            style={{ flex: '0 0 auto' }}
          >
            {t('generic.cancel')}
          </button>
          <button
            className="workout-btn workout-btn-primary"
            onClick={handleSubmit}
            disabled={isSubmitting}
            style={{ flex: 1, opacity: isSubmitting ? 0.5 : 1 }}
          >
            {isSubmitting ? t('customex.creating') : t('customex.create')}
          </button>
        </div>
      </div>
    </div>
  );
}
