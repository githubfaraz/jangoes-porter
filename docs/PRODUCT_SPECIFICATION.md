# Product Specification — On-Demand Hyperlocal Logistics Platform

**Prepared for:** Prospective clients, partners, investors
**Document type:** Product overview & capability specification
**Last updated:** 2026-04-27

---

## 1. Executive Summary

**The Platform** is a mobile-first, AI-assisted on-demand logistics platform that connects customers with verified drivers across India. Customers book parcel pickups, returns, or two-way item exchanges in seconds; drivers accept matching jobs, complete them under a verified flow, and receive transparent earnings.

Where ride-hailing solved how people move, the Platform solves how *things* move — at the same speed and the same level of polish.

**Key facts**

| | |
|---|---|
| Category | On-demand logistics / hyper-local delivery |
| Primary market | India (initial focus: Delhi NCR) |
| Currency | INR |
| Form factors | Mobile-first responsive web app + native Android & iOS shells (via Capacitor) |
| Identity & auth | Phone OTP (DLT-compliant SMS) + Google Sign-In |
| Driver identity | Multi-document KYC with third-party verification (Surepass) and admin review |
| Payments | Wallet-first model; cash and online supported |
| AI capabilities | Parcel classification, fragility detection, weight estimation, conversational support |
| Mapping | Google Maps (Places, Geocoding, Directions, Distance Matrix) with live driver GPS |
| Status | Functional MVP with end-to-end booking, tracking, and exchange workflows live |

---

## 2. Product Vision

### The problem
Hyper-local logistics in India is fragmented. Customers either rely on informal porter networks with no accountability, or large couriers with rigid pickup windows and opaque pricing. Returning items, swapping items, or sending an unusual load is a particular gap.

### Our approach
Three commitments shape every screen of the Platform:

1. **One job, one flow.** Each step of a booking is a focused screen: choose locations, describe the parcel, pick a vehicle, confirm. No forms-within-forms, no scrolling through paperwork.
2. **Verified at every handoff.** Pickup PINs, delivery OTPs, KYC-verified drivers, and (for exchanges) sender-approved Quality Checks ensure both sides know exactly who they are dealing with at every step.
3. **Transparent pricing, in real time.** Fares are computed live from real road distance (Google Maps), vehicle base rates, weight, and time-of-day surcharges. The customer sees the breakdown before booking — every charge is itemised, including GST.

### Differentiators
- **Exchange service** — a true two-way trip (deliver Item A, return Item B) with sender-controlled Quality Check, an industry first for this segment in India.
- **AI-augmented booking** — Gemini classifies the parcel from a description and a photo; weight, fragility, and category are populated automatically.
- **Premium "Liquid Glass" interface** — a fintech-grade visual language differentiates the Platform from utilitarian competitors and signals trust to first-time users.
- **End-to-end driver verification** — eight-step KYC including Aadhaar OCR, PAN OCR, Driving License (Surepass), Vehicle RC, vehicle photographs, and selfie face-match.

---

## 3. Target Market

### Geography
- **Phase 1:** Delhi NCR (Delhi, Gurugram, Noida, Faridabad, Ghaziabad)
- **Phase 2:** Tier-1 metros (Mumbai, Bengaluru, Hyderabad, Chennai, Pune, Kolkata)
- **Phase 3:** Tier-2 expansion + inter-city long-haul

### Customer segments

| Segment | Use case | Vehicle preference |
|---|---|---|
| Individual senders | Documents, gifts, small parcels | Bike, Car |
| Small businesses (D2C, resellers) | Daily fulfilment, returns | Bike, Tata Ace |
| Households relocating | Furniture, appliances | Bolero, Tata 407 |
| Marketplace returns | Reverse logistics | Bike, Tata Ace |
| Buyer/seller swaps (resale, repair, replacement) | Exchange | Bike, Car, Tata Ace |
| Wholesale & SMEs | Bulk movement | Tata 407, Large Truck |

### Driver / partner segments

| Partner type | Vehicle class | Earnings model |
|---|---|---|
| Two-wheeler riders | Bike / Scooter | Per-trip + peak-hour incentives |
| Compact-vehicle owners | Car | Per-trip + bonus tiers |
| Tata Ace / Mini-truck operators | Mini Truck | Per-trip with weight surcharge share |
| Pickup / Bolero operators | Pickup Truck | Per-trip + waiting charges |
| 407 / large fleet operators | Medium / Large Truck | Per-trip + toll passthrough |

---

## 4. Service Catalogue

### 4.1 Parcels (standard delivery) — *Live*
A customer ships an item from a pickup point to a single drop-off. Driver collects, transports, hands over.

**Trust touchpoints:**
- 4-digit Pickup PIN displayed to customer; entered by driver to confirm collection
- Mandatory parcel photograph at pickup (shown to customer for verification)
- 4-digit Delivery OTP sent via SMS to receiver at trip start; entered by driver to confirm handover
- Live driver GPS on customer's tracking map throughout

### 4.2 Reverse Parcels (returns) — *Live*
A customer requests an item to be picked up from a third-party location (e.g., a marketplace seller's address) and returned to them. Inverts the standard direction.

### 4.3 Exchange — *Live (latest service)*
A two-way trip in a single booking. The driver:

1. Collects **Product A** from the sender (Leg 1).
2. Travels to the receiver's location.
3. Inspects **Product B** at the receiver, photographs it, and runs the QC checklist defined by the sender.
4. Submits Product B for **sender-side QC review** while still on-site.
5. On sender's approval → SMS-delivered handover OTP to receiver → driver hands over Product A → collects Product B (Leg 2 wrap).
6. Returns **Product B** to the sender (Leg 3) and confirms handover with the return OTP.

**Use cases:**
- Buyer-side returns/replacements (e.g., resale platforms, peer-to-peer exchanges)
- Repair drop-off with replacement pickup (e.g., phone, watch, electronics service centres)
- Document or asset swap requiring chain-of-custody

**Why this is unique:**
The sender retains *control of approval* until they have visually verified Product B. If the QC is rejected, the driver returns Product A safely and the trip is recorded as a graceful failure (no charge to the receiver, transparent record for both parties).

---

## 5. End-to-End User Journeys

### 5.1 Customer — Standard parcel booking
1. **Sign in** with phone OTP or Google.
2. **Pick locations** — Google Places autocomplete, draggable map picker, or "Use Current Location" with reverse geocoding.
3. **Describe parcel** — type a description and (optionally) photograph the item. Gemini AI auto-classifies category, fragility, and estimated weight.
4. **Confirm dimensions & declared value** — used for volumetric weight and insurance/liability.
5. **Choose vehicle** — see live fare breakdown for every vehicle class (base fare, distance, time, GST). "Best Value" badge highlights the recommended option.
6. **Confirm booking** — wallet-first payment if balance permits, otherwise cash or online.
7. **Track in real time** — live Google Map with pickup/drop markers, live driver GPS, status timeline, in-app chat, and tap-to-call.
8. **Confirm delivery** — receiver shares the SMS-delivered OTP with the driver. Customer rates the trip.

### 5.2 Customer — Exchange booking
Identical opening flow, branching at *Set up your exchange*:
1. Describe **Product A** (what you're sending) and **Product B** (what you expect back), each with category and reference photos.
2. Toggle **Quality Check** on and define a checklist (e.g., "Check screen for cracks", "Verify charger is included") — driver must verify each item on-site.
3. Pricing automatically reflects the roundtrip nature (1.8× standard fare, with the breakdown shown).
4. During the trip, the customer receives a **QC review screen** when the driver submits Product B's photo + checklist results from the receiver's location. Approve or reject with one tap.
5. On approval: delivery OTP is dispatched to the receiver's phone, the driver hands over Product A, collects Product B, and returns to the customer.

### 5.3 Driver — Job lifecycle
1. **Go online** from the dashboard (location permission required).
2. **Receive a job request** matched by vehicle category and proximity (5 km radius). One-tap Accept or Decline.
3. **Navigate to pickup**, mark "I have reached pickup", enter the 4-digit Pickup PIN, photograph the parcel.
4. **Start the trip** → live GPS streams to customer every 10 seconds.
5. **At destination**: confirm delivery OTP from receiver, mark complete.
6. **Earnings credited instantly** (visible in Payouts), reflecting trip fare plus any waiting/loading charges.

For **Exchange jobs**, the driver's flow extends with the QC submission and post-approval handover steps described in §4.3.

### 5.4 Driver — Onboarding (KYC)
An eight-step verification flow with progress saved at every step (resume-on-return supported, including a dedicated **Exit** button that signs the user out without losing progress).

| Step | Document / Action | Verification method |
|---|---|---|
| 1 | Full legal name | Manual entry, used as match key |
| 2 | Aadhaar Front | OCR + name match against Step 1 |
| 3 | Aadhaar Back | OCR for address |
| 4 | PAN Card | OCR + name match against Aadhaar |
| 5 | Driving License | Surepass API verification + expiry check |
| 6 | Vehicle RC | Surepass RC verification + vehicle category selection |
| 7 | Vehicle Photographs | 3–6 photographs (front, back, side) |
| 8 | Selfie | Live capture or upload, face-match against Aadhaar photo |

After completion, the dashboard remains locked behind admin verification for any document flagged as `pending_review`. The driver sees a clear "documents under review" banner; admins approve or request re-upload via the admin panel. Re-upload flows are built in for rejected documents.

---

## 6. Pricing & Fare Engine

A complete description of the fare model is in [`FARE_CALCULATION_LOGIC.md`](../FARE_CALCULATION_LOGIC.md). Summary below.

### 6.1 Vehicle catalogue (Delhi rates, 2025)

| Vehicle | Capacity | Base fare (first 4 km) | Per-km after 4 km | Minimum fare |
|---|---|---|---|---|
| Bike | up to 20 kg | ₹60 | ₹8 / km | ₹60 |
| Tata Ace (Mini Truck) | up to 750 kg | ₹220 | ₹22 / km | ₹220 |
| Bolero Pickup | up to 1,500 kg | ₹380 | ₹28 / km | ₹380 |
| Tata 407 | up to 2,500 kg | ₹580 | ₹38 / km | ₹580 |
| Large Truck (14 ft) | up to 4,000 kg | ₹900 | ₹55 / km | ₹900 |

### 6.2 Fare formula

```
Fare = Base Fare
     + Distance Charge       [(Road KM − 4) × Per-km Rate]
     + Weight Surcharge      [(Extra KG above free allowance) × ₹6]
     + Time-of-Day Surcharge [Base + Distance × 20% (peak) or 25% (night)]
     + Waiting Charge        [(Wait Mins − Free Mins) × Per-min Rate]
     + Toll Charges          [Actual, passed through at cost]
─────────────────────────────────────────────────────────────────────
       Subtotal              [Minimum Fare floor applies]
     + GST 5% (SAC 9965)
─────────────────────────────────────────────────────────────────────
     = TOTAL FARE shown to customer
```

**Distance** uses the Google Maps Distance Matrix API for actual road distance (not as-the-crow-flies), with a Haversine × 1.4 fallback if the API is unavailable.

**Time-of-day surcharge windows:**
- 🌙 Night (22:00 – 06:00): +25% on Base + Distance
- ⏰ Peak (08:00 – 11:00 and 18:00 – 21:00): +20% on Base + Distance
- Outside windows: no surcharge

### 6.3 Exchange pricing
Exchange trips apply a **1.8× roundtrip multiplier** on the calculated fare, reflecting the additional travel and the on-site QC time. Customers see this clearly labelled in the fare breakdown.

### 6.4 Server-side fare validation
Every booking is independently fare-checked on the server before it is created. The server recomputes the fare from authoritative rates (configurable via the admin panel), compares against the client-quoted fare, and only persists the booking if the difference is within tolerance. This prevents tampering and protects margins.

---

## 7. Trust, Safety & Compliance

### 7.1 Customer trust
- Every booking has a unique 4-digit Pickup PIN and 4-digit Delivery OTP.
- Customer always sees the driver's verified name, vehicle, RC number, photo, and average rating before pickup.
- Live GPS tracking from the moment the driver accepts.
- In-app chat and tap-to-call for both sender and receiver.
- Cancellation reasons captured for both customer and driver.

### 7.2 Driver trust
- Sender details, receiver details, and the parcel image are all surfaced clearly.
- The pickup PIN must be entered correctly to start the trip — protects against wrong-address pickups.
- Waiting time is tracked from arrival to handover and compensated automatically.
- Disabled / suspended accounts are notified clearly with a path to support.

### 7.3 Identity & data
- All driver KYC documents are verified through **Surepass** (NSDL/UIDAI partner).
- Aadhaar/PAN/DL name fields are normalised and exact-matched to prevent mismatched identities.
- Document images are stored encrypted; only admins with role-based access can view them.
- OTP delivery is via DLT-registered templates through `voicensms.in`.
- Authentication uses Firebase custom tokens issued by a server holding the only writable copy of the Firebase Admin private key.

### 7.4 GST & invoicing
- All fares are GST-inclusive (5%, SAC 9965 — Goods Transport by Road).
- The fare breakdown shows GST as a separate line.
- Foundation laid for GST-compliant automated invoicing (Phase 3 roadmap).

### 7.5 Admin controls
The admin panel includes:
- Driver verification & document approval / rejection
- Vehicle rate configuration (per-vehicle base, per-km, per-minute, GST %, surge windows)
- Driver activation / deactivation
- Customer support tooling
- (Roadmap) Trip dispute resolution, payout configuration, dashboards

---

## 8. Technology Foundation

A high-level summary suitable for technical due diligence; not a code-level spec.

| Layer | Technology |
|---|---|
| Frontend (web + mobile) | React 19 (Strict Mode), TypeScript, Vite |
| Routing | HashRouter (universal across web, Android WebView, iOS WebView) |
| Native shells | Capacitor 8 (Android, iOS) — same JS bundle, native chrome |
| Styling | Tailwind CSS, custom "Liquid Glass" theme, Material Symbols icons |
| Backend | Express 5 (Node.js, TypeScript via tsx) |
| Authentication | Firebase Auth (phone-OTP custom tokens, Google OAuth) |
| Database | Cloud Firestore with production security rules (per-user / per-trip access) |
| Storage | Firebase Storage + Cloudinary (for hot media — parcel photos, KYC documents) |
| Maps | Google Maps Platform (Maps JS, Places, Geocoding, Distance Matrix, Directions) |
| AI | Google Gemini (`gemini-3-flash-preview`, `gemini-flash-lite-latest`) |
| KYC verification | Surepass API (Aadhaar OCR, PAN OCR, DL, RC, face-match) |
| SMS | voicensms.in (DLT-compliant) |
| Hosting | Cloud-native; production-ready for any Node-compatible platform (currently designed for Express + static dist on a single instance) |

**Architectural posture:**
- Single codebase for web, Android, iOS — minimises maintenance overhead
- Real-time everywhere: Firestore listeners drive the UI, no polling
- Server-side validation on fares, custom-token issuance, KYC proxying — sensitive paths are not client-trusted
- Firebase Cloud Messaging readiness for future push notifications

---

## 9. Brand & Visual Identity

The Platform's interface uses a custom design system named **"Liquid Glass & Aero-Mesh"**:

- High-vibrancy light theme with animated mesh gradients (blue / purple / green)
- Frosted-glass containers, soft shadows, large rounded corners (24–40 px)
- Custom green gradient (`#78AA64 → #96C882`) signalling growth and reliability
- Material Symbols Outlined for iconography (variable font for crisp rendering at any size)
- Mobile-first 448 px max-width with bottom navigation; bottom nav contextually hidden during focus flows (booking funnel, KYC, active trip)
- Dark mode supported

The visual language is a deliberate departure from utilitarian logistics interfaces — the Platform presents as fintech-grade, building trust with first-time users and supporting premium pricing positioning.

---

## 10. Current Status

### 10.1 Live in the current build

| Capability | Status |
|---|---|
| Phone OTP login (DLT-compliant SMS, demo-mode fallback) | Live |
| Google Sign-In | Live |
| Persistent session (stable Firebase UID per phone number) | Live |
| First-time profile setup for OTP customers | Live |
| Customer location flow (Places, map picker, current location, reverse geocoding) | Live |
| Real-time customer Tracking (live driver GPS, status timeline, chat, call) | Live |
| Customer Order History (Firestore-driven, 3-leg display for Exchange) | Live |
| Customer Wallet UI (balance, top-up flow) | Live (UI; payment gateway pending) |
| Standard Parcel booking → delivery → rating | Live |
| Reverse Parcel booking | Live |
| **Exchange booking with QC + post-approval handover OTP** | **Live (latest)** |
| Driver KYC (8-step Aadhaar / PAN / DL / RC / Vehicle / Selfie + Surepass) | Live |
| Driver Dashboard with real-time matched job requests | Live |
| Driver Active Trip with PIN/OTP enforcement, parcel photo, GPS streaming | Live |
| Driver Payouts (live earnings query, daily/weekly aggregation, transaction list) | Live |
| Driver Exit-and-Resume during KYC | Live |
| AI parcel classification (description + photo) | Live |
| AI-powered logistics support chat | Live |
| Server-side fare validation | Live |
| Admin panel (driver verification, fare config, customer/driver views) | Live |
| Production Firestore security rules | Live |

### 10.2 On the roadmap

**Phase 1 — Verification & Safety enhancements**
- Real-time face-match between selfie and Aadhaar photo (foundation in place)
- "End-of-Trip" delivery photograph analysed by AI
- Push notifications via Firebase Cloud Messaging
- Real payment gateway integration (Razorpay or Stripe)
- Apple Sign-In activation

**Phase 2 — Live Logistics**
- Voice-activated booking (e.g., "send a laptop from home")
- Multi-stop route optimisation for premium-tier drivers
- Real-time traffic-aware ETA adjustments

**Phase 3 — Enterprise & Scale**
- Bulk shipping dashboard for SMEs
- GST-compliant automated invoicing
- Inter-city trucking with Veo-powered condition reporting
- Fleet management for partnered logistics companies

---

## 11. Operational Model

### Driver acquisition
- Self-serve onboarding through the app — no field agent required for most drivers
- KYC fully digital; Surepass verification means most documents return verified status within seconds
- Manual review queue for ambiguous cases (typically PAN or DL with marginal name matches)

### Fleet composition (target mix)
- 60% two-wheelers (Bike) — highest demand for documents and small parcels
- 25% Mini Truck (Tata Ace)
- 10% Pickup (Bolero) and Medium Truck (Tata 407)
- 5% Large Truck (specialty / pre-booked)

### Unit economics philosophy
- Customer-facing fare = driver payout + platform commission + GST passthrough
- Commission tier configurable per vehicle category (admin)
- Surge windows (peak / night) split as configured between platform and driver
- Wallet-first payments improve liquidity and reduce COD risk

---

## 12. Engagement Options

> *Placeholder — to be tailored to the specific client conversation.*

We welcome engagement under any of the following models:

- **White-label deployment** — the Platform rebranded for your brand, deployed on your infrastructure, with custom geography and fare configuration.
- **API / aggregator integration** — Use the Platform as the fulfilment layer for your existing customer-facing app or marketplace.
- **Joint venture** — Co-launch in a new market with shared operations and revenue.
- **Strategic investment** — Equity participation in the Platform's expansion roadmap.

---

## 13. Glossary

| Term | Meaning |
|---|---|
| **KYC** | Know Your Customer — driver document verification |
| **OTP** | One-Time Password — 4-digit code sent via SMS for pickup, delivery, or handover confirmation |
| **PIN** | Pickup PIN — 4-digit code shown to the customer; entered by driver at pickup |
| **QC** | Quality Check — sender-defined verification of Product B before exchange handover |
| **Product A / Product B** | In an Exchange trip, A is the item being sent, B is the item expected in return |
| **DLT** | Distributed Ledger Technology (TRAI mandate for Indian SMS templates) |
| **SAC 9965** | Service Accounting Code for Goods Transport by Road (GST classification) |
| **Surepass** | KYC verification provider used for Aadhaar / PAN / DL / RC checks |
| **Liquid Glass** | The Platform's design system — frosted glass on aero-mesh gradients |

---

## 14. Reference Documents

For deeper detail on specific subsystems:

- [`FARE_CALCULATION_LOGIC.md`](../FARE_CALCULATION_LOGIC.md) — full fare formula with worked examples
- [`docs/architecture-decisions.md`](architecture-decisions.md) — design and technology rationale
- [`docs/api-integration.md`](api-integration.md) — integration patterns with Gemini and Google Maps
- [`docs/idea-inbox-mvp-roadmap.md`](idea-inbox-mvp-roadmap.md) — extended roadmap context

---

*The Platform is built and operated with a long-term commitment to driver welfare, customer trust, and operational excellence. We welcome the opportunity to discuss how it can serve your goals.*
