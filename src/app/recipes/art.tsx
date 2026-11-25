// Recipes' own line-art (spec 2026-11-25 § Look): drawn here, no image files.
// Strokes are currentColor (set by the parent); details use the coral accent.
// Decorative only.

const LINE = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const ACCENT = { ...LINE, stroke: 'var(--rc-accent)' };

/** A pot with steam and a wooden spoon — the empty book. */
export function PotArt({ className = '' }: { className?: string }) {
  return (
    <svg className={`rc-art ${className}`} viewBox="0 0 200 170" width="200" height="170" aria-hidden focusable="false">
      <path {...LINE} d="M78 40c-8-10 8-16 0-26M100 36c-8-10 8-16 0-26M122 40c-8-10 8-16 0-26" opacity="0.7" />
      <path {...ACCENT} d="M128 70 166 18" strokeWidth={5} />
      <ellipse {...ACCENT} cx="168" cy="15" rx="7" ry="4.5" transform="rotate(-54 168 15)" />
      <ellipse {...LINE} cx="100" cy="70" rx="62" ry="12" />
      <path {...LINE} d="M38 70v58c0 14 28 24 62 24s62-10 62-24V70" />
      <path {...LINE} d="M38 84c-14 0-22 6-22 13s8 12 22 10M162 84c14 0 22 6 22 13s-8 12-22 10" />
      <path {...ACCENT} d="M44 104c18 7 38 10 56 10s38-3 56-10" strokeDasharray="2 9" strokeWidth={4} />
      <path {...LINE} d="M34 160h132" opacity="0.4" />
    </svg>
  );
}

/** A small pot with sparkles — the start sheet. */
export function CauldronArt({ className = '' }: { className?: string }) {
  return (
    <svg className={`rc-art ${className}`} viewBox="0 0 160 140" width="140" height="122" aria-hidden focusable="false">
      <path {...ACCENT} d="M58 18v14M51 25h14M112 8v18M103 17h18M124 40v10M119 45h10" />
      <path {...LINE} d="M80 58c-10-8 6-14-2-24 8 4 12 12 6 20" opacity="0.7" />
      <ellipse {...LINE} cx="80" cy="66" rx="46" ry="9" />
      <path {...LINE} d="M36 68c-4 34 14 52 44 52s48-18 44-52" />
      <path {...LINE} d="M36 76c-10 0-14 5-12 10M124 76c10 0 14 5 12 10" />
      <path {...LINE} d="M54 118l-6 12M106 118l6 12" />
    </svg>
  );
}

/** Scattered kitchen tools, tiled — the cover band when a recipe has no photo. */
export function UtensilsPattern({ className = '' }: { className?: string }) {
  return (
    <svg className={`rc-art rc-pattern ${className}`} width="100%" height="100%" aria-hidden focusable="false">
      <defs>
        <pattern id="rc-utensils" width="180" height="150" patternUnits="userSpaceOnUse">
          <g {...LINE} strokeWidth={1.8} opacity="0.55">
            {/* fork */}
            <path d="M20 20v22M26 20v22M32 20v22M20 42c0 6 12 6 12 0M26 46v40" />
            {/* whisk */}
            <path d="M70 18c-10 14-10 30 0 38 10-8 10-24 0-38zM70 18c-4 14-4 28 0 38M70 56v28" />
            {/* ladle */}
            <path d="M128 16v44M128 60c-14 0-16 18 0 18s14-18 0-18" />
            {/* knife */}
            <path d="M18 110l50-20 6 6-46 26zM62 92l20-8" />
            {/* rolling pin */}
            <path d="M104 118l46-26M100 116l6 6M146 90l6 6M108 112l38-22 4 6-38 22z" />
            {/* spoon */}
            <ellipse cx="164" cy="30" rx="6" ry="10" />
            <path d="M164 40v40" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#rc-utensils)" />
    </svg>
  );
}
