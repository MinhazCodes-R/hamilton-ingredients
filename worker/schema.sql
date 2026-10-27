-- One row per ingredient / recipe / meal-prep entry; `data` is the same JSON
-- object the static site already uses, so fields (rating, notes, ...) are free-form.
CREATE TABLE IF NOT EXISTS docs (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  kind       TEXT NOT NULL,            -- 'ingredient' | 'recipe' | 'meal' | 'meta'
  id         TEXT NOT NULL,            -- ingredient name, recipe id, meal id, or meta key
  data       TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (kind, id)
);

-- Photos taken from the site; base64 JPEG, one per ingredient (replaced on re-upload).
CREATE TABLE IF NOT EXISTS photos (
  name       TEXT PRIMARY KEY,
  data_b64   TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
