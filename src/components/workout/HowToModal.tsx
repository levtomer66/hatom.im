'use client';

// PROTOTYPE — "how to do it": an animated GIF from ExerciseDB (fetched live
// via /api/workout/howto), else a flip between our two public-domain photos
// (start/end position), else just the photo.

import React, { useEffect, useState } from 'react';
import { useT } from '@/lib/workout-i18n';
import ExercisePhoto from './ExercisePhoto';

interface Props {
  exerciseId: string;
  title: string;
  photo?: string;
  onClose: () => void;
}

type State =
  | { kind: 'loading' }
  | { kind: 'gif'; url: string; steps: string[] }
  | { kind: 'flip' }
  | { kind: 'none' };

export default function HowToModal({ exerciseId, title, photo, onClose }: Props) {
  const t = useT();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [frame, setFrame] = useState(0);
  const [gifFailed, setGifFailed] = useState(false);

  // Our own frames exist only for photos we saved under /workout/exercises/.
  const hasFrames = !!photo?.startsWith('/workout/exercises/');
  const endFrame = hasFrames ? photo!.replace(/\.jpg$/, '-end.jpg') : undefined;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/workout/howto?id=${encodeURIComponent(exerciseId)}`)
      .then((r) => (r.ok ? r.json() : { gifUrl: null, steps: [] }))
      .catch(() => ({ gifUrl: null, steps: [] }))
      .then((d: { gifUrl: string | null; steps: string[] }) => {
        if (cancelled) return;
        if (d.gifUrl) setState({ kind: 'gif', url: d.gifUrl, steps: d.steps ?? [] });
        else setState({ kind: hasFrames ? 'flip' : 'none' });
      });
    return () => { cancelled = true; };
  }, [exerciseId, hasFrames]);

  const showFlip = state.kind === 'flip' || (state.kind === 'gif' && gifFailed && hasFrames);

  useEffect(() => {
    if (!showFlip) return;
    const id = window.setInterval(() => setFrame((f) => 1 - f), 900);
    return () => window.clearInterval(id);
  }, [showFlip]);

  return (
    <div className="workout-modal-overlay" onClick={onClose}>
      <div className="workout-modal howto-modal" onClick={(e) => e.stopPropagation()}>
        <div className="workout-modal-header">
          <h2 className="workout-modal-title">{title}</h2>
          <button className="workout-modal-close" onClick={onClose} aria-label={t('generic.close')}>✕</button>
        </div>
        <div className="workout-modal-body">
          <div className="howto-stage">
            {state.kind === 'loading' && <span className="howto-muted">{t('howto.loading')}</span>}
            {state.kind === 'gif' && !gifFailed && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={state.url} alt={t('howto.title')} onError={() => setGifFailed(true)} />
            )}
            {showFlip && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={frame === 0 ? photo : endFrame} alt={t('howto.flip_note')} />
            )}
            {(state.kind === 'none' || (state.kind === 'gif' && gifFailed && !hasFrames)) && (
              <ExercisePhoto src={photo} style={{ width: '100%', height: '100%' }} />
            )}
          </div>
          <div className="howto-caption">
            {state.kind === 'gif' && !gifFailed && t('howto.source')}
            {showFlip && t('howto.flip_note')}
            {(state.kind === 'none' || (state.kind === 'gif' && gifFailed && !hasFrames)) && t('howto.none')}
          </div>
          {state.kind === 'gif' && !gifFailed && state.steps.length > 0 && (
            <>
              <div className="howto-steps-title">{t('howto.steps_en_only')}</div>
              <ol className="howto-steps" dir="ltr">
                {state.steps.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
