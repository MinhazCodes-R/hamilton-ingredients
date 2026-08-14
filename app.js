const raw = document.getElementById("ingredient-data").textContent;
const data = JSON.parse(raw);

const CATEGORY_ICON = {
  "Oils & Vinegars": "🫒",
  "Sauces & Condiments": "🍯",
  "Spices & Seasonings": "🧂",
  "Baking": "🥣",
  "Dairy & Fridge": "🧀",
  "Produce": "🧄",
  "Meat & Seafood": "🥩",
  "Pantry & Grains": "🍝",
};

// Falls back to CATEGORY_ICON for anything not listed here.
const ITEM_ICON = {
  "Garlic": "🧄",
  "Onion(s)": "🧅",
  "Jalapeño": "🌶️",
  "Tomato (fresh)": "🍅",
  "Fresh Cilantro": "🌿",
  "Bell Peppers": "🫑",
  "Beef Stew Meat (cubed)": "🥩",
  "Shredded Cheese (chihuahua or mozzarella)": "🧀",
  "Tomato Paste": "🥫",
  "Beef Stock": "🍲",
  "Tortillas (or rice)": "🫓",
  "Ground Cumin": "🧂",
  "Ground Coriander": "🧂",
  "Bean Sprouts (Sprout King)": "🌱",
  "Rice Noodles": "🍜",
  "Breadcrumbs": "🍞",
  "Unsalted Butter": "🧈",
  "Eggs (whole)": "🥚",
  "Egg Whites (liquid carton)": "🥚",
  "Pumpkin Purée": "🎃",
  "Chocolate Chips": "🍫",
  "Black or Dark Cocoa Powder": "🍫",
  "Vanilla Extract": "🍦",
  "Chili Flakes (crushed red pepper)": "🌶️",
  "Parsley (dried or fresh)": "🌿",
  "Paprika": "🌶️",
  "Garlic Powder": "🧄",
};

const STORAGE_KEY = "hamilton-ingredients-checked";

// Give every ingredient a stable id so checked state survives re-renders
// and page reloads, even if the list order changes slightly.
data.ingredients.forEach((item, i) => {
  item.id = `${i}-${item.name.replace(/\s+/g, "-").toLowerCase()}`;
});

function loadChecked() {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function saveChecked() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...checked]));
}

const checked = loadChecked();

const state = {
  status: "all",
  category: "all",
  query: "",
};

const sections = document.getElementById("sections");
const gridNeed = document.getElementById("grid-need");
const gridHave = document.getElementById("grid-have");
const sectionNeed = document.getElementById("section-need");
const sectionHave = document.getElementById("section-have");
const needCount = document.getElementById("need-count");
const haveCount = document.getElementById("have-count");
const emptyMsg = document.getElementById("empty-msg");
const resultCount = document.getElementById("result-count");
const totalCount = document.getElementById("total-count");
const updatedDate = document.getElementById("updated-date");
const categoryChips = document.getElementById("category-chips");
const statusTabs = document.getElementById("status-tabs");
const search = document.getElementById("search");
const clearCheckedBtn = document.getElementById("clear-checked");

updatedDate.textContent = data.updated;
totalCount.textContent = data.ingredients.length;

function buildCategoryChips() {
  const allChip = document.createElement("button");
  allChip.className = "chip active";
  allChip.dataset.category = "all";
  allChip.textContent = "All categories";
  categoryChips.appendChild(allChip);

  data.categories.forEach((cat) => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.dataset.category = cat;
    chip.textContent = `${CATEGORY_ICON[cat] || ""} ${cat}`;
    categoryChips.appendChild(chip);
  });

  categoryChips.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    state.category = btn.dataset.category;
    [...categoryChips.children].forEach((c) => c.classList.toggle("active", c === btn));
    render();
  });
}

function buildStatusTabs() {
  statusTabs.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab");
    if (!btn) return;
    state.status = btn.dataset.status;
    [...statusTabs.children].forEach((c) => c.classList.toggle("active", c === btn));
    render();
  });
}

function matchesFilters(item) {
  if (state.status === "have" && item.status !== "have") return false;
  if (state.status === "need" && item.status !== "need") return false;
  if (state.status === "low" && !item.low) return false;
  if (state.category !== "all" && item.category !== state.category) return false;
  if (state.query) {
    const q = state.query.toLowerCase();
    if (!item.name.toLowerCase().includes(q) && !item.category.toLowerCase().includes(q)) {
      return false;
    }
  }
  return true;
}

function cardHTML(item) {
  const isChecked = checked.has(item.id);
  const badge = item.low
    ? `<span class="badge low">Low</span>`
    : item.status === "need"
    ? `<span class="badge need">Buy</span>`
    : `<span class="badge have">Have</span>`;

  const imgBlock = item.image
    ? `<img src="images/${item.image}" alt="${item.name}" loading="lazy" />`
    : `<div class="card-img placeholder">${ITEM_ICON[item.name] || CATEGORY_ICON[item.category] || "🍽️"}</div>`;

  return `
    <div class="card ${isChecked ? "checked" : ""}" data-id="${item.id}">
      <div class="card-img">
        ${imgBlock}
        ${badge}
      </div>
      <div class="card-body">
        <label class="card-check">
          <input type="checkbox" data-id="${item.id}" ${isChecked ? "checked" : ""} />
          <span class="card-name">${item.name}</span>
        </label>
        ${item.note ? `<div class="card-note">${item.note}</div>` : ""}
        <div class="card-meta">
          <span class="card-category">${CATEGORY_ICON[item.category] || ""} ${item.category}</span>
          ${item.qty ? `<span class="card-qty">${item.qty}</span>` : ""}
        </div>
      </div>
    </div>
  `;
}

function render() {
  const filtered = data.ingredients.filter(matchesFilters);
  const needItems = filtered.filter((i) => i.status === "need");
  const haveItems = filtered.filter((i) => i.status === "have");

  gridNeed.innerHTML = needItems.map(cardHTML).join("");
  gridHave.innerHTML = haveItems.map(cardHTML).join("");

  sectionNeed.hidden = needItems.length === 0;
  sectionHave.hidden = haveItems.length === 0;
  needCount.textContent = needItems.length ? `(${needItems.length})` : "";
  haveCount.textContent = haveItems.length ? `(${haveItems.length})` : "";

  emptyMsg.hidden = filtered.length !== 0;

  const checkedInView = filtered.filter((i) => checked.has(i.id)).length;
  resultCount.textContent =
    state.status === "need" && filtered.length
      ? `${checkedInView} of ${filtered.length} checked off`
      : `${filtered.length} of ${data.ingredients.length} ingredients`;

  const anyCheckedAtAll = data.ingredients.some((i) => checked.has(i.id));
  clearCheckedBtn.hidden = !anyCheckedAtAll;
}

sections.addEventListener("change", (e) => {
  const box = e.target.closest("input[type=checkbox][data-id]");
  if (!box) return;
  const id = box.dataset.id;
  if (box.checked) {
    checked.add(id);
  } else {
    checked.delete(id);
  }
  saveChecked();
  const card = sections.querySelector(`.card[data-id="${id}"]`);
  if (card) card.classList.toggle("checked", box.checked);
  render();
});

clearCheckedBtn.addEventListener("click", () => {
  checked.clear();
  saveChecked();
  render();
});

search.addEventListener("input", (e) => {
  state.query = e.target.value.trim();
  render();
});

buildCategoryChips();
buildStatusTabs();
render();

/* ---------- Recipes ---------- */

const recipeData = JSON.parse(
  document.getElementById("recipe-data").textContent
);

const statusByName = new Map(
  data.ingredients.map((i) => [i.name, i])
);

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function recipeIngredientHTML(ing) {
  const inv = ing.item ? statusByName.get(ing.item) : null;
  // An ingredient the inventory doesn't track at all shouldn't claim to be
  // in stock — mark it unknown rather than silently showing "Have".
  const state = !inv ? "unknown" : inv.status === "need" ? "need" : "have";
  const mark = { have: "✅", need: "🛒", unknown: "❔" }[state];
  const title = { have: "In stock", need: "On the shopping list", unknown: "Not tracked" }[state];

  return `
    <li class="r-ing ${state}">
      <span class="r-mark" title="${title}">${mark}</span>
      <span class="r-amount">${escapeHTML(ing.amount)}</span>
      <span class="r-label">
        ${escapeHTML(ing.label)}
        ${ing.note ? `<em class="r-note">${escapeHTML(ing.note)}</em>` : ""}
      </span>
    </li>`;
}

function recipeHTML(r) {
  const missing = r.ingredients.filter((i) => {
    const inv = i.item ? statusByName.get(i.item) : null;
    return inv && inv.status === "need";
  }).length;

  const readiness = missing === 0
    ? `<span class="r-ready have">Ready to cook</span>`
    : `<span class="r-ready need">${missing} still to buy</span>`;

  return `
    <details class="recipe" ${missing === 0 ? "open" : ""}>
      <summary>
        <span class="r-icon">${r.icon}</span>
        <span class="r-title">${escapeHTML(r.name)}</span>
        ${readiness}
      </summary>
      <div class="recipe-body">
        <p class="r-blurb">${escapeHTML(r.blurb)}</p>
        <dl class="r-times">
          <div><dt>Prep</dt><dd>${escapeHTML(r.prep)}</dd></div>
          <div><dt>Cook</dt><dd>${escapeHTML(r.cook)}</dd></div>
          <div><dt>Total</dt><dd>${escapeHTML(r.total)}</dd></div>
          <div><dt>Yield</dt><dd>${escapeHTML(r.yield)}</dd></div>
        </dl>

        <h3 class="r-h">Ingredients</h3>
        <ul class="r-ings">${r.ingredients.map(recipeIngredientHTML).join("")}</ul>

        <h3 class="r-h">Instructions</h3>
        <ol class="r-steps">
          ${r.steps.map((s) => `<li>${escapeHTML(s)}</li>`).join("")}
        </ol>

        ${r.notes && r.notes.length
          ? `<h3 class="r-h">Notes</h3>
             <ul class="r-notes">${r.notes.map((n) => `<li>${escapeHTML(n)}</li>`).join("")}</ul>`
          : ""}
      </div>
    </details>`;
}

function renderRecipes() {
  const host = document.getElementById("recipes");
  if (!host || !recipeData.recipes.length) return;
  host.innerHTML =
    `<h2 class="section-title recipes">🍲 Recipes</h2>` +
    recipeData.recipes.map(recipeHTML).join("");
}

renderRecipes();
