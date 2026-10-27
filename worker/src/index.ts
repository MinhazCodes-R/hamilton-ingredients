import { handleOAuth, isAuthorized, metadata } from "./auth";
import { type Env, ingredientsFile, mealPrepFile, recipesFile } from "./db";
import { handleMcp } from "./mcp";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
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
