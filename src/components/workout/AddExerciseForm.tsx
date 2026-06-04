'use client';

import React, { useState } from 'react';
import { ExerciseCategory, ExerciseDefinition } from '@/types/workout';
import { useT, TranslationKey } from '@/lib/workout-i18n';

interface AddExerciseFormProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (exercise: ExerciseDefinition) => void;
}

// Downscale the picked image in the browser before upload — cuts bandwidth on
// mobile (the server re-encodes to 400px JPEG regardless). Returns the JPEG
// blob to upload plus a data URL for the inline preview.
async function resizeToJpeg(
  file: File,
  maxEdge = 600,
  quality = 0.8,
): Promise<{ blob: Blob; dataUrl: string }> {
  const srcUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('decode failed'));
    image.src = srcUrl;
  });
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas context');
  ctx.drawImage(img, 0, 0, w, h);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', quality);
  });
  return { blob, dataUrl: canvas.toDataURL('image/jpeg', quality) };
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
  // Resized photo blob to upload on submit + a data URL for the preview.
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    try {
      const { blob, dataUrl } = await resizeToJpeg(file);
      setPhotoBlob(blob);
      setPhotoPreview(dataUrl);
      setError('');
    } catch {
      setError(t('customex.err_photo'));
    }
  };

  const clearPhoto = () => {
    setPhotoBlob(null);
    setPhotoPreview(null);
  };

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
      // Upload the (already resized) photo first; the create call stores the
      // returned Blob URL. A failed upload aborts the create.
      let photoUrl: string | undefined;
      if (photoBlob) {
        const fd = new FormData();
        fd.append('file', photoBlob, 'custom.jpg');
        const up = await fetch('/api/workout/exercises/custom/upload', { method: 'POST', body: fd });
        if (!up.ok) {
          setError(t('customex.err_photo'));
          setIsSubmitting(false);
          return;
        }
        photoUrl = (await up.json()).url;
      }

      // userId is derived from the session server-side — not sent here.
      const res = await fetch('/api/workout/exercises/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          categories: Array.from(selectedCategories),
          ...(photoUrl ? { photo: photoUrl } : {}),
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
    clearPhoto();
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

          {/* Photo (optional) */}
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: 600,
                fontSize: '14px',
              }}
            >
              {t('customex.photo_label')}
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {photoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoPreview}
                  alt=""
                  style={{
                    width: '64px',
                    height: '64px',
                    objectFit: 'cover',
                    borderRadius: '8px',
                    flexShrink: 0,
                    backgroundColor: 'var(--workout-bg-secondary)',
                  }}
                />
              ) : (
                <div
                  aria-hidden="true"
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '8px',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '28px',
                    backgroundColor: 'var(--workout-bg-secondary)',
                  }}
                >
                  🏋️
                </div>
              )}
              <label
                className="workout-btn workout-btn-secondary"
                style={{ flex: '0 0 auto', cursor: 'pointer', margin: 0 }}
              >
                {photoPreview ? t('customex.photo_change') : t('customex.photo_add')}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  style={{ display: 'none' }}
                />
              </label>
              {photoPreview && (
                <button
                  type="button"
                  className="workout-btn workout-btn-secondary"
                  style={{ flex: '0 0 auto', color: 'var(--workout-red)' }}
                  onClick={clearPhoto}
                >
                  {t('customex.photo_remove')}
                </button>
              )}
            </div>
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
