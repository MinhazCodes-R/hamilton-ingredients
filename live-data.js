import { API_BASE } from "./config.js";

// Prefer the live database behind the MCP server; fall back to the JSON embedded in the
// page if the API isn't configured or is unreachable.
export async function loadData(scriptId, apiPath) {
  const embedded = () => JSON.parse(document.getElementById(scriptId).textContent);
  if (!API_BASE) return embedded();
  try {
    const res = await fetch(API_BASE + apiPath, { cache: "no-cache" });
    if (!res.ok) throw new Error(res.status);
    return await res.json();
  } catch {
    return embedded();
  }
}

export function stars(rating) {
  if (!rating) return "";
  return `<span class="stars" title="${rating}/5">${"★".repeat(rating)}${"☆".repeat(5 - rating)}</span>`;
}
