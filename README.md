# Interactive Talks & Experiences Web App

A suite of interactive web presentations, computer vision and sensor experiences, and audience engagement tools built with Next.js, MediaPipe, Web Audio API, Web Bluetooth, and CoreBluetooth.

## Available Talk Decks & Experiences

<div align="center">
  <img src="img/aisubstrate.png" alt="AI Substrate" width="700" />
  <br />
  <a href="/talks/bbdo-ai-playday">BBDO AI Playday</a>
  <span> &nbsp; | &nbsp; </span>
  <a href="/talks/raw-school-2026">Raw School 2026</a>
  <span> &nbsp; | &nbsp; </span>
  <a href="/talks/aerocano">Aerocano: Shaking Up Coffee Tech</a>
  <span> &nbsp; | &nbsp; </span>
  <a href="/experience/dragon-slayer">Dragon Slayer</a>
  <span> &nbsp; | &nbsp; </span>
  <a href="/experience/find-your-officemate">WRU?! Radar</a>
</div>

---

## Getting Started

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Set `GEMINI_API_KEY` in `.env.local` to enable Gemini-powered experiences and Lyria generation; see [Configuration & Environment Variables](#-configuration--environment-variables).

---

## Routes & Features

The following tables cover every application page and route handler in `app/`.

### Application pages

| Route | Location | Description |
| --- | --- | --- |
| `/` | `app/page.tsx` | Retro TTY landing console with command-based navigation |
| `/talk` | `app/talk/page.tsx` | Directory of the three presentation decks |
| `/experience` | `app/experience/page.tsx` | Retro TTY directory for interactive experiences |
| `/experience/dragon-slayer` | `app/experience/dragon-slayer/page.tsx` | **Dragon Slayer**: hand-tracked lightsaber combat experience |
| `/experience/find-your-officemate` | `app/experience/find-your-officemate/page.tsx` | **WRU?!**: Bluetooth Low Energy proximity and direction radar |
| `/experience/aerocano-shake` | `app/experience/aerocano-shake/page.tsx` | Mobile shake-it game with live score logging |
| `/experience/aerocano-survey` | `app/experience/aerocano-survey/page.tsx` | Live coffee-preference audience survey |
| `/experience/5-wave` | `app/experience/5-wave/page.tsx` | DMAP MediaPipe hand-tracking activity with configurable wave detection |
| `/experience/handshake` | `app/experience/handshake/page.tsx` | DMAP two-person grip and motion-sensor handshake activity |
| `/experience/hold-tap` | `app/experience/hold-tap/page.tsx` | DMAP simultaneous two-person contact-hold activity |
| `/experience/dmap-control` | `app/experience/dmap-control/page.tsx` | Live Firebase controls for all DMAP detection thresholds |
| `/experience/dungeons` | `app/experience/dungeons/page.tsx` | **Techeons & Promptons** campaign hub for the five-chapter prompt-driven medieval adventure |
| `/experience/dungeons/1` | `app/experience/dungeons/1/page.tsx` | Chapter I host screen: assemble the party, activate the gate challenge, review players, and continue when everyone passes |
| `/experience/dungeons/1-quest` | `app/experience/dungeons/1-quest/page.tsx` | Chapter I participant screen for role assignment and Gemini-validated gate-opening prompts |
| `/experience/dungeons/2` | `app/experience/dungeons/2/page.tsx` | Chapter II host screen showing the ruined town, surviving elders, party members, and recovered evidence |
| `/experience/dungeons/2-quest` | `app/experience/dungeons/2-quest/page.tsx` | Chapter II participant screen for ordered role assignment and three-sentence evidence reconstruction |
| `/experience/dungeons/3` | `app/experience/dungeons/3/page.tsx` | Chapter III elder hall using the complete Firestore evidence corpus to ground four distinct Gemini Live elders |
| `/experience/dungeons/4` | `app/experience/dungeons/4/page.tsx` | Chapter IV shared dragon battlefield with rehearsal mode, sensor animations, damage tracking, battle reset, and victory controls |
| `/experience/dungeons/4-quest` | `app/experience/dungeons/4-quest/page.tsx` | Chapter IV mobile controller assigning Mage, Warrior, and Archer roles with spin, slash, or tap sensors |
| `/experience/dungeons/5` | `app/experience/dungeons/5/page.tsx` | Chapter V bard dashboard with live contribution analysis, evolving lyrics, celebration direction, and Lyria song generation |
| `/experience/dungeons/5-quest` | `app/experience/dungeons/5-quest/page.tsx` | Chapter V anonymous participant prompt for a random role, song request, lyric limitation, and generated ground discovery |
| `/experience/raw-school-2026/price-demo` | `app/experience/raw-school-2026/price-demo/page.tsx` | Smile-detection pricing demonstration |
| `/experience/raw-school-2026/ninja` | `app/experience/raw-school-2026/ninja/page.tsx` | Hand-tracking slash demonstration |
| `/experience/raw-school-2026/krebs` | `app/experience/raw-school-2026/krebs/page.tsx` | Interactive Krebs cycle of creativity visualization |
| `/experience/substrate-blob` | `app/experience/substrate-blob/page.tsx` | AI Substrate audience survey with three scored questions |
| `/proto` | `app/proto/page.tsx` | Directory for sensor, music, and visual identity prototypes |
| `/proto/camera-sub` | `app/proto/camera-sub/page.tsx` | Webcam Body Replacement Technique: optionally capture an empty background after a five-second countdown and save it in this browser; substitution shows that image with a log, or uses live segmentation when no background is saved; activation audio starts on seal detection, then substitution audio and the visual switch occur after 70% of that clip; delete the saved scene to return to segmentation |
| `/proto/logo` | `app/proto/logo/page.tsx` | DOT-inspired geometric identity system with seven cultural symbols and full, dark, vibrant, and close-reference studies for twelve travel and everyday-life icons |
| `/proto/lyria` | `app/proto/lyria/page.tsx` | Google Lyria full-song and clip generation prototype |
| `/proto/sword-2` | `app/proto/sword-2/page.tsx` | Motion-controlled 3D sword client monitored by Sword Control |
| `/proto/admin` | `app/proto/admin/page.tsx` | Directory containing every prototype control dashboard |
| `/proto/sword` | `app/proto/sword/page.tsx` | Phone motion-sensor sword prototype with anonymous Firebase Realtime Database sessions and slash detection |
| `/proto/sword-control` | `app/proto/sword-control/page.tsx` | Live sword-sensor controller for thresholds, session telemetry, and slash-count resets |
| `/proto/arrow` | `app/proto/arrow/page.tsx` | Persistent-device Arrow tap prototype that records pointer, motion, orientation, and browser data |
| `/proto/arrow-control` | `app/proto/arrow-control/page.tsx` | Live Arrow controller showing connected devices, persistent IDs, tap counts, and all captured data |
| `/proto/hold` | `app/proto/hold/page.tsx` | Persistent-device Hold prototype measuring press duration, movement, pressure, and motion |
| `/proto/hold-control` | `app/proto/hold-control/page.tsx` | Live Hold controller showing current and completed holds with exhaustive data explanations |
| `/proto/staff` | `app/proto/staff/page.tsx` | Motion-sensor Staff prototype that integrates gyroscope rotation and counts full spins |
| `/proto/staff-control` | `app/proto/staff-control/page.tsx` | Live Staff controller for spin tuning, telemetry, device management, and data explanations |
| `/talks/aerocano` | `app/talks/aerocano/page.tsx` | Redirects to the first Aerocano slide |
| `/talks/aerocano/[slide]` | `app/talks/aerocano/[slide]/page.tsx` | **Aerocano** interactive deck; valid slide paths are statically generated |
| `/talks/bbdo-ai-playday` | `app/talks/bbdo-ai-playday/page.tsx` | Redirects to the first BBDO AI Playday slide |
| `/talks/bbdo-ai-playday/[slide]` | `app/talks/bbdo-ai-playday/[slide]/page.tsx` | **BBDO AI Playday** interactive deck; valid slide paths are statically generated |
| `/talks/raw-school-2026` | `app/talks/raw-school-2026/page.tsx` | Redirects to the first Raw School 2026 slide |
| `/talks/raw-school-2026/[slide]` | `app/talks/raw-school-2026/[slide]/page.tsx` | **Raw School 2026** interactive deck; valid slide paths are statically generated |
| `/admin` | `app/admin/page.tsx` | Protected admin portal for QR links, dashboards, route guards, and complete Techeons & Promptons page/data management |
| `/admin/qr-generator` | `app/admin/qr-generator/page.tsx` | Dynamic QR-link manager |
| `/admin/live-dash/aerocano` | `app/admin/live-dash/aerocano/page.tsx` | Live Aerocano telemetry, answers, insights, and leaderboard dashboard |
| `/admin/aerocano` | `app/admin/aerocano/page.tsx` | Client-side redirect to `/admin/live-dash/aerocano` |

### Route handlers

| Route | Methods | Location | Description |
| --- | --- | --- | --- |
| `/r/[slug]` | `GET` | `app/r/[slug]/route.ts` | Dynamic short-link redirect, such as `/r/live`, `/r/dragon`, or `/r/aerocano` |
| `/api/admin/auth` | `POST` | `app/api/admin/auth/route.ts` | Verifies an administrator password for the admin UI |
| `/api/bluetooth/scan` | `GET` | `app/api/bluetooth/scan/route.ts` | Scans nearby Bluetooth devices through the macOS CoreBluetooth bridge when available |
| `/api/gemini` | `POST` | `app/api/gemini/route.ts` | Generates Gemini-based analysis from audience-survey answers |
| `/api/live-tuning` | `GET`, `POST` | `app/api/live-tuning/route.ts` | Reads and updates the BBDO slide 3 tuning-panel visibility stored in Firebase Realtime Database |
| `/api/dungeons/gate-check` | `POST` | `app/api/dungeons/gate-check/route.ts` | Validates a Chapter I role and gate-opening intent with Gemini |
| `/api/dungeons/reconstruct` | `POST` | `app/api/dungeons/reconstruct/route.ts` | Generates a role-grounded, three-sentence Chapter II evidence fragment |
| `/api/dungeons/live-token` | `POST` | `app/api/dungeons/live-token/route.ts` | Creates an ephemeral token for the Chapter III Gemini Live elder conversation |
| `/api/dungeons/celebration` | `POST` | `app/api/dungeons/celebration/route.ts` | Analyzes each Chapter V contribution and revises the shared mood, lyrics, look-and-feel, and song prompt |
| `/api/lyria` | `GET`, `POST` | `app/api/lyria/route.ts` | Reports Lyria configuration and generates audio with the selected Lyria model |
| `/api/redirect` | `GET`, `POST`, `DELETE` | `app/api/redirect/route.ts` | Reads, creates, lists, and removes managed short-link destinations |
| `/api/route-guard` | `GET`, `POST` | `app/api/route-guard/route.ts` | Reads and configures Public, Password Protected, and Disabled route-access states |
| `/api/route-guard/verify` | `POST` | `app/api/route-guard/verify/route.ts` | Validates access passwords for protected talks and experiences |
| `/api/scores` | `GET`, `POST`, `DELETE` | `app/api/scores/route.ts` | Reads, submits, and clears the live shake-it leaderboard |
| `/api/survey` | `GET`, `POST`, `DELETE` | `app/api/survey/route.ts` | Reads, submits, and clears audience-survey responses and related cached insights |

### Data integrations

- `lib/firebase.ts` initializes the Firebase client once and exports `firebaseApp`, `firestore`, and `realtimeDatabase` for shared client-side data.
- Firebase is available for new client-side features; the current `/api/redirect`, `/api/scores`, `/api/survey`, and `/api/route-guard` handlers continue to use `lib/db.ts` (Vercel KV/Upstash Redis when configured, otherwise the development in-memory fallback).
- The Sword prototype initializes the top-level `swords` node, then stores shared thresholds at `swords/config` and anonymous device sessions at `swords/sessions/{sessionId}`. It keeps each browser’s anonymous session ID in local storage so stopping and resuming the sensor continues the same session. Configure Firebase Realtime Database rules to allow the intended users to read and write these paths before testing on phones.
- The three DMAP activities share live detection settings under `dmap/config`: `wave` contains MediaPipe confidence and gesture thresholds, `handshake` contains accelerometer and gyroscope thresholds, and `holdTap` contains simultaneous-contact timing and pressure thresholds; the control dashboard also records a server timestamp, changed field, and monotonically increasing revision under `dmap/sync` so connected devices receive the same configuration through live listeners.
- BBDO AI Playday slide 3 keeps its live-tuning panel hidden by default and subscribes to `talks/bbdo-ai-playday/slide-3/tuning` in Realtime Database. The authenticated admin switch updates the same path through `/api/live-tuning`, so open presentation screens respond immediately.
- The Arrow prototype initializes `arrows/sessions/{deviceId}` and keeps each browser’s anonymous device ID in local storage. Each target tap records browser-exposed pointer fields plus the latest available motion and orientation data.
- The Hold prototype initializes `holds/sessions/{deviceId}` and records live hold duration, pointer movement, pressure, motion, orientation, and completed hold summaries.
- The Staff prototype initializes `staffs/config` and `staffs/sessions/{deviceId}` to tune and record gyroscope-integrated spin detection with one count per configured rotation angle.
- Techeons & Promptons stores Chapters I, II, III's source corpus, and V in Firestore. Chapter IV uses Realtime Database for low-latency battle, player, and sensor updates. The complete persistence map is documented below.

---

## 🏰 Techeons & Promptons (`/experience/dungeons`)

A five-chapter audience campaign in which Warriors, Mages, and Archers use prompting, shared evidence, live voice, and phone sensors to enter a city, reconstruct its fall, question its elders, defeat a dragon, and compose the victory song.

### Campaign flow

1. **The Sealed Gate** — Participants scan the host QR code, enter their name, receive a role, and submit a role-consistent attempt to open the city gate. The host activates the challenge, Gemini evaluates each attempt, and the next chapter becomes available when everyone passes.
2. **Ashes Remember** — New arrivals are assigned Warrior, Mage, and Archer in a repeating order. Their scroll, book, or notes seed a three-sentence Gemini-generated account of what happened. Every accepted account joins the evidence corpus alongside a protected clue that calls the party to slay the dragon.
3. **The Four Elders** — The host switches between Batt, Arto, Durst, and Sbor. Each elder has a distinct personality and voice, while Gemini Live is grounded in the complete Chapter II Firestore corpus. Finishing the conversation calls the party to battle.
4. **The Dragon Battle** — Participants reconnect with a name and receive Mage, Warrior, or Archer in a repeating order. Spins, slashes, and taps animate their sprites during rehearsal; after battle activation, each detected action deals one damage to the 1,000-HP dragon. Simultaneous attacks enter a visual queue so every character and damage animation finishes before the next begins, including the final strike before the victory popup. The host can also use a 100-damage bomb, reset the battle without disconnecting players, remove individual players, and continue to the celebration after victory.
5. **The Bard's Victory Song** — Anonymous participants receive a random role and ground discovery, then contribute a song idea and lyric limitation. Gemini cumulatively analyzes successful submissions to produce the mood, happiness index, lyrics, visual direction, and final music prompt. No placeholder analysis is shown before the first successful submission. The host generates a 30-second vocal celebration with `lyria-3-clip-preview`, using Ambient, Euphoric, and 120 BPM production settings.

All campaign QR codes use `https://talks-amber.vercel.app` as their public origin.

### Persistence map

| Data | Storage | Location |
| --- | --- | --- |
| Chapter I players, roles, prompts, Gemini results | Firestore | `dungeons-stage-1-players` |
| Chapter I activation and role order | Firestore | `dungeons-state/stage-1` |
| Chapter II players, roles, prompts, delivery status | Firestore | `dungeons-stage-2-players` |
| Chapter II evidence and protected dragon truth | Firestore | `dungeons-stage-2-clues` |
| Chapter II role order | Firestore | `dungeons-state/stage-2` |
| Chapter III RAG corpus | Firestore | Reads Chapter II players and clues |
| Chapter IV players, assignments, HP, damage, and battle state | Realtime Database | `dungeons/battle-4` |
| Warrior slash sessions | Realtime Database | `swords/sessions/{playerId}` |
| Mage spin sessions | Realtime Database | `staffs/sessions/{playerId}` |
| Archer tap sessions | Realtime Database | `arrows/sessions/{playerId}` |
| Chapter V anonymous song contributions | Firestore | `dungeons-stage-5-submissions` |
| Chapter V analyzed board, lyrics, and final prompt | Firestore | `dungeons-state/stage-5` |

Chapter III live conversations and selected elder state are temporary. Generated Chapter V audio is held as a browser Blob for immediate playback and download; it is not uploaded to Firebase. Participant browsers retain only their reconnection IDs in local storage where required.

### Admin management

The Dungeons section in `/admin` includes a directory for every campaign, host, and quest page. It provides live record summaries and chapter-specific controls for:

- Opening any host or participant route directly.
- Resetting Chapter I activation and role order.
- Resetting Chapter II role order and clearing generated evidence.
- Inspecting the complete Chapter III RAG corpus.
- Disconnecting or deleting individual participants.
- Reassigning Chapter IV participants between Warrior, Mage, and Archer while keeping them joined.
- Resetting Chapter IV while preserving connected players, or clearing battle players and linked sensor sessions.
- Inspecting, deleting, or clearing Chapter V submissions and resetting its cumulative song board.

---

## 🐲 Dragon Slayer Experience (`/experience/dragon-slayer`)

An AI-powered webcam battle experience combining **Fruit Ninja slashing mechanics** with a **physics-driven Lightsaber**:

### Key Features:
- **MediaPipe Hand & Fist Tracking**: Tracks wrist, palm, and knuckle landmarks in real-time. Automatically detects clenched fist grips to position the saber handle directly inside the player's physical hand.
- **Dynamic Lightsaber Weaponry**: High-radiance plasma blade rendering with pure white-hot energy core, color kyber crystals, and metallic hilt detailing.
- **Fruit Ninja Boss Mechanics**:
  - Slashing damage scales from 1–3 HP based on swing velocity.
  - 20% random critical strike chance with custom hit effects.
  - Slices incoming dragon fireball projectiles in half.
- **Dragon Boss AI**: 100 HP boss with 3 evolving phases (Normal $\to$ Enraged $\to$ Berserk) with dynamic attack patterns and animations.
- **Customizable Saber Configuration (`lib/dragon-slayer/saber-config.ts`)**:
  - Adjust blade length, blade width, hilt dimensions, and glow blur.
  - Configure manual X and Y position offsets, depth offsets, and angle adjustments.
  - Toggle clenched fist hilt occlusion and dynamic distance scaling.
- **Web Audio Sound Effects**: Low-latency synthesizer audio triggering on saber ignition, swings, fireball slices, critical strikes, and dragon roars.

---

## 📡 WRU?! Bluetooth Radar Experience (`/experience/find-your-officemate`)

A generative audio-visual radar interface that scans and tracks nearby Bluetooth Low Energy (BLE) devices in real-time, estimating proximity distance (up to 8.0 meters) and direction:

### Key Capabilities:
- **Continuous Passive Listening**: Listens to raw 2.4GHz BLE advertisement packets without requiring individual device pairing.
- **Dual Radio Architecture**: Integrates a compiled native macOS `CoreBluetooth` scanner (`bin/ble-scanner`) with browser Web Bluetooth.
- **8.0-Meter Proximity Range**: Scaled across 4 concentric 2.0m range rings (`2m`, `4m`, `6m`, `8m`).
- **Telemetry & Battery Inspector**: Displays real-time distance, battery telemetry, signal quality, and faint signal flags.
- **Log-Distance Path Loss Model**: Calculates distance using $d = 10^{\frac{\text{TxPower} - \text{RSSI}}{10 \times n}}$ with Exponential Moving Average (EMA) smoothing.
- **Crystal Sonar Synthesizer**: Web Audio API 3-note rising triad arpeggio ($2100\text{--}3300\text{ Hz}$) with resonant bandpass filtering and spatial stereo panning.
- **Device Category Filters**: Dynamically filter by Phones, Laptops, Audio, Smart Home, Trackers, and Beacons.

---

## 💻 Terminal Consoles (`/` and `/experience`)

- **Old-School Flat TTY Console**: Solid black background with green monospace text.
- **Direct Navigation**: Type any route name (e.g. `dragon-slayer`, `find-your-officemate`, `aerocano`) to navigate immediately.
- **History & Commands**: Supports Up/Down arrow command history and built-in utilities (`clear`, `help`, `whoami`, `date`).

---

## 🔒 Configuration & Environment Variables

Copy `.env.example` to `.env.local` and add your Google AI API key. Keep `.env.local` private and out of version control.

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

`GEMINI_API_KEY` enables Gemini-powered survey analysis, Techeons & Promptons chapter features, Gemini Live conversations, and Lyria generation. The KV/Upstash settings below are optional; without them, the app uses its in-memory data store during local development. For persistent hosted data, configure these in the deployment environment:

```env
ADMIN_PASSWORD=your_secure_admin_password_here

KV_REST_API_URL=your_kv_rest_api_url_here
KV_REST_API_TOKEN=your_kv_rest_api_token_here
```

---

## 🛠️ Tech Stack

- **Framework**: Next.js (App Router, Turbopack)
- **Generative AI**: Google Gemini prompt analysis, Gemini Live voice sessions, and Lyria music generation
- **Computer Vision**: MediaPipe Hand Tracking & Face Landmark Detection
- **Audio**: Web Audio API Procedural Audio Synthesizers
- **Hardware Integration**: Web Bluetooth API & macOS CoreBluetooth Native Bridge
- **Realtime Data**: Firebase Firestore and Firebase Realtime Database
- **Styling**: Tailwind CSS & Canvas 2D Rendering
