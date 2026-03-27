# Jangoes Porter — Project Specifications & Development Status

_Last updated: 2026-03-03_

---

## 1. Project Overview

**Jangoes** is a mobile-first web application for parcel/logistics delivery, operating similarly to Uber but for packages. It connects customers who need to send parcels with nearby drivers who own commercial vehicles.

- **Target Market:** India (phone number login, INR currency, India-restricted map search)
- **App URL (dev):** `http://localhost:3000`
- **Firebase Project:** `jangoes-porter`
- **UI Style:** Mobile-first, max-width 448px (md), dark mode supported

---

## 2. Tech Stack

### Frontend
| Package | Version | Purpose |
|---|---|---|
| React | 19.2.3 | UI framework |
| TypeScript | ~5.8.2 | Type safety |
| Vite | ^6.2.0 | Build tool |
| react-router-dom | 6.28.0 | Client-side routing (HashRouter) |
| @vis.gl/react-google-maps | latest | Google Maps integration |
| firebase | ^12.10.0 | Auth + Firestore + Storage |
| @google/genai | 1.3.0 | Gemini AI features |

### Backend (server.ts)
| Package | Version | Purpose |
|---|---|---|
| express | ^5.2.1 | HTTP server |
| tsx | ^4.21.0 | Run TypeScript directly |
| firebase-admin | latest | Custom token generation |
| axios | ^1.13.6 | SMS API calls |
| dotenv | ^17.3.1 | Environment variables |

### External Services
| Service | Usage |
|---|---|
| Firebase Auth | Custom token auth (OTP), Google OAuth |
| Firebase Firestore | Database |
| Firebase Storage | File/image storage |
| Google Maps JS API | Interactive maps, Places Autocomplete, Geocoding |
| voicensms.in | OTP SMS delivery (India) |
| Google Gemini AI | Parcel classification, logistics support chat |

---

## 3. Project Structure

```
jangoes-porter/
├── server.ts               # Express backend (OTP, SMS, Vite middleware)
├── App.tsx                 # Root component, routing, auth guards
├── index.tsx               # React entry point, APIProvider wrapper
├── types.ts                # TypeScript interfaces (UserRole, Trip, BookingStatus)
├── constants.tsx           # SERVICES array and other constants
├── vite.config.ts          # Vite config
├── .env                    # All environment variables
├── src/
│   └── firebase.ts         # Firebase app init (auth, db, storage exports)
├── services/
│   └── geminiService.ts    # Gemini AI functions
├── screens/
│   ├── AuthScreen.tsx      # Login screen (OTP + Google)
│   ├── OTPScreen.tsx       # OTP verification screen
│   ├── customer/
│   │   ├── Home.tsx        # Customer home dashboard
│   │   ├── SearchLocation.tsx  # Pickup/drop location flow
│   │   ├── ParcelDetails.tsx   # Parcel description & photo
│   │   ├── ParcelDimensions.tsx # Size & weight input
│   │   ├── VehicleSelection.tsx # Choose vehicle type
│   │   ├── OrderSummary.tsx    # Final booking confirmation
│   │   ├── Tracking.tsx        # Live order tracking
│   │   ├── Wallet.tsx          # Wallet & top-up
│   │   ├── Profile.tsx         # Customer profile & edit
│   │   └── Services.tsx        # All services listing
│   ├── driver/
│   │   ├── Dashboard.tsx       # Driver home, trip requests
│   │   ├── RegistrationFlow.tsx # KYC wizard (5 steps)
│   │   ├── ActiveTrip.tsx      # Active trip management
│   │   ├── Payouts.tsx         # Earnings & payouts
│   │   └── Profile.tsx         # Driver profile
│   └── shared/
│       ├── SetupProfile.tsx    # First-time name entry (OTP users)
│       ├── ChatScreen.tsx      # In-trip chat
│       ├── HelpSupport.tsx     # Help & Gemini AI support
│       └── OrderHistory.tsx    # Order activity history
```

---

## 4. Authentication System

### OTP Phone Login
**Flow:**
1. `AuthScreen` → user selects role (Customer/Driver), enters 10-digit phone
2. POST `/api/auth/send-otp` → server generates 4-digit OTP, stores in memory (3 min TTL), sends via voicensms.in
3. `OTPScreen` → user enters OTP
4. POST `/api/auth/verify-otp` → server verifies, generates Firebase custom token with `uid = phone_XXXXXXXXXX`
5. Client calls `signInWithCustomToken(auth, token)` → stable Firebase session
6. Firestore document created at `users/{uid}` if new user

**SMS Payload (voicensms.in):**
```json
{
  "filetype": 1,
  "language": 0,
  "credittype": 2,
  "senderid": "JANGOE",
  "templateid": 79178,
  "ukey": "...",
  "isrefno": true,
  "dlttemplateid": 79178,
  "msisdnlist": [{ "phoneno": "9XXXXXXXXX", "arg1": "XXXX" }]
}
```

**Demo mode:** If SMS credentials missing/invalid, OTP is returned in API response (shown in browser alert for testing).

### Google Login
- Uses `signInWithPopup(auth, GoogleAuthProvider)`
- Name, email, photoURL saved to Firestore on first login
- Skips `SetupProfile` screen (name already available)

### Apple Login
- Code implemented in `AuthScreen.tsx` using `OAuthProvider('apple.com')`
- **NOT YET ACTIVE** — Firebase Apple Sign-In not configured in Firebase Console

---

## 5. Routing & Guards (App.tsx)

```
Not logged in:
  /auth         → AuthScreen
  /otp          → OTPScreen
  *             → redirect /auth

Logged in (Customer, profile incomplete):
  /setup-profile → SetupProfile
  *              → redirect /setup-profile

Logged in (Customer, profile complete):
  /home         → CustomerHome
  /services     → Services
  /search       → SearchLocation
  /parcel-details → ParcelDetails
  /parcel-dimensions → ParcelDimensions
  /vehicles     → VehicleSelection
  /summary      → OrderSummary
  /tracking     → Tracking
  /wallet       → CustomerWallet
  /profile      → CustomerProfile
  /help, /chat, /activity → shared screens

Logged in (Driver, KYC incomplete):
  /registration → RegistrationFlow
  *             → redirect /registration

Logged in (Driver, KYC complete):
  /dashboard    → DriverDashboard
  /payouts      → DriverPayouts
  /active-trip  → ActiveTrip
  /profile      → DriverProfile
  /help, /chat, /activity → shared screens
```

**Bottom Nav** is hidden on: `/parcel-details`, `/parcel-dimensions`, `/vehicles`, `/summary`, `/tracking`, `/search`, `/registration`, `/active-trip`, `/services`, `/auth`, `/otp`, `/setup-profile`

---

## 6. Firestore Data Schema

### `users/{uid}`
```typescript
{
  name: string,           // Set in SetupProfile or from Google
  email?: string,         // Google users only
  phoneNumber?: string,   // 10-digit, OTP users
  photoURL?: string,      // Google profile photo URL
  role: 'CUSTOMER' | 'DRIVER',
  kycCompleted: boolean,  // Driver only
  kycTimestamp?: string,  // Driver only
  walletBalance: number,  // Default 0
  createdAt: string       // ISO timestamp
}
```

### `trips/{tripId}`
```typescript
{
  customerId: string,
  driverId?: string,
  pickup: { address: string, lat: number, lng: number },
  dropoff: { address: string, lat: number, lng: number },
  status: BookingStatus,  // See enum below
  fare: number,
  vehicleType: string,
  pickupPin: string,      // 4-digit PIN shown to customer at pickup
  dropoffOtp: string,     // OTP for delivery confirmation
  parcelImageUrl?: string,
  senderName: string,
  receiverName: string,
  receiverPhone: string,
  createdAt: Timestamp,
  acceptedAt?: string,
  updatedAt?: string
}
```

### BookingStatus Enum
`SEARCHING → ACCEPTED → ARRIVED_AT_PICKUP → PICKING_UP → IN_TRANSIT → ARRIVED_AT_DESTINATION → DROPPING_OFF → COMPLETED | CANCELLED`

### Firestore Security Rules
```
users/{userId}: read/write if auth.uid == userId
trips/{tripId}: read/write if auth.uid == customerId OR driverId; create if authenticated
```

---

## 7. Google Maps Integration

**Library:** `@vis.gl/react-google-maps`
**APIProvider:** Wraps entire app in `index.tsx` with `libraries={['places']}`

### Enabled Google APIs Required
- Maps JavaScript API
- Places API
- Geocoding API
- Directions API (for future route drawing)

### SearchLocation Screen — 4 Views
1. **route_summary** — shows pickup/drop inputs
2. **search_selection** — Google Places Autocomplete (India-restricted), recent locations
3. **map_picker** — interactive `<Map>` with fixed center pin, reverse geocoding on drag & on open
4. **details_form** — sender name, mobile, save address type

### Features Implemented
- Real-time Places Autocomplete (biased to user's location within 50km)
- "Use Current Location" → browser geolocation → reverse geocode → real address
- "Locate on Map" → draggable map, address updates as pin moves
- All selected addresses include real `lat`/`lng` coordinates

### Tracking Screen
- Real Google Map showing pickup (blue) and drop (red) `AdvancedMarker`s
- Map center defaults to trip's pickup coordinates

---

## 8. Gemini AI Features (services/geminiService.ts)

| Function | Model | Purpose |
|---|---|---|
| `getLogisticsSupport(query)` | gemini-3-flash-preview | Chatbot in HelpSupport screen |
| `classifyParcel(desc, images?)` | gemini-3-flash-preview | Auto-classify parcel category, fragility, weight from description + optional photos |
| `searchPlaces(query, lat?, lng?)` | gemini-flash-lite-latest | Legacy place search (replaced by Google Maps Places API in SearchLocation) |

---

## 9. Backend API (server.ts)

**Port:** 3000
**Mode:** In development, serves Vite middleware. In production, serves `dist/` static files.

### Endpoints

#### `POST /api/auth/send-otp`
- Body: `{ mobile: string }` (10-digit)
- Validates phone format
- Generates 4-digit OTP, stores in Map with 3-min TTL
- Sends via voicensms.in or falls back to demo mode
- Returns: `{ success: true }` or `{ success: true, demo: true, otp: string }`

#### `POST /api/auth/verify-otp`
- Body: `{ mobile: string, otp: string }`
- Validates OTP against store
- On success: creates Firebase custom token via Admin SDK with `uid = phone_${mobile}`
- Returns: `{ success: true, token: string }` (Firebase custom token)

---

## 10. Feature Status

### ✅ Fully Working
- OTP SMS login (voicensms.in)
- Google Sign-In
- First-time profile setup (name entry)
- Persistent login (custom token → same UID per phone number)
- Customer home screen with real name & avatar
- Customer profile screen (read + edit → Firestore)
- SearchLocation with Google Maps (Places Autocomplete, map picker, reverse geocoding, current location)
- Tracking screen with real Google Map + pickup/drop markers
- Driver KYC registration flow (5 steps, sets `kycCompleted` in Firestore)
- Driver dashboard with real-time Firestore trip request listener
- Firebase custom token authentication
- Firestore security rules (production mode)

### ⚠️ UI Complete but Not Wired to Backend
| Screen | Issue |
|---|---|
| `OrderSummary.tsx` | Hardcoded pickup/drop/fare/vehicle — not reading from SearchLocation/VehicleSelection state |
| `Wallet.tsx` | Simulated balance (useState) — not reading/writing `walletBalance` from Firestore, no payment gateway |
| `OrderHistory.tsx` | Hardcoded mock orders — not fetching from Firestore `trips` collection |
| `Driver/ActiveTrip.tsx` | Needs wiring to accepted trip from Firestore |
| `Driver/Payouts.tsx` | Hardcoded earnings UI |
| `Driver/Profile.tsx` | May still have hardcoded values |
| `HelpSupport.tsx` | Gemini chatbot — needs verification it's working with current API key |

### ❌ Not Implemented
- Apple Sign-In (code exists, Firebase not configured)
- Driver live GPS location on customer tracking map
- Route polyline between pickup and drop on map
- Real payment gateway (Razorpay / Stripe)
- Push notifications
- Parcel image upload to Firebase Storage
- Admin panel

---

## 11. State Flow — Customer Booking

```
/home → [Book Now]
  → /search (SearchLocation)
      → Select pickup (Places/Map/Current Location) + details form
      → Select drop (Places/Map) + details form
      → [Confirm And Proceed]
  → /parcel-details (ParcelDetails)
      → Describe parcel, optional photo, Gemini auto-classify
  → /parcel-dimensions (ParcelDimensions)
      → Weight, dimensions input
  → /vehicles (VehicleSelection)
      → Choose vehicle type & see fare estimate
  → /summary (OrderSummary)
      → Review all details
      → [Confirm Booking] → writes Trip to Firestore with status=SEARCHING
  → /tracking (Tracking)
      → Real-time Firestore listener on trip document
      → Shows Google Map with markers
      → Shows driver info when status ≠ SEARCHING
```

**⚠️ Gap:** Data is NOT being passed between screens via state/context. Each screen has its own local state. OrderSummary creates a trip with hardcoded values instead of using selected addresses/vehicle/fare from previous steps.

---

## 12. Environment Variables Reference

```env
# SMS (voicensms.in)
SMS_UKEY=...
SMS_SENDER=JANGOE
SMS_TEMPLATE_ID=79178
SMS_DLT_TEMPLATE_ID=79178
SMS_CREDIT_TYPE=2

# Firebase Admin SDK (server-side)
FIREBASE_PROJECT_ID=jangoes-porter
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@jangoes-porter.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Google Maps (client-side, Vite exposes VITE_ prefix)
VITE_GOOGLE_MAPS_API_KEY=...

# Firebase (client-side)
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=jangoes-porter.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=jangoes-porter
VITE_FIREBASE_STORAGE_BUCKET=jangoes-porter.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

---

## 13. Next Development Priorities (Suggested)

1. **Wire booking flow state** — Pass pickup/drop/vehicle/fare through screens using React Context or router state so OrderSummary creates trips with real data
2. **OrderHistory from Firestore** — Query `trips` where `customerId == auth.uid`
3. **Wallet from Firestore** — Read `walletBalance` from user doc, integrate payment gateway
4. **Driver live location** — Driver writes GPS coords to Firestore, customer tracking screen reads them
5. **Route polyline** — Draw path between pickup and drop using Google Directions API
6. **Apple Sign-In** — Configure in Firebase Console + Apple Developer account
7. **Push notifications** — Firebase Cloud Messaging for trip updates
