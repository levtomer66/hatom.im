// Where the shopping feature lives. Import-free.
// The middleware `matcher` must be a static literal (Next analyses it at
// build time), so moving the page also means editing that one line in
// src/middleware.ts.

export const SHOPPING_BASE_PATH = '/shopping';
export const SHOPPING_API_PATH = '/api/shopping';

/** Stores shown per section of the results. */
export const RESULTS_PER_SECTION = 10;
/** Two-store splits shown. */
export const SPLITS_SHOWN = 3;
