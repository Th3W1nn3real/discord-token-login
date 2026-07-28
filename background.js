// background.js - service worker (Manifest V3)
// Riceve il token dal popup (o dal menu contestuale) e lo inietta in una
// scheda di discord.com. Si occupa anche della verifica dei token via API
// e della costruzione del menu contestuale "accedi come...".

const DISCORD_MATCH = ["https://discord.com/*", "https://*.discord.com/*"];
const PARENT_ID = "dtl-parent";

/* --------------------------- token injection -------------------------- */
// Funzione eseguita nel contesto della pagina (MAIN world).
// Discord salva il token in localStorage racchiuso tra virgolette (JSON string).
function applyTokenToPage(token) {
  const clean = String(token).replace(/"/g, "").trim();
  const stored = JSON.stringify(clean);

  try {
    localStorage.setItem("token", stored);
  } catch (e) {
    const frame = document.createElement("iframe");
    document.body.appendChild(frame);
    try {
      frame.contentWindow.localStorage.setItem("token", stored);
    } catch (_) {}
    frame.remove();
  }
}

function waitForTab(tabId, timeoutMs) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    };
    const listener = (id, info) => {
      if (id === tabId && info.status === "complete") finish();
    };
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(finish, timeoutMs || 12000);
  });
}

async function handleLogin(token, sendResponse) {
  try {
    const tabs = await chrome.tabs.query({ url: DISCORD_MATCH });
    let tab = tabs[0];
    let createdNew = false;

    if (!tab) {
      tab = await chrome.tabs.create({ url: "https://discord.com/login", active: true });
      createdNew = true;
    } else {
      await chrome.tabs.update(tab.id, { active: true });
    }

    if (createdNew || tab.status === "loading" || !tab.url || !/^https/.test(tab.url)) {
      await waitForTab(tab.id);
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: applyTokenToPage,
      args: [token],
      world: "MAIN",
    });

    await chrome.tabs.update(tab.id, { url: "https://discord.com/channels/@me" });

    if (sendResponse) sendResponse({ ok: true });
  } catch (err) {
    if (sendResponse) sendResponse({ ok: false, error: (err && err.message) || String(err) });
  }
}

/* ----------------------------- verification --------------------------- */
// Verifica un token chiamando l'API Discord /users/@me e restituisce
// l'identita' reale (username, display name, avatar).
async function fetchMe(token) {
  try {
    const resp = await fetch("https://discord.com/api/v9/users/@me", {
      headers: { Authorization: String(token).trim() },
    });
    if (resp.ok) {
      const d = await resp.json();
      const ext = d.avatar && String(d.avatar).startsWith("a_") ? ".gif" : ".png";
      const avatarUrl = d.avatar
        ? `https://cdn.discordapp.com/avatars/${d.id}/${d.avatar}${ext}?size=64`
        : null;
      return {
        ok: true,
        valid: true,
        id: d.id,
        username: d.username,
        displayName: d.global_name || d.username,
        discriminator: d.discriminator,
        avatarUrl,
      };
    }
    if (resp.status === 401 || resp.status === 403) {
      return { ok: true, valid: false };
    }
    return { ok: false, error: "HTTP " + resp.status };
  } catch (e) {
    return { ok: false, error: (e && e.message) || String(e) };
  }
}

/* ----------------------- full info (on demand) ----------------------- */
// Recupera TUTTE le info reperibili di un account: utente completo,
// server (guilds), connessioni e metodi di pagamento. Chiamato solo
// quando l'utente apre il pannello "info" di un account.
async function fetchFullInfo(token) {
  const headers = {
    Authorization: String(token).trim(),
    "Content-Type": "application/json",
  };
  const base = "https://discord.com/api/v9";

  const safe = async (path) => {
    try {
      const r = await fetch(base + path, { headers });
      if (!r.ok) return null;
      return await r.json();
    } catch (e) {
      return null;
    }
  };

  const user = await safe("/users/@me");
  if (!user) {
    try {
      const r = await fetch(base + "/users/@me", { headers });
      return { ok: true, valid: false, status: r.status };
    } catch (e) {
      return { ok: false, error: (e && e.message) || String(e) };
    }
  }

  const [guilds, connections, billing, profile] = await Promise.all([
    safe("/users/@me/guilds?with_counts=true"),
    safe("/users/@me/connections"),
    safe("/users/@me/billing/payment-sources"),
    safe("/users/@me/profile"),
  ]);

  const ext = user.avatar && String(user.avatar).startsWith("a_") ? ".gif" : ".png";
  const bext = user.banner && String(user.banner).startsWith("a_") ? ".gif" : ".png";

  return {
    ok: true,
    valid: true,
    user,
    guilds,
    connections,
    billing,
    profile,
    avatarUrl: user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}${ext}?size=128`
      : null,
    bannerUrl: user.banner
      ? `https://cdn.discordapp.com/banners/${user.id}/${user.banner}${bext}?size=512`
      : null,
  };
}

/* --------------------------- context menus ---------------------------- */
function getAccounts() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["accounts"], (res) => resolve((res && res.accounts) || []));
  });
}

function rebuildContextMenus() {
  chrome.storage.local.get(["accounts"], (res) => {
    const accounts = (res && res.accounts) || [];
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: PARENT_ID,
        title: "Discord: accedi come…",
        contexts: ["all"],
      });
      if (accounts.length === 0) {
        chrome.contextMenus.create({
          id: "dtl-empty",
          parentId: PARENT_ID,
          title: "(nessun account salvato)",
          contexts: ["all"],
          enabled: false,
        });
        return;
      }
      accounts.forEach((acc) => {
        const label = acc.displayName || acc.username || acc.name;
        chrome.contextMenus.create({
          id: "dtl-" + acc.id,
          parentId: PARENT_ID,
          title: label,
          contexts: ["all"],
        });
      });
    });
  });
}

chrome.runtime.onInstalled.addListener(rebuildContextMenus);
chrome.runtime.onStartup.addListener(rebuildContextMenus);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.accounts) rebuildContextMenus();
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  const id = String(info.menuItemId || "");
  if (!id.startsWith("dtl-") || id === "dtl-empty") return;
  const accId = id.slice(4);
  const accounts = await getAccounts();
  const acc = accounts.find((a) => a.id === accId);
  if (acc) handleLogin(acc.token, null);
});

/* ----------------------------- messaging ------------------------------ */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "LOGIN_WITH_TOKEN") {
    handleLogin(msg.token, sendResponse);
    return true;
  }
  if (msg && msg.type === "VERIFY_TOKEN") {
    fetchMe(msg.token).then(sendResponse);
    return true;
  }
  if (msg && msg.type === "FETCH_FULL_INFO") {
    fetchFullInfo(msg.token).then(sendResponse);
    return true;
  }
});
