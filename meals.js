import { API_BASE } from "./config.js";

const SLOT_ICON = { breakfast: "🍳", lunch: "🥗", dinner: "🍽️", snack: "🥤", bedtime: "🌙" };
const SLOT_ORDER = ["breakfast", "lunch", "dinner", "snack", "bedtime"];
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const weekEl = document.getElementById("cal-week");
const rangeEl = document.getElementById("cal-range");
const summaryEl = document.getElementById("cal-summary");
const errorEl = document.getElementById("cal-error");

// Dates are handled as local YYYY-MM-DD strings throughout to avoid UTC off-by-one days.
const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s) => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const mondayOf = (d) => addDays(d, -((d.getDay() + 6) % 7));

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let weekStart = mondayOf(new Date());

async function load(from, to) {
  if (!API_BASE) throw new Error("The site isn't connected to the meal database (API_BASE is empty in config.js).");
  const res = await fetch(`${API_BASE}/api/meal-log?from=${from}&to=${to}`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Couldn't load meals (${res.status})`);
  return (await res.json()).entries;
}

const sumOf = (entries, k) => entries.reduce((n, e) => n + (Number(e[k]) || 0), 0);

function entryHTML(e) {
  const macros = [
    e.calories != null && `${e.calories} cal`,
    e.protein != null && `${e.protein}g P`,
    e.carbs != null && `${e.carbs}g C`,
    e.fat != null && `${e.fat}g F`,
  ].filter(Boolean);
  const stars = e.rating ? `<span class="stars" title="${e.rating}/5">${"★".repeat(e.rating)}${"☆".repeat(5 - e.rating)}</span>` : "";
  return `
    <div class="cal-entry slot-${esc(e.slot)}">
      <div class="cal-entry-head">
        <span>${SLOT_ICON[e.slot] || "🍽️"} ${esc(e.slot)}${e.time ? ` · ${esc(e.time)}` : ""}</span>
        ${stars}
      </div>
      <div class="cal-entry-meal">${esc(e.meal)}</div>
      ${macros.length ? `<div class="cal-entry-macros">${macros.join(" · ")}</div>` : ""}
      ${e.notes ? `<div class="cal-entry-notes">${esc(e.notes)}</div>` : ""}
    </div>`;
}

function dayHTML(date, entries, today) {
  const key = iso(date);
  const mine = entries
    .filter((e) => e.date === key)
    .sort((a, b) => (a.time || "99").localeCompare(b.time || "99") || SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));
  const cal = sumOf(mine, "calories");
  const protein = sumOf(mine, "protein");
  const totals = mine.length && (cal || protein)
    ? `<div class="cal-day-totals">${cal} cal · ${protein}g protein</div>`
    : "";
  const dow = DAY_NAMES[(date.getDay() + 6) % 7];
  return `
    <section class="cal-day ${key === today ? "today" : ""} ${key > today ? "future" : ""}">
      <header class="cal-day-head"><span class="cal-dow">${dow}</span><span class="cal-dom">${date.getDate()}</span></header>
      <div class="cal-day-body">${mine.length ? mine.map(entryHTML).join("") : `<p class="cal-none">Nothing logged</p>`}</div>
      ${totals}
    </section>`;
}

async function render() {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const from = iso(days[0]), to = iso(days[6]);
  const fmt = (d, o) => d.toLocaleDateString(undefined, o);
  rangeEl.textContent = `${fmt(days[0], { month: "short", day: "numeric" })} – ${fmt(days[6], { month: "short", day: "numeric", year: "numeric" })}`;
  errorEl.hidden = true;
  try {
    const entries = await load(from, to);
    weekEl.innerHTML = days.map((d) => dayHTML(d, entries, iso(new Date()))).join("");
    const logged = new Set(entries.map((e) => e.date)).size;
    const withCals = [...new Set(entries.filter((e) => e.calories != null).map((e) => e.date))];
    const avgCal = withCals.length ? Math.round(sumOf(entries, "calories") / withCals.length) : null;
    const avgP = withCals.length ? Math.round(sumOf(entries, "protein") / withCals.length) : null;
    summaryEl.textContent = entries.length
      ? `${entries.length} meal${entries.length === 1 ? "" : "s"} across ${logged} day${logged === 1 ? "" : "s"}` +
        (avgCal != null ? ` · avg ${avgCal} cal, ${avgP}g protein per tracked day` : "")
      : "No meals logged this week";
  } catch (err) {
    weekEl.innerHTML = "";
    summaryEl.textContent = "";
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
}

document.getElementById("cal-prev").addEventListener("click", () => { weekStart = addDays(weekStart, -7); render(); });
document.getElementById("cal-next").addEventListener("click", () => { weekStart = addDays(weekStart, 7); render(); });
document.getElementById("cal-today").addEventListener("click", () => { weekStart = mondayOf(new Date()); render(); });

render();
