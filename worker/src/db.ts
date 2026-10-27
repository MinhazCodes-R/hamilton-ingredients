export interface Env {
  DB: D1Database;
  MCP_PASSWORD: string;
}

export type Kind = "ingredient" | "recipe" | "meal";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Doc = Record<string, any>;

export async function listDocs(env: Env, kind: Kind): Promise<Doc[]> {
  const { results } = await env.DB.prepare(
    "SELECT data FROM docs WHERE kind = ? ORDER BY seq"
  ).bind(kind).all<{ data: string }>();
  return results.map((r) => JSON.parse(r.data));
}

export async function getDoc(env: Env, kind: Kind | "meta", id: string): Promise<Doc | null> {
  const row = await env.DB.prepare("SELECT data FROM docs WHERE kind = ? AND id = ?")
    .bind(kind, id).first<{ data: string }>();
  return row ? JSON.parse(row.data) : null;
}

export async function putDoc(env: Env, kind: Kind | "meta", id: string, data: unknown): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO docs (kind, id, data) VALUES (?, ?, ?)
     ON CONFLICT (kind, id) DO UPDATE SET data = excluded.data, updated_at = datetime('now')`
  ).bind(kind, id, JSON.stringify(data)).run();
}

export async function deleteDoc(env: Env, kind: Kind, id: string): Promise<boolean> {
  const res = await env.DB.prepare("DELETE FROM docs WHERE kind = ? AND id = ?").bind(kind, id).run();
  return res.meta.changes > 0;
}

export async function getCategories(env: Env): Promise<string[]> {
  return ((await getDoc(env, "meta", "categories")) as unknown as string[]) ?? [];
}

async function lastUpdated(env: Env, kinds: Kind[]): Promise<string> {
  const row = await env.DB.prepare(
    `SELECT MAX(updated_at) AS t FROM docs WHERE kind IN (${kinds.map(() => "?").join(",")})`
  ).bind(...kinds).first<{ t: string | null }>();
  return (row?.t ?? new Date().toISOString()).slice(0, 10);
}

// Same shapes as data.json / recipes.json / meal-prep-log.json, so the static site needs no changes
// beyond where it loads them from.
export async function ingredientsFile(env: Env) {
  return {
    updated: await lastUpdated(env, ["ingredient"]),
    categories: await getCategories(env),
    ingredients: await listDocs(env, "ingredient"),
  };
}
export async function recipesFile(env: Env) {
  return { recipes: await listDocs(env, "recipe") };
}
export async function mealPrepFile(env: Env) {
  return { updated: await lastUpdated(env, ["meal"]), entries: await listDocs(env, "meal") };
}
