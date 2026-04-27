# Reusable Prompt — Pickup/Drop Location Selection Flow

> Copy everything inside the fenced block below and paste it as a Claude Code prompt in any project where you want to recreate this app's pickup/drop location-selection flow.

---

````text
Build a complete pickup/drop location selection flow for a customer-side delivery/logistics app. Match the design and behavior described below exactly. Implement it as a single screen component that internally switches between four views using local state.

## Tech stack requirements

- React 18+ or 19 with TypeScript
- React Router v6+ (HashRouter or BrowserRouter — either works)
- Tailwind CSS for styling
- Material Symbols Outlined icon font
- `@vis.gl/react-google-maps` (v1.7+) for the Google Maps integration

If any of these are missing, install / configure them first. Do not silently substitute different libraries.

## One-time setup

1. Install the maps library:

   ```
   npm install @vis.gl/react-google-maps
   ```

2. In `.env`, add a Google Maps Platform API key with **Maps JavaScript API**, **Places API**, and **Geocoding API** enabled:

   ```
   VITE_GOOGLE_MAPS_API_KEY=your_key_here
   ```

3. In your app entry (e.g. `index.tsx`), wrap `<App />` in the API provider, requesting the Places library:

   ```tsx
   import { APIProvider } from '@vis.gl/react-google-maps';

   <APIProvider
     apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
     libraries={['places']}
   >
     <App />
   </APIProvider>
   ```

4. In `index.html` `<head>`, ensure the Material Symbols font is loaded:

   ```html
   <link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Symbols+Outlined" />
   ```

5. Confirm your Tailwind config defines a `primary` color (any brand blue or green works). The component uses `bg-primary`, `text-primary`, etc. throughout.

## Component contract

### File location
`screens/customer/SearchLocation.tsx` (or wherever your customer screens live).

### Inputs — read from `useLocation().state`
- `serviceType?: string` — optional. Used only to decide the next route after both addresses are picked.

### Outputs — navigate to next route with state
- After both pickup and drop are confirmed, navigate to the next screen (default `/parcel-details`) passing `{ pickup, drop, serviceType }` in the router state.

### Address data shape

```typescript
interface AddressDetails {
  title: string;     // Short label — usually the street name or business name
  address: string;   // Full formatted address from Google
  building: string;  // Optional flat / apartment / building number
  name: string;      // Sender's or Receiver's full name
  mobile: string;    // 10-digit mobile (digits only, max 10 chars)
  type: 'Home' | 'Work' | 'Other' | null;
  lat?: number;      // Geocoded latitude
  lng?: number;      // Geocoded longitude
}
```

## State machine — four views

The component has a single `view` state that switches between:

1. **`route_summary`** — entry view. Shows pickup and drop slots; tap either to start setting it.
2. **`search_selection`** — Google Places autocomplete search + Current Location + Choose on Map shortcuts + recent / saved addresses.
3. **`map_picker`** — full-screen interactive map with a fixed center pin and live reverse-geocoded address as the user drags.
4. **`details_form`** — building, name, mobile, save-as tag.

Plus a separate `activeEditing: 'pickup' | 'drop'` state tracking which slot is being edited.

Transitions:

| From | Action | To |
|---|---|---|
| `route_summary` | Tap pickup or drop slot | `search_selection` (with `activeEditing` set) |
| `search_selection` | Type ≥3 chars | (in-place — show autocomplete results) |
| `search_selection` | Tap a search result | (geocode placeId) → `details_form` |
| `search_selection` | Tap "Current Location" | (reverse-geocode user coords) → `details_form` |
| `search_selection` | Tap "Choose on Map" | `map_picker` |
| `map_picker` | Drag map | (reverse-geocode new center, update displayed address) |
| `map_picker` | Tap "Confirm Location" | `details_form` |
| `map_picker` | Tap back arrow / "Search" link | `search_selection` |
| `details_form` | Tap close | `search_selection` |
| `details_form` | Tap "Change" on the address chip | `search_selection` |
| `details_form` | Tap "Confirm And Proceed" | `route_summary` (saves to pickup or drop based on activeEditing) |
| `route_summary` | Both set + tap "Confirm And Proceed" | navigate to next route (e.g. `/parcel-details`) |

## Hooks and refs (top of component)

```tsx
const navigate = useNavigate();
const routeLocation = useLocation();
const serviceType = (routeLocation.state as any)?.serviceType || 'parcels';

const [view, setView] = useState<ViewState>('route_summary');
const [activeEditing, setActiveEditing] = useState<'pickup' | 'drop'>('pickup');

const [pickup, setPickup] = useState<AddressDetails | null>(() => {
  const saved = localStorage.getItem('LAST_PICKUP_ADDRESS');
  return saved ? JSON.parse(saved) : null;
});
const [drop, setDrop] = useState<AddressDetails | null>(null);

const [tempAddress, setTempAddress] = useState<Partial<AddressDetails>>({});
const [searchQuery, setSearchQuery] = useState('');
const [searchResults, setSearchResults] = useState<any[]>([]);
const [isSearching, setIsSearching] = useState(false);
const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);

const placesLib = useMapsLibrary('places');
const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
const geocoderRef = useRef<google.maps.Geocoder | null>(null);
const [mapCenter, setMapCenter] = useState<google.maps.LatLngLiteral>({
  lat: 28.6139, lng: 77.2090, // Default — change to your city
});
const [mapAddress, setMapAddress] = useState('Locating...');
```

## Behaviors

### 1. Geolocation on mount
On mount, ask the browser for `navigator.geolocation.getCurrentPosition` and stash the coords in `userLoc`. Use these to:
- Bias the Places autocomplete toward the user's area (50 km radius)
- Set the initial map center
- Power the "Use Current Location" shortcut

### 2. Initialize Google services when Places loads
```tsx
useEffect(() => {
  if (!placesLib) return;
  autocompleteService.current = new placesLib.AutocompleteService();
  geocoderRef.current = new google.maps.Geocoder();
}, [placesLib]);
```

### 3. Places autocomplete — debounced search with lat/lng fallback
- 400 ms debounce
- Only fire when `searchQuery.length >= 3`
- **Special case:** if the input matches `^lat,lng$` (e.g. `28.6139, 77.2090`), call `geocoder.geocode({ location: { lat, lng } })` instead of Places. This lets users paste raw coordinates.
- Restrict results to country code `'in'` (change to your country) using `componentRestrictions: { country: 'in' }`
- If `userLoc` is set, pass `location` and `radius: 50000` to bias results
- Result shape stored in `searchResults`: `{ id, title, address, placeId }` where `title = main_text` and `address = secondary_text`

### 4. Selecting a search result
On tap:
- If the result is a lat/lng result (no `placeId`), use the lat/lng directly.
- Otherwise call `geocoder.geocode({ placeId })` to get `lat` and `lng` from `results[0].geometry.location`
- Save into `tempAddress` and switch to `details_form`

### 5. Map picker — fixed center pin
The map fills the top ~58% of the screen. The user drags the map; a fixed pin marker (Material Symbols `location_on`, primary color, large) is positioned absolutely at the center of the map area. The actual map center moves under the pin.

Hook into `onCenterChanged` of the `<Map>` component. On every change:
- Update `mapCenter`
- Reverse-geocode the new center and update `mapAddress`

A bottom sheet card (rounded `40px` top corners, `-mt-8` overlap, shadow-2xl) shows the current `mapAddress` and a "Confirm Location" button.

Also reverse-geocode once when entering `map_picker` view.

### 6. Use Current Location
Tapping "Current Location" should:
- If `userLoc` is already known: reverse-geocode and set `tempAddress`, then go to `details_form`
- Otherwise call `getCurrentPosition` first, set `userLoc`, then do the same
- On geolocation failure, alert "Unable to get your location. Please enable location access."

### 7. Persist last pickup
On `details_form` confirm, if `activeEditing === 'pickup'`, save `pickup` to `localStorage` under a key like `LAST_PICKUP_ADDRESS` so it pre-fills on next visit.

### 8. Use My Details checkbox (pickup only)
On the `details_form` for pickup ONLY (not drop), show a "Use My Details" checkbox. When checked, fill name and mobile from the logged-in user's profile (read from your auth/database — adapt to your app's user store). When unchecked, clear them. Lock the inputs (readonly + grayed background) while checked.

### 9. Contact picker for name + mobile
Both the name and mobile inputs have a small icon button (Material Symbols `contact_page` / `contacts`) that opens the browser's `navigator.contacts.select(['name', 'tel'], { multiple: false })` API. This works on Android Chrome and Capacitor wrappers; on desktop, alert that contact picker is mobile-only.

When a contact is selected, fill both name AND mobile (strip non-digits, take last 10 digits of phone).

### 10. Save-as tags
Three pill buttons: Home, Work, Other (icons: `home`, `work`, `favorite`). Tapping toggles `tempAddress.type` between the value and `null`. Selected pill: `bg-primary text-white`, unselected: white background with border.

## Layout, sizing, and visual language

- The whole screen is mobile-first: `max-w-md` (448 px) when constrained at the parent app level, but the component itself fills `h-screen w-full` of its container.
- All four views use a sticky / pinned top header with `pt-14` (large top padding to clear status bars on iOS), and a sticky bottom action button with `p-6` and a rounded `2xl` button.
- Border colors are `slate-100` / `slate-800` (light/dark). Text colors are `slate-900` / `white` (active) and `slate-400` / `slate-500` (muted).
- Pickup color: `primary` (use `bg-primary/10` for tints). Drop color: `red-500` (use `bg-red-500/10` for tints). Use these consistently for dots, badges, and accent rings on every view that mentions either slot.
- Buttons in primary action: `h-16 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/30 active:scale-[0.98]`
- Disabled state on the final button: `opacity-30`
- Animations: `animate-in fade-in duration-300` between views; `animate-in slide-in-from-right` for search; `animate-in slide-in-from-bottom duration-500` for the details form
- Use `material-symbols-outlined` class on `<span>` elements for all icons. Common icons used: `arrow_back`, `mic`, `my_location`, `map`, `location_on`, `home`, `work`, `favorite`, `contact_page`, `contacts`, `close`, `chevron_right`, `distance`

### Route summary (view 1)
- Header `pt-14 pb-6 border-b`. Back button + "Setup Route" title.
- Vertical dashed connector between the pickup and drop dots (absolute-positioned border-dashed div).
- Each slot: 40-px circle with a 10-px inner colored dot, ringed in white. To the right: small uppercase "Pickup" / "Drop" label + bold title (or placeholder text "Where is your PickUp?" / "Where is your Drop?") + smaller address line below if filled.
- Empty main area shows a `distance` icon and "Add locations to see fare estimates" — `opacity-40`.
- Footer: "Confirm And Proceed" button, disabled until both pickup and drop are set. Navigates to `/parcel-details` (or your equivalent) with `{ pickup, drop, serviceType }` state.

### Search selection (view 2)
- Header: a single rounded search bar `h-14 bg-slate-50 rounded-xl px-4 border`. Inside: back button (closes to route_summary) + colored dot (pickup or drop) + autoFocus input + mic icon (decorative, no STT wiring required).
- Two equal-width buttons in a `grid-cols-2` row right under the header: "Current Location" (icon `my_location`) and "Choose on Map" (icon `map`). `border-l` between them, `border-b` below.
- Body:
  - When there are search results, show a vertical list of results with a `location_on` icon, bold title, small grey address line, and a `border-b` between rows.
  - When there are no results (initial state), show:
    - A "Saved Addresses" link row (icon `favorite` + label + chevron right) — wire this up later if you have a saved-addresses feature, otherwise leave it as a non-functional row.
    - A "Recent {Pickup|Drop}s" section heading with a list below. For now hardcode a single sample entry (Home / address / "Sample Name • 9999999999") OR pull from `localStorage` if you've saved any.

### Map picker (view 3)
- Top 58% is the `<Map>` component with `disableDefaultUI`, `gestureHandling="greedy"`, `defaultZoom={15}`. Use a unique `mapId` (any short string).
- Fixed centered pin: a `material-symbols-outlined` `location_on` icon at `text-5xl`, primary color, `filled` modifier, with a drop-shadow. Position with `absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full pointer-events-none`. The pin's tip should sit on the map's geometric center.
- Back button: top-left, white circular `size-11` with shadow.
- Bottom sheet: white card with `rounded-t-[40px]`, `-mt-8`, `shadow-2xl`, fills remaining space.
  - 12-px wide drag handle at top (`w-12 h-1.5 bg-slate-200 rounded-full`)
  - Address row: pickup/drop dot + uppercase label + the live `mapAddress` (line-clamp-2)
  - "Search" pill button on the right of the address row → opens search_selection
  - Sticky-bottom "Confirm Location" button (full-width primary, `h-16`)

### Details form (view 4)
- Header: `pt-14 pb-4 border-b`, close button (X), centered title "Pickup Details" or "Drop Details".
- Address chip at the top of the body: pickup/drop dot + bold title + small address line + "Change" link → search_selection.
- Then four/five inputs:
  1. **Building** input (optional). Standard rounded `h-14` input.
  2. **Sender's / Receiver's Name** — input with a floating label, contact-picker icon button on the right.
  3. **Sender's / Receiver's Mobile Number** — same pattern, type=tel, inputMode=numeric, maxLength=10, strip non-digits on input.
  4. **Use My Details** checkbox (pickup only, see Behavior #8).
  5. **Save as** pills (Home / Work / Other).
- Footer: "Confirm And Proceed" button.

## Genericize when copying

Replace these placeholders with your project's values:
- `LAST_PICKUP_ADDRESS` — localStorage key (was app-specific)
- The default `mapCenter` lat/lng — set to your launch city
- `componentRestrictions: { country: 'in' }` — change country code if not India
- The `mapId` string passed to `<Map>` — pick anything unique to your app
- The hardcoded sample "Home" entry in the empty search state — replace with a real saved-addresses query, or remove
- Next-route navigation: `/parcel-details` is the default; change to whatever screen comes next in your booking flow. The same applies to the `serviceType === 'exchange' ? '/exchange-details' : '/parcel-details'` branch — keep it only if you have multiple service types.
- The "Use My Details" auth source — adapt to whatever you use (Firebase, Supabase, your own API)

## Acceptance checklist

After implementing, verify all of these:

- [ ] Both pickup and drop can be set from any of three sources: typing in search, dragging the map picker, or "Use Current Location"
- [ ] Typing `28.6139, 77.2090` in the search bar resolves to the correct address (lat,lng fallback)
- [ ] Selected pickup persists across page reloads (localStorage)
- [ ] Drop does NOT persist (intentional — drops are usually one-off)
- [ ] On the map picker, dragging updates the displayed address within ~500 ms
- [ ] The pin's tip sits exactly on the geometric center of the map
- [ ] "Use My Details" only appears for pickup, and locks the name+mobile fields when checked
- [ ] Mobile input rejects non-digit characters and caps at 10 chars
- [ ] Save-as pills toggle on/off; tapping a selected pill clears it
- [ ] "Confirm And Proceed" on the route_summary view is disabled until both addresses are set
- [ ] After confirming, the next screen receives `{ pickup, drop, serviceType }` via router state with full lat/lng coordinates on each address

## Reference implementation

A complete reference implementation of this exact flow exists. If you need to see how a particular detail is wired up — debounce timer, geocode response shape, the contact picker error handling — ask for the reference file and I can paste it.
````

---

## Notes on using this prompt

- **Paste it once at the start of the session.** Then iterate naturally — Claude Code can ask clarifying questions about your stack, your `primary` color, your auth provider, etc.
- **Don't paste your real Maps API key** in the prompt. Just the env-var name. Set the actual key in `.env`.
- **If the other project uses `react-leaflet` or Mapbox** instead of `@vis.gl/react-google-maps`, tell Claude that upfront and ask it to adapt — the four-view state machine is library-agnostic but the specific imports and component shapes will change.
- **The reference implementation** in this repo is at `screens/customer/SearchLocation.tsx`. If Claude needs to see actual code, paste that file in as a follow-up message.
