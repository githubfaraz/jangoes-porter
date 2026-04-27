# Jangoes Porter

A mobile-first web app for parcel/logistics delivery in India — Uber-for-packages. Customers book deliveries, drivers (with KYC) accept and fulfil them. Pricing is computed live per booking using real road distance, vehicle type, weight, and time-of-day surcharges.

**Stack:** React 19 + TypeScript + Vite (frontend) · Express 5 (backend) · Firebase Auth + Firestore + Storage · Google Maps · Gemini AI · voicensms.in (OTP) · Capacitor (Android + iOS shells).

## Prerequisites

- Node.js 20+
- A `.env` file at the project root with the variables listed in `CLAUDE.md` §7 (Firebase Admin credentials, Google Maps key, Firebase web config, voicensms.in SMS keys).

## Run locally

```bash
npm install
npm run dev          # Express + Vite middleware on http://localhost:3000
```

Other scripts:

```bash
npm run build        # production build to dist/
npm run preview      # preview the production build
npm run lint         # tsc --noEmit (typecheck only)
npm run cap:android  # build + cap sync + open Android Studio
npm run cap:ios      # build + cap sync + open Xcode
```

## Project structure

See `CLAUDE.md` §4 for the full breakdown. Top-level highlights:

- `server.ts` — Express server (OTP, KYC OCR proxy, Vite middleware)
- `App.tsx` — root component, routing, auth/role/KYC guards
- `screens/` — `customer/`, `driver/`, `shared/`
- `services/geminiService.ts` — Gemini AI helpers
- `src/firebase.ts` — Firebase client init
- `admin/` — separate admin SPA
- `android/`, `ios/` — Capacitor native projects

## Documentation

- **`CLAUDE.md`** — entry point. Stack, architecture, conventions, gotchas, env vars, key files.
- **`docs/PROGRESS.md`** — daily session log; current state of in-flight work and pending features.
- **`docs/SESSION_START.md`** — paste-at-start prompt for new Claude Code sessions.
- **`docs/project-specs.md`** — deep dive on schema, routing, feature status.
- **`docs/architecture-decisions.md`** — ADR-style design rationale.
- **`docs/api-integration.md`** — Gemini SDK usage patterns.
- **`docs/idea-inbox-mvp-roadmap.md`** — vision and roadmap.
- **`FARE_CALCULATION_LOGIC.md`** — full fare formula spec.
