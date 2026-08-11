# Ernest Pascual Interactive Talks Web App

## Current available talks:

<div align="center">
  <img src="img/aisubstrate.png" alt="AI Substrate" />
  <br />
  <a href="https://talks.ernestpascual.com/talks/raw-school-2026">Raw School 2026</a>
  <span> &nbsp; | &nbsp; </span>
  <a href="https://talks.ernestpascual.com/talks/aerocano">Aerocano: Shaking Up Coffee Tech</a>
</div>

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

## Routes & features

| Route                                  | File                                    | Description                                                             |
| -------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------- |
| `/admin`                               | `app/admin/`                            | Password-protected admin menu linking to QR Generator & Aerocano database |
| `/admin/aerocano`                      | `app/admin/aerocano/`                   | Admin table for live scores and survey responses with clear buttons     |
| `/talks/raw-school-2026`               | `app/talks/raw-school-2026/`           | **Raw School 2026** slide deck (14 slides)                              |
| `/talks/aerocano`                      | `app/talks/aerocano/`                   | **Aerocano** interactive slide deck                                     |
| `/experience/aerocano-survey`          | `app/experience/aerocano-survey/`       | Participant survey input form                                           |
| `/experience/aerocano-shake`           | `app/experience/aerocano-shake/`        | Handheld device shake-it game experience                                |
| `/r/[slug]`                            | `app/r/[slug]/route.ts`                 | Dynamic short URL redirects (e.g. `/r/live` -> active slide target)    |
| `/api/survey`                          | `app/api/survey/route.ts`               | Submit and fetch survey responses                                       |
| `/api/scores`                          | `app/api/scores/route.ts`               | Submit, fetch, and clear live shake-it scoreboard entries               |
| `/api/gemini`                          | `app/api/gemini/route.ts`               | Calls Gemini API to analyze survey responses and generate insights      |

## Aerocano Talk Deck (`/talks/aerocano`)

An interactive, multi-slide presentation about coffee tech and the Aerocano build. It integrates live viewer inputs directly onto the presenter screen:

- **Slide 1:** Title slide featuring custom overlays.
- **Slide 2:** Text-heavy intro with enlarged readability.
- **Slide 3:** Custom background illustration.
- **Slide 4:** Coffee pour visualization with sized-up containers.
- **Slide 5:** Aerocano recipe formulation panel.
- **Slide 6 (Bento Dashboard):** Live dashboard showing room insights analyzed by Gemini. Refreshes dynamically as responses arrive. Features sweetness meters, archetype charts, and a "why cloud". Layout is fully responsive to support scrolling and clear spacing on mobile devices.
- **Slide 7 (Leaderboard):** Real-time auto-updating leaderboard displaying the highest scores submitted from the shake experience, alongside a scannable QR code to participate.
- **Slide 8:** Presentation video showcase with minimal surrounding glows.

## Raw School 2026 Talk Deck (`/talks/raw-school-2026`)

A fullscreen presentation on **AI as creative substrate**—how ideas can be made _of_ AI, not only _by_ AI:

- **Slides:** 14 pages of slides at `/talks/raw-school-2026/[1–14]`.
- **Slide 1:** Title slide — full-screen image artwork with overlays.
- **Slide 6 (Smile pricing demo):** Smile detection pricing tier simulator using live face-tracking.
- **Slide 9 (Fruit Ninja):** Interactive hand-tracking slash game experience.
- **Other slides:** Feature rich video illustrations, Venn diagrams, polymath framework overlays, and interactive quotes.

## Database & KV Storage (`lib/db.ts`)

The database layer utilizes a single unified abstraction supporting multiple environments:

- **Production (Vercel / Upstash):** If `KV_REST_API_URL` and `KV_REST_API_TOKEN` (or Upstash Redis equivalent env vars) are present, database queries interact directly with the persistent cloud KV store.
- **Development Fallback:** Locally, it falls back automatically to a global, in-memory cache store that persists until the dev server is restarted.

### Admin (`/admin`)

- Sign in with a fixed password (set via the `ADMIN_PASSWORD` environment variable, defaulting to `aerocano2025`).
- Session is stored in `localStorage` under the key `admin-auth`.
- Sessions expire **7 days** after login; you must sign in again after that.
- Use the **Log out** button on the admin page, or call `logout()` from `lib/admin-auth.ts`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
