// Typed calls to /api/recipes (routes: docs/superpowers/specs/2026-11-24-recipes-design.md § API).

import type { RecipePatch } from '@/lib/recipes/recipe';
import type { Recipe, RecipeSummary } from '@/lib/recipes/types';
import type { MatchLine, ProductLite } from '@/lib/recipes/api-types';
import type { Meal } from '@/lib/calories/calories';
import type { ImportRequest } from '@/lib/recipes/imports';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const BASE = '/api/recipes';

async function call<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    const form = body instanceof FormData;
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: body === undefined || form ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : form ? body : JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new ApiError('אין חיבור. נסו שוב', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: string }).error ?? 'משהו השתבש, נסו שוב', res.status);
  return data as T;
}

export const listMine = () => call<{ recipes: RecipeSummary[] }>('GET', '').then((r) => r.recipes);
export const listFeed = () => call<{ recipes: RecipeSummary[] }>('GET', '/feed').then((r) => r.recipes);
export const getRecipe = (id: string) => call<{ recipe: Recipe }>('GET', `/${id}`).then((r) => r.recipe);
export const createRecipe = (init: RecipePatch = {}) => call<{ recipe: Recipe }>('POST', '', init).then((r) => r.recipe);
export const patchRecipe = (id: string, patch: RecipePatch) => call<{ recipe: Recipe }>('PATCH', `/${id}`, patch).then((r) => r.recipe);
export const deleteRecipe = (id: string) => call<{ ok: true }>('DELETE', `/${id}`);
export const copyRecipe = (id: string) => call<{ recipe: Recipe }>('POST', `/${id}/copy`).then((r) => r.recipe);

export function uploadPhoto(id: string, file: Blob) {
  const form = new FormData();
  form.append('file', file, 'photo.jpg');
  return call<{ photo: string }>('POST', `/${id}/photo`, form).then((r) => r.photo);
}
export const removePhoto = (id: string) => call<{ photo: null }>('DELETE', `/${id}/photo`);

export const matchLines = (id: string, servings: number) => call<{ lines: MatchLine[] }>('GET', `/${id}/match?servings=${servings}`).then((r) => r.lines);
export const toList = (id: string, lines: { key: string; qty: number }[], picks: { id: string; key: string }[]) =>
  call<{ added: number; recipe?: Recipe }>('POST', `/${id}/to-list`, { lines, picks });
export const logServing = (id: string, date: string, meal: Meal, qty: number) => call<{ ok: true }>('POST', `/${id}/log`, { date, meal, qty });
export const searchProducts = (q: string, signal?: AbortSignal) =>
  call<{ products: ProductLite[] }>('GET', `/products?q=${encodeURIComponent(q)}`, undefined, signal).then((r) => r.products);

export const listImports = () => call<{ imports: ImportRequest[] }>('GET', '/imports').then((r) => r.imports);
export const requestImport = (req: { url: string; text: string; note: string }) => call<{ import: ImportRequest }>('POST', '/imports', req).then((r) => r.import);
export const dismissImport = (id: string) => call<{ ok: true }>('DELETE', `/imports/${id}`);
