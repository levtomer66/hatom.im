'use client';

import { FaMinus, FaPlus } from 'react-icons/fa';

export default function ServingsStepper({ value, onChange, label = 'מנות' }: { value: number; onChange: (n: number) => void; label?: string }) {
  return (
    <span className="rc-servings">
      <span className="sh-stepper" aria-label={label}>
        <button type="button" onClick={() => onChange(Math.min(100, value + 1))} aria-label={`עוד ${label}`}><FaPlus /></button>
        <span className="sh-qty" aria-live="polite">{value}</span>
        <button type="button" onClick={() => onChange(Math.max(1, value - 1))} disabled={value <= 1} aria-label={`פחות ${label}`}><FaMinus /></button>
      </span>
      <span>{label}</span>
    </span>
  );
}
