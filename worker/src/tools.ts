import { type Doc, type Env, type Kind, deleteDoc, getCategories, getDoc, listDocs, putDoc } from "./db";

interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  readOnly?: boolean;
  run(env: Env, args: Doc): Promise<unknown>;
}

const str = (description: string) => ({ type: "string", description });
const obj = (properties: Record<string, unknown>, required: string[] = []) =>
  ({ type: "object", properties, required, additionalProperties: false });
const ratingProp = { type: ["integer", "null"], minimum: 1, maximum: 5, description: "1-5 stars; null clears the rating" };

class ToolError extends Error {}
const fail = (msg: string): never => { throw new ToolError(msg); };

/** Shallow-merge `patch` over `base`; a null value deletes that field. */
function merge(base: Doc, patch: Doc): Doc {
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete out[k];
    else out[k] = v;
  }
  return out;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const checkRating = (r: unknown) => {
  if (r !== undefined && r !== null && !(Number.isInteger(r) && (r as number) >= 1 && (r as number) <= 5))
    fail("rating must be an integer 1-5 (or null to clear)");
};

const INGREDIENT_FIELDS = ["name", "category", "qty", "status", "low", "trip", "note", "image", "rating", "review"];
const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack", "bedtime", "extra"];

function onlyKnown(args: Doc, allowed: string[]) {
  const bad = Object.keys(args).filter((k) => !allowed.includes(k));
  if (bad.length) fail(`Unknown field(s): ${bad.join(", ")}. Allowed: ${allowed.join(", ")}`);
}

async function stockMap(env: Env) {
  return new Map((await listDocs(env, "ingredient")).map((i) => [i.name as string, i]));
}

/** For each recipe ingredient: 'have' | 'need' | 'untracked' (item not in inventory). */
function annotate(recipe: Doc, stock: Map<string, Doc>) {
  return (recipe.ingredients ?? []).map((ing: Doc) => {
    const inv = ing.item ? stock.get(ing.item) : undefined;
    return { ...ing, stock: !inv ? "untracked" : inv.status === "need" ? "need" : "have" };
  });
}

export const tools: Tool[] = [
  {
    name: "kitchen_overview",
    description: "Start here. Counts, categories, current shopping trips, low-stock items, and top-rated recipes.",
    inputSchema: obj({}),
    readOnly: true,
    async run(env) {
      const ings = await listDocs(env, "ingredient");
      const recipes = await listDocs(env, "recipe");
      const meals = await listDocs(env, "meal");
      return {
        categories: await getCategories(env),
        ingredientCount: ings.length,
        inStock: ings.filter((i) => i.status === "have").length,
        onShoppingList: ings.filter((i) => i.status === "need").map((i) => ({ name: i.name, trip: i.trip })),
        runningLow: ings.filter((i) => i.low).map((i) => i.name),
        recipes: recipes.map((r) => ({ id: r.id, name: r.name, rating: r.rating ?? null })),
        mealPrepEntries: meals.length,
        mealTypes: MEAL_TYPES,
      };
    },
  },

  // ---------- ingredients ----------
  {
    name: "list_ingredients",
    description: "List ingredients, optionally filtered. All filters are ANDed.",
    inputSchema: obj({
      status: { enum: ["have", "need"], description: "have = in stock, need = on shopping list" },
      category: str("Exact category name"),
      low: { type: "boolean", description: "Only items flagged as running low" },
      trip: str("Shopping trip label, e.g. 'Shopping Aug 20'"),
      query: str("Case-insensitive substring of the name"),
    }),
    readOnly: true,
    async run(env, a) {
      const q = (a.query ?? "").toLowerCase();
      return (await listDocs(env, "ingredient")).filter((i) =>
        (!a.status || i.status === a.status) &&
        (!a.category || i.category === a.category) &&
        (a.low === undefined || !!i.low === a.low) &&
        (!a.trip || i.trip === a.trip) &&
        (!q || i.name.toLowerCase().includes(q)));
    },
  },
  {
    name: "save_ingredient",
    description:
      "Create or update one ingredient, matched by exact name. Only the fields you pass change; pass null to remove a field. " +
      "New ingredients need category and status. 'image' must be a filename that already exists in the site's images/ folder (uploading photos isn't supported here).",
    inputSchema: obj({
      name: str("Exact ingredient name (the key)"),
      category: str("Must be an existing category; use add_category first for a new one"),
      qty: { type: ["string", "null"], description: "e.g. '1L'" },
      status: { enum: ["have", "need"] },
      low: { type: ["boolean", "null"] },
      trip: { type: ["string", "null"], description: "Shopping trip label for 'need' items" },
      note: { type: ["string", "null"] },
      image: { type: ["string", "null"] },
      rating: ratingProp,
      review: { type: ["string", "null"], description: "Free-text opinion on the product" },
    }, ["name"]),
    async run(env, a) {
      onlyKnown(a, INGREDIENT_FIELDS);
      checkRating(a.rating);
      const existing = await getDoc(env, "ingredient", a.name);
      const next = merge(existing ?? {}, a);
      if (!existing && (!next.category || !next.status)) fail("New ingredients need both category and status.");
      if (!["have", "need"].includes(next.status)) fail("status must be 'have' or 'need'.");
      const cats = await getCategories(env);
      if (!cats.includes(next.category)) fail(`Unknown category '${next.category}'. Existing: ${cats.join(", ")}`);
      await putDoc(env, "ingredient", a.name, next);
      return { created: !existing, ingredient: next };
    },
  },
  {
    name: "set_ingredient_status",
    description:
      "Bulk-flip ingredients between in stock ('have') and shopping list ('need'). Typical use: after a grocery run, mark everything bought as 'have'. " +
      "Moving to 'have' clears the 'trip' label and the 'low' flag; moving to 'need' can set a trip label.",
    inputSchema: obj({
      names: { type: "array", items: { type: "string" }, minItems: 1, description: "Exact ingredient names" },
      status: { enum: ["have", "need"] },
      trip: str("Optional trip label when status is 'need'"),
    }, ["names", "status"]),
    async run(env, a) {
      const updated: string[] = [], missing: string[] = [];
      for (const name of a.names as string[]) {
        const ing = await getDoc(env, "ingredient", name);
        if (!ing) { missing.push(name); continue; }
        const next = a.status === "have"
          ? merge(ing, { status: "have", trip: null, low: null })
          : merge(ing, { status: "need", ...(a.trip ? { trip: a.trip } : {}) });
        await putDoc(env, "ingredient", name, next);
        updated.push(name);
      }
      return { updated, notFound: missing };
    },
  },
  {
    name: "delete_ingredient",
    description: "Permanently delete an ingredient by exact name. Recipes that reference it will show it as untracked.",
    inputSchema: obj({ name: str("Exact ingredient name") }, ["name"]),
    async run(env, a) {
      await env.DB.prepare("DELETE FROM photos WHERE name = ?").bind(a.name).run();
      return { deleted: await deleteDoc(env, "ingredient", a.name) };
    },
  },
  {
    name: "add_category",
    description: "Add a new ingredient category.",
    inputSchema: obj({ name: str("Category name") }, ["name"]),
    async run(env, a) {
      const cats = await getCategories(env);
      if (!cats.includes(a.name)) await putDoc(env, "meta", "categories", [...cats, a.name]);
      return { categories: cats.includes(a.name) ? cats : [...cats, a.name] };
    },
  },

  // ---------- recipes ----------
  {
    name: "list_recipes",
    description: "List recipes with rating and how many ingredients are still to buy.",
    inputSchema: obj({ query: str("Substring of the recipe name") }),
    readOnly: true,
    async run(env, a) {
      const stock = await stockMap(env);
      const q = (a.query ?? "").toLowerCase();
      return (await listDocs(env, "recipe")).filter((r) => !q || r.name.toLowerCase().includes(q)).map((r) => ({
        id: r.id, name: r.name, rating: r.rating ?? null, yield: r.yield, total: r.total,
        toBuy: annotate(r, stock).filter((i: Doc) => i.stock === "need").length,
      }));
    },
  },
  {
    name: "get_recipe",
    description: "Full recipe; each ingredient line is tagged stock: have | need | untracked.",
    inputSchema: obj({ id: str("Recipe id") }, ["id"]),
    readOnly: true,
    async run(env, a) {
      const r = (await getDoc(env, "recipe", a.id)) ?? fail(`No recipe with id '${a.id}'.`);
      return { ...r, ingredients: annotate(r, await stockMap(env)) };
    },
  },
  {
    name: "save_recipe",
    description:
      "Create or update a recipe by id. Only passed fields change (arrays like ingredients/steps/notes are replaced whole); null removes a field. " +
      "Each ingredient is {amount, label, item?, note?}; 'item' must be the exact name of a tracked ingredient to show stock status. " +
      "New recipes need name, ingredients and steps.",
    inputSchema: obj({
      id: str("kebab-case id, e.g. 'carne-guisada'"),
      name: str("Display name"),
      icon: str("One emoji"),
      blurb: str("One-sentence description"),
      prep: str("e.g. '10 Min'"), cook: str("e.g. '30 Min'"), total: str("e.g. '40 Min'"), yield: str("e.g. '3-4'"),
      ingredients: {
        type: "array",
        items: obj({ amount: str("e.g. '1 Tbsp'"), label: str("e.g. 'Oil'"), item: str("Exact tracked ingredient name"), note: str("") }, ["amount", "label"]),
      },
      steps: { type: "array", items: { type: "string" } },
      notes: { type: ["array", "null"], items: { type: "string" } },
      rating: ratingProp,
      review: { type: ["string", "null"], description: "How it turned out, what to change next time" },
    }, ["id"]),
    async run(env, a) {
      onlyKnown(a, ["id", "name", "icon", "blurb", "prep", "cook", "total", "yield", "ingredients", "steps", "notes", "rating", "review"]);
      checkRating(a.rating);
      const existing = await getDoc(env, "recipe", a.id);
      const next = merge(existing ?? { icon: "🍽️", blurb: "", prep: "-", cook: "-", total: "-", yield: "-" }, a);
      if (!existing && (!next.name || !next.ingredients?.length || !next.steps?.length))
        fail("New recipes need name, ingredients and steps.");
      await putDoc(env, "recipe", a.id, next);
      const stock = await stockMap(env);
      const untracked = annotate(next, stock).filter((i: Doc) => i.stock === "untracked").map((i: Doc) => i.label);
      return { created: !existing, recipe: next, untrackedIngredients: untracked };
    },
  },
  {
    name: "delete_recipe",
    description: "Permanently delete a recipe by id.",
    inputSchema: obj({ id: str("Recipe id") }, ["id"]),
    async run(env, a) {
      return { deleted: await deleteDoc(env, "recipe", a.id) };
    },
  },

  // ---------- meal prep ----------
  {
    name: "list_meal_prep",
    description: "List meal-prep log entries, oldest first. Dates are YYYY-MM-DD.",
    inputSchema: obj({ from: str("Earliest date"), to: str("Latest date"), type: { enum: MEAL_TYPES } }),
    readOnly: true,
    async run(env, a) {
      return (await listDocs(env, "meal"))
        .filter((m) => (!a.from || m.date >= a.from) && (!a.to || m.date <= a.to) && (!a.type || m.type === a.type))
        .sort((x, y) => x.date.localeCompare(y.date));
    },
  },
  {
    name: "save_meal_prep",
    description:
      "Log or update a meal-prep session. Omit id to create one (id becomes '<date>-<slug of meal>'); pass id to update. " +
      "New entries need date, meal, type, servings and ingredients (list of strings). perServing = {calories, protein, carbs, fat}.",
    inputSchema: obj({
      id: str("Existing entry id (omit to create)"),
      date: str("YYYY-MM-DD"),
      meal: str("What was made"),
      type: { enum: MEAL_TYPES },
      servings: { type: "integer", minimum: 1, description: "Number of containers" },
      perServing: obj({ calories: { type: "number" }, protein: { type: "number" }, carbs: { type: "number" }, fat: { type: "number" } }, ["calories", "protein", "carbs", "fat"]),
      ingredients: { type: "array", items: { type: "string" } },
      notes: { type: ["string", "null"] },
      recipeLink: { type: ["string", "null"], description: "Recipe id if this came from a saved recipe" },
      rating: ratingProp,
      review: { type: ["string", "null"] },
    }),
    async run(env, a) {
      onlyKnown(a, ["id", "date", "meal", "type", "servings", "perServing", "ingredients", "notes", "recipeLink", "rating", "review"]);
      checkRating(a.rating);
      if (a.date && !/^\d{4}-\d{2}-\d{2}$/.test(a.date)) fail("date must be YYYY-MM-DD.");
      if (a.type && !MEAL_TYPES.includes(a.type)) fail(`type must be one of ${MEAL_TYPES.join(", ")}`);
      const existing = a.id ? await getDoc(env, "meal", a.id) : null;
      if (a.id && !existing) fail(`No meal-prep entry with id '${a.id}'. Omit id to create a new one.`);
      const next = merge(existing ?? {}, a);
      if (!existing) {
        for (const f of ["date", "meal", "type", "servings", "ingredients"]) if (next[f] === undefined) fail(`New entries need '${f}'.`);
        next.id = `${next.date}-${slug(next.meal)}`;
        if (await getDoc(env, "meal", next.id)) fail(`An entry with id '${next.id}' already exists; pass id to update it.`);
      }
      await putDoc(env, "meal", next.id, next);
      return { created: !existing, entry: next };
    },
  },
  {
    name: "delete_meal_prep",
    description: "Permanently delete a meal-prep entry by id.",
    inputSchema: obj({ id: str("Entry id") }, ["id"]),
    async run(env, a) {
      return { deleted: await deleteDoc(env, "meal", a.id) };
    },
  },

  // ---------- ratings ----------
  {
    name: "rate",
    description:
      "Shortcut to set or clear just the rating/review on an ingredient (by name), recipe (by id) or meal-prep entry (by id). " +
      "Omitted fields are left alone.",
    inputSchema: obj({
      kind: { enum: ["ingredient", "recipe", "meal"] },
      id: str("Ingredient name, recipe id, or meal-prep entry id"),
      rating: ratingProp,
      review: { type: ["string", "null"] },
    }, ["kind", "id"]),
    async run(env, a) {
      checkRating(a.rating);
      const existing = (await getDoc(env, a.kind as Kind, a.id)) ?? fail(`No ${a.kind} '${a.id}'.`);
      const next = merge(existing, {
        ...(a.rating !== undefined ? { rating: a.rating } : {}),
        ...(a.review !== undefined ? { review: a.review } : {}),
      });
      await putDoc(env, a.kind as Kind, a.id, next);
      return { id: a.id, rating: next.rating ?? null, review: next.review ?? null };
    },
  },
];

export { ToolError };
