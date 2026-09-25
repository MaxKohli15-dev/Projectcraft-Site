# ProjectCraft website

Static rank-shop frontend for `projectcraft.play.hosting`. No build step —
just HTML/CSS/JS.

## Deploy on GitHub Pages

1. Push this folder's contents to a repo (e.g. `projectcraft-website`).
2. Repo Settings → Pages → Deploy from branch → pick `main` and `/ (root)`.
3. Your site goes live at `https://<username>.github.io/<repo>/`.

## Configure

Edit `config.js`:

```js
const API_BASE = "https://api.projectcraft.example.com"; // your plugin's HTTPS address
const SERVER_IP = "projectcraft.play.hosting";
```

`API_BASE` **must** be `https://` — see the plugin's README for why (browsers
block an HTTPS page calling a plain HTTP API) and how to get HTTPS in front
of the plugin (Cloudflare Tunnel or a reverse proxy).

On the plugin side, set `api.allowed-origin` in its `config.yml` to your
exact GitHub Pages URL (e.g. `https://mauxhsky.github.io`) so only your site
can call the API.

## How the pieces fit together

- `index.html` / `styles.css` — the shop page.
- `script.js` — fetches `/api/ranks` for the catalogue, handles the
  `/linkweb` code entry, shows the linked player's live balance from
  `/api/status`, and calls `/api/purchase` when someone buys a rank.
- `config.js` — the only file you need to edit per-deployment.

Nothing here talks to a database directly; every read/write of money or
ranks goes through the plugin, so the server is always the source of truth.
