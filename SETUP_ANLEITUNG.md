# Setup-Anleitung für Toby

So gehst Du Schritt für Schritt vor, um "Fred lernt" mit Claude Code zu bauen.

## Voraussetzungen

1. **Node.js 20+** installiert — https://nodejs.org
2. **Claude Code** installiert — https://docs.claude.com/claude-code
3. **Git** installiert
4. **Anthropic API-Key** — https://console.anthropic.com
5. **OpenAI API-Key** — https://platform.openai.com
6. **Vercel-Account** für's Deployment (kostenlos) — https://vercel.com
7. **GitHub-Account** (optional, aber empfohlen)

## Schritt 1 — Projekt-Ordner anlegen

Öffne ein Terminal und mach:

```bash
mkdir fred-lernt
cd fred-lernt
claude
```

Claude Code startet jetzt in diesem Ordner.

## Schritt 2 — Prompt an Claude Code geben

Kopiere den **gesamten Inhalt** aus `CLAUDE_CODE_PROMPT.md` und gib ihn als
ersten Prompt in Claude Code. Claude Code wird dann:
- Das Next.js-Projekt initialisieren
- Alle Dependencies installieren
- Die komplette Struktur anlegen
- Alle Dateien schreiben

Das dauert 5–15 Minuten. Claude Code fragt eventuell zwischendurch nach
Permissions (Dateien schreiben, `npm install` ausführen) — alles erlauben.

## Schritt 3 — API-Keys eintragen

Nach der Erstellung gibt es eine Datei `.env.local.example`. Kopiere sie:

```bash
cp .env.local.example .env.local
```

Dann `.env.local` öffnen und beide Keys einfügen:

```
ANTHROPIC_API_KEY=sk-ant-dein-key-hier
OPENAI_API_KEY=sk-dein-openai-key-hier
```

## Schritt 4 — Lokal testen

```bash
npm run dev
```

Browser öffnet sich auf http://localhost:3000 — die App sollte laufen.
Teste einmal den ganzen Ablauf: Material hochladen, Mic-Button, sprechen,
Antwort anhören.

## Schritt 5 — Auf dem Handy testen (vor Deployment)

Zwei Optionen:

**Option A: Im gleichen WLAN (einfacher)**
- Starte dev-Server mit externer IP:
  ```bash
  npm run dev -- -H 0.0.0.0
  ```
- Schau am Mac/PC Deine lokale IP (z.B. `192.168.1.42`)
- Auf dem Handy im selben WLAN: `http://192.168.1.42:3000` aufrufen
- **Problem:** Mikrofon funktioniert nur über HTTPS. Das klappt so nicht.

**Option B: Tunnel via ngrok (funktioniert mit HTTPS)**
- `npm install -g ngrok`
- `ngrok http 3000`
- ngrok gibt Dir eine `https://xxxxx.ngrok.io` URL — die öffnest Du auf
  dem Handy, dort funktioniert auch das Mikrofon.

## Schritt 6 — Auf Vercel deployen

Damit Fred die App jederzeit auf dem Handy nutzen kann:

1. **GitHub-Repository anlegen** (privat):
   ```bash
   git init
   git add .
   git commit -m "Initial setup"
   gh repo create fred-lernt --private --source=. --push
   ```
   (Oder manuell auf github.com ein Repo anlegen und pushen.)

2. **Auf Vercel importieren:**
   - https://vercel.com/new
   - Das GitHub-Repo auswählen
   - **Wichtig:** Bei "Environment Variables" beide Keys eintragen
     (`ANTHROPIC_API_KEY` und `OPENAI_API_KEY`)
   - Deploy klicken

3. Nach 2 Minuten hast Du eine URL wie `fred-lernt.vercel.app` —
   die kannst Du aufs Handy als Home-Screen-Icon legen.

## Schritt 7 — Für Fred ready machen

- **Home-Screen-Icon auf dem Handy:** Safari/Chrome → Menü → "Zum
  Home-Bildschirm". Dann startet die App wie eine echte App.
- **Material hochladen:** Einmal beim ersten Öffnen die PDF + DOCX
  hochladen. Bleibt in der Session.
- **Hinweis an Fred:** Mikrofon tippen, sprechen, nochmal tippen zum
  Stoppen.

## Geschätzte Kosten pro Lern-Session (ca. 30 Min)

- **Whisper STT:** ~0,01–0,03 € (6–10 Aufnahmen à 10–20 Sek)
- **Claude Sonnet 4.5:** ~0,10–0,30 € (abhängig von Material-Größe)
- **OpenAI TTS:** ~0,05–0,10 € (~2000 Zeichen Antworten)
- **Vercel Hosting:** kostenlos im Hobby-Plan

**Pro Session also ca. 20–50 Cent.**

## Wenn was schiefgeht

- **Mikrofon funktioniert nicht:** Nur HTTPS-Verbindungen erlauben das.
  Auf `localhost` geht es per Ausnahme, sonst ngrok/Vercel.
- **Whisper versteht nichts:** Sprachwahl im Code prüfen
  (`language: "de"` muss gesetzt sein).
- **Claude antwortet auf Englisch:** Systemprompt nochmal prüfen,
  vielleicht User-Message mit "Antworte auf Deutsch" ergänzen.
- **TTS klingt komisch:** Andere Voice probieren (`alloy`, `echo`,
  `shimmer`, `onyx`, `fable`).

## Nächste Iterationen (für später)

Wenn die Basis läuft und Fred die App nutzt, können wir erweitern:
- Profile für mehrere Kinder
- Lernstand-Tracking
- Fach-Auswahl
- PDF-Export eines Lernprotokolls für Eltern
