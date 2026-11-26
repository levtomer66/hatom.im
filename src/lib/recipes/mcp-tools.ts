// /recipes tools for the MCP server (src/app/api/mcp/route.ts): importing a
// recipe someone found online ("save this reel's recipe"), finding and
// reading recipes, and putting a recipe's ingredients on the shopping list.
// The model does the reading and converting; recipes_save's description holds
// the rules (Hebrew, Israeli units and products). Server-only.

import { hasCurrentPermission } from '@/lib/api-caller';
import { normalizeQty } from '@/lib/shopping/home';
import { getItems } from '@/models/ShoppingCatalog';
import { addLines } from '@/models/ShoppingHome';
import { canRead, createRecipe, getRecipe, listFeed, listMineFull, setPhoto, updateRecipe } from '@/models/Recipe';
import type { ShoppingTool, ShoppingToolCaller } from '@/lib/shopping/mcp-tools';
import { autoLink } from './autolink';
import { filterRecipes } from './filter';
import { buildMatch } from './match-server';
import { perServing } from './nutrition';
import { parseSaveArgs } from './recipe';
import { scaleLine } from './scale';
import { dropBlob, storeImageFromUrl } from './server';
import type { Recipe, RecipeSummary } from './types';
import { CONVERSION_RULES, IDEA_RULES } from './import-rules';
import { isOwnerEmail } from '@/types/auth';
import { claimImport, finishImport, getImport, importQueue } from '@/models/RecipeImport';

const SAVE_RULES = `Save a recipe to the caller's /recipes book (create, or replace one of theirs by id). Use it to import a recipe from a link, a caption, a video or a screenshot the user gives you: read it yourself, then convert it before calling.\n\n${CONVERSION_RULES}\nTell the user the page link from the result.`;

const SITE = 'https://www.hatom.im';
const str = (args: Record<string, unknown>, key: string) => (typeof args[key] === 'string' ? (args[key] as string).trim() : '');

const summaryLine = (r: RecipeSummary) =>
  `- ${r.id} · ${r.name}${r.ownerName ? ` (by ${r.ownerName})` : ''} · ${r.servings} servings` +
  `${r.tags.length ? ` · tags: ${r.tags.join(', ')}` : ''}${r.kcal !== null ? ` · ${r.partial ? '~' : ''}${r.kcal} kcal/serving` : ''}`;

function toSummary(r: Recipe): RecipeSummary {
  const { totals, partial } = perServing(r);
  return { ...r, kcal: totals?.kcal ?? null, partial, ingredientNames: r.ingredients.map((i) => i.name) };
}

async function readable(id: string, caller: ShoppingToolCaller): Promise<Recipe> {
  const r = id ? await getRecipe(id) : null;
  if (!r || !canRead(r, caller.userEmail)) throw new Error(`No recipe "${id}" you can read. Use recipes_list to find ids.`);
  return r;
}


/**
 * recipes_save's work, for `owner`'s book: parse, auto-link, create or replace
 * (replace only one of `owner`'s), copy the image. Also used by the import
 * agent's recipes_import_complete, where `owner` is the request's requester.
 */
async function saveFromArgs(owner: string, args: Record<string, unknown>, replaceId: string | null): Promise<{ saved: Recipe; notes: string }> {
  const parsed = parseSaveArgs(args);
  if (!parsed.ok) throw new Error(parsed.error);
  const { recipe, sourceUrl, imageUrl } = parsed.value;
  if (replaceId) {
    const old = await getRecipe(replaceId);
    if (!old || old.owner !== owner) throw new Error(`No recipe "${replaceId}" of yours to replace.`);
  }
  const ingredients = await autoLink(recipe.ingredients);
  const source = sourceUrl ? { url: sourceUrl, by: null } : undefined;
  const saved = replaceId
    ? await updateRecipe(owner, replaceId, { ...recipe, ingredients, ...(source ? { source } : {}) })
    : await createRecipe(owner, { ...recipe, ingredients, source: source ?? null });
  if (!saved) throw new Error('The recipe could not be saved.');
  let photoNote = '';
  if (imageUrl) {
    const url = await storeImageFromUrl(imageUrl, saved.id);
    if (url) {
      const before = await setPhoto(owner, saved.id, url);
      if (before && before !== url) await dropBlob(before);
    } else photoNote = '\nPhoto not saved: the image could not be downloaded (it needs a direct https image link).';
  }
  const unlinked = ingredients.filter((i) => i.qty !== null && !i.link).map((i) => i.text);
  return {
    saved,
    notes: `${ingredients.length} ingredients, ${saved.steps.length} steps. Ingredient links were picked automatically; the user can check them on the page.` +
      (unlinked.length ? `\nNo nutrition link for: ${unlinked.join('; ')}` : '') + photoNote,
  };
}

/** The import agent's tools are for the site owners' own agent only. */
function requireAgent(caller: ShoppingToolCaller): void {
  if (!isOwnerEmail(caller.userEmail)) throw new Error('Only the import agent (an owner key) can use this tool.');
}

const RECIPE_PROPS = {
  name: { type: 'string' },
  description: { type: 'string', description: 'One short line under the name (≤ 200 chars), e.g. "ארוחת ערב קלילה ב-20 דקות".' },
  servings: { type: 'number' },
  ingredients: {
    type: 'array',
    items: { type: 'object', properties: { text: { type: 'string' }, orig: { type: 'string' }, alt: { type: 'string' } }, required: ['text'] },
  },
  steps: { type: 'array', items: { type: 'string' } },
  tags: { type: 'array', items: { type: 'string' } },
  prep_min: { type: 'number' },
  cook_min: { type: 'number' },
  notes: { type: 'string' },
  source_url: { type: 'string' },
  image_url: { type: 'string' },
} as const;

export const RECIPE_TOOLS: ShoppingTool[] = [
  {
    name: 'recipes_list',
    description: "List recipes: the caller's own (scope 'mine', default) or the shared feed ('feed'). Optional q (words in the name, an ingredient or a tag) and tag. Returns ids for recipes_get.",
    inputSchema: {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'Words to match (Hebrew).' },
        tag: { type: 'string' },
        scope: { type: 'string', enum: ['mine', 'feed'] },
      },
    },
    handler: async (args, caller) => {
      const feed = str(args, 'scope') === 'feed';
      const all = feed ? await listFeed() : (await listMineFull(caller.userEmail)).map(toSummary);
      const tag = str(args, 'tag');
      const found = filterRecipes(all, str(args, 'q'), tag ? [tag] : []);
      if (!found.length) return all.length ? 'No recipe matches.' : feed ? 'The feed is empty.' : 'No recipes yet.';
      return [`${found.length} recipe(s):`, ...found.slice(0, 50).map(summaryLine)].join('\n');
    },
  },
  {
    name: 'recipes_get',
    description: 'One recipe in full: ingredients (optionally scaled to servings), steps, notes, nutrition per serving and its page link.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, servings: { type: 'number', description: 'Scale the amounts to this many servings.' } },
      required: ['id'],
    },
    handler: async (args, caller) => {
      const r = await readable(str(args, 'id'), caller);
      const n = typeof args.servings === 'number' && args.servings >= 1 && args.servings <= 100 ? Math.round(args.servings) : r.servings;
      const { totals, partial } = perServing(r);
      return [
        `${r.name} — ${n} servings${r.ownerName && r.owner !== caller.userEmail ? ` (by ${r.ownerName})` : ''}`,
        `${SITE}/recipes/${r.id}`,
        r.description ? r.description : '',
        r.tags.length ? `Tags: ${r.tags.join(', ')}` : '',
        r.prepMin || r.cookMin ? `Prep ${r.prepMin ?? 0} min, cook ${r.cookMin ?? 0} min` : '',
        '', 'Ingredients:', ...r.ingredients.map((i) => `- ${scaleLine(i, n / r.servings)}${i.alt ? ` (${i.alt})` : ''}`),
        '', 'Steps:', ...r.steps.filter((s) => s.trim()).map((s, k) => `${k + 1}. ${s}`),
        r.notes.trim() ? `\nNotes: ${r.notes.trim()}` : '',
        totals ? `\nPer serving: ${partial ? 'about ' : ''}${totals.kcal} kcal, protein ${totals.p} g, carbs ${totals.c} g, fat ${totals.f} g` : '',
      ].filter((l) => l !== '').join('\n');
    },
  },
  {
    name: 'recipes_save',
    description: SAVE_RULES,
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: "Replace this recipe of the caller's instead of creating one." }, ...RECIPE_PROPS },
      required: ['name', 'servings', 'ingredients', 'steps'],
    },
    handler: async (args, caller) => {
      const { saved, notes } = await saveFromArgs(caller.userEmail, args, str(args, 'id') || null);
      return `Saved "${saved.name}" — ${SITE}/recipes/${saved.id}\n${notes}`;
    },
  },
  {
    name: 'recipes_to_list',
    description: "Put a recipe's ingredients on the caller's household shopping list (needs the shopping permission). Pantry basics (salt, oil, sugar, flour…) and products already on the list are skipped. Optional servings scales weighed amounts.",
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, servings: { type: 'number' } },
      required: ['id'],
    },
    handler: async (args, caller) => {
      if (!(await hasCurrentPermission(caller.userEmail, 'shopping'))) throw new Error("You don't have the \"shopping\" permission.");
      const r = await readable(str(args, 'id'), caller);
      const n = typeof args.servings === 'number' && args.servings >= 1 && args.servings <= 100 ? Math.round(args.servings) : r.servings;
      const { lines, householdId } = await buildMatch(r, caller.userEmail, n);
      const take = lines.filter((l) => l.ticked && l.product);
      const docs = await getItems(take.map((l) => l.product!.key));
      const byKey = new Map(docs.map((d) => [d._id, d]));
      const add = take.flatMap((l) => {
        const d = byKey.get(l.product!.key);
        const qty = d ? normalizeQty(l.qty, d.w) : null;
        return d && qty ? [{ key: d._id, name: d.n, qty, w: d.w }] : [];
      });
      if (add.length) await addLines(householdId, add);
      const skipped = lines.filter((l) => !l.ticked || !l.product).map((l) => `${l.text}${l.product ? '' : ' (no product found)'}`);
      return [
        add.length ? `Added ${add.length} to the shopping list: ${add.map((a) => a.name).join(', ')}` : 'Nothing was added.',
        skipped.length ? `Skipped (pantry, already on the list, or no product): ${skipped.join('; ')}` : '',
      ].filter(Boolean).join('\n');
    },
  },
  {
    name: 'recipes_import_queue',
    description: 'Import agent only. The import requests waiting to be done (oldest first): their ids. Claim each with recipes_import_claim.',
    inputSchema: { type: 'object', properties: {} },
    handler: async (_args, caller) => {
      requireAgent(caller);
      const q = await importQueue();
      return q.length ? q.map((r) => r.id).join('\n') : 'The queue is empty.';
    },
  },
  {
    name: 'recipes_import_claim',
    description: 'Import agent only. Takes one request (nobody else will): returns its link and/or pasted text (or an idea to write a recipe from), the requester\'s note, and the conversion rules to follow. Then call recipes_import_complete or recipes_import_fail.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    handler: async (args, caller) => {
      requireAgent(caller);
      const r = await claimImport(str(args, 'id'));
      if (!r) throw new Error('Not claimable: unknown id, already taken, or finished.');
      return [
        `Request ${r.id}`,
        ...(r.prompt ? [`Idea to write: ${r.prompt}`] : [r.url ? `Link: ${r.url}` : 'Link: (none)', r.text ? `Pasted text:\n${r.text}` : 'Pasted text: (none)']),
        r.note ? `Requester's note: ${r.note}` : '',
        '', ...(r.prompt ? [IDEA_RULES, ''] : []), CONVERSION_RULES,
      ].filter((l) => l !== '').join('\n');
    },
  },
  {
    name: 'recipes_import_complete',
    description: "Import agent only. Saves the converted recipe into the requester's book (same fields as recipes_save) and marks the request done.",
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'The import request id.' }, ...RECIPE_PROPS },
      required: ['id', 'name', 'servings', 'ingredients', 'steps'],
    },
    handler: async (args, caller) => {
      requireAgent(caller);
      const req = await getImport(str(args, 'id'));
      if (!req || req.status !== 'working') throw new Error('Claim the request first (recipes_import_claim).');
      const { saved, notes } = await saveFromArgs(req.requester, { ...args, source_url: args.source_url ?? req.url ?? undefined }, null);
      await finishImport(req.id, { recipeId: saved.id });
      return `Saved "${saved.name}" for the requester — ${SITE}/recipes/${saved.id}\n${notes}`;
    },
  },
  {
    name: 'recipes_import_fail',
    description: 'Import agent only. Ends a claimed request that could not be imported; `reason` is shown to the requester in Hebrew (e.g. "לא הצלחתי לקרוא את הקישור — הדביקו את טקסט המתכון").',
    inputSchema: { type: 'object', properties: { id: { type: 'string' }, reason: { type: 'string' } }, required: ['id', 'reason'] },
    handler: async (args, caller) => {
      requireAgent(caller);
      const reason = str(args, 'reason').slice(0, 300) || 'הייבוא נכשל';
      if (!(await finishImport(str(args, 'id'), { error: reason }))) throw new Error('Not a claimed request.');
      return 'Marked failed.';
    },
  },
];
