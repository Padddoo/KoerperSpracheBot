# Lern-Coach-App für Fred — Claude Code Projekt-Prompt

Bitte baue eine mobile-first Web-App namens **"Fred lernt"**, die als
sprachgesteuerter KI-Lern-Coach für Kinder (4.–5. Klasse) funktioniert.

## Kernidee

- Ein Erwachsener lädt Lernmaterial hoch (PDF oder DOCX: Arbeitshefte,
  Karteikarten, Zusammenfassungen).
- Das Kind öffnet die App auf dem Handy, tippt auf ein Mikrofon, spricht
  auf Deutsch.
- Claude (über Anthropic API) übernimmt die Rolle eines freundlichen
  Lern-Coachs, stellt Fragen zum hochgeladenen Material, gibt
  kindgerechtes Feedback.
- Alle Claude-Antworten werden per OpenAI TTS laut vorgelesen.
- Spracherkennung läuft über OpenAI Whisper API (deutsch).

## Tech-Stack

- **Framework:** Next.js 15 mit App Router, TypeScript, Tailwind CSS
- **UI-Komponenten:** shadcn/ui (Button, Card, Textarea, Alert, Progress)
- **KI:** Anthropic SDK (`@anthropic-ai/sdk`), Model
  `claude-sonnet-4-5-20250929`
- **Speech-to-Text:** OpenAI Whisper API (`whisper-1`), Sprache `de`
- **Text-to-Speech:** OpenAI TTS API (`tts-1`, Stimme `nova`)
- **Audio-Aufnahme:** `MediaRecorder` im Browser (webm/opus)
- **PDF-Extraktion:** `pdf-parse`
- **DOCX-Extraktion:** `mammoth`
- **Icons:** `lucide-react`
- **Deployment-Target:** Vercel

## Projektstruktur

```
fred-lernt/
├── app/
│   ├── layout.tsx              # Root-Layout, Font-Setup
│   ├── page.tsx                # Haupt-UI (Upload + Chat)
│   ├── globals.css
│   └── api/
│       ├── transcribe/route.ts # Whisper STT
│       ├── chat/route.ts       # Claude-Antwort
│       ├── speak/route.ts      # OpenAI TTS
│       └── upload/route.ts     # PDF/DOCX zu Text
├── components/
│   ├── upload-zone.tsx         # Drag&Drop für Materialien
│   ├── mic-button.tsx          # Großer Mikrofon-Button mit Animation
│   ├── chat-view.tsx           # Nachrichtenverlauf
│   ├── message-bubble.tsx      # Einzelne Nachricht
│   └── ui/                     # shadcn-Komponenten
├── lib/
│   ├── anthropic.ts            # Claude-Client + Systemprompt
│   ├── openai.ts               # OpenAI-Client (Whisper + TTS)
│   ├── extract-text.ts         # PDF/DOCX Parser
│   └── session-store.ts        # In-Memory Session (pro User-ID)
├── types/
│   └── index.ts                # Message, Session, etc.
├── .env.local.example
├── .gitignore
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
├── README.md
└── vercel.json
```

## Systemprompt für Claude (in `lib/anthropic.ts`)

```
Du bist ein freundlicher, geduldiger Lern-Coach für ein Kind der 4.–5.
Klasse. Dein Niveau liegt leicht über 4. Klasse (Richtung 5. Klasse),
aber Deine Sprache bleibt kindgerecht, warm und motivierend. Du duzt
das Kind.

Wir sind im Sprachmodus. Halte Deine Fragen und Antworten kurz —
maximal 2–3 Sätze pro Mal. Keine Listen, keine Aufzählungen, keine
Überschriften, keine Emojis. Sprich so, wie man mit einem Kind redet.

Dein Material findest Du im Kontext unten (hochgeladenes Lernmaterial).
Stelle nur Fragen zu diesen Inhalten.

So gehst Du vor:
- Bei der ersten Nachricht: Begrüße das Kind kurz mit Namen (falls
  bekannt) und frag, ob es ein bestimmtes Thema üben will oder
  lieber gemischt.
- Stell immer nur eine Frage. Warte auf die Antwort.
- Bei richtiger Antwort: kurzes, echtes Lob ("Genau." / "Richtig." /
  "Gut überlegt.") und manchmal eine kleine Zusatzinfo zum Merken.
- Bei falscher oder unvollständiger Antwort: nie sofort die Lösung
  nennen. Gib einen Tipp oder stell eine leichtere Teilfrage.
- Wenn das Kind etwas wirklich nicht weiß: freundlich erklären, dann
  später dieselbe Frage nochmal stellen.
- Nach etwa 8–10 Fragen: kurze Zwischenbilanz.
- Variiere Fragetypen: offene Fragen, "Wahr oder falsch?", "Wo
  liegt…?", "Was passiert, wenn…?", Schätzfragen.

Ton: Freundlich, ermutigend, aber nicht übertrieben. Kein "Super
toll!!!" Lieber ein echtes "Genau, das stimmt" oder "Fast — willst Du
nochmal überlegen?".

Wenn die Spracherkennung eine Antwort seltsam wiedergibt (z.B.
unsinnige Wörter): freundlich nachfragen, nicht als falsch werten.
```

Der Kontext mit dem hochgeladenen Material wird als zweite
System-Message angehängt (oder als erste User-Message mit
Material-Tags).

## UI-Design

**Ästhetik:** Warm, freundlich, kindgerecht — aber nicht kindisch
überzogen. Eltern sollen es auch ernst nehmen. Sanfte Farben (warmes
Creme als Hintergrund, tiefes Grün als Akzent, vielleicht ein
handschriftlicher Akzent-Font für Überschriften).

**Mobile-first:** Alles muss auf dem Handy perfekt bedienbar sein.
Großer Mikrofon-Button (mind. 80px Durchmesser), deutliche Zustände
(Idle / Aufnahme / Verarbeitung / Antwort wird vorgelesen).

**Screens / States:**
1. **Start / Upload-Screen:** Wenn noch kein Material geladen ist,
   zeigt die App eine freundliche Upload-Zone ("Lade Freds
   Lernmaterial hoch"). Akzeptiert PDF und DOCX. Mehrere Dateien
   gleichzeitig möglich.
2. **Lern-Screen:** Nach Upload sieht man oben einen kleinen Hinweis
   ("Material: 2 Dateien geladen"), darunter den Chat-Verlauf, unten
   fest den Mikrofon-Button. Der Button pulsiert sanft im Idle,
   zeigt einen roten Ring bei Aufnahme, ein Spinner-Icon beim
   Verarbeiten, und wird beim Vorlesen mit einer Wellen-Animation
   versehen.
3. **Controls:** Ein kleiner "Neues Material"-Button oben rechts zum
   Zurücksetzen. Ein "Abfrage beenden"-Button am Ende der Session.

**Fonts:** Für Überschriften eine runde, freundliche Display-Font wie
"Fraunces" oder "Crimson Pro" (Google Fonts). Für den Body "Nunito"
oder "Quicksand" — klar, kinderfreundlich, aber nicht albern.

**Farben (CSS-Variablen):**
- `--bg: #FAF7F2` (warmes Creme)
- `--fg: #2D3A2E` (tiefes Waldgrün)
- `--accent: #D97757` (warmes Orange als Akzent)
- `--accent-soft: #F5E6DC` (für Hintergründe von Claude-Messages)
- `--user-bubble: #2D3A2E` (User-Bubbles dunkel)

## API-Routes im Detail

### `POST /api/upload`
- Empfängt `FormData` mit einer oder mehreren Dateien
- Extrahiert Text via `pdf-parse` oder `mammoth`
- Speichert Text pro `sessionId` im In-Memory-Store
- Rückgabe: `{ sessionId, filenames: string[], charCount: number }`

### `POST /api/transcribe`
- Empfängt `FormData` mit Audio-Blob (webm)
- Leitet weiter an OpenAI Whisper (`model: "whisper-1"`, `language: "de"`)
- Rückgabe: `{ text: string }`

### `POST /api/chat`
- Empfängt `{ sessionId, userMessage, history }`
- Lädt Materialtext aus Session-Store
- Ruft Claude auf mit Systemprompt + Material-Kontext + History +
  neuer Message
- Rückgabe: `{ assistantMessage: string }`

### `POST /api/speak`
- Empfängt `{ text }`
- Ruft OpenAI TTS (`model: "tts-1"`, `voice: "nova"`,
  `response_format: "mp3"`)
- Streamt Audio zurück als `audio/mpeg`

## Ablauf (Client-seitig)

1. User tippt Mikrofon an → `MediaRecorder` startet
2. User tippt nochmal → Aufnahme stoppt, Blob wird an `/api/transcribe`
   geschickt
3. Transkribierter Text wird als neue User-Message im Chat angezeigt
4. Client schickt `/api/chat` mit History → Claude antwortet
5. Assistant-Message wird im Chat angezeigt
6. Parallel wird `/api/speak` mit dem Antworttext gerufen →
   Audio-Blob wird abgespielt
7. Nach Ende der Wiedergabe → Mic-Button wieder aktiv

## Environment Variables

In `.env.local.example`:
```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

## Besondere Anforderungen

- **HTTPS-Zwang:** Mikrofonzugriff funktioniert im Browser nur über
  HTTPS. Lokal mit `next dev` funktioniert es per Localhost-Ausnahme;
  auf Handy-Test muss es Vercel-Deployment oder `next dev -H 0.0.0.0`
  mit einem Tunneldienst sein (z.B. `ngrok`). Im README beide Wege
  dokumentieren.
- **Fehlerbehandlung:** Wenn Mikro-Permission verweigert wird,
  freundlicher Hinweis. Wenn API-Call fehlschlägt, "Entschuldige,
  versuch's nochmal" — nie technische Fehlermeldungen ans Kind.
- **Keine Emojis in Claude-Antworten:** Der Systemprompt verbietet
  sie, aber TTS würde sie eh seltsam vorlesen.
- **Aufnahme-Länge:** Nach 60 Sekunden automatisch stoppen, um Kosten
  und Fehlinterpretationen zu vermeiden.
- **Mobile Safari:** `MediaRecorder` braucht dort `audio/mp4` als
  Fallback. Bitte im Code berücksichtigen.

## README

Schreibe ein README mit:
- Projektbeschreibung
- Setup (Node-Version, `npm install`, `.env.local` anlegen)
- Lokal starten (`npm run dev`)
- Mobile-Testing (Tunneling mit `ngrok` oder LAN-IP)
- Deployment auf Vercel (Env-Vars eintragen)
- Kostenschätzung pro Session (Whisper + Claude + TTS)

## Umsetzungs-Prioritäten

1. **Erst:** Grundgerüst + alle API-Routes funktionsfähig (auch ohne
   hübsche UI). Nachweisen, dass die Kette Upload→Aufnahme→Whisper
   →Claude→TTS→Playback ganz durchläuft.
2. **Dann:** UI polieren nach dem beschriebenen Design.
3. **Zum Schluss:** Fehlerbehandlung, Edge-Cases, Mobile-Safari-Kram.

## Was ich später (in Folge-Iterationen) noch will

- Mehrere Kinder-Profile mit eigenem Material
- Lernstand-Tracking (welche Fragen saßen, welche nicht)
- Auswahl verschiedener Claude-Stimmen / Personas
- Export eines "Lernprotokolls" als PDF für Eltern
- Optional: Eigene Claude-Prompts pro Fach

Aber für diese erste Version: einfach, robust, funktional.

Bitte fange an, sobald Du bereit bist. Bei Unklarheiten gerne
zurückfragen.
