# Hamilton Kitchen Ingredients

A running inventory of what's stocked in the Hamilton apartment kitchen, photographed and tagged so it's easy to check before a grocery run or before starting a recipe.

## View it

Open `index.html` directly in a browser, or enable **GitHub Pages** for this repo (Settings → Pages → deploy from `main` / root) to get a shareable link.

## What's here

- `index.html` / `styles.css` / `app.js` — a searchable, filterable gallery of every ingredient, each scoped to its own photo
- `images/` — one photo per ingredient (resized/compressed from the original kitchen photos)
- `data.json` — the same ingredient data in plain JSON, kept in sync with the copy embedded in `index.html`

## Updating the list

1. Edit the ingredient entries in `data.json` (source of truth) and mirror the change into the `<script id="ingredient-data">` block in `index.html`.
2. Drop any new photo into `images/`, referencing its filename in the `image` field.
3. Set `"status": "have"` or `"need"`, and add `"low": true` for anything running out.
4. Commit and push.

## Filters in the UI

- **In Stock / Shopping List / Running Low** tabs
- Category chips (Oils & Vinegars, Sauces & Condiments, Spices & Seasonings, Baking, Dairy & Fridge, Produce, Meat & Seafood)
- Free-text search

## Checking things off while you shop

Every card has a checkbox. Tap it as you drop an item in your cart — the card dims and the name gets struck through. Checked state is saved in your browser's `localStorage`, so it survives closing the tab and reopening later. The **Shopping List** tab shows a running "X of Y checked off" count, and a **Clear checked-off items** link appears whenever anything is checked so you can reset before your next trip.

Note: this is per-browser/device, not synced anywhere — it won't follow you across a different phone or laptop.
