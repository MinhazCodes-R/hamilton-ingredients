import type { Env } from "./db";

/*
 * Single-user auth. Two ways in:
 *  1. `Authorization: Bearer <MCP_PASSWORD>` — for clients that let you set a header.
 *  2. OAuth 2.1 (PKCE, dynamic client registration) whose only "login" is typing the
 *     password on /authorize — this is what claude.ai / ChatGPT-style connectors speak.
 * All OAuth artifacts are HMAC-signed, stateless tokens keyed off the password, so
 * rotating MCP_PASSWORD revokes everything.
 */

const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64url = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function hmacKey(env: Env) {
  return crypto.subtle.importKey("raw", enc.encode("hamilton-mcp:" + env.MCP_PASSWORD),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function sign(env: Env, payload: Record<string, unknown>): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(env), enc.encode(body));
  return `${body}.${b64url(sig)}`;
}

export async function verify(env: Env, token: string, type: string): Promise<Record<string, any> | null> {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(env), unb64url(sig), enc.encode(body));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(unb64url(body)));
    if (payload.t !== type) return null;
    if (payload.exp && payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

async function safeEqual(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all(
    [a, b].map(async (s) => new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s))))
  );
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha[i] ^ hb[i];
  return diff === 0;
}

export async function isAuthorized(env: Env, req: Request): Promise<boolean> {
  if (!env.MCP_PASSWORD) return false;
  const h = req.headers.get("Authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  if (!token) return false;
  if (await safeEqual(token, env.MCP_PASSWORD)) return true;
  return (await verify(env, token, "access")) !== null;
}

const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...headers },
  });

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function loginPage(params: URLSearchParams, error = ""): Response {
  const hidden = ["client_id", "redirect_uri", "state", "code_challenge", "response_type"]
    .map((k) => `<input type="hidden" name="${k}" value="${esc(params.get(k) ?? "")}">`).join("");
  return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hamilton Kitchen · Connect</title>
<style>body{font:16px system-ui;max-width:360px;margin:12vh auto;padding:0 16px}input,button{font:inherit;width:100%;padding:10px;margin-top:10px;box-sizing:border-box}.e{color:#b00020}</style>
<h2>Hamilton Kitchen</h2><p>Enter the password to let this app read and edit the kitchen data.</p>
${error ? `<p class="e">${esc(error)}</p>` : ""}
<form method="post">${hidden}<input type="password" name="password" placeholder="Password" autofocus required><button>Connect</button></form>`,
    { status: error ? 401 : 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

export function metadata(url: URL): Response | null {
  const origin = url.origin;
  if (url.pathname.startsWith("/.well-known/oauth-protected-resource"))
    return json({ resource: `${origin}/mcp`, authorization_servers: [origin], bearer_methods_supported: ["header"] });
  if (url.pathname === "/.well-known/oauth-authorization-server")
    return json({
      issuer: origin,
      authorization_endpoint: `${origin}/authorize`,
      token_endpoint: `${origin}/token`,
      registration_endpoint: `${origin}/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
    });
  return null;
}

export async function handleOAuth(env: Env, req: Request, url: URL): Promise<Response | null> {
  if (url.pathname === "/register" && req.method === "POST") {
    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    const redirect_uris: string[] = Array.isArray(body.redirect_uris) ? body.redirect_uris : [];
    if (!redirect_uris.length) return json({ error: "invalid_redirect_uri" }, 400);
    // The client_id carries its own redirect_uris, signed, so no client table is needed.
    const client_id = await sign(env, { t: "client", r: redirect_uris });
    return json({
      client_id, redirect_uris, client_name: body.client_name ?? "MCP client",
      token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    }, 201);
  }

  if (url.pathname === "/authorize") {
    const form = req.method === "POST" ? new URLSearchParams(await req.text()) : url.searchParams;
    const client = await verify(env, form.get("client_id") ?? "", "client");
    const redirect = form.get("redirect_uri") ?? "";
    if (!client || !client.r.includes(redirect)) return new Response("Unknown client or redirect_uri", { status: 400 });
    if (form.get("response_type") !== "code" || !form.get("code_challenge"))
      return new Response("Only response_type=code with PKCE (S256) is supported", { status: 400 });

    if (req.method !== "POST") return loginPage(form);
    if (!env.MCP_PASSWORD || !(await safeEqual(form.get("password") ?? "", env.MCP_PASSWORD)))
      return loginPage(form, "Wrong password.");

    const code = await sign(env, {
      t: "code", c: form.get("client_id"), r: redirect,
      ch: form.get("code_challenge"), exp: Math.floor(Date.now() / 1000) + 300,
    });
    const dest = new URL(redirect);
    dest.searchParams.set("code", code);
    if (form.get("state")) dest.searchParams.set("state", form.get("state")!);
    return Response.redirect(dest.toString(), 302);
  }

  if (url.pathname === "/token" && req.method === "POST") {
    const form = new URLSearchParams(await req.text());
    const now = Math.floor(Date.now() / 1000);
    const issue = async (client_id: string) => json({
      token_type: "Bearer",
      access_token: await sign(env, { t: "access", exp: now + 86400 }),
      expires_in: 86400,
      refresh_token: await sign(env, { t: "refresh", c: client_id, exp: now + 90 * 86400 }),
    });

    if (form.get("grant_type") === "authorization_code") {
      const code = await verify(env, form.get("code") ?? "", "code");
      if (!code || code.r !== form.get("redirect_uri") || code.c !== form.get("client_id"))
        return json({ error: "invalid_grant" }, 400);
      const challenge = b64url(await crypto.subtle.digest("SHA-256", enc.encode(form.get("code_verifier") ?? "")));
      if (!(await safeEqual(challenge, code.ch))) return json({ error: "invalid_grant" }, 400);
      return issue(code.c);
    }
    if (form.get("grant_type") === "refresh_token") {
      const r = await verify(env, form.get("refresh_token") ?? "", "refresh");
      if (!r) return json({ error: "invalid_grant" }, 400);
      return issue(r.c);
    }
    return json({ error: "unsupported_grant_type" }, 400);
  }
  return null;
}
