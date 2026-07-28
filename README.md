# Discord Token Login - Estensione Chrome (Manifest V3)

Accedi al TUO account Discord incollando un token di accesso.
Estensione open-source, completamente locale, nessuna raccolta dati.

## Avviso - uso responsabile

- Usa SOLO token di account di tua proprietà.
- Usare o condividere token altrui viola i Termini di Servizio di Discord
  e può essere illegale.
- Non incollare MAI il tuo token in strumenti di terze parti non verificati:
  equivale a consegnare la password. Chi possiede il token ha accesso
  completo all'account.

## Installazione (carica estensione non pacchettizzata)

1. Scarica ed estrai lo ZIP (cartella "discord-token-login").
2. Apri Chrome / Edge / Brave / Opera all'indirizzo:

       chrome://extensions

3. Attiva "Modalità sviluppatore" in alto a destra.
4. Clicca "Carica non pacchettizzata" e seleziona la cartella estratta.
5. Fissa l'icona dalla barra delle estensioni.
6. Clicca l'icona, incolla il token e premi "Accedi".

## Come ottenere il tuo token (solo account tuo)

Metodo DevTools (consigliato):

1. Accedi a discord.com dal browser.
2. Apri gli Strumenti per Sviluppatori (F12) -> scheda "Network".
3. Trova una richiesta verso discord.com e cerca l'intestazione
   "authorization". Il token è il valore di quell'intestazione
   (SENZA la parola "Bearer").

Oppure: DevTools -> Application -> Local Storage -> chiave "token".

## Multi-account (account salvati)

L'estensione salva i token in locale (`chrome.storage.local`) associandoli a
un nome (nickname), così puoi gestire più account:

- All'apertura e al salvataggio, ogni token viene verificato via API Discord
  (`/users/@me`) e viene mostrato **avatar, @chiocciola (handle) reale e un
  badge di validità** (verde = valido, rosso = scaduto/invalido).
- Pulsante **↻ Verifica tutti** per controllare tutti gli account in un colpo.
- Pulsante **ℹ info** per ogni account: apre un pannello con tutte le info
  recuperabili (email, 2FA, Nitro, lingua, data di creazione account ricavata
  dall'ID, numero di server e membri, connessioni collegate, metodi di
  pagamento e badge del profilo).

## Menu contestuale (click destro)

Clic destro ovunque nella pagina → **"Discord: accendi come…"** → scegli un
account dal sottomenu per fare il login istantaneo, senza aprire il popup.
Il menu si aggiorna automaticamente quando aggiungi/rimuovi account.

1. Scheda **Accedi** → incolla il token, scrivi un nome (opzionale),
   premi **Salva account**.
2. Scheda **Account salvati** → per ogni account hai tre azioni:
   - **➜ Accedi** → applica il token e ricarica Discord.
   - **⧉ Copia** → copia il token completo negli appunti.
   - **✕ Elimina** → rimuove l'account salvato.

I token salvati sono mostrati **mascherati** (non in chiaro) ma sempre
**copiabili**. I dati non lasciano mai il tuo browser.

## File inclusi

- manifest.json   - configurazione dell'estensione (MV3)
- popup.html       - interfaccia del popup (con schede)
- popup.css        - stile del popup
- popup.js         - logica popup + multi-account + verifica token
- background.js    - service worker: applica token, verifica API, menu contestuale
- icon.png         - icona dell'estensione
