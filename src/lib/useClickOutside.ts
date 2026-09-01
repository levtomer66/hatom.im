import { RefObject, useEffect, useRef } from 'react';

// Close a popover/menu when a pointer event lands outside all of the given
// elements. Refs and the callback are read through refs so the listener is
// (re)subscribed only when `active` toggles — not on every render. Pass the
// popover + its trigger button so clicking the trigger doesn't immediately
// re-close what it just opened.
export function useClickOutside(
  refs: RefObject<HTMLElement | null>[],
  onOutside: () => void,
  active = true,
) {
  const refsRef = useRef(refs);
  refsRef.current = refs;
  const cbRef = useRef(onOutside);
  cbRef.current = onOutside;

  useEffect(() => {
    if (!active) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (refsRef.current.some((r) => r.current?.contains(target))) return;
      cbRef.current();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [active]);
}
