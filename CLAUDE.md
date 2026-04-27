# CLAUDE.md — Jangoes Porter

This file is the entry point for any Claude Code session in this repo. Read it first, then `docs/PROGRESS.md` for current state. The exact session-start prompt lives in `docs/SESSION_START.md`.

---

## 1. Project Overview

**Jangoes Porter** is a mobile-first web app for parcel/logistics delivery in India — Uber-for-packages. Customers book deliveries; drivers (with KYC) accept and fulfil them. Pricing is computed live per booking.

- **Market:** India only (10-digit phone login, INR, India-restricted Places search)
- **Dev URL:** `http://localhost:3000`
- **Firebase project:** `jangoes-porter`
- **UI:** mobile-first, max-width 448px, light "Liquid Glass" theme, dark mode supported
- **Native shells:** Capacitor wrappers for Android and iOS (`android/`, `ios/`, `capacitor.config.ts`)

## 2. Tech Stack

| Layer | What |
|---|---|
| Frontend | React 19.2.3 (Strict Mode) + TypeScript ~5.8 + Vite 6 |
| Routing | `react-router-dom` 6.28 — **HashRouter** (URLs use `#/path`) |
| Styling | Tailwind CSS, Material Symbols Outlined icons |
| Backend | Express 5 in `server.ts`, run via `tsx` |
| Auth | Firebase Auth (custom-token via Admin SDK, Google OAuth) |
| Data | Firestore + Firebase Storage |
| Maps | `@vis.gl/react-google-maps` (Maps JS, Places, Geocoding) |
| AI | `@google/genai` — Gemini 3 Flash + Flash Lite |
| SMS | `voicensms.in` API (OTP delivery, India) |
| Mobile | Capacitor 8 (Android + iOS) |

## 3. Environment

- **OS:** Windows 11
- **Path:** `C:\wamp64\www\jangoes-porter` (lives in WAMP's `www/` folder for convenience — **WAMP/Apache is not used to serve the app**; Express+Vite handles everything on `:3000`)
- **Run dev:** `npm run dev` → `tsx server.ts` (Express boots Vite as middleware)
- **Build:** `npm run build` → static output in `dist/`
- **Typecheck:** `npm run lint` → `tsc --noEmit`
- **Mobile:** `npm run cap:android` / `npm run cap:ios` (build → sync → open native IDE)

## 4. Architecture

```
jangoes-porter/
├── server.ts               # Express: /api/auth/send-otp, /api/auth/verify-otp, Vite middleware
├── App.tsx                 # Root: routing + auth/role/KYC guards
├── index.tsx               # React entry, wraps app in <APIProvider> for Maps
├── types.ts                # UserRole, Trip, BookingStatus enum, etc.
├── constants.tsx           # SERVICES array, static config
├── vite.config.ts          # Vite + React plugin config
├── capacitor.config.ts     # Capacitor (mobile) config
├── .env                    # All secrets (see §7)
├── src/firebase.ts         # Client Firebase init (auth, db, storage exports)
├── services/
│   └── geminiService.ts    # classifyParcel, getLogisticsSupport, searchPlaces
├── screens/
│   ├── AuthScreen.tsx, OTPScreen.tsx
│   ├── customer/           # Home, SearchLocation, ParcelDetails, ParcelDimensions,
│   │                       # VehicleSelection, OrderSummary, Tracking, Wallet,
│   │                       # Profile, Services, ExchangeDetails
│   ├── driver/             # Dashboard, RegistrationFlow (KYC wizard), ActiveTrip,
│   │                       # ExchangeTrip, Payouts, Profile
│   └── shared/             # SetupProfile, ChatScreen, HelpSupport, OrderHistory
├── admin/                  # Separate admin SPA (App.tsx, main.tsx, rbac.ts, screens/, services/, hooks/)
├── android/, ios/          # Capacitor native projects
├── dist/                   # Build output
└── docs/                   # Project documentation (see §9)
```

### Two user roles
- **CUSTOMER** — books deliveries, flow lives under customer screens
- **DRIVER** — must complete KYC (`screens/driver/RegistrationFlow.tsx`) before reaching `/dashboard`

### Auth flow (OTP)
1. User enters phone → server generates 4-digit OTP, stores in-memory with 3-min TTL, sends via voicensms.in
2. User enters OTP → server verifies → Admin SDK mints custom token with `uid = phone_<10digits>`
3. Client `signInWithCustomToken()` → stable Firebase session keyed by phone number
4. New customer → `/setup-profile` to capture name; new driver → `/registration` for KYC
5. Google login uses `signInWithPopup` and skips SetupProfile (name from Google)

### Routing guards (App.tsx)
- `!isLoggedIn` → `/auth`
- Customer + `!isProfileComplete` → `/setup-profile`
- Driver + `!isKycDone` → `/registration`

### Firestore schema
- `users/{uid}`: `name, email?, phoneNumber?, photoURL?, role, kycCompleted, walletBalance, createdAt`
- `trips/{tripId}`: `customerId, driverId?, pickup, dropoff, status, fare, vehicleType, pickupPin, dropoffOtp, parcelImageUrl?, senderName, receiverName, receiverPhone, createdAt`
- `BookingStatus`: `SEARCHING → ACCEPTED → ARRIVED_AT_PICKUP → PICKING_UP → IN_TRANSIT → ARRIVED_AT_DESTINATION → DROPPING_OFF → COMPLETED | CANCELLED`

## 5. Coding Conventions (observed)

- **TypeScript everywhere.** Function components + hooks only; no class components.
- **One screen per route.** Each step of the booking funnel is its own route (atomic-screen pattern). State for the current step is local; cross-screen state is currently a known gap (see §6).
- **Imports:** absolute-ish from project root (`screens/...`, `services/...`, `src/...`).
- **Tailwind utility-first.** Custom theme is "Liquid Glass" (mesh gradients, frosted glass containers, custom green `#78AA64 → #96C882`). No CSS modules.
- **Icons:** Material Symbols Outlined (variable font, used as `<span className="material-symbols-outlined">…</span>`).
- **HashRouter.** URLs use `#/path` — match this when constructing links/redirects.
- **Firebase access:** import `auth`, `db`, `storage` from `src/firebase.ts`. Don't re-init Firebase elsewhere.
- **Gemini access:** import helpers from `services/geminiService.ts`. New AI features go in that file.
- **Don't hardcode secrets.** Client-side keys use `VITE_` prefix; server-side keys read from `process.env`.
- **Mobile-first layout.** Containers cap at `max-w-md` (448px). Bottom nav is conditionally hidden on funnel/auth/registration routes.

## 6. Gotchas, Workarounds, Quirks

- **Booking-flow state isn't threaded between screens.** `OrderSummary.tsx` currently uses hardcoded pickup/drop/fare/vehicle instead of reading the user's selections from previous screens. Fixing this needs a Context or router state. (Tracked in PROGRESS.)
- **Gemini API key is exposed client-side.** Intentional MVP tradeoff documented in `docs/architecture-decisions.md`. Don't move it to the server without discussion.
- **`FIREBASE_PRIVATE_KEY` in `.env` must keep its literal `\n` escapes.** The server replaces them with real newlines at boot. Quote the value with double quotes.
- **OTP store is in-memory.** Server restart wipes pending OTPs. Fine for dev; would need Redis for prod scaling.
- **SMS demo-mode fallback.** If `SMS_UKEY` is missing/invalid, `/api/auth/send-otp` returns `{ demo: true, otp: "1234" }` and the client shows it in an alert. Keep this behavior — useful for testing without burning SMS credits.
- **HashRouter, not BrowserRouter.** Deep links and redirects must use the `#/...` form. This was chosen to keep static hosting + Capacitor file:// loading simple.
- **Apple Sign-In code is wired up but not active** — Firebase Console doesn't have Apple provider configured yet.
- **No driver live-GPS yet.** Tracking screen shows pickup/drop markers but no live driver position. This is the most-requested unfinished feature.
- **`EXTRAS/` directory** is gitignored scratch space (see commit `7193d1c "Removed EXTRAS folder from tracking"`). Don't depend on its contents.
- **WAMP isn't serving anything.** The project just lives under `C:\wamp64\www\` because that's the user's web folder. All routing is Express on `:3000`.
- **Two front-ends in one repo.** `screens/` is the customer+driver app; `admin/` is a separate admin SPA with its own entry. Don't confuse the two when editing.

## 7. Environment Variables (`.env`)

```
# SMS (voicensms.in)
SMS_UKEY=...
SMS_SENDER=JANGOE
SMS_TEMPLATE_ID=79178
SMS_DLT_TEMPLATE_ID=79178
SMS_CREDIT_TYPE=2

# Firebase Admin (server)
FIREBASE_PROJECT_ID=jangoes-porter
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@jangoes-porter.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Client-side (Vite exposes only VITE_-prefixed vars)
VITE_GOOGLE_MAPS_API_KEY=...
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=jangoes-porter.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=jangoes-porter
VITE_FIREBASE_STORAGE_BUCKET=jangoes-porter.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

## 8. Key Files at a Glance

| File | What it does |
|---|---|
| `server.ts` | Express server. OTP send/verify endpoints, Firebase Admin custom-token mint, Vite dev middleware, static `dist/` in prod. |
| `App.tsx` | Auth listener, role/KYC guards, all route declarations. The first place to look when "the wrong screen showed up". |
| `index.tsx` | React entry; wraps `<App>` in Maps `<APIProvider libraries={['places']}>`. |
| `src/firebase.ts` | Single source of truth for Firebase client init. |
| `services/geminiService.ts` | All Gemini calls (classifyParcel, getLogisticsSupport, searchPlaces). |
| `screens/customer/SearchLocation.tsx` | 4-view pickup/drop flow: route_summary, search_selection, map_picker, details_form. |
| `screens/customer/Tracking.tsx` | Real-time Firestore listener + Map with pickup/drop markers. |
| `screens/driver/RegistrationFlow.tsx` | 8-step KYC wizard (all steps complete); sets `kycCompleted` on completion. |
| `screens/driver/Dashboard.tsx` | Real-time Firestore listener for `SEARCHING` trip requests. |
| `types.ts` | All shared types. **Update here before changing data shape anywhere else.** |
| `constants.tsx` | `SERVICES` array and other static lists. |
| `admin/App.tsx`, `admin/rbac.ts` | Admin SPA entry + role checks. |

## 9. Other Documentation

These exist already; read them when the topic comes up.

| File | When to read |
|---|---|
| `docs/project-specs.md` | Deep dive on schema, routing, feature status. **Slightly stale (last updated 2026-03-03)** — verify against code before relying. |
| `docs/architecture-decisions.md` | Why we chose Liquid Glass, client-side Gemini, atomic screens, wallet-first. |
| `docs/api-integration.md` | Gemini SDK patterns: structured output, multimodal, Maps grounding. |
| `docs/idea-inbox-mvp-roadmap.md` | Vision + roadmap phases. |
| `FARE_CALCULATION_LOGIC.md` (root) | Full fare formula: base, distance, weight, time-of-day, waiting, toll, GST. |
| `docs/PROGRESS.md` | **Daily session log.** Always read this second after CLAUDE.md. |
| `docs/SESSION_START.md` | The exact prompt to paste at session start. |
| `docs/PRODUCT_SPECIFICATION.md` | **Client-facing product spec** — sales/partnership document. Don't dump internal/implementation details into it; keep it polished. |

## 10. How to Work in This Repo

- **Analyze before editing.** Read the screen and adjacent files before making changes. Many screens look similar but differ in state shape.
- **Match existing patterns.** Don't introduce new state libs, routing patterns, or styling systems. Use Context or router state for cross-screen data, not Redux/Zustand/etc., unless we discuss.
- **Backwards-compatible Firestore changes only.** Schema changes need migration thinking — old `trips` and `users` docs already exist.
- **Update `docs/PROGRESS.md`** at the end of any non-trivial session.
- **If unsure, ask.** This repo has stale docs and known gaps; don't guess.