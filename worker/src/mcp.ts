import type { Env } from "./db";
import { ToolError, tools } from "./tools";

// Minimal stateless MCP over Streamable HTTP: every POST is a self-contained JSON-RPC
// request/batch answered with plain JSON (no sessions, no SSE).

const SUPPORTED = ["2025-06-18", "2025-03-26", "2024-11-05"];

type Rpc = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: any };

const ok = (id: Rpc["id"], result: unknown) => ({ jsonrpc: "2.0", id, result });
const err = (id: Rpc["id"], code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });

async function handle(env: Env, msg: Rpc) {
  const isNotification = msg.id === undefined;
  switch (msg.method) {
    case "initialize": {
      const asked = msg.params?.protocolVersion;
      return ok(msg.id, {
        protocolVersion: SUPPORTED.includes(asked) ? asked : SUPPORTED[0],
        capabilities: { tools: {} },
        serverInfo: { name: "hamilton-kitchen", version: "1.0.0" },
        instructions:
          "Read and edit the Hamilton apartment kitchen: ingredient inventory/shopping list, recipes, meal-prep log, and ratings. " +
          "Call kitchen_overview first. Writes go live on the website immediately.",
      });
    }
    case "ping":
      return ok(msg.id, {});
    case "tools/list":
      return ok(msg.id, {
        tools: tools.map(({ name, description, inputSchema, readOnly }) => ({
          name, description, inputSchema,
          annotations: { readOnlyHint: !!readOnly, destructiveHint: name.startsWith("delete_") },
        })),
      });
    case "tools/call": {
      const tool = tools.find((t) => t.name === msg.params?.name);
      if (!tool) return err(msg.id, -32602, `Unknown tool: ${msg.params?.name}`);
      try {
        const result = await tool.run(env, msg.params?.arguments ?? {});
        return ok(msg.id, { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
      } catch (e) {
        // Tool-level failures are reported in-band so the model can read and retry.
        const text = e instanceof ToolError ? e.message : `Internal error: ${(e as Error).message}`;
        return ok(msg.id, { isError: true, content: [{ type: "text", text }] });
      }
    }
    default:
      return isNotification ? null : err(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}

export async function handleMcp(env: Env, req: Request): Promise<Response> {
  if (req.method !== "POST") return new Response("Use POST", { status: 405, headers: { Allow: "POST" } });
  let body: Rpc | Rpc[];
  try {
    body = await req.json();
  } catch {
    return Response.json(err(null, -32700, "Parse error"), { status: 400 });
  }
  const msgs = Array.isArray(body) ? body : [body];
  const replies = (await Promise.all(msgs.map((m) => handle(env, m)))).filter((r) => r !== null);
  if (!replies.length) return new Response(null, { status: 202 });
  return Response.json(Array.isArray(body) ? replies : replies[0]);
}
