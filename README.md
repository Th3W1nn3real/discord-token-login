# Discord Token Login - Chrome Extension (Manifest V3)

Log in to YOUR Discord account by pasting an access token.
Open-source extension, fully local, no data collection.

## Warning - responsible use

- Use ONLY tokens from accounts you own.
- Using or sharing someone else's tokens violates Discord's Terms of Service
  and may be illegal.
- NEVER paste your token into unverified third-party tools:
  whoever owns the token has full access to the account.

## Install (load unpacked)

1. Download and extract the ZIP (folder "discord-token-login").
2. Open Chrome / Edge / Brave / Opera at:

       chrome://extensions

3. Enable "Developer mode" top right.
4. Click "Load unpacked" and select the extracted folder.
5. Pin the icon from the extensions toolbar.
6. Click the icon, paste the token and press "Log in".

## How to get your token (only your own account)

DevTools method (recommended):

1. Log in to discord.com in the browser.
2. Open Developer Tools (F12) -> "Network" tab.
3. Find a request to discord.com and look for the
   "authorization" header. The token is that header value
   (WITHOUT the word "Bearer").

Or: DevTools -> Application -> Local Storage -> "token" key.

## Multi-account (saved accounts)

The extension saves tokens locally (`chrome.storage.local`) with
a name (nickname), so you can manage multiple accounts:

- On open and on save, each token is verified via Discord API
  (`/users/@me`) and shows **avatar, real @handle and a
  validity badge** (green = valid, red = expired/invalid).
- **Verify all** button to check all accounts at once.
- **Info button** for each account: opens a panel with all
  retrievable info (email, 2FA, Nitro, locale, account creation
  date derived from ID, server count and members, linked
  connections, payment methods and profile badges).

## Context menu (right click)

Right click anywhere on the page → **"Discord: log in as…"** → pick an
account from the submenu for instant login, without opening the popup.
The menu updates automatically when you add/remove accounts.

1. **Log in** tab → paste the token, type a name (optional),
   press **Save account**.
2. **Saved accounts** tab → for each account you have:
   - **Login** → applies the token and reloads Discord.
   - **Copy** → copies the full token to clipboard.
   - **Delete** → removes the saved account.

Saved tokens are shown **masked** (not in plain text) but always
**copyable**. Data never leaves your browser.

## Files included

- manifest.json   - extension config (MV3)
- popup.html       - popup UI (with tabs)
- popup.css        - popup style
- popup.js         - popup logic + multi-account + token verify
- background.js    - service worker: apply token, API verify, context menu
- icon.png         - extension icon
