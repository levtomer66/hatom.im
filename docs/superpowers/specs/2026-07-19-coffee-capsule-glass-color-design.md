# Coffee Order Form: Capsule + Glass Color — Design

**Date:** 2026-07-19
**Status:** Approved

## Goal

Add two fields to the coffee-order form:

1. **Capsule** — Vanille (default), Hazelnut, Blonde, Caramel, Guatemala
2. **Glass Color** — Gray (default), Green, Black, Pink

## Approach

Mirror the existing `source` field pattern end-to-end: string-literal union +
option array + `resolveX()` helper that defaults missing values and rejects
unknown ones. No Mongo migration — documents saved before these fields existed
read back as the defaults (Vanille capsule, Gray glass), exactly how `source`
was retrofitted.

## Changes

### `src/types/coffee-order.ts`

- `CoffeeCapsule = 'vanille' | 'hazelnut' | 'blonde' | 'caramel' | 'guatemala'`
- `CoffeeGlassColor = 'gray' | 'green' | 'black' | 'pink'`
- `COFFEE_CAPSULES` / `GLASS_COLORS` option arrays with Hebrew labels
  (וניל, אגוזי לוז, בלונד, קרמל, גואטמלה / אפורה, ירוקה, שחורה, ורודה —
  glass labels are feminine to agree with כוס).
- `DEFAULT_CAPSULE = 'vanille'`, `DEFAULT_GLASS_COLOR = 'gray'`.
- Both fields added to `CoffeeDrinkConfig`, so orders **and** favorites carry
  them, and the DTOs inherit them.
- `resolveCapsule()` / `resolveGlassColor()` — missing → default, present but
  unknown → `null` (API returns 400). Same contract as `resolveSource`.
- `capsuleLabel()` / `glassColorLabel()` helpers.
- `drinkSummary()` appends `קפסולת <label>` and `כוס <label>` (guarded for
  pre-field docs), so the barista board and the ntfy push show them.
- `defaultDrinkConfig()` returns the new defaults.

### API routes

`api/coffee-order/orders/route.ts` and `api/coffee-order/favorites/route.ts`
validate via the resolve helpers and persist the resolved values. Model files
need no changes (documents extend the shared config type).

### Form (`src/app/coffee-order/page.tsx`)

- **Capsule:** full-width `<select>` (consistent with sugar/source).
- **Glass Color:** segmented buttons like the drink/milk pickers, each with a
  small colored dot (`.coffee-glass-dot` + per-color class in
  `coffee-order.css`).
- `pickConfig()` falls back to the defaults (`?? DEFAULT_CAPSULE`,
  `?? DEFAULT_GLASS_COLOR`) so loading an old favorite / reordering an old
  order works.

### Non-goals

- No drink- or source-conditional visibility (capsule shows for every drink).
- No Mongo migration.
- No barista-board changes beyond what flows through `drinkSummary`.
