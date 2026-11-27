import { loadData, stars } from "./live-data.js";

/* ---------- Views ----------
   On wide screens every panel shows at once. On phones (see styles.css) only the
   panel named by `main[data-view]` shows; the URL hash picks it, so the top tabs
   and the bottom bar on every page can link straight to a view. */

const VIEWS = {
  recipes: { title: "Recipes", nav: "recipes" },
  shopping: { title: "Shopping list", nav: "shopping" },
  "in-stock": { title: "In stock", nav: "shopping" },
};
const DEFAULT_VIEW = "shopping";

const main = document.getElementById("main");
const viewTitle = document.getElementById("view-title");

function currentView() {
  const view = location.hash.slice(1);
  return VIEWS[view] ? view : DEFAULT_VIEW;
}

function markCurrent(link, on) {
  link.classList.toggle("active", on);
  if (on) link.setAttribute("aria-current", "page");
  else link.removeAttribute("aria-current");
}

function applyView() {
  const view = currentView();
  main.dataset.view = view;
  viewTitle.textContent = VIEWS[view].title;
  document.querySelectorAll("[data-view-link]").forEach((a) => markCurrent(a, a.dataset.viewLink === view));
  document.querySelectorAll(".bottom-nav [data-nav]").forEach((a) => markCurrent(a, a.dataset.nav === VIEWS[view].nav));
}

window.addEventListener("hashchange", () => {
  applyView();
  window.scrollTo(0, 0);
});
applyView();

/* ---------- Ingredients ---------- */

const data = await loadData("ingredient-data", "/api/ingredients");

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

// Placeholder art for in-stock cards without a photo. Falls back to CATEGORY_ICON.
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
  "Fresh Parsley": "🌿",
  "Fresh Basil": "🌿",
  "Parmesan Cheese": "🧀",
  "Ground Beef": "🥩",
  "Celery": "🥬",
  "Tomato Sauce": "🥫",
};

const STORAGE_KEY = "hamilton-ingredients-checked";

// Items whose `trip` matches this are pulled into their own group at the top.
const CURRENT_TRIP = "Pasta + Moscow Mules";

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// Give every ingredient a stable id so checked state survives re-renders
// and page reloads, even if the list order changes slightly.
data.ingredients.forEach((item, i) => {
  item.id = `${i}-${item.name.replace(/\s+/g, "-").toLowerCase()}`;
});

const categories = [...new Set([...(data.categories || []), ...data.ingredients.map((i) => i.category)])];

function loadChecked() {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function saveChecked() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...checked]));
  } catch {
    // Private mode or storage blocked: checks still work until reload.
  }
}

const checked = loadChecked();

const state = {
  category: "all",
  lowOnly: false,
  query: "",
};

const needGroups = document.getElementById("need-groups");
const needCount = document.getElementById("need-count");
const needTabCount = document.getElementById("need-tab-count");
const needEmpty = document.getElementById("need-empty");
const checkedSummary = document.getElementById("checked-summary");
const clearCheckedBtn = document.getElementById("clear-checked");
const gridHave = document.getElementById("grid-have");
const haveCount = document.getElementById("have-count");
const haveEmpty = document.getElementById("have-empty");
const categoryChips = document.getElementById("category-chips");
const search = document.getElementById("search");

if (data.updated) {
  document.getElementById("updated-date").textContent = data.updated;
  document.getElementById("updated-wrap").hidden = false;
}
document.getElementById("total-count").textContent = data.ingredients.length;

function buildCategoryChips() {
  const chips = [{ category: "all", label: "All categories" }, ...categories.map((c) => ({ category: c, label: c }))];
  categoryChips.innerHTML =
    chips
      .map((c) => `<button type="button" class="chip${c.category === "all" ? " active" : ""}" data-category="${escapeHTML(c.category)}" aria-pressed="${c.category === "all"}">${escapeHTML(c.label)}</button>`)
      .join("") +
    `<button type="button" class="chip chip-toggle" id="low-toggle" aria-pressed="false">Running low</button>`;

  categoryChips.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    if (btn.id === "low-toggle") {
      state.lowOnly = !state.lowOnly;
      btn.classList.toggle("active", state.lowOnly);
      btn.setAttribute("aria-pressed", String(state.lowOnly));
    } else {
      state.category = btn.dataset.category;
      categoryChips.querySelectorAll("[data-category]").forEach((c) => {
        c.classList.toggle("active", c === btn);
        c.setAttribute("aria-pressed", String(c === btn));
      });
    }
    render();
  });
}

function matchesQuery(item) {
  if (!state.query) return true;
  const q = state.query.toLowerCase();
  return item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q);
}

function matchesHaveFilters(item) {
  if (state.category !== "all" && item.category !== state.category) return false;
  if (state.lowOnly && !item.low) return false;
  return true;
}

// Shopping-list rows: plain list entries, no photo or badge. The whole row is the
// checkbox's label so it is easy to tap in a store.
function shopRowHTML(item, showCategory) {
  const isChecked = checked.has(item.id);
  const meta = [item.qty, showCategory ? item.category : null].filter(Boolean).join(" · ");
  return `
    <li class="shop-row${isChecked ? " checked" : ""}">
      <label>
        <input type="checkbox" data-id="${item.id}" ${isChecked ? "checked" : ""} />
        <span class="shop-text">
          <span class="shop-name">${escapeHTML(item.name)}</span>
          ${item.note ? `<span class="shop-note">${escapeHTML(item.note)}</span>` : ""}
        </span>
        ${meta ? `<span class="shop-meta">${escapeHTML(meta)}</span>` : ""}
      </label>
    </li>`;
}

function groupNeedItems(items) {
  const groups = [];
  const trip = items.filter((i) => i.trip === CURRENT_TRIP);
  if (trip.length) groups.push({ title: CURRENT_TRIP, items: trip, mixed: true });
  const rest = items.filter((i) => i.trip !== CURRENT_TRIP);
  categories.forEach((cat) => {
    const inCat = rest.filter((i) => i.category === cat);
    if (inCat.length) groups.push({ title: cat, items: inCat, mixed: false });
  });
  return groups;
}

function cardHTML(item) {
  const isChecked = checked.has(item.id);
  const badge = item.low ? `<span class="badge low">Low</span>` : "";

  const imgBlock = item.image
    ? `<img src="images/${escapeHTML(item.image)}" alt="${escapeHTML(item.name)}" loading="lazy" />`
    : `<div class="card-img placeholder" aria-hidden="true">${ITEM_ICON[item.name] || CATEGORY_ICON[item.category] || "🍽️"}</div>`;

  return `
    <div class="card ${isChecked ? "checked" : ""}">
      <div class="card-img">
        ${imgBlock}
        ${badge}
      </div>
      <div class="card-body">
        <label class="card-check">
          <input type="checkbox" data-id="${item.id}" ${isChecked ? "checked" : ""} />
          <span class="card-name">${escapeHTML(item.name)}</span>
        </label>
        ${item.note ? `<div class="card-note">${escapeHTML(item.note)}</div>` : ""}
        <div class="card-meta">
          <span class="card-category">${escapeHTML(item.category)}</span>
          ${item.qty ? `<span class="card-qty">${escapeHTML(item.qty)}</span>` : ""}
        </div>
      </div>
    </div>
  `;
}

function render() {
  const need = data.ingredients.filter((i) => i.status === "need");
  const have = data.ingredients.filter((i) => i.status === "have");
  const needShown = need.filter(matchesQuery);
  const haveShown = have.filter((i) => matchesQuery(i) && matchesHaveFilters(i));

  needGroups.innerHTML = groupNeedItems(needShown)
    .map((g) => `
      <h3 class="shop-group-title">${escapeHTML(g.title)}</h3>
      <ul class="shop-list">${g.items.map((i) => shopRowHTML(i, g.mixed)).join("")}</ul>`)
    .join("");

  needCount.textContent = need.length;
  needTabCount.textContent = need.length || "";
  const checkedNeed = need.filter((i) => checked.has(i.id)).length;
  checkedSummary.textContent = need.length ? `${checkedNeed} of ${need.length} checked off` : "";
  clearCheckedBtn.hidden = !data.ingredients.some((i) => checked.has(i.id));
  needEmpty.hidden = needShown.length !== 0;
  needEmpty.textContent = need.length ? "Nothing on the list matches your search." : "Nothing to buy right now.";

  gridHave.innerHTML = haveShown.map(cardHTML).join("");
  haveCount.textContent = have.length;
  haveEmpty.hidden = haveShown.length !== 0;
}

main.addEventListener("change", (e) => {
  const box = e.target.closest("input[type=checkbox][data-id]");
  if (!box) return;
  if (box.checked) {
    checked.add(box.dataset.id);
  } else {
    checked.delete(box.dataset.id);
  }
  saveChecked();
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
render();

/* ---------- Recipes ---------- */

const recipeData = await loadData("recipe-data", "/api/recipes");

const statusByName = new Map(
  data.ingredients.map((i) => [i.name, i])
);

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
        <span class="r-title">${escapeHTML(r.name)}</span>
        ${stars(r.rating)}
        ${readiness}
      </summary>
      <div class="recipe-body">
        <p class="r-blurb">${escapeHTML(r.blurb)}</p>
        ${r.review ? `<p class="r-review">“${escapeHTML(r.review)}”</p>` : ""}
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
  const host = document.getElementById("recipes-list");
  const recipes = recipeData.recipes || [];
  document.getElementById("recipe-count").textContent = recipes.length || "";
  host.innerHTML = recipes.length
    ? recipes.map(recipeHTML).join("")
    : `<p class="empty">No recipes yet.</p>`;
}

renderRecipes();
