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

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

---

## Routes & Features

| Route | Location | Description |
| --- | --- | --- |
| `/` | `app/page.tsx` | Retro TTY terminal console with direct route navigation |
| `/experience` | `app/experience/page.tsx` | Retro TTY terminal console for experiences |
| `/experience/dragon-slayer` | `app/experience/dragon-slayer/` | **Dragon Slayer**: AI hand-tracked lightsaber combat with Fruit Ninja mechanics |
| `/experience/find-your-officemate` | `app/experience/find-your-officemate/` | **WRU?!**: Real-time 2.4GHz Bluetooth Low Energy proximity & direction radar |
| `/experience/aerocano-shake` | `app/experience/aerocano-shake/` | Mobile device shake-it game with live score logging |
| `/experience/aerocano-survey` | `app/experience/aerocano-survey/` | Coffee preference live audience survey |
| `/experience/raw-school-2026/price-demo` | `app/experience/raw-school-2026/price-demo/` | Real-time smile detection facial tracking pricing demo |
| `/experience/raw-school-2026/ninja` | `app/experience/raw-school-2026/ninja/` | Hand-tracking interactive slash demo |
| `/experience/raw-school-2026/krebs` | `app/experience/raw-school-2026/krebs/` | Interactive Krebs cycle of creativity visualization |
| `/talks/bbdo-ai-playday` | `app/talks/bbdo-ai-playday/` | **BBDO AI Playday** interactive slide deck (14 slides) |
| `/talks/raw-school-2026` | `app/talks/raw-school-2026/` | **Raw School 2026** interactive slide deck (14 slides) |
| `/talks/aerocano` | `app/talks/aerocano/` | **Aerocano** interactive slide deck with live audience widgets |
| `/admin` | `app/admin/` | Protected admin menu for QR Generator & Aerocano database |
| `/admin/aerocano` | `app/admin/aerocano/` | Live scores and survey responses table with reset tools |
| `/admin/qr-generator` | `app/admin/qr-generator/` | Dynamic QR code generator for presentations and experiences |
| `/r/[slug]` | `app/api/redirect/route.ts` | Dynamic short URL redirects (e.g. `/r/live` -> active target) |
| `/api/bluetooth/scan` | `app/api/bluetooth/scan/route.ts` | CoreBluetooth & system Bluetooth scanner endpoint |
| `/api/survey` | `app/api/survey/route.ts` | Submit and fetch survey responses |
| `/api/scores` | `app/api/scores/route.ts` | Submit, fetch, and clear live shake-it leaderboard scores |
| `/api/gemini` | `app/api/gemini/route.ts` | Gemini AI analysis of audience responses |

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

Create a `.env.local` file to configure environment settings:

```env
# Google Gemini API key for live talk analytics and audience insights
GEMINI_API_KEY=your_gemini_api_key_here

# Admin Dashboard access password
ADMIN_PASSWORD=your_secure_admin_password_here

# Upstash Redis / Vercel KV storage (optional, falls back to in-memory store in development)
KV_REST_API_URL=your_kv_rest_api_url_here
KV_REST_API_TOKEN=your_kv_rest_api_token_here
```

---

## 🛠️ Tech Stack

- **Framework**: Next.js (App Router, Turbopack)
- **Computer Vision**: MediaPipe Hand Tracking & Face Landmark Detection
- **Audio**: Web Audio API Procedural Audio Synthesizers
- **Hardware Integration**: Web Bluetooth API & macOS CoreBluetooth Native Bridge
- **Styling**: Tailwind CSS & Canvas 2D Rendering
