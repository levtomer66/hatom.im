// How an imported recipe is converted for Israel: the one source for the
// recipes_save description and what recipes_import_claim hands the import
// agent. Edit here to improve imports. Import-free.

/** Writing a recipe from an idea (a prompt request) instead of importing one. */
export const IDEA_RULES = `Writing from an idea (this request has no link or text):
- Write a real, cookable recipe for the idea, in Hebrew: name, ingredients, steps, tags, and a short description.
- Ingredients easy to buy in an Israeli supermarket; metric and Israeli measures (גרם, מ״ל, כוס, כף, כפית).
- 2–4 servings unless the idea says otherwise; honest prep and cook minutes.
- No source_url. Leave orig empty (there is no original); no image_url unless you found a matching photo.
- Tags as for imports. When the idea isn't a dish or a drink, fail the request with a short Hebrew reason.`;

export const CONVERSION_RULES = `Conversion rules (Israel):
- Write the name, ingredients, steps, tags and notes in Hebrew.
- Amounts in grams / ml, or כוס / כף / כפית (cup = 240 ml, tbsp = 15 ml, tsp = 5 ml); oz → grams (28 g), lb → grams (454 g), a stick of butter = 113 g. Keep "לפי הטעם" lines without an amount.
- Temperatures in °C (°F → °C, rounded to 5: 350°F → 175°C).
- Swap US products for what an Israeli supermarket sells: heavy cream → שמנת מתוקה 38%; sour cream → שמנת חמוצה 15%; all-purpose flour → קמח לבן; half-and-half → חצי שמנת מתוקה חצי חלב; buttermilk → לבן או רוויון; cream cheese → גבינת שמנת 30%; kosher salt → מלח גס; baking soda → סודה לשתייה; scallions → בצל ירוק; cilantro → כוסברה; ground beef → בשר בקר טחון; powdered sugar → אבקת סוכר; brown sugar → סוכר חום.
- Each ingredient: { text: the Hebrew line, amount first ("2 כוסות קמח לבן"), orig: the original line as written in the source, alt: a short note when you swapped a product ("heavy cream → שמנת מתוקה 38%") }.
- One action per step. Servings as the source states (default 4 if it says nothing).
- source_url: the link the recipe came from. image_url: a direct image URL of the dish if you have one (it is copied and stored).
The server estimates grams and links each ingredient to nutrition and a product to buy (marked for the user to check).`;
