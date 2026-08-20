# Hamilton Kitchen Ingredients

A running inventory of what's stocked in the Hamilton apartment kitchen, photographed and tagged so it's easy to check before a grocery run or before starting a recipe.

## View it

Open `index.html` directly in a browser, or enable **GitHub Pages** for this repo (Settings → Pages → deploy from `main` / root) to get a shareable link.

## What's here

- `index.html` / `styles.css` / `app.js` — a searchable, filterable gallery of every ingredient, each scoped to its own photo
- `images/` — one photo per ingredient (resized/compressed from the original kitchen photos)
- `data.json` — the same ingredient data in plain JSON, kept in sync with the copy embedded in `index.html`
- `recipes.json` — recipes, each ingredient cross-referenced to an entry in `data.json`
- `recipes/` — the same recipes as plain markdown, readable straight from GitHub

## Recipes

The site shows each recipe above the inventory. Every ingredient line is marked
against what's actually in the kitchen — ✅ in stock, 🛒 on the shopping list —
and the header counts how many you still need, so you can tell at a glance
whether you can cook it tonight. A recipe with nothing left to buy opens
expanded.

To add one: append an entry to `recipes.json`, mirror it into the
`<script id="recipe-data">` block in `index.html`, and set each ingredient's
`item` field to the exact `name` of the matching entry in `data.json`. An
ingredient whose `item` doesn't match anything tracked shows as ❔ rather than
silently claiming to be in stock. Drop a markdown copy in `recipes/` for
reading on GitHub.

## Updating the list

1. Edit the ingredient entries in `data.json` (source of truth) and mirror the change into the `<script id="ingredient-data">` block in `index.html`.
2. Drop any new photo into `images/`, referencing its filename in the `image` field.
3. Set `"status": "have"` or `"need"`, and add `"low": true` for anything running out.
4. Commit and push.

## Shopping trips

Items for one specific grocery run get a `"trip"` field (e.g. `"trip": "Shopping Aug 20"`).
Any `need` item whose `trip` matches `CURRENT_TRIP` in `app.js` is pulled out of the
general shopping list into its own section at the top of the page. To start a new trip,
tag the items and update `CURRENT_TRIP`.

Every ingredient now has a photo. The ones that were never photographed in the
kitchen use freely-licensed stand-ins from Wikimedia Commons — all of them are
listed in `images/CREDITS.md`, and several are share-alike. They show the right
ingredient, not the specific product on the shelf, so replace any of them with a
real photo when you take one: same filename in `images/`, then drop its line
from `CREDITS.md`.

## Filters in the UI

- **In Stock / Shopping List / Running Low** tabs
- Category chips (Oils & Vinegars, Sauces & Condiments, Spices & Seasonings, Baking, Dairy & Fridge, Produce, Meat & Seafood)
- Free-text search

## Checking things off while you shop

Every card has a checkbox. Tap it as you drop an item in your cart — the card dims and the name gets struck through. Checked state is saved in your browser's `localStorage`, so it survives closing the tab and reopening later. The **Shopping List** tab shows a running "X of Y checked off" count, and a **Clear checked-off items** link appears whenever anything is checked so you can reset before your next trip.

Note: this is per-browser/device, not synced anywhere — it won't follow you across a different phone or laptop.
