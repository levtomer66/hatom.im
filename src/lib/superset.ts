// Superset grouping helper shared by the active workout, history detail, and
// the template editor. A run of CONSECUTIVE items sharing the same non-null
// `supersetGroup` collapses into one render group; everything else is a
// singleton. The original array index of each item is preserved so callers
// can address the underlying flat array (update/remove/reorder).

export interface SupersetRenderGroup<T> {
  key: string;
  supersetGroup: number | null;
  items: { item: T; index: number }[];
}

export function buildSupersetGroups<T extends { supersetGroup?: number | null }>(
  items: T[],
): SupersetRenderGroup<T>[] {
  const groups: SupersetRenderGroup<T>[] = [];
  items.forEach((item, index) => {
    const g = item.supersetGroup ?? null;
    const last = groups[groups.length - 1];
    if (g !== null && last && last.supersetGroup === g) {
      last.items.push({ item, index });
    } else {
      groups.push({ key: `${g ?? 'solo'}-${index}`, supersetGroup: g, items: [{ item, index }] });
    }
  });
  return groups;
}

// 1 → 'A', 2 → 'B', … for the superset label. Beyond Z (only reachable via a
// hand-edited DB doc — the editor caps at 4) fall back to the number so the
// label can never render a garbage control character.
export function supersetLabel(group: number | null): string {
  if (group == null) return '';
  if (group < 1 || group > 26) return String(group);
  return String.fromCharCode(64 + group);
}
