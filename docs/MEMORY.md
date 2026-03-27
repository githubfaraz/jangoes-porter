# Jangoes Porter — Session Memory

## Quick Reference
- **Project:** Jangoes Porter — logistics/parcel delivery web app (Uber-like for packages)
- **Root:** `C:/wamp64/www/jangoes-porter`
- **Run:** `npm run dev` → Express + Vite on `http://localhost:3000`
- **Detailed docs:** See `project-specs.md` in this memory folder

## Tech Stack
- React 19 + TypeScript + Vite (frontend)
- Express 5 + tsx (backend/server)
- Firebase Auth (custom token) + Firestore + Storage
- Firebase Admin SDK (server-side, for custom tokens)
- Google Maps (`@vis.gl/react-google-maps`) — Places, Geocoding, Maps JS API
- Gemini AI (`@google/genai`) — parcel classifier, logistics chat
- SMS via voicensms.in API

## Two User Roles
- **CUSTOMER** — books deliveries, tracked via `/home` flow
- **DRIVER** — goes through KYC first (`/registration`), then `/dashboard`

## Auth Flow (OTP)
1. User enters phone → server sends OTP via voicensms.in
2. User enters OTP → server verifies, generates Firebase custom token with UID = `phone_XXXXXXXXXX`
3. Client calls `signInWithCustomToken()` — stable UID across sessions
4. First-time OTP users → `SetupProfile` screen to enter name (guards `isProfileComplete`)
5. Google login → `signInWithPopup(GoogleAuthProvider)` — name/photo saved to Firestore

## Key Guards in App.tsx
- `!isLoggedIn` → `/auth`
- Customer + `!isProfileComplete` → `/setup-profile`
- Driver + `!isKycDone` → `/registration`

## Firestore Collections
- `users/{uid}` — name, email, phoneNumber, role, kycCompleted, walletBalance, photoURL
- `trips/{tripId}` — full Trip object (see types.ts)

## Environment Variables (.env)
- `SMS_UKEY`, `SMS_SENDER`, `SMS_TEMPLATE_ID`, `SMS_DLT_TEMPLATE_ID`, `SMS_CREDIT_TYPE`
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (Admin SDK)
- `VITE_GOOGLE_MAPS_API_KEY`
- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, etc.

## Known Pending Work
- OrderSummary.tsx — hardcoded trip data, not wired to SearchLocation state
- Wallet.tsx — simulated, no real payment gateway
- OrderHistory.tsx — hardcoded mock orders, not fetching from Firestore
- Driver ActiveTrip, Payouts, Profile — mostly UI, not fully wired to Firestore
- Apple Sign-In — code in place, Firebase Apple auth not configured yet
- Driver live location on tracking map — not implemented
