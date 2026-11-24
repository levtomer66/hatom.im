// /recipes tools for the MCP server (src/app/api/mcp/route.ts): importing a
// recipe someone found online ("save this reel's recipe"), finding and
// reading recipes, and putting a recipe's ingredients on the shopping list.
// The model does the reading and converting; recipes_save's description holds
// the rules (Hebrew, Israeli units and products). Server-only.

import { hasFeaturePermission } from '@/lib/api-caller';
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

const SAVE_RULES = `Save a recipe to the caller's /recipes book (create, or replace one of theirs by id). Use it to import a recipe from a link, a caption, a video or a screenshot the user gives you: read it yourself, then convert it before calling.

Conversion rules (Israel):
- Write the name, ingredients, steps, tags and notes in Hebrew.
- Amounts in grams / ml, or כוס / כף / כפית (cup = 240 ml, tbsp = 15 ml, tsp = 5 ml); oz → grams (28 g), lb → grams (454 g), a stick of butter = 113 g. Keep "לפי הטעם" lines without an amount.
- Temperatures in °C (°F → °C, rounded to 5: 350°F → 175°C).
- Swap US products for what an Israeli supermarket sells: heavy cream → שמנת מתוקה 38%; sour cream → שמנת חמוצה 15%; all-purpose flour → קמח לבן; half-and-half → חצי שמנת מתוקה חצי חלב; buttermilk → לבן או רוויון; cream cheese → גבינת שמנת 30%; kosher salt → מלח גס; baking soda → סודה לשתייה; scallions → בצל ירוק; cilantro → כוסברה; ground beef → בשר בקר טחון; powdered sugar → אבקת סוכר; brown sugar → סוכר חום.
- Each ingredient: { text: the Hebrew line, amount first ("2 כוסות קמח לבן"), orig: the original line as written in the source, alt: a short note when you swapped a product ("heavy cream → שמנת מתוקה 38%") }.
- One action per step. Servings as the source states (default 4 if it says nothing).
- source_url: the link the recipe came from. image_url: a direct image URL of the dish if you have one (it is copied and stored).
The server estimates grams and links each ingredient to nutrition and a product to buy (marked for the user to check). Tell the user the page link from the result.`;

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
      properties: {
        id: { type: 'string', description: "Replace this recipe of the caller's instead of creating one." },
        name: { type: 'string' },
        servings: { type: 'number' },
        ingredients: {
          type: 'array',
          items: {
            type: 'object',
            properties: { text: { type: 'string' }, orig: { type: 'string' }, alt: { type: 'string' } },
            required: ['text'],
          },
        },
        steps: { type: 'array', items: { type: 'string' } },
        tags: { type: 'array', items: { type: 'string' } },
        prep_min: { type: 'number' },
        cook_min: { type: 'number' },
        notes: { type: 'string' },
        source_url: { type: 'string' },
        image_url: { type: 'string' },
      },
      required: ['name', 'servings', 'ingredients', 'steps'],
    },
    handler: async (args, caller) => {
      const parsed = parseSaveArgs(args);
      if (!parsed.ok) throw new Error(parsed.error);
      const { recipe, sourceUrl, imageUrl } = parsed.value;
      const id = str(args, 'id');
      if (id) {
        const old = await getRecipe(id);
        if (!old || old.owner !== caller.userEmail) throw new Error(`No recipe "${id}" of yours to replace.`);
      }
      const ingredients = await autoLink(recipe.ingredients);
      const source = sourceUrl ? { url: sourceUrl, by: null } : undefined;
      const saved = id
        ? await updateRecipe(caller.userEmail, id, { ...recipe, ingredients, ...(source ? { source } : {}) })
        : await createRecipe(caller.userEmail, { ...recipe, ingredients, source: source ?? null });
      if (!saved) throw new Error('The recipe could not be saved.');
      let photoNote = '';
      if (imageUrl) {
        const url = await storeImageFromUrl(imageUrl, saved.id);
        if (url) {
          const before = await setPhoto(caller.userEmail, saved.id, url);
          if (before && before !== url) await dropBlob(before);
        } else photoNote = '\nPhoto not saved: the image could not be downloaded (it may need a direct image link).';
      }
      const unlinked = ingredients.filter((i) => i.qty !== null && !i.link).map((i) => i.text);
      return `Saved "${saved.name}" — ${SITE}/recipes/${saved.id}\n` +
        `${ingredients.length} ingredients, ${saved.steps.length} steps. Ingredient links were picked automatically; the user can check them on the page.` +
        (unlinked.length ? `\nNo nutrition link for: ${unlinked.join('; ')}` : '') + photoNote;
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
      if (!(await hasFeaturePermission(caller.userEmail, 'shopping'))) throw new Error("You don't have the \"shopping\" permission.");
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
];
