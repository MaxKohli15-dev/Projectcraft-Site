const STORAGE_KEY = "projectcraft_session";

const rankGrid = document.getElementById("rank-grid");
const rankStatus = document.getElementById("rank-status");
const balanceLine = document.getElementById("balance-line");
const balancePlayer = document.getElementById("balance-player");
const balanceAmount = document.getElementById("balance-amount");
const linkBtn = document.getElementById("link-btn");
const linkModal = document.getElementById("link-modal");
const linkCancel = document.getElementById("link-cancel");
const linkSubmit = document.getElementById("link-submit");
const linkCodeInput = document.getElementById("link-code-input");
const linkError = document.getElementById("link-error");
const ipChip = document.getElementById("ip-chip");

let ranks = [];
let session = loadSession();

init();

async function init() {
  ipChip.addEventListener("click", copyIp);
  linkBtn.addEventListener("click", () => openModal());
  linkCancel.addEventListener("click", closeModal);
  linkSubmit.addEventListener("click", submitLinkCode);
  linkCodeInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitLinkCode();
  });

  await loadRanks();
  if (session) {
    refreshStatus();
  }
}

// Calls a Supabase RPC function (a SQL function from setup.sql).
// Returns the parsed JSON body. Throws with a readable message on failure.
async function rpc(name, params) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(params || {}),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    // some calls return no body (204) - that's fine
  }
  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || "Serverfehler";
    throw new Error(msg);
  }
  return data;
}

function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(s) {
  session = s;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function clearSession() {
  session = null;
  localStorage.removeItem(STORAGE_KEY);
  balanceLine.classList.add("hidden");
  linkBtn.textContent = "Account verknüpfen";
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Polls get_result() until the plugin has processed a queued status/purchase
// request. The plugin only checks in every few seconds, so this can take a
// short moment - that's expected, not a bug.
async function pollForResult(requestId, maxTries = 15, delayMs = 1000) {
  for (let i = 0; i < maxTries; i++) {
    await sleep(delayMs);
    try {
      const rows = await rpc("get_result", { p_id: requestId });
      if (rows && rows[0] && rows[0].status === "done") {
        return rows[0].result;
      }
    } catch {
      // keep trying - a single dropped request isn't fatal
    }
  }
  return null; // timed out
}

function copyIp() {
  navigator.clipboard?.writeText(SERVER_IP).then(() => {
    const hint = ipChip.querySelector(".ip-copy-hint");
    const old = hint.textContent;
    hint.textContent = "Kopiert!";
    setTimeout(() => (hint.textContent = old), 1500);
  });
}

function openModal() {
  linkError.classList.add("hidden");
  linkCodeInput.value = "";
  linkModal.classList.remove("hidden");
  linkCodeInput.focus();
}

function closeModal() {
  linkModal.classList.add("hidden");
}

async function submitLinkCode() {
  const code = linkCodeInput.value.trim();
  if (!/^\d{4,8}$/.test(code)) {
    showLinkError("Bitte den Code aus /linkweb eingeben.");
    return;
  }
  linkSubmit.disabled = true;
  try {
    const rows = await rpc("link_account", { p_code: code });
    const row = rows && rows[0];
    if (!row) {
      showLinkError("Code ungültig.");
      return;
    }
    saveSession({ token: row.token, player: row.player });
    closeModal();
    await refreshStatus();
  } catch (e) {
    showLinkError(
      e.message === "invalid_or_expired_code"
        ? "Code ungültig oder abgelaufen. Gib /linkweb erneut ein."
        : "Shop-Server nicht erreichbar. Später nochmal versuchen."
    );
  } finally {
    linkSubmit.disabled = false;
  }
}

function showLinkError(msg) {
  linkError.textContent = msg;
  linkError.classList.remove("hidden");
}

async function loadRanks() {
  try {
    ranks = (await rpc("get_ranks", {})) || [];
    renderRanks();
    rankStatus.classList.add("hidden");
  } catch (e) {
    rankStatus.textContent = "Ränge konnten nicht geladen werden — Shop-Server gerade nicht erreichbar.";
    rankStatus.classList.add("error");
  }
}

function renderRanks() {
  rankGrid.innerHTML = "";
  for (const rank of ranks) {
    const card = document.createElement("div");
    card.className = "rank-card";
    card.innerHTML = `
      <h3>${escapeHtml(rank.name)}</h3>
      <div class="rank-price">${formatPrice(rank.price)}</div>
      <p class="rank-desc">${escapeHtml(rank.description || "")}</p>
      <button class="btn btn-primary" data-rank="${escapeHtml(rank.id)}">Kaufen</button>
    `;
    card.querySelector("button").addEventListener("click", () => buyRank(rank));
    rankGrid.appendChild(card);
  }
}

async function refreshStatus() {
  if (!session) return;
  try {
    const rows = await rpc("request_status", { p_token: session.token });
    const row = rows && rows[0];
    if (!row) {
      clearSession();
      return;
    }
    const result = await pollForResult(row.id);
    if (!result || result.error) return; // server offline or busy - leave existing UI as is

    balancePlayer.textContent = session.player;
    balanceAmount.textContent = formatPrice(result.balance);
    balanceLine.classList.remove("hidden");
    linkBtn.textContent = "Erneut verknüpfen";
  } catch (e) {
    if (e.message === "invalid_or_expired_session") {
      clearSession();
    }
    // otherwise: Supabase unreachable - leave existing UI state
  }
}

async function buyRank(rank) {
  if (!session) {
    openModal();
    return;
  }
  const sure = confirm(`${rank.name} für ${formatPrice(rank.price)} kaufen?`);
  if (!sure) return;

  try {
    const rows = await rpc("request_purchase", { p_token: session.token, p_rank_id: rank.id });
    const row = rows && rows[0];
    if (!row) {
      alert("Kauf fehlgeschlagen.");
      return;
    }
    const result = await pollForResult(row.id, 20, 1000);
    if (!result) {
      alert("Zeitüberschreitung - ist der Minecraft-Server gerade online?");
      return;
    }
    if (result.error) {
      alert(result.error);
      return;
    }
    alert(`${result.rank} freigeschaltet! Neues Guthaben: ${formatPrice(result.balance)}`);
    await refreshStatus();
  } catch (e) {
    alert(e.message === "invalid_or_expired_session" ? "Sitzung abgelaufen, bitte neu verknüpfen." : "Shop-Server nicht erreichbar.");
  }
}

function formatPrice(n) {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(n);
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s ?? "";
  return div.innerHTML;
}
