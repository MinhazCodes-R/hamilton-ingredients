# Hamilton MCP server

A Cloudflare Worker that exposes the kitchen data (ingredients, recipes, meal-prep log, ratings) as an
[MCP](https://modelcontextprotocol.io) server, backed by D1. The static site reads the same data from
the worker's public `/api/*` endpoints.

## Deploy

```bash
cd worker
npm install
npx wrangler login
npx wrangler d1 create hamilton            # paste the printed database_id into wrangler.toml
npx wrangler d1 execute hamilton --remote --file=schema.sql
npm run seed:sql                           # builds seed.sql from ../data.json, ../recipes.json, ../meal-prep-log.json
npx wrangler d1 execute hamilton --remote --file=seed.sql
npx wrangler secret put MCP_PASSWORD       # the password you'll type to connect
npx wrangler deploy
```

Then set `API_BASE` in `../config.js` to the worker URL so the site shows live data.

Seed once only: re-running it overwrites rows with the repo JSON. After that, the database is the source of truth
and the JSON files / embedded HTML blocks are just an offline fallback.

## Connect a chatbot

MCP URL: `https://<worker>.workers.dev/mcp`

- **Claude.ai / ChatGPT / anything with "custom connector"**: paste the URL. A page opens asking for the
  password; enter `MCP_PASSWORD` and you're connected (OAuth 2.1 + PKCE under the hood).
- **Claude Code, Cursor, etc.**: `claude mcp add --transport http hamilton https://<worker>.workers.dev/mcp --header "Authorization: Bearer <password>"`

Changing `MCP_PASSWORD` invalidates every existing connection. Use a long password: there is no rate limit
on the login page.

## Tools

`kitchen_overview`, `list_ingredients`, `save_ingredient`, `set_ingredient_status`, `delete_ingredient`,
`add_category`, `list_recipes`, `get_recipe`, `save_recipe`, `delete_recipe`, `list_meal_prep`,
`save_meal_prep`, `delete_meal_prep`, `rate`.

Ratings are an integer `rating` (1-5) plus a free-text `review` on ingredients, recipes and meal-prep entries.
Photos can't be uploaded through MCP; `image` must name a file already in `images/`.

## Local dev

```bash
echo 'MCP_PASSWORD=dev' > .dev.vars
npx wrangler d1 execute hamilton --local --file=schema.sql
npm run seed:sql && npx wrangler d1 execute hamilton --local --file=seed.sql
npm run dev
```
