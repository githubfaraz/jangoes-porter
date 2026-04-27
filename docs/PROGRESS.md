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