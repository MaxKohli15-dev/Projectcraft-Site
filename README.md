# ProjectCraft website

Static rank-shop frontend for `projectcraft.play.hosting`. No build step —
just HTML/CSS/JS. Talks directly to Supabase's auto-generated RPC endpoints
(see the `projectcraft-supabase` package) — no server of your own, no
port/HTTPS setup needed on the Minecraft host at all.

## Deploy on GitHub Pages

1. Push this folder's contents to a repo (e.g. `projectcraft-website`).
2. Repo Settings → Pages → Deploy from branch → pick `main` and `/ (root)`.
3. Your site goes live at `https://<username>.github.io/<repo>/`.

## Configure

Edit `config.js`:

```js
const SUPABASE_URL = "https://YOURPROJECT.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_ANON_KEY";
```

Both come from Supabase → Project Settings → API. Set up Supabase first —
see `projectcraft-supabase/README.md`.

## How the pieces fit together

```
Website (GitHub Pages)  <--HTTPS-->  Supabase (Postgres + RPC)  <--HTTPS (outbound only)--  Plugin on your Minecraft server
```

- `index.html` / `styles.css` — the shop page.
- `script.js` — calls Supabase's `get_ranks` for the catalogue, `link_account`
  for the `/linkweb` code entry, and for balance checks / purchases:
  `request_status`/`request_purchase` to queue the request, then polls
  `get_result` every second until the plugin (which checks in every few
  seconds) has processed it.
- `config.js` — the only file you need to edit per-deployment.

Because the plugin only polls *out* to Supabase, nothing on your Minecraft
host needs a public port, a domain, or HTTPS certificates. The trade-off is
that balance checks and purchases take a few seconds instead of being
instant — the page shows that it's working rather than freezing.
