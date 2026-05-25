# PROGRESS — Daily Session Log

**Purpose:** A running log of what changed, what's in flight, and what's next, written one entry per working session. Future Claude sessions read this right after `CLAUDE.md` to skip relearning the project state. Append new entries to the **top** so the latest is always first.

Keep entries terse. Code lives in git; this log captures *intent and context* git can't tell you — why we paused something, what we tried that didn't work, what's blocking us, what the user is waiting on.

---

## Entry Template

```markdown
## YYYY-MM-DD — <one-line headline>

**Done**
- <thing finished this session>

**In progress**
- <thing started but not finished, with where it stands>

**Next**
- <next concrete step>

**Open questions**
- <thing we need a human decision on>

**Files touched**
- `path/to/file.tsx` — what changed
```

Notes on the fields:
- **Done** = merged or committed work. If it's just on disk and not committed, mark `(uncommitted)`.
- **In progress** = explicitly *not* done; describe the half-state so the next session can resume.
- **Next** = the very next action, not a wishlist. Wishlist goes to `docs/idea-inbox-mvp-roadmap.md`.
- **Open questions** = anything blocking that needs the user's input.
- **Files touched** = give the path, one short clause on what changed. Skip if no edits this session.

---

## 2026-05-25 — Activity tab UX, exchange driver actions, admin image audit, listener stability

**Done**
- **Customer Activity tab — Mail Invoice on every row.** `OrderHistory.tsx` now has a small outline mail-icon button on each ongoing row and a "Mail Invoice" outline button on each past row. Reuses `/api/email-invoice` (works for ongoing trips too since the endpoint doesn't gate on status). Falls back to `prompt()` when the customer has no email (OTP-only signups).
- **Past list trimmed to 5 + paginated full history.** `OrderHistory.tsx` shows the 5 most-recent past trips with a "View All (N)" button when more exist. New `screens/shared/AllOrders.tsx` paginates the full history at 10/page with Prev/Next; mounted at `/orders/all`.
- **Exchange 3-leg display + scroll fix.** Past row in OrderHistory branches on `serviceType === 'exchange'` and renders three legs (sender → receiver → sender return) with green/red/green-ringed dots and "Leg 1/2/3" labels. Outer `OrderHistory` wrapper changed from `h-full` to `h-screen` + `shrink-0` on the header so the list scrolls inside instead of growing the body.
- **Customer Tracking — Pickup OTP card.** Exchange post-accept layout in `Tracking.tsx` now shows an OTP card (Pickup OTP / Return OTP, themed primary/amber) between the status text and the driver info card. Previously the OTP was only visible after tapping "View Details".
- **Driver Exchange — Cancel + Logout from any screen.** `ExchangeTrip.tsx` got a `more_vert` menu in the top bar (next to Chat) on every in-progress status screen. Opens a bottom sheet with **Back to Dashboard**, **Cancel Trip** (red — opens confirmation modal with 5 reasons, writes `status: CANCELLED, cancelReason, cancelledBy: 'driver'`), and **Log Out**. Terminal screens (EXCHANGE_COMPLETED / EXCHANGE_FAILED) untouched — they already had BACK TO DASHBOARD.
- **Admin Trips — image audit.** `admin/screens/Trips.tsx` expanded-row now renders all uploaded images in two color-tinted groups (blue = Customer uploads, emerald = Driver uploads), each with the uploader's name + UID. Covers `parcelImageUrl`, `exchange.productA/B.images`, `exchange.productA/B.referencePhotos`, and `exchange.qcChecklist.photos`. Each thumbnail opens a lightbox with uploader attribution + image label.
- **Activity Logs permission error fixed.** `firestore.rules` updated: renamed `adminActions` rule to `adminLogs` (the actual collection name written by `admin/services/activityLog.ts`). Required `npm run deploy:rules` to push to Firebase.
- **`deploy:rules` works without global firebase CLI.** Switched the script to `npx firebase-tools deploy --only firestore:rules --project jangoes-porter`.
- **Driver TripRequestOverlay listener stability.** The new-trip listener used to re-subscribe on every GPS tick and KYC snapshot (deps included `driverLat`/`driverLng`/`pendingDocs`). Refactored to depend only on `isOnline`; other inputs read via refs inside the snapshot callback. Eliminates the brief unsubscribe-resubscribe windows that were preventing the popup from firing reliably on non-`/dashboard` screens.

**In progress**
- _(none — all changes ready to commit)_

**Next**
- After commit + push: run `npm run deploy:rules` so the `adminLogs` rule lands in the Console.
- SMTP credentials for Mail Invoice (Open Q #1) still outstanding.

**Open questions carried forward**
- **#1 SMTP credentials for Mail Invoice.**
- **#2 DLT template for receiver pickup OTP.**

**Files touched today**
- New: `screens/shared/AllOrders.tsx`
- Modified: `App.tsx`, `package.json`, `firestore.rules`, `admin/screens/Trips.tsx`, `screens/customer/Tracking.tsx`, `screens/driver/ExchangeTrip.tsx`, `screens/driver/TripRequestOverlay.tsx`, `screens/shared/OrderHistory.tsx`
- Docs: `docs/PROGRESS.md` (this entry)

---

## 2026-05-24 — Audit of untracked work since 2026-05-04

**Status**
- Repo has 10 modified + 3 untracked files that aren't in any PROGRESS entry. They appear to address 4 of the 6 open questions from 2026-05-04. Logging what's on disk; not committing in this session.

**Done (uncommitted, on disk)**
- **Open Q #3 — Receiver tracking page.** New `screens/RecipientTracking.tsx` (public, polls every 8s, status banner + driver card + map). New `GET /api/public-trip/:tripId` in `server.ts` returns a PII-stripped projection (no phones, OTPs, fare, customer IDs). New bare-URL alias `GET /rd/:tripId` → `302 /#/rd/:tripId` so WhatsApp links work. `App.tsx` routes `/rd/:tripId` to `RecipientTracking` ahead of the auth branch and hides BottomNav + driver TripRequestOverlay on `/rd/*`.
- **Open Q #4 — Book Again pre-fills earlier flow.** `OrderHistory.tsx` + `TripDetails.tsx` Book Again now navigates to `/search` (not `/summary`) carrying the full `buildBookAgainState`. `SearchLocation.tsx` reads `pickup`/`drop` from incoming state (wins over `JANGOES_LAST_PICKUP`) and forwards the rest of the payload to the next route. `ParcelDetails.tsx` pre-fills description + analysis from `state.parcel`. `VehicleSelection.tsx` pre-selects `state.vehicle.id` if visible/enabled.
- **Open Q #5 — Coupon redeem now idempotent.** `POST /api/redeem-coupon` accepts `tripId` and runs a Firestore transaction that creates `coupons/{CODE}/redemptions/{tripId}` and increments `usedCount` only if the doc didn't already exist. `OrderSummary.tsx` now passes `tripId: docRef.id`. Back-compat: no `tripId` → old non-idempotent behavior.
- **Open Q #6 — Firestore rules checked into repo.** New `firestore.rules` (full ruleset matching what's in Console — `users`, `users/{uid}/transactions`, `trips`, `coupons` + `coupons/{code}/redemptions`, `config`, `adminActions`, default-deny) and `firebase.json` pointing to it. New `npm run deploy:rules` script.
- **CLAUDE.md** — appended a "You are a senior software engineer" rules block (terse-response preferences).

**In progress**
- All of the above is uncommitted in working tree. Modified: `App.tsx`, `CLAUDE.md`, `package.json`, `server.ts`, `screens/customer/{OrderSummary,ParcelDetails,SearchLocation,VehicleSelection}.tsx`, `screens/shared/{OrderHistory,TripDetails}.tsx`. Untracked: `firebase.json`, `firestore.rules`, `screens/RecipientTracking.tsx`.

**Next**
- User to confirm what's on disk is intended, then commit in logical groups (receiver tracking / Book Again prefill / coupon idempotency / firestore rules in repo / CLAUDE.md tweak).
- Run `npm run deploy:rules` once after committing so repo and Console rules match.
- End-to-end test of receiver tracking link (book → share via WhatsApp → open on second device).

**Open questions carried forward from 2026-05-04**
- **#1 SMTP credentials for Mail Invoice** — still unresolved per session-start.
- **#2 DLT template for receiver pickup OTP** — still using generic delivery-OTP template.

**Files touched today**
- _(this session only edited `docs/PROGRESS.md`; uncommitted code changes above were already on disk at session start)_

---

## 2026-05-04 — Session wrap-up

A large session — eight discrete batches landed in `main` plus one Firebase Console change. Entries below have full per-batch detail; this is the index.

**Done (in chronological order)**
1. **`/api/driver-availability` diagnosis + fix** — switched to `roles array-contains DRIVER`, returns 503 on backend failure, `VehicleSelection` distinguishes outage from genuine zero-supply. *(Commit `bd9dcdf`)*
2. **Customer Tracking: Exchange post-accept layout + WhatsApp share** — new layout from `EXTRAS/customer-view-after-driver-accepts-trip.jpeg` with Trip CRN header, Info + Share buttons (WhatsApp `wa.me/?text=…`), driver/address cards, View Details bottom sheet. Per-trip share URL `jangoes.com/rd/<tripId>`. *(Commit `b53c90a`)*
3. **Five-pack** — 2-min ETA "Your Vehicle is here!" banner, receiver OTP fired on Exchange pickup (parity with Parcel), Product A/B → Product 'A' / 'B' across UI, Exchange completion rating screen, driver-side Product 'B' reference photo card with lightbox.
4. **Four-pack** — Parcel/Exchange progress-timeline sync (added "Driver at Pickup" step to Exchange, terminal-state coverage, failure-path label swaps), parcel image preview at dropoff in `ActiveTrip`, driver new-trip popup lifted to App-level (`TripRequestOverlay` + shared `useDriverOnline`), Order History redesign + new Trip Details screen.
5. **Three-pack enhancements** — Book Again now pre-fills Order Summary, Mail Invoice posts to a new `/api/email-invoice` (Nodemailer/SMTP), full coupon system (validate + redeem endpoints, OrderSummary input, fare-breakdown discount line on both screens, `couponCode`/`couponDiscount` on `Trip`).
6. **Admin coupon CRUD + active-flag enforcement** — new `/coupons` page with table, Add/Edit modal, delete confirm, activate/deactivate toggle, all logged via `logAdminAction`. New `coupons` + `coupons.edit` permissions; sidebar nav. `/api/validate-coupon` rejects `active === false`.
7. **Firestore rules update** *(in Firebase Console, not repo)* — added `match /coupons/{code}` admin-only rule + fixed `isAdmin()` to check `roles` array (matches `useAdminAuth.tsx:53-54`).

**In progress**
- _(none — repo is clean except for `.claude/settings.local.json` harness config)_

**Next**
- User testing of the day's changes end-to-end before further feature work.
- When ready: provision SMTP credentials in `.env` (see "Open questions" below) so Mail Invoice actually sends.

**Open questions / pending caveats** (carried forward — none introduced this session beyond what was logged in each batch)
- **SMTP credentials for Mail Invoice.** Endpoint returns `503 { error: 'email_not_configured' }` until `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` are set in `.env`. Easiest path: Gmail App Password (https://myaccount.google.com/apppasswords) with `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`. Restart `npm run dev` after.
- **DLT template for receiver pickup OTP** — driver Exchange flow now sends an SMS to the receiver on pickup, but the body is the existing generic delivery-OTP template (decision (b) made earlier today). When you register a new DLT template with the desired text ("Hi, I am sending you a packet via jangoes 2 wheeler. You can track…"), swap `SMS_TEMPLATE_ID` (or add `SMS_RECEIVER_PICKUP_TEMPLATE_ID`).
- **Receiver-side `jangoes.com/rd/<tripId>` tracking page** — share URL is correctly per-trip but currently a dead link. Browser fallback + Capacitor deep-link handoff to the installed app is a separate workstream.
- **"Book Again" doesn't pre-fill earlier flow screens** — jumps straight to `/summary`. Pre-filling `SearchLocation` → `ParcelDetails` → etc. would require threading initial state through each step.
- **Coupon `usedCount` not strictly idempotent** — repeat redeem-calls (e.g. user double-taps Confirm Booking before navigation) could double-increment. Acceptable for MVP; tighten via Firestore transaction or Cloud Function later.
- **Firestore rules live only in the Firebase Console**, not in the repo. Any new collection needs a rule added there — easy to forget. Consider a `firestore.rules` file checked in next to a `firebase.json` for traceability.

**Files touched today**
- **New code:** `screens/driver/TripRequestOverlay.tsx`, `screens/shared/TripDetails.tsx`, `src/driverOnline.ts`, `src/bookAgain.ts`, `admin/screens/Coupons.tsx`
- **Modified code:** `App.tsx`, `server.ts`, `types.ts`, `screens/customer/Tracking.tsx`, `screens/customer/VehicleSelection.tsx`, `screens/customer/ExchangeDetails.tsx`, `screens/customer/OrderSummary.tsx`, `screens/driver/ActiveTrip.tsx`, `screens/driver/ExchangeTrip.tsx`, `screens/driver/Dashboard.tsx`, `screens/shared/OrderHistory.tsx`, `admin/App.tsx`, `admin/rbac.ts`, `admin/screens/Layout.tsx`
- **Dependencies:** `nodemailer` + `@types/nodemailer` added (`package.json` / `package-lock.json`)
- **Outside the repo:** Firestore security rules updated in the Firebase Console (added `coupons` rule + `isAdmin()` fix)
- **Docs:** `docs/PROGRESS.md` (this and seven prior entries today)

---

## 2026-05-04 — Firestore rules: coupons access + isAdmin() fix

**Done**
- Published updated Firestore security rules in the Firebase Console (jangoes-porter project). Two changes:
  - **Added `match /coupons/{code} { allow read, write: if isAdmin(); }`** — admin SPA's `onSnapshot(collection(db, 'coupons'))` was hitting `permission-denied` because the new collection had no rule. Customers don't need direct read access; the server (`/api/validate-coupon`, `/api/redeem-coupon`) uses the Admin SDK, which bypasses rules.
  - **Fixed `isAdmin()` to check the `roles` array, not just the legacy `role` string.** New form:
    ```
    function isAdmin() {
      let user = get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
      return user.roles.hasAny(['ADMIN']) || user.role == 'ADMIN';
    }
    ```
  - **Why the fix mattered:** `OTPScreen.tsx:139` and `App.tsx:125` rewrite `role` to whatever the user picked on the login toggle. An admin who logged into the customer-facing app and picked "Customer" would have `role: 'CUSTOMER'` — losing admin database access until next admin login, even though `roles: ['ADMIN', ...]` still included it. The admin SPA's auth hook (`useAdminAuth.tsx:53-54`) was already tolerant; the rules now match.

**Caveats / follow-up**
- This is a setup-step pattern: **any new Firestore collection added in code needs a corresponding rule in the Firebase Console.** Default-deny.
- Rules live only in the Firebase Console — not checked into the repo. Worth noting in CLAUDE.md so future sessions know to flag this.

**Files touched**
- _(none — Firestore rules edited in Firebase Console directly)_
- `docs/PROGRESS.md` — this entry

---

## 2026-05-04 — Admin coupon CRUD + active-flag enforcement

**Done**
- **Admin coupon management screen** at `/coupons` (admin SPA). New `admin/screens/Coupons.tsx`:
  - Live list of all `coupons/{CODE}` docs via `onSnapshot`. Table view: Code (mono), Discount ("₹X off" / "X% off"), Valid window, Usage (`used / limit` or `used`), Min Order, Active toggle, Edit/Delete buttons.
  - Stat tiles at the top: Total / Active / Limit-reached counts.
  - **Add Coupon** modal: code (uppercased; doc ID; validated for `^[A-Z0-9_-]{2,32}$`), Type (Flat ₹ / Percent), Value, Valid From / Until (datetime-local), Usage Limit (blank = unlimited), Min Order, Active toggle. Guards against overwriting an existing code via `getDoc` check before `setDoc`.
  - **Edit** reuses the modal with code field disabled. Preserves `usedCount` + `createdAt` + `createdBy`.
  - **Delete** confirms via a small modal, then `deleteDoc`. Notes that past redemptions are unaffected.
  - **Activate/Deactivate** via inline toggle on each row. Just flips `coupons/{CODE}.active`.
  - Every mutation logged via `logAdminAction` (actions: `coupon.created`, `coupon.updated`, `coupon.deleted`, `coupon.activated`, `coupon.deactivated`).
- **RBAC integration.** New `coupons` (view) and `coupons.edit` (create/update/delete/toggle) permissions in `admin/rbac.ts`. Read-only admins still see the table; write operations are hidden when `coupons.edit` not granted (no Add button, no Edit/Delete icons, toggle disabled).
- **Nav + route.** Layout sidebar gets a "Coupons" entry (icon `local_offer`) gated by the `coupons` permission. Route `/coupons` registered in `admin/App.tsx` with `ProtectedRoute`.
- **Server now honors the `active` flag.** `/api/validate-coupon` (`server.ts`) rejects with `reason: 'Coupon is currently inactive'` when `c.active === false`. Backwards-compat: coupons created before this rollout don't have the field; absent === active. Only an explicit `false` disables.

**Caveats**
- New permissions (`coupons`, `coupons.edit`) need to be granted to existing non-Super-Admin admins via `/admin-users`. Super Admins inherit all permissions, so they get coupon access automatically.
- `usedCount` increment via `/api/redeem-coupon` remains non-idempotent (flagged earlier) — admin UI doesn't change this.

**Files touched**
- `admin/screens/Coupons.tsx` — new (CRUD + activate/deactivate)
- `admin/rbac.ts` — added `coupons` + `coupons.edit` permissions
- `admin/screens/Layout.tsx` — added Coupons nav item + page title
- `admin/App.tsx` — registered `/coupons` route
- `server.ts` — validate-coupon now rejects `active === false`
- `docs/PROGRESS.md` — this entry

---

## 2026-05-04 — Three-pack enhancements: Book Again pre-fill + Mail Invoice email + Coupon system

**Done**
- **Book Again now skips the booking flow.** New `src/bookAgain.ts` with `buildBookAgainState(trip)` that maps a stored Trip doc → the `location.state` shape `OrderSummary` already accepts (pickup/drop with name+phone, vehicle, parcel/dimensions, exchange + reference photos, serviceType, fare). Wired into both `OrderHistory.tsx` and `TripDetails.tsx` Book Again buttons — clicking now jumps the customer straight to `/summary` one tap away from re-booking the same trip. No fetch needed (both screens already have the trip in memory).
- **Mail Invoice now sends a real email.** Installed `nodemailer`. New `POST /api/email-invoice` (`server.ts`) fetches the trip, renders an HTML invoice (CRN, addresses, vehicle, fare-detail table mirroring the Trip Details screen — including the coupon line and rounding row when applicable), and sends via SMTP using the env vars below. Returns **503 with `error: 'email_not_configured'`** when SMTP credentials aren't present so the client can show a useful toast. `TripDetails.tsx` Mail Invoice button is now async (POSTs to the endpoint, shows "Sending…" spinner, alerts on success/failure). Falls back to prompting for an email if `auth.currentUser.email` is empty (OTP-only customers).
- **Coupon system (minimal MVP).** Added `couponCode` + `couponDiscount` fields to the `Trip` type. Two new server endpoints in `server.ts`:
  - `POST /api/validate-coupon` — reads `coupons/{CODE}` (uppercased), validates `validFrom`/`validUntil`/`usageLimit`/`minOrderAmount`, computes discount (`flat` or `percent`), caps it at the order amount so total never goes negative. Returns `{ valid, code, discount, discountType }` or `{ valid: false, reason }`.
  - `POST /api/redeem-coupon` — atomically increments `usedCount` via `FieldValue.increment(1)`. Called best-effort by the client right after a successful trip creation; failure is silent (under-counts rather than blocks the booking).
  - `OrderSummary.tsx` got a "Have a coupon code?" card between Vehicle and Fare Breakdown — input + Apply button → validates → on success swaps to a green "CODE applied / You saved ₹X" pill with Remove button. Errors render below the input. The fare breakdown shows a green `−₹X.XX` "Coupon discount (CODE)" line when applied. `finalFare = max(0, fare − couponDiscount)` is now what's used for the wallet auto-select check, the "Confirm Booking • ₹X" CTA, and the saved `trip.fare`. The pre-discount `estimatedTripFare` and the coupon details are persisted separately so the breakdown can reconstruct.
  - `TripDetails.tsx` fare breakdown now shows the same green "Coupon discount (CODE)" line when `trip.couponDiscount > 0`, and the rounding calc accounts for it.

**TODO — provision SMTP credentials**
- Mail Invoice currently returns 503 with `error: 'email_not_configured'` until you set these in `.env`:
  ```
  SMTP_HOST=smtp.gmail.com           # or smtp.sendgrid.net, smtp.resend.com, etc.
  SMTP_PORT=465                       # 465 (SSL) or 587 (STARTTLS)
  SMTP_USER=invoices@yourdomain.com  # or your Gmail address
  SMTP_PASS=...                       # Gmail App Password (https://myaccount.google.com/apppasswords) or provider API key
  SMTP_FROM=Jangoes Porter <invoices@yourdomain.com>   # optional, defaults to SMTP_USER
  ```
  Then restart `npm run dev`. No code changes needed — the endpoint reads env at request time.

**Caveats — known minor issues**
- Coupon `usedCount` increment is not idempotent. If the redeem-call retries (user double-taps Confirm Booking before navigation), the coupon could be incremented twice. Acceptable for MVP; tighten with a Cloud Function or transaction if abuse becomes an issue.
- No admin UI for coupons. You add them by writing docs to the `coupons` collection in the Firebase console: doc ID = the code (uppercase), shape `{ code, discountType: 'flat' | 'percent', discountValue, validFrom?, validUntil?, usageLimit?, usedCount?, minOrderAmount? }`.
- Coupon discount is applied on the customer's displayed fare, but the **server-side `/api/validate-fare` check still validates the original (pre-discount) fare** — that's correct (the discount is a marketing concession, not the trip's actual cost). No change needed there.

**Files touched**
- `src/bookAgain.ts` — new helper
- `screens/shared/OrderHistory.tsx` — Book Again wiring
- `screens/shared/TripDetails.tsx` — Book Again wiring, Mail Invoice POST, coupon line in breakdown
- `screens/customer/OrderSummary.tsx` — coupon UI + state, finalFare wiring, persist + redeem
- `server.ts` — `nodemailer` import, `/api/email-invoice`, `/api/validate-coupon`, `/api/redeem-coupon`
- `types.ts` — added `couponCode` + `couponDiscount` on `Trip`
- `package.json` / `package-lock.json` — `nodemailer` + `@types/nodemailer`
- `docs/PROGRESS.md` — this entry

---

## 2026-05-04 — Four-pack: timeline sync + Order History redesign + global driver popup + parcel preview at dropoff

**Done**
- **Customer timeline sync (Parcel + Exchange).** Audited each step's `done` condition vs status transitions in `Tracking.tsx`. Two real bugs fixed:
  - **Exchange used to jump straight from "Driver Assigned" to "Product 'A' Picked Up"** — that step pulsed for the entire ACCEPTED/ARRIVED_AT_PICKUP/PICKING_UP window, before the driver had even reached the sender. Added an intermediate **"Driver at Pickup"** step. Applied to both the new bottom-sheet Exchange timeline and the legacy inline copy (which now only renders during SEARCHING but kept consistent for back-nav edge cases).
  - **All step `done` arrays now include later/terminal statuses** (`COMPLETED`/`EXCHANGE_COMPLETED`/`EXCHANGE_FAILED`) so a brief moment before the rating screen takes over doesn't show a half-grey timeline.
  - **Skipped steps no longer mis-anchor the active pulse.** When an Exchange fails (e.g. Product 'B' unavailable), the `product_b` step's label flips to "Product 'B' Skipped" + sub becomes "Receiver did not have it" / "Not collected", QC sub becomes "Skipped". The "Returning to You" sub already swapped to "Returning Product 'A'" via the existing `failureReason` check.
- **Parcel image preview at dropoff (driver).** `ActiveTrip.tsx` `DROPPING_OFF` block now renders a primary-tinted card "Parcel you picked up" containing `trip.parcelImageUrl` (size-32 thumbnail). Tap → fullscreen lightbox modal (added `fullScreenImage` state + viewer at component bottom matching the `ExchangeTrip.tsx` pattern). Helps the driver verify they're handing over the right item.
- **Driver new-trip popup now fires on every screen.** Previously only fired while `/dashboard` was mounted. Extracted listener + popup UI into a new `screens/driver/TripRequestOverlay.tsx` component, mounted at `App.tsx` whenever `userRole === DRIVER && isKycDone && isKycVerified`. The shared online-toggle state lives in a tiny module `src/driverOnline.ts` (sessionStorage-backed pub/sub with a `useDriverOnline` hook) so Dashboard's Online/Offline toggle still controls the listener. Dashboard kept its KYC subscription (used for the local pending-docs UI) but lost the GPS watcher, trip listener, accept handler, and inline modal — all owned by the overlay now.
- **Order History redesign + new Trip Details screen.** Rewrote `screens/shared/OrderHistory.tsx` to match `EXTRAS/order-history-1.jpeg`: dropped the Ongoing/History tabs in favor of section dividers ("Ongoing" still shown above "Past" if any active trips exist, but Past is the focus). Past cards now have vehicle illustration + "2 Wheeler"-style label + date + fare + chevron header, sender + receiver address card with green/red dotted rail, "Completed" status pill on the left, blue "Book Again" CTA on the right. Tapping the chevron opens the new `screens/shared/TripDetails.tsx` (modeled on `EXTRAS/order-history-2.jpeg`): date + CRN + total header, driver row with vehicle icon + name + "category | RC" + 5-star rating, pickup/drop, fare details breakdown (uses `trip.finalFare` if present, falls back to `trip.fare`), payment details (cash/online/wallet), bottom action bar with **Mail Invoice** (`mailto:` with trip summary) and **Book Again** (`navigate('/home')`). Wired `/trip-details` route in `App.tsx`.

**Caveats**
- "Book Again" is a stub — navigates to `/home` so the user re-books from scratch. Pre-filling pickup/drop/vehicle would be the next step (needs threading through `SearchLocation` → `OrderSummary`).
- Mail Invoice opens `mailto:` in the user's mail client (no server-side invoice PDF generation).
- Trip Details "Coupon discount" line is omitted from the fare breakdown because no coupon system exists yet — when one lands, add a `couponDiscount` field to `Trip` and another conditional row in the breakdown.
- `TripRequestOverlay` keeps its own KYC + GPS subscriptions (independent of Dashboard's). Slight resource duplication when both are mounted; acceptable to avoid lifting all of Dashboard's listeners into a Context.

**Files touched**
- `screens/customer/Tracking.tsx` — timeline `done` arrays + intermediate "Driver at Pickup" step + skipped-step label swap (both bottom-sheet and inline timelines)
- `screens/driver/ActiveTrip.tsx` — parcel image preview + lightbox at dropoff
- `screens/driver/Dashboard.tsx` — removed GPS/listener/popup, kept toggle wired to `useDriverOnline`
- `screens/driver/TripRequestOverlay.tsx` — new, app-level popup
- `src/driverOnline.ts` — new, shared online-toggle pub/sub
- `App.tsx` — mount `<TripRequestOverlay>` when driver, register `/trip-details` route
- `screens/shared/OrderHistory.tsx` — full rewrite to new design
- `screens/shared/TripDetails.tsx` — new screen
- `docs/PROGRESS.md` — this entry

---

## 2026-05-04 — Five-pack: ETA notif + receiver OTP + Product 'A'/'B' rename + Exchange rating + driver Product 'B' preview

**Done**
- **Exchange-pickup receiver OTP (Parcel parity).** `ExchangeTrip.tsx` PROCEED-TO-RECEIVER button now fires `/api/send-delivery-otp` to `receiverPhone` with `dropoffOtp` after the pickup PIN is verified (mirror of `ActiveTrip.tsx:181-184`). Per user direction, **reusing the existing DLT template** — receiver gets the generic delivery-OTP body, not the exact copy in the spec. If/when a new DLT template is registered with the desired text, swap `SMS_TEMPLATE_ID` (or add a per-flow env var).
- **2-min proximity notification.** `Tracking.tsx`: new effect computes ETA = `haversineKm(driverLocation, target) * 1.4 / 25 * 60`. Target is `pickup` while pre-pickup, `dropoff` from `IN_TRANSIT` onward. When ETA ≤ 2 min, fires the existing in-app banner — "Your Vehicle is here! Our driver-partner <RC|name> is arriving at your <pickup|drop> location." Once-per-leg via a `useRef<{pickup, drop}>` latch (resets on full reload — acceptable). 6 s auto-dismiss. **In-app banner only**: FCM/native push isn't wired up in this repo; banner won't surface if the page is backgrounded.
- **Product A / Product B → Product 'A' / Product 'B'.** Find/replace across 5 files: `Tracking.tsx`, `ExchangeTrip.tsx`, `ExchangeDetails.tsx`, `OrderHistory.tsx`, `OrderSummary.tsx`. Touched user-visible strings, JSX text, alt attributes, and prose comments — not schema field names (`productA`/`productB` keys preserved). Several JS string literals had to be re-quoted from `'…'` to `"…"` because the embedded `'A'`/`'B'` collided with the outer single quotes.
- **Exchange completion rating screen.** Replaced the trivial "Exchange Successful! GO HOME" `EXCHANGE_COMPLETED` branch in `Tracking.tsx` with the layout from `EXTRAS/trip-completed-customer-screen.jpeg`: Skip button (top-right, navigates `/home` without saving), Paid ₹<fare> chip, driver photo, "How was your ride with <name>?", 5-star picker, optional feedback textarea, Need Help? card linking `/help`, Done button (saves `rating`/`feedback`/`ratedAt` to the trip doc, navigates `/home`). Done is disabled until a star is selected. `EXCHANGE_FAILED` keeps its existing failure screen — only success gets the rating.
- **Driver views customer's Product 'B' reference photos at receiver.** `ExchangeTrip.tsx`: extracted a `renderProductBReferenceStrip()` local helper that reads `trip.exchange.productB.referencePhotos[]` (the path `OrderSummary.tsx:111` writes to). Renders an emerald-tinted card titled "Customer's Product 'B' reference photos" with size-20 thumbnails, each a button that calls the **already-existing** `setFullScreenImage` lightbox (line 605). Added the strip to the `ARRIVED_AT_RECEIVER` and `PICKING_UP_PRODUCT_B` blocks. Also wired clicks on the existing IN_TRANSIT thumbnail strip so those open in the lightbox too.

**Caveats**
- Exchange-pickup OTP body to the receiver does **not** match the spec text ("Hi, I am sending you a packet via jangoes 2 wheeler…") — it's whatever the existing DLT template says. Trigger logic is correct; copy is gated on a DLT template registration.
- Proximity notification fires on best-effort ETA (haversine × 1.4 / 25 km/h). Not traffic-aware; rough but cheap. Could swap to `/api/distance-matrix` per location update if accuracy matters more than API cost.
- Product 'A'/'B' replacement also touched alt text and code comments; field names like `productA`/`productB` and CSS class names were not affected.

**Files touched**
- `screens/driver/ExchangeTrip.tsx` — receiver-OTP fire on pickup, Product 'B' reference-photo strip + lightbox wiring at receiver stages, label rename
- `screens/customer/Tracking.tsx` — 2-min proximity-notification effect + ref latch, Exchange rating screen replacing `EXCHANGE_COMPLETED`, label rename
- `screens/customer/ExchangeDetails.tsx`, `screens/customer/OrderSummary.tsx`, `screens/shared/OrderHistory.tsx` — label rename
- `docs/PROGRESS.md` — this entry

---

## 2026-05-04 — Customer Tracking: Exchange post-accept layout + WhatsApp share

**Done**
- New customer-side tracking layout for **Exchange** trips, shown from `ACCEPTED` through to (but not including) the QC review and terminal exchange screens. Modeled on `EXTRAS/customer-view-after-driver-accepts-trip.jpeg`.
  - Header: back arrow, **Trip CRN** (first 10 chars of tripId, prefixed `CRN`), **Info** + **Share** icon buttons top-right.
  - Map (rounded card, 52vh) with pickup, drop, and live driver markers; driver marker carries an "X.X km away" chip computed via `haversineKm` between `driverLocation` and the next leg's target (pickup if pre-pickup, dropoff otherwise).
  - **Status text** (binary, per user direction): "Driver on the way to pick" while `ACCEPTED`/`ARRIVED_AT_PICKUP`/`PICKING_UP`; "Driver on the way to drop" everywhere else in the active range.
  - Compact driver card: vehicle illustration avatar (or photo when available), **RC number** (large), category label (`bike` → "2 Wheeler", `car` → "4 Wheeler", `tata-ace` → "Mini Truck", `bolero` → "Pickup Truck", `tata-407` → "Medium Truck", `large-truck` → "Large Truck") + driver name, call icon (tel link).
  - Address card with a green→red rail; sender name/phone + pickup address, receiver name/phone + dropoff address; **View Details** link at the bottom opens a bottom sheet.
  - View Details bottom sheet contains: contextual **OTP** (Pickup OTP normally, Return OTP during return stages), full **progress timeline** (same step shape as the existing inline timeline), and **Cancel Ride** button.
- **Share button** opens WhatsApp via `https://wa.me/?text=<encoded>`. Message body is exactly the copy you specified, with three substitutions: `<vehicleLabel>` (from category map), `jangoes.com/rd/<tripId>` (per-trip tracking URL — receiver-side tracking page is out of scope here; URL stub in place for it to be wired up later), and `<referralCode>`.
- **Referral code wiring:** new helper `ensureReferralCode(uid)` reads `users/{customerId}.referralCode`; if absent, generates an 8-char uppercase alphanumeric (ambiguous chars 0/O/1/I/L excluded) and persists it via `setDoc(..., { merge: true })`. Loaded once per trip on a `useEffect`. Share button is disabled until the code is loaded.

**Caveats / not done in this change**
- The receiver-side tracking page at `jangoes.com/rd/<tripId>` doesn't exist yet — neither the web fallback nor the deep-link handoff to the installed app. The share URL is correctly per-trip but currently dead. Treat as a separate workstream.
- Existing default tracking layout (non-Exchange) untouched. The new branch is an early return gated on `serviceType === 'exchange'` AND status ∈ `EXCHANGE_ACTIVE_STATUSES`.
- Notification banner and cancellation modal are inlined in both branches (small JSX duplication). Acceptable; can be lifted into a wrapper later if churn warrants it.
- Status text simplifies multi-leg Exchange (going-to-receiver, returning) into a single "drop" state, per user direction.

**Files touched**
- `screens/customer/Tracking.tsx` — new helpers (`vehicleCategoryLabel`, `formatTripCrn`, `ensureReferralCode`, `buildExchangeShareMessage`); new state (`showDetails`, `referralCode`); referral-code load effect; new Exchange post-accept early-return branch with header, map, driver card, address card, View Details bottom sheet, Share-to-WhatsApp wiring.
- `docs/PROGRESS.md` — this entry.

---

## 2026-05-04 — `/api/driver-availability` diagnosis + fix

**Done**
- Diagnosed the "all categories returned 0" report. Root cause: a transient `14 UNAVAILABLE: Name resolution failed for target dns:firestore.googleapis.com:443` from Firebase Admin. The `try/catch` at `server.ts:311` swallowed the error and returned `{ counts: {} }`, which the frontend rendered as "No drivers nearby" on every vehicle — indistinguishable from a genuine zero-supply state.
- **`server.ts` (driver-availability endpoint):** on failure, now returns `503 { error: 'availability_unavailable', message }` instead of an empty-counts 200, so the client can tell a backend/network outage apart from "no drivers exist".
- **`server.ts` (same endpoint):** switched query from `where('role', '==', 'DRIVER')` to `where('roles', 'array-contains', 'DRIVER')`. The single-string `role` field is the *active view* (set by the login toggle and `App.tsx` `handleSwitchRole`); a driver who later switches view to Customer would have `role: 'CUSTOMER'` and silently disappear from availability counts despite being a fully-KYCed driver. The `roles` array is the durable enrollment signal.
- **`screens/customer/VehicleSelection.tsx`:** added `availabilityFailed` state, branched on `availResponse.ok`. On failure: subtitle changes to "Couldn't check driver availability", and the "No drivers nearby" amber badge is suppressed (since we don't actually know). The default vehicle still gets selected so booking isn't blocked. Vehicle gating was already disabled in the 2026-04-27 fix, so customers can still proceed regardless.

**Caveat / follow-up**
- The new compound query `(roles array-contains, kycCompleted ==)` likely needs a **Firestore composite index**. First request after server restart may fail with a console link — click it to auto-create the index, takes ~1 min.
- Dev server (`tsx server.ts`, no `--watch`) does **not** auto-reload server.ts changes. Restart `npm run dev` to pick up the endpoint changes. Vite HMR handles the `VehicleSelection.tsx` change automatically.

**Open questions**
- _(none — both carried-forward questions resolved this session, see Resolved)_

**Resolved**
- DLT template for post-QC handover OTP SMS — **decision: keep reusing the generic delivery-OTP template body**. Not registering a new DLT template for now.
- `/api/driver-availability` returning 0 — root cause was DNS failure to Firestore being silently swallowed. Fixed (see Done).

**Notes / drift**
- Three commits landed after the last PROGRESS entry but were not themselves logged: `36154d7` (add `docs/PRODUCT_SPECIFICATION.md`), `33fea34` (genericise client name in PRODUCT_SPECIFICATION), `76a68f8` (add reusable Claude Code prompt for replicating SearchLocation flow). All docs-only — no code drift.

**Files touched**
- `server.ts` — driver-availability query + error response shape
- `screens/customer/VehicleSelection.tsx` — `availabilityFailed` state, conditional subtitle and badge
- `docs/PROGRESS.md` — this entry

---

## 2026-04-27 — Upload-feedback polish + Driver Registration Exit button

**Done**
- **`ExchangeDetails.tsx`** (customer Exchange setup): added inline size-14 spinner tile + "Uploading…" caption for Product A and Product B reference photo uploads. Each product gets its own busy state (`uploadingA` / `uploadingB`) so the two upload buttons don't interfere with each other. Primary blue tint for Product A, emerald for Product B (matches each card's accent color). The "+" button hides during upload and reappears once finished. Failure path (`alert('Photo upload failed.')`) untouched. *(Commit `f46a103`)*
- **`RegistrationFlow.tsx`** (driver KYC): replaced the decorative `verified_user` shield in the header with a real **Exit** button (logout icon + "Exit" label). On click → `window.confirm` → `auth.signOut()` → navigate to `/auth`. The user's progress is preserved because the existing per-step `saveProgress()` writes (lines 300, 349, 394, 460, 538, 597, 679, 715, 1426) already commit `kycStep` + `kycData.*` to Firestore after each completed step; on next login the existing mount-time effect reads `kycStep` and resumes at the saved step. *(Commit `3708f15`)*
- **`ExchangeTrip.tsx`** (driver Exchange flow): added spinner feedback for the three remaining upload sites that previously gave no signal — Product A photo at PICKING_UP (placeholder card with primary-blue spinner), Product B photo at PICKING_UP_PRODUCT_B (emerald spinner), QC photos strip (size-16 inline tile matching existing thumbnail size, amber tint). Each gets its own busy state (`uploadingProductA`, `uploadingProductB`, `uploadingQc`) — separate from the shared `loading` flag used for status updates. *(Commit `e39ae83`)*
- Audited every other upload site in the codebase. ParcelDetails uses synchronous FileReader (no async to track). PendingVerification PAN re-upload is instant on select; the verify step has its own button-level spinner. RegistrationFlow doc OCR and vehicle bulk-upload already show "Verifying…" / "Uploading Images…" button spinners. ActiveTrip parcel image already has an overlay spinner. No further changes needed.

**In progress**
- _(none — all three follow-up fixes shipped and pushed)_

**Next**
- User testing the Driver Exchange flow end-to-end with the new upload feedback.
- Eventually: register a DLT template for the post-QC handover SMS so the body matches the desired text "Your exchange is completed, please share the OTP for new product delivery" (currently the receiver receives the existing generic delivery-OTP template body).

**Open questions**
- _(none new)_ — carrying forward from earlier today: (a) DLT template not yet registered for handover OTP, (b) `/api/driver-availability` should be diagnosed at some point to understand why all categories returned 0 in the user's environment.

**Notes / drift**
- Mid-step partial field state (e.g., user typed half their name in Step 1 but didn't click Next) is **not** preserved by the Exit button — they'll resume at the *start* of that step. Per-keystroke writes were considered out of scope; flag this if the resume-fidelity needs to improve.

**Files touched**
- `screens/customer/ExchangeDetails.tsx` — upload spinner + per-product busy state
- `screens/driver/RegistrationFlow.tsx` — header Exit button replacing decorative shield
- `screens/driver/ExchangeTrip.tsx` — upload spinners for Product A / Product B / QC strip
- `docs/PROGRESS.md` — this entry

---

## 2026-04-27 — Fix: vehicle selection no longer blocks customer when no drivers online

**Done**
- `VehicleSelection.tsx`: removed the hard `disabled` on vehicle cards and the secondary disable check on "Book Now". Cards stay informative (still show "X online" / "No drivers nearby" badges) but the customer can always pick a vehicle and proceed. The trip enters `SEARCHING` like normal — drivers can pick it up when they come online.

**Why this fix**
- User reported all vehicle options disabled in the Exchange booking flow. The disable logic isn't Exchange-specific — same gating applies to regular delivery. It fires when `/api/driver-availability` returns `0` for every `vehicleCategory`. That happens when (a) no drivers in Firestore have `kycCompleted=true` AND a `vehicleCategory` set, or (b) the API call fails and the catch in `VehicleSelection.tsx:57-61` swallows the error, leaving `availableCategories = {}`. Either way the UX of trapping the user is wrong — booking should proceed and queue.

**Open questions for follow-up**
- Worth diagnosing the underlying availability data on the user's environment: open the network tab on the Vehicle Selection screen, find the `/api/driver-availability` request, and check whether `counts` is empty. If it is, verify drivers in Firestore have `kycCompleted: true`, `disabled` not `true`, and a `vehicleCategory` matching `bike` / `car` / `tata-ace` / `bolero` / `tata-407` / `large-truck`.

**Files touched**
- `screens/customer/VehicleSelection.tsx`
- `docs/PROGRESS.md`

---

## 2026-04-27 — Exchange flow: post-QC handover OTP + 3-leg history + driver payouts wired

**Done**
- Committed in-flight Exchange work as baseline (`c4834d5`): customer ExchangeDetails (Product A/B + QC checklist + product cost), driver state machine (`ExchangeTrip.tsx`), Tracking QC review screen, driver GPS tracking, `/api/send-delivery-otp`, `/api/driver-info`, `/api/deduct-fare`, `/api/validate-fare`, Surepass KYC routes.
- **Req #1 (product cost on Exchange):** confirmed already done in `ExchangeDetails.tsx`.
- **Req #2 (OTP after sender QC approval):** removed early OTP send at `ARRIVED_AT_RECEIVER` and removed the OTP-verify block + Product A handover preview at receiver arrival. The OTP is now only sent when the customer approves QC (already wired in `Tracking.tsx` lines 282-289). Reusing existing `/api/send-delivery-otp` template per user direction (no new DLT template registered).
- **Req #3 (driver post-QC UI):** replaced `QC_APPROVED` screen with: heading "QC of product is approved. Now handover the new product" + Product A image preview + handover OTP input + "HANDOVER COMPLETED" button + "Resend OTP" link. On valid OTP → `RETURNING_PRODUCT_B`. Uses existing `dropoffOtp` field as the handover OTP.
- **Req #4 (3-leg history for Exchange):** `OrderHistory.tsx` was already wired to Firestore (auto-memory was stale). Added 3-leg display for `serviceType === 'exchange'` trips: Leg 1 (Pickup Product A), Leg 2 (Exchange at Receiver), Leg 3 (Return to Sender). Non-exchange trips keep the original 2-point pickup→drop view.
- **Req #5 (driver transaction/earning history):** rewrote `Payouts.tsx` from scratch. Now queries `trips where driverId == auth.uid`, filters `COMPLETED`/`EXCHANGE_COMPLETED`/`EXCHANGE_FAILED`, computes total/today/this-week earnings live, lists each trip as a transaction row with icon (swap for exchange, truck for delivery, amber for failed exchange). No transactions collection exists yet — earnings derived from trip fares.

**In progress**
- _(none — all five requested changes shipped)_

**Next**
- User testing of the new Exchange flow (post-QC handover OTP path) end-to-end.
- Eventually: register a DLT template that matches the desired SMS body "Your exchange is completed, please share the OTP for new product delivery" — currently the receiver receives the existing generic delivery-OTP template body.
- Eventually: real withdrawal/payout collection so Payouts can show "available balance" separately from "total earned".

**Open questions**
- _(none)_

**Files touched**
- `screens/driver/ExchangeTrip.tsx` — removed early receiver-OTP/handover; new QC_APPROVED handover screen
- `screens/shared/OrderHistory.tsx` — 3-leg display for exchange trips
- `screens/driver/Payouts.tsx` — full rewrite, Firestore-wired
- `docs/PROGRESS.md` — this entry

**Notes / drift from earlier PROGRESS**
- `OrderHistory.tsx` was listed as "hardcoded mocks" in earlier PROGRESS and auto-memory. **It's actually fully wired to Firestore already** — that note was stale. Auto-memory updated.

---

## 2026-04-27 — Session-sync system bootstrapped; current state snapshot

**Done**
- Created `CLAUDE.md` (project root) as session entry-point covering stack, architecture, conventions, gotchas, env, and pointers to docs.
- Created this `docs/PROGRESS.md` for daily logging.
- Created `docs/SESSION_START.md` with the paste-at-session-start prompt.
- Catalogued existing docs and flagged stale/duplicate ones (see "Open questions").

**Current project state (snapshot, not done-this-session)**

✅ **Working:**
- OTP login via voicensms.in (with demo-mode fallback when creds missing)
- Google Sign-In via Firebase
- Persistent session via Firebase custom token (UID = `phone_<10digits>`)
- First-time profile setup for OTP customers
- Customer `SearchLocation` with Google Places Autocomplete, draggable map picker, "Use Current Location", reverse geocoding (4-view flow)
- Customer `Tracking` screen with real Google Map + pickup/drop `AdvancedMarker`s
- Driver KYC `RegistrationFlow` — **all 8 steps complete**, nothing left in the registration process
- Driver `Dashboard` with real-time Firestore listener for `SEARCHING` trips
- Firestore security rules in production mode
- Fare calculation logic documented in `FARE_CALCULATION_LOGIC.md`

**In progress** (modified per `git status`, uncommitted)
- `screens/customer/ExchangeDetails.tsx`
- `screens/customer/SearchLocation.tsx`
- `screens/customer/Tracking.tsx`
- `screens/driver/ActiveTrip.tsx`
- `screens/driver/ExchangeTrip.tsx`
- `server.ts`
- `.claude/settings.local.json`

These belong to an in-flight **Exchange service** — a separate booking type alongside the regular delivery flow. Shape: a **two-way trip** where the driver delivers item A from sender to recipient, then picks up item B from recipient and returns it to sender. Still in flux, so deliberately not documented in `docs/project-specs.md` or `CLAUDE.md` yet — revisit once the screen names and booking shape stabilise. Recent commits (`3b6493f`, `ae7d5f6`) reference: Delivery OTP flow, product cost field, wallet redesign, exchange service fixes, driver decline persistence.

❌ **Pending / known gaps:**
- `OrderSummary.tsx` uses hardcoded pickup/drop/fare/vehicle — booking-flow state not threaded through screens
- `Wallet.tsx` simulated (local `useState`); not reading/writing `users/{uid}.walletBalance` from Firestore; no payment gateway
- `OrderHistory.tsx` shows hardcoded mock orders, not querying `trips` collection
- Driver `ActiveTrip`, `Payouts`, `Profile` — UI mostly there, not fully wired to Firestore
- Apple Sign-In — code in place, Firebase Apple provider not configured
- Driver live GPS on customer tracking map — not implemented
- Route polyline pickup→drop — not implemented
- Real payment gateway (Razorpay/Stripe) — not started
- Push notifications (FCM) — not started
- Parcel image upload to Firebase Storage — not wired
- Admin panel exists at `admin/` but state of completion is undocumented

**Next**
- Pick up the in-flight Exchange flow OR commit/document the current uncommitted changes before starting fresh work.

**Open questions**
- _(none — all six setup questions resolved 2026-04-27. See "Resolved" below.)_

**Resolved**
1. **"Laravel 5.4" / "GoDash/Zippyy"** — wrong-repo copy-paste in the original setup prompt. Not relevant to Jangoes Porter; do not track.
2. **Exchange service** — confirmed as a separate booking type, two-way trip (deliver A, return B). Still in flux — left out of `docs/project-specs.md` and `CLAUDE.md` deliberately; documented as a one-line note above. Revisit when the flow settles.
3. **Driver KYC** — all 8 steps complete; nothing left to build. Auto-memory `MEMORY.md` and `CLAUDE.md` §8 updated to reflect this. `driver-kyc-stage.md` was already current.
4. **`docs/MEMORY.md`** — deleted (stale duplicate of auto-memory).
5. **`claude_master_prompt.md`** at root — deleted (generic persona prompt, superseded by `CLAUDE.md` §10).
6. **`README.md`** — replaced with a real project README pointing at `CLAUDE.md`.

**Files touched**
- `CLAUDE.md` (created, then §8 KYC line updated)
- `docs/PROGRESS.md` (created, then refined as questions were answered)
- `docs/SESSION_START.md` (created)
- `README.md` (rewritten — was AI Studio boilerplate)
- `docs/MEMORY.md` (deleted)
- `claude_master_prompt.md` (deleted)
- Auto-memory: `~/.claude/projects/.../memory/MEMORY.md` — KYC section updated to "all 8 complete"