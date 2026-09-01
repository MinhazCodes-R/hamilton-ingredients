# Hamilton Kitchen Ingredients

A running inventory of what's stocked in the Hamilton apartment kitchen, photographed and tagged so it's easy to check before a grocery run or before starting a recipe.

## View it

Open `index.html` directly in a browser, or enable **GitHub Pages** for this repo (Settings → Pages → deploy from `main` / root) to get a shareable link.

## What's here

- `index.html` / `styles.css` / `app.js` — a searchable, filterable gallery of every ingredient, each scoped to its own photo
- `images/` — one photo per ingredient (resized/compressed from the original kitchen photos)
- `data.json` — the same ingredient data in plain JSON, kept in sync with the copy embedded in `index.html`
- `meal-prep.html` / `meal-prep.js` — a weekly log of meal-prep sessions: what was made, how many containers, and per-container macros
- `meal-prep-log.json` — the same meal-prep data in plain JSON, kept in sync with the copy embedded in `meal-prep.html`

## Updating the list

1. Edit the ingredient entries in `data.json` (source of truth) and mirror the change into the `<script id="ingredient-data">` block in `index.html`.
2. Drop any new photo into `images/`, referencing its filename in the `image` field.
3. Set `"status": "have"` or `"need"`, and add `"low": true` for anything running out.
4. Commit and push.

## Filters in the UI

- **In Stock / Shopping List / Running Low** tabs
- Category chips (Oils & Vinegars, Sauces & Condiments, Spices & Seasonings, Baking, Dairy & Fridge, Produce, Meat & Seafood)
- Free-text search

## Logging a meal prep

1. Add a new entry to the `entries` array in `meal-prep-log.json` (source of truth) and mirror it into the `<script id="meal-prep-data">` block in `meal-prep.html`.
2. Fields: `date` (YYYY-MM-DD, drives the week grouping), `meal`, `type` (breakfast/lunch/dinner/snack/bedtime), `servings` (number of containers), `perServing` macros, `ingredients`, and optional `notes`.
3. Commit and push. Entries are grouped by ISO week automatically — no need to track the week number yourself.
4. Tap a container checkbox on the page as you eat it — checked state is saved in your browser's `localStorage`, same as the shopping list.

## Checking things off while you shop

Every card has a checkbox. Tap it as you drop an item in your cart — the card dims and the name gets struck through. Checked state is saved in your browser's `localStorage`, so it survives closing the tab and reopening later. The **Shopping List** tab shows a running "X of Y checked off" count, and a **Clear checked-off items** link appears whenever anything is checked so you can reset before your next trip.

Note: this is per-browser/device, not synced anywhere — it won't follow you across a different phone or laptop.
