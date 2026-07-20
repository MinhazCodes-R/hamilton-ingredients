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

const grid = document.getElementById("grid");
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
    : `<div class="card-img placeholder">${CATEGORY_ICON[item.category] || "🍽️"}</div>`;

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
  grid.innerHTML = filtered.map(cardHTML).join("");
  emptyMsg.hidden = filtered.length !== 0;

  const checkedInView = filtered.filter((i) => checked.has(i.id)).length;
  resultCount.textContent =
    state.status === "need" && filtered.length
      ? `${checkedInView} of ${filtered.length} checked off`
      : `${filtered.length} of ${data.ingredients.length} ingredients`;

  const anyCheckedAtAll = data.ingredients.some((i) => checked.has(i.id));
  clearCheckedBtn.hidden = !anyCheckedAtAll;
}

grid.addEventListener("change", (e) => {
  const box = e.target.closest("input[type=checkbox][data-id]");
  if (!box) return;
  const id = box.dataset.id;
  if (box.checked) {
    checked.add(id);
  } else {
    checked.delete(id);
  }
  saveChecked();
  const card = grid.querySelector(`.card[data-id="${id}"]`);
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
