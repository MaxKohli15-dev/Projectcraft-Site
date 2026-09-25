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
    const res = await fetch(`${API_BASE}/api/link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    if (!res.ok) {
      showLinkError(data.error || "Code ungültig.");
      return;
    }
    saveSession({ token: data.token, player: data.player });
    closeModal();
    await refreshStatus();
  } catch (e) {
    showLinkError("Server nicht erreichbar. Läuft die API und ist HTTPS eingerichtet?");
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
    const res = await fetch(`${API_BASE}/api/ranks`);
    if (!res.ok) throw new Error("bad status");
    ranks = await res.json();
    renderRanks();
    rankStatus.classList.add("hidden");
  } catch (e) {
    rankStatus.textContent = "Ränge konnten nicht geladen werden — Server-API gerade nicht erreichbar.";
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
    const res = await fetch(`${API_BASE}/api/status?token=${encodeURIComponent(session.token)}`);
    const data = await res.json();
    if (!res.ok) {
      clearSession();
      return;
    }
    balancePlayer.textContent = data.player;
    balanceAmount.textContent = formatPrice(data.balance);
    balanceLine.classList.remove("hidden");
    linkBtn.textContent = "Erneut verknüpfen";
  } catch {
    // API unreachable - leave existing UI state, don't wipe the session
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
    const res = await fetch(`${API_BASE}/api/purchase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: session.token, rankId: rank.id }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Kauf fehlgeschlagen.");
      return;
    }
    alert(`${data.rank} freigeschaltet! Neues Guthaben: ${formatPrice(data.balance)}`);
    await refreshStatus();
  } catch (e) {
    alert("Server nicht erreichbar. Kauf wurde nicht durchgeführt.");
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
