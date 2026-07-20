const raw = document.getElementById("ingredient-data").textContent;
const data = JSON.parse(raw);

const CATEGORY_ICON = {
  "Oils & Vinegars": "🫒",
  "Sauces & Condiments": "🍯",
  "Spices & Seasonings": "🧂",
  "Baking": "🥣",
  "Dairy & Fridge": "🧀",
  "Produce": "🧄",
};

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
  const badge = item.low
    ? `<span class="badge low">Low</span>`
    : item.status === "need"
    ? `<span class="badge need">Buy</span>`
    : `<span class="badge have">Have</span>`;

  const imgBlock = item.image
    ? `<img src="images/${item.image}" alt="${item.name}" loading="lazy" />`
    : `<div class="card-img placeholder">${CATEGORY_ICON[item.category] || "🍽️"}</div>`;

  return `
    <div class="card">
      <div class="card-img">
        ${item.image ? imgBlock : imgBlock}
        ${badge}
      </div>
      <div class="card-body">
        <div class="card-name">${item.name}</div>
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
  resultCount.textContent = `${filtered.length} of ${data.ingredients.length} ingredients`;
}

search.addEventListener("input", (e) => {
  state.query = e.target.value.trim();
  render();
});

buildCategoryChips();
buildStatusTabs();
render();
