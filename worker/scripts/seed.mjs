// Prints SQL that loads the repo's JSON files into D1:  npm run seed:sql
import { readFileSync } from "node:fs";

const load = (f) => JSON.parse(readFileSync(new URL(`../../${f}`, import.meta.url), "utf8"));
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const row = (kind, id, obj) =>
  `INSERT OR REPLACE INTO docs (kind, id, data) VALUES (${q(kind)}, ${q(id)}, ${q(JSON.stringify(obj))});`;

const ing = load("data.json");
const rec = load("recipes.json");
const meals = load("meal-prep-log.json");

const out = [];
out.push(row("meta", "categories", ing.categories));
ing.ingredients.forEach((i) => out.push(row("ingredient", i.name, i)));
rec.recipes.forEach((r) => out.push(row("recipe", r.id, r)));
meals.entries.forEach((m) => out.push(row("meal", m.id, m)));
console.log(out.join("\n"));
