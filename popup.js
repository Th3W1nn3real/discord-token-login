// popup.js - logica dell'interfaccia (multi-account + verifica + info complete)
const $ = (id) => document.getElementById(id);

const tokenEl = $("token");
const nicknameEl = $("nickname");
const statusEl = $("status");
const loginBtn = $("login");
const saveBtn = $("save");
const accountsList = $("accounts-list");
const emptyEl = $("empty");
const countEl = $("count");
const verifyAllBtn = $("verify-all");
const modal = $("modal");
const modalCard = $("modal-card");

let accounts = [];

/* ------------------------------ decoders ------------------------------ */
const PALETTE = ["#5865f2", "#3ba55d", "#eb459e", "#faa61a", "#ed4245", "#00b0f4", "#9b59b6"];
const PREMIUM = { 0: "None", 1: "Nitro Classic", 2: "Nitro", 3: "Nitro Basic" };
const FLAG_BADGES = {
  1: "Discord Staff",
  2: "Partner",
  4: "HypeSquad Events",
  8: "Bug Hunter",
  64: "HypeSquad Bravery",
  128: "HypeSquad Brilliance",
  256: "HypeSquad Balance",
  512: "Early Supporter",
  1024: "Team User",
  16384: "Bug Hunter Gold",
  65536: "Verified Bot",
  131072: "Verified Developer",
  262144: "Certified Moderator",
  4194304: "Active Developer",
};
const CONN_LABELS = {
  twitch: "Twitch", youtube: "YouTube", spotify: "Spotify", steam: "Steam",
  github: "GitHub", battlenet: "Battle.net", xbox: "Xbox", facebook: "Facebook",
  twitter: "Twitter", leagueoflegends: "League of Legends", reddit: "Reddit",
  epicgames: "Epic Games", paypal: "PayPal", playstation: "PlayStation",
  tiktok: "TikTok", roblox: "Roblox", domains: "Dominio", instagram: "Instagram",
  skype: "Skype", linkedin: "LinkedIn",
};

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]),
  );
}
function colorFor(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
function decodeFlags(flags) {
  if (!flags) return [];
  const out = [];
  for (const bit in FLAG_BADGES) if ((flags & Number(bit)) === Number(bit)) out.push(FLAG_BADGES[bit]);
  return out;
}
function createdAtFromId(id) {
  try {
    const ms = Number((BigInt(id) >> 22n) + 1420070400000n);
    return new Date(ms);
  } catch {
    return null;
  }
}
function formatDate(d) {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" });
}
function toHex(n) {
  if (n == null) return null;
  return "#" + Number(n).toString(16).padStart(6, "0");
}
function label(acc) {
  return acc.displayName || acc.username || acc.name || "Account";
}
function maskToken(token) {
  if (!token) return "";
  if (token.length <= 12) return "•".repeat(token.length);
  return token.slice(0, 6) + "•".repeat(6) + "••" + token.slice(-4);
}

/* ------------------------------ helpers ------------------------------- */
function setStatus(text, kind) {
  statusEl.textContent = text;
  statusEl.className = "status " + (kind || "idle");
}
function sanitizeToken(raw) {
  return String(raw || "")
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+/g, "");
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ------------------------------ storage ------------------------------- */
function loadAccounts() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["accounts"], (res) => resolve((res && res.accounts) || []));
  });
}
function persist() {
  return new Promise((resolve) => chrome.storage.local.set({ accounts }, resolve));
}

/* ------------------------------- login -------------------------------- */
function loginWithToken(token) {
  if (!token) {
    setStatus("Paste a valid token to continue.", "err");
    return;
  }
  if (token.length < 50) {
    setStatus("Token looks too short to be valid.", "err");
    return;
  }
  setStatus("Opening Discord...", "idle");
  chrome.runtime.sendMessage({ type: "LOGIN_WITH_TOKEN", token }, (resp) => {
    if (chrome.runtime.lastError) {
      setStatus("Error: " + chrome.runtime.lastError.message, "err");
      return;
    }
    if (resp && resp.ok) {
      setStatus("Token applied. Reloading Discord...", "ok");
      setTimeout(() => window.close(), 900);
    } else {
      setStatus((resp && resp.error) || "Unknown error.", "err");
    }
  });
}

/* ------------------------------ verify -------------------------------- */
function applyVerification(acc, resp) {
  if (resp && resp.ok && resp.valid) {
    acc.verified = true;
    acc.username = resp.username;
    acc.displayName = resp.displayName;
    acc.discriminator = resp.discriminator;
    acc.avatarUrl = resp.avatarUrl;
    acc.verifiedAt = Date.now();
    return true;
  }
  if (resp && resp.ok && !resp.valid) {
    acc.verified = false;
    acc.verifiedAt = Date.now();
  }
  return false;
}

function verifyAccount(id) {
  const acc = accounts.find((a) => a.id === id);
  if (!acc || acc.checking) return;
  acc.checking = true;
  render();
  chrome.runtime.sendMessage({ type: "VERIFY_TOKEN", token: acc.token }, (resp) => {
    acc.checking = false;
    const ok = applyVerification(acc, resp);
    if (!ok && resp && !resp.ok) setStatus("Verification failed (network error).", "err");
    else if (ok) setStatus(`"${label(acc)}" verified ✓`, "ok");
    else setStatus("Invalid or expired token.", "err");
    persist().then(render);
  });
}

function verifyAll() {
  const pending = accounts.filter((a) => !a.checking);
  if (pending.length === 0) return;
  setStatus(`Verifying ${pending.length} account(s)...`, "idle");
  let i = 0;
  const next = () => {
    if (i >= pending.length) {
      persist().then(render);
      setStatus("Verification complete.", "ok");
      return;
    }
    const acc = pending[i++];
    acc.checking = true;
    render();
    chrome.runtime.sendMessage({ type: "VERIFY_TOKEN", token: acc.token }, (resp) => {
      acc.checking = false;
      applyVerification(acc, resp);
      render();
      next();
    });
  };
  next();
}

/* --------------------------- saved accounts --------------------------- */
function copyToken(token) {
  navigator.clipboard.writeText(token).then(
    () => setStatus("Full token copied to clipboard.", "ok"),
    () => setStatus("Unable to copy token.", "err"),
  );
}
async function deleteAccount(id) {
  const acc = accounts.find((a) => a.id === id);
  accounts = accounts.filter((a) => a.id !== id);
  await persist();
  render();
  setStatus(acc ? `Deleted "${label(acc)}".` : "Account deleted.", "idle");
}

function mkBtn(text, title, onClick, danger) {
  const b = document.createElement("button");
  b.className = "icon-btn" + (danger ? " danger" : "");
  b.textContent = text;
  b.title = title;
  b.onclick = onClick;
  return b;
}

/* ------------------------------ render -------------------------------- */
function render() {
  countEl.textContent = accounts.length;
  verifyAllBtn.classList.toggle("hidden", accounts.length === 0);

  if (accounts.length === 0) {
    accountsList.classList.add("hidden");
    emptyEl.classList.remove("hidden");
    return;
  }
  emptyEl.classList.add("hidden");
  accountsList.classList.remove("hidden");
  accountsList.replaceChildren();

  accounts.forEach((acc) => {
    const row = document.createElement("div");
    row.className = "account" + (acc.verified === false ? " invalid" : "");

    // avatar + badge validita'
    const avatar = document.createElement("div");
    avatar.className = "acc-avatar";
    if (acc.avatarUrl) {
      const img = document.createElement("img");
      img.src = acc.avatarUrl;
      img.alt = "";
      img.onerror = () => avatar.classList.add("fallback");
      avatar.appendChild(img);
    } else {
      avatar.classList.add("fallback");
      avatar.style.background = colorFor(acc.name || acc.id);
      avatar.textContent = (label(acc)[0] || "?").toUpperCase();
    }
    const badge = document.createElement("span");
    badge.className = "acc-badge";
    if (acc.checking) badge.className += " checking";
    else if (acc.verified === true) {
      badge.className += " ok";
      badge.textContent = "✓";
      badge.title = "Valid token";
    } else if (acc.verified === false) {
      badge.className += " err";
      badge.textContent = "✕";
      badge.title = "Invalid / expired token";
    } else {
      badge.className += " unknown";
      badge.title = "Not verified yet";
    }
    avatar.appendChild(badge);

    // info: nome + @chiocciola
    const info = document.createElement("div");
    info.className = "acc-info";
    const name = document.createElement("div");
    name.className = "acc-name";
    name.textContent = label(acc);
    const handle = document.createElement("div");
    handle.className = "acc-handle";
    handle.textContent = acc.username ? "@" + acc.username : maskToken(acc.token);
    info.append(name, handle);

    // azioni
    const actions = document.createElement("div");
    actions.className = "acc-actions";
    actions.append(
      mkBtn("ℹ", "Show full info", () => openInfo(acc.id)),
      mkBtn("↻", "Verify token", () => verifyAccount(acc.id)),
      mkBtn("➜", "Log in with this account", () => loginWithToken(acc.token)),
      mkBtn("⧉", "Copy full token", () => copyToken(acc.token)),
      mkBtn("✕", "Delete account", () => deleteAccount(acc.id), true),
    );

    row.append(avatar, info, actions);
    accountsList.appendChild(row);
  });
}

/* ------------------------- full info modal ---------------------------- */
function openModal() {
  modal.classList.remove("hidden");
}
function closeModal() {
  modal.classList.add("hidden");
  modalCard.innerHTML = "";
}

function openInfo(id) {
  const acc = accounts.find((a) => a.id === id);
  if (!acc) return;
  openModal();
  modalCard.innerHTML = `<div class="modal-loading"><span class="spinner"></span><p>Loading info…</p></div>`;

  chrome.runtime.sendMessage({ type: "FETCH_FULL_INFO", token: acc.token }, (resp) => {
    if (chrome.runtime.lastError) {
      modalCard.innerHTML = `<div class="modal-error">Error: ${esc(chrome.runtime.lastError.message)}</div>`;
      return;
    }
    if (resp && resp.ok && resp.valid) renderInfo(resp, acc);
    else if (resp && resp.ok && !resp.valid)
      modalCard.innerHTML = `<div class="modal-error">This token is invalid or expired (HTTP ${esc(resp.status)}).</div>`;
    else
      modalCard.innerHTML = `<div class="modal-error">Unable to fetch info (${esc(resp && resp.error)}).</div>`;
  });
}

function renderInfo(resp, acc) {
  const u = resp.user || {};
  const flags = decodeFlags(u.public_flags != null ? u.public_flags : u.flags);
  const created = createdAtFromId(u.id);
  const accent = toHex(u.accent_color);
  const guilds = Array.isArray(resp.guilds) ? resp.guilds : null;
  const conns = Array.isArray(resp.connections) ? resp.connections : null;
  const billing = Array.isArray(resp.billing) ? resp.billing : null;
  const avatar = resp.avatarUrl || acc.avatarUrl;

  const bannerStyle = resp.bannerUrl
    ? `background-image:url('${esc(resp.bannerUrl)}')`
    : accent
      ? `background:${accent}`
      : "background:linear-gradient(135deg,#5865f2,#eb459e)";

  const avatarHtml = avatar
    ? `<img class="modal-avatar" src="${esc(avatar)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/><div class="modal-avatar fallback" style="display:none;background:${colorFor(acc.name || u.id || "")}">${esc((label(acc)[0] || "?").toUpperCase())}</div>`
    : `<div class="modal-avatar fallback" style="background:${colorFor(acc.name || u.id || "")}">${esc((label(acc)[0] || "?").toUpperCase())}</div>`;

  const field = (k, v) =>
    `<div class="modal-field"><span class="k">${esc(k)}</span><span class="v">${v == null || v === "" ? "—" : esc(v)}</span></div>`;

  const nitro = PREMIUM[u.premium_type] || "None";
  const verifiedEmail = u.verified ? "Yes ✓" : "No";
  const mfa = u.mfa_enabled ? "Enabled ✓" : "Disabled";

  let html = `
    <div class="modal-banner" style="${bannerStyle}">
      <button class="modal-close" id="modal-close" title="Close">✕</button>
    </div>
    <div class="modal-body">
      ${avatarHtml}
      <div class="modal-name">${esc(u.global_name || u.username || label(acc))}</div>
      ${u.username ? `<div class="modal-handle">@${esc(u.username)}</div>` : ""}
      ${u.discriminator && u.discriminator !== "0" ? `<div class="modal-discrim">#${esc(u.discriminator)}</div>` : ""}

      <div class="modal-section-title">Account</div>
      <div class="modal-fields">
        ${field("User ID", u.id)}
        ${field("Email", u.email)}
        ${field("Verified email", verifiedEmail)}
        ${field("2FA / MFA", mfa)}
        ${field("Nitro", nitro)}
        ${field("Language", u.locale)}
        ${field("Bot", u.bot ? "Yes" : "No")}
        ${field("Created at", formatDate(created))}
        ${accent ? field("Accent color", accent.toUpperCase()) : ""}
      </div>`;

  if (guilds) {
    const totalMembers = guilds.reduce((s, g) => s + (g.approximate_member_count || 0), 0);
    html += `
      <div class="modal-section-title">Servers</div>
      <div class="modal-fields">
        ${field("Server count", guilds.length)}
        ${totalMembers ? field("Total members (approx)", totalMembers.toLocaleString("en-US")) : ""}
      </div>`;
  }

  if (conns && conns.length) {
    html += `<div class="modal-section-title">Connections (${conns.length})</div><div class="conn-list">`;
    conns.forEach((c) => {
      const t = CONN_LABELS[c.type] || c.type;
      html += `<div class="conn-item"><span>${esc(t)}</span><span class="v">${esc(c.name)}${c.verified ? " ✓" : ""}</span></div>`;
    });
    html += `</div>`;
  }

  if (billing && billing.length) {
    const types = billing.map((b) => (b.type === 1 ? "Card" : b.type === 2 ? "PayPal" : "Other"));
    html += `
      <div class="modal-section-title">Payments</div>
      <div class="modal-fields">${field("Saved methods", types.join(", "))}</div>`;
  }

  if (flags.length) {
    html += `<div class="modal-section-title">Badges</div><div class="modal-badges">`;
    flags.forEach((f) => (html += `<span class="badge-chip">${esc(f)}</span>`));
    html += `</div>`;
  }

  html += `<button class="btn-primary modal-done" id="modal-done">Close</button></div>`;
  modalCard.innerHTML = html;

  $("modal-close").onclick = closeModal;
  $("modal-done").onclick = closeModal;
}

/* ------------------------------- events ------------------------------- */
loginBtn.addEventListener("click", () => loginWithToken(sanitizeToken(tokenEl.value)));
verifyAllBtn.addEventListener("click", verifyAll);
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modal.classList.contains("hidden")) closeModal();
});

saveBtn.addEventListener("click", async () => {
  const token = sanitizeToken(tokenEl.value);
  if (!token) {
    setStatus("Paste a token to save first.", "err");
    return;
  }
  if (accounts.some((a) => a.token === token)) {
    setStatus("This token is already saved.", "err");
    return;
  }
  const name = nicknameEl.value.trim() || `Account ${accounts.length + 1}`;
  const acc = { id: uid(), name, token, createdAt: Date.now(), checking: true };
  accounts.push(acc);
  await persist();
  await render();

  tokenEl.value = "";
  nicknameEl.value = "";
  setStatus(`"${name}" saved. Verifying…`, "idle");
  showTab("accounts");

  chrome.runtime.sendMessage({ type: "VERIFY_TOKEN", token }, (resp) => {
    acc.checking = false;
    if (applyVerification(acc, resp)) setStatus(`"${label(acc)}" verified ✓`, "ok");
    else if (resp && resp.ok && !resp.valid) setStatus("Token saved, but it looks invalid.", "err");
    else setStatus("Token saved (verification failed).", "idle");
    persist().then(render);
  });
});

tokenEl.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") loginBtn.click();
});

/* ------------------------------- tabs --------------------------------- */
function showTab(tab) {
  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.toggle("active", t.dataset.tab === tab));
  $("panel-login").classList.toggle("hidden", tab !== "login");
  $("panel-accounts").classList.toggle("hidden", tab !== "accounts");
  if (tab === "login") statusEl.textContent = "";
}
document
  .querySelectorAll(".tab")
  .forEach((t) => t.addEventListener("click", () => showTab(t.dataset.tab)));

/* ------------------------------- init --------------------------------- */
(async function init() {
  accounts = await loadAccounts();
  await render();
  chrome.storage.local.get(["savedToken"], (res) => {
    if (res && res.savedToken) tokenEl.value = res.savedToken;
  });
})();
