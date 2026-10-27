import { handleOAuth, isAuthorized, metadata } from "./auth";
import { type Env, getDoc, ingredientsFile, mealPrepFile, putDoc, recipesFile } from "./db";
import { handleMcp } from "./mcp";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PUT, OPTIONS",
  "access-control-allow-headers": "authorization, content-type, mcp-protocol-version, mcp-session-id",
};

async function route(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });

  // Read-only JSON for the static site (same data is already public in the repo).
  if (req.method === "GET") {
    if (url.pathname === "/api/ingredients") return Response.json(await ingredientsFile(env), { headers: { "cache-control": "no-cache" } });
    if (url.pathname === "/api/recipes") return Response.json(await recipesFile(env), { headers: { "cache-control": "no-cache" } });
    if (url.pathname === "/api/meal-prep") return Response.json(await mealPrepFile(env), { headers: { "cache-control": "no-cache" } });
    if (url.pathname === "/") return new Response("Hamilton Kitchen MCP server. Connect a client to /mcp.");
  }

  // Ingredient photos (public to read; replacing one needs the password).
  if (url.pathname.startsWith("/img/") && req.method === "GET") {
    const name = decodeURIComponent(url.pathname.slice(5));
    const row = await env.DB.prepare("SELECT data_b64 FROM photos WHERE name = ?").bind(name).first<{ data_b64: string }>();
    if (!row) return new Response("No photo", { status: 404 });
    const bytes = Uint8Array.from(atob(row.data_b64), (c) => c.charCodeAt(0));
    // The site adds ?v=<photoVersion>, so each re-upload gets a fresh cache key.
    return new Response(bytes, { headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=31536000, immutable" } });
  }
  if (url.pathname.startsWith("/api/photo/") && req.method === "PUT") {
    if (!(await isAuthorized(env, req))) return new Response("Unauthorized", { status: 401 });
    const name = decodeURIComponent(url.pathname.slice("/api/photo/".length));
    const ing = await getDoc(env, "ingredient", name);
    if (!ing) return new Response("Unknown ingredient", { status: 404 });
    const buf = new Uint8Array(await req.arrayBuffer());
    if (buf.length > 1_000_000) return new Response("Photo too large (max 1MB)", { status: 413 });
    if (!(buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)) return new Response("Expected a JPEG", { status: 415 });
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    await env.DB.prepare(
      `INSERT INTO photos (name, data_b64) VALUES (?, ?)
       ON CONFLICT (name) DO UPDATE SET data_b64 = excluded.data_b64, updated_at = datetime('now')`
    ).bind(name, btoa(bin)).run();
    const photoVersion = Date.now();
    await putDoc(env, "ingredient", name, { ...ing, photoVersion });
    return Response.json({ photoVersion });
  }

  const meta = metadata(url);
  if (meta) return meta;

  const oauth = await handleOAuth(env, req, url);
  if (oauth) return oauth;

  if (url.pathname === "/mcp") {
    if (!(await isAuthorized(env, req))) {
      return new Response("Unauthorized", {
        status: 401,
        headers: { "WWW-Authenticate": `Bearer resource_metadata="${url.origin}/.well-known/oauth-protected-resource"` },
      });
    }
    return handleMcp(env, req);
  }
  return new Response("Not found", { status: 404 });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const res = await route(req, env);
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(CORS)) out.headers.set(k, v);
    out.headers.set("access-control-expose-headers", "www-authenticate");
    return out;
  },
};
