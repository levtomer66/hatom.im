'use client';

// The band at the top of a recipe (spec 2026-11-25 § Create and edit): its photo,
// or the utensils pattern. In the editor (onPick) tapping it picks a photo.

import { FaCamera } from 'react-icons/fa';
import { UtensilsPattern } from './art';

export default function CoverBand({ photo, busy = false, onPick, onRemove }: {
  photo: string | null; busy?: boolean; onPick?: (file: File | undefined) => void; onRemove?: () => void;
}) {
  const art = photo
    ? <img className="rc-cover-img" src={photo} alt="" />  // eslint-disable-line @next/next/no-img-element -- the optimizer can't fetch gated blobs
    : <UtensilsPattern />;
  if (!onPick) return <div className={`rc-cover ${photo ? '' : 'is-empty'}`}>{art}</div>;
  return (
    <div className={`rc-cover ${photo ? '' : 'is-empty'} ${busy ? 'is-busy' : ''}`}>
      {art}
      <label className="rc-cover-chip">
        <FaCamera aria-hidden /> {photo ? 'החלפת תמונה' : 'הוספת תמונה'}
        <input type="file" accept="image/*" hidden disabled={busy} onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = ''; }} />
      </label>
      {photo && onRemove ? <button type="button" className="rc-cover-chip rc-cover-remove" disabled={busy} onClick={onRemove}>הסרה</button> : null}
    </div>
  );
}
