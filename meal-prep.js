const raw = document.getElementById("meal-prep-data").textContent;
const data = JSON.parse(raw);

const TYPE_ICON = {
  breakfast: "🍳",
  lunch: "🥗",
  dinner: "🍽️",
  snack: "🥤",
  bedtime: "🌙",
};

const STORAGE_KEY = "hamilton-meal-prep-eaten";

data.entries.forEach((entry) => {
  entry.week = isoWeek(entry.date);
});

function isoWeek(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const diff = target - firstThursday;
  const week = 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
  return `${target.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function loadEaten() {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function saveEaten() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...eaten]));
}

const eaten = loadEaten();

const updatedDate = document.getElementById("updated-date");
const entryCount = document.getElementById("entry-count");
const weeksEl = document.getElementById("weeks");
const emptyMsg = document.getElementById("empty-msg");

updatedDate.textContent = data.updated;
entryCount.textContent = data.entries.length;

function macroRow(perServing) {
  if (!perServing) return "";
  return `
    <div class="macro-row">
      <span>${perServing.calories} cal</span>
      <span>${perServing.protein}g protein</span>
      <span>${perServing.carbs}g carb</span>
      <span>${perServing.fat}g fat</span>
    </div>
  `;
}

function entryHTML(entry) {
  const eatenCount = (entry.eatenIds || []).filter((id) => eaten.has(id)).length;
  const ids = [];
  for (let i = 1; i <= entry.servings; i++) ids.push(`${entry.id}__s${i}`);
  entry.eatenIds = ids;
  const eatenNow = ids.filter((id) => eaten.has(id)).length;

  const checkboxes = ids
    .map(
      (id, i) => `
      <label class="serving-check">
        <input type="checkbox" data-id="${id}" ${eaten.has(id) ? "checked" : ""} />
        <span>#${i + 1}</span>
      </label>
    `
    )
    .join("");

  return `
    <div class="prep-card ${eatenNow === ids.length ? "all-eaten" : ""}" data-entry="${entry.id}">
      <div class="prep-card-header">
        <span class="prep-type">${TYPE_ICON[entry.type] || "🍽️"} ${entry.type}</span>
        <span class="prep-date">${entry.date}</span>
      </div>
      <h3 class="prep-meal">${entry.meal}</h3>
      ${macroRow(entry.perServing)}
      <div class="prep-servings">
        <span class="prep-servings-label">${eatenNow}/${entry.servings} containers eaten</span>
        <div class="serving-grid">${checkboxes}</div>
      </div>
      ${entry.notes ? `<p class="prep-notes">${entry.notes}</p>` : ""}
      <details class="prep-ingredients">
        <summary>Ingredients</summary>
        <ul>${entry.ingredients.map((i) => `<li>${i}</li>`).join("")}</ul>
      </details>
    </div>
  `;
}

function render() {
  const byWeek = new Map();
  [...data.entries]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .forEach((entry) => {
      if (!byWeek.has(entry.week)) byWeek.set(entry.week, []);
      byWeek.get(entry.week).push(entry);
    });

  emptyMsg.hidden = data.entries.length !== 0;

  weeksEl.innerHTML = [...byWeek.entries()]
    .map(
      ([week, entries]) => `
      <section class="week-block">
        <h2 class="week-title">Week ${week}</h2>
        <div class="prep-grid">${entries.map(entryHTML).join("")}</div>
      </section>
    `
    )
    .join("");
}

weeksEl.addEventListener("change", (e) => {
  const box = e.target.closest("input[type=checkbox][data-id]");
  if (!box) return;
  const id = box.dataset.id;
  if (box.checked) {
    eaten.add(id);
  } else {
    eaten.delete(id);
  }
  saveEaten();
  render();
});

render();
