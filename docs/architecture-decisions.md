# Architectural Decisions (ADR)

## Tech Stack
- **Framework**: React 19.0.0 (Strict Mode).
- **Styling**: Tailwind CSS with custom "Liquid Glass" theme.
- **AI**: Google Gemini API (@google/genai).
- **Icons**: Material Symbols Outlined (Variable Font).

## 1. Client-Side AI Processing
**Decision**: We invoke Gemini API directly from the frontend using `process.env.API_KEY`.
**Rationale**: For an MVP, this reduces latency and infrastructure overhead. We use Gemini 3 Flash for speed-sensitive classification and Gemini Flash Lite for grounding tasks.

## 2. Multi-Modal Interaction
**Decision**: Use `inlineData` parts in `generateContent` for parcel classification.
**Rationale**: Allowing users to take photos of their load ensures drivers are better prepared for the physical volume, reducing "rejection at pickup" rates.

## 3. Atomic Screen Design
**Decision**: Each step of the logistics funnel is a dedicated route (e.g., `/parcel-details`, `/parcel-dimensions`).
**Rationale**: This ensures a "One Task per Screen" UX, which is critical for mobile users who may be in distracting environments. It also simplifies state management by using standard URL navigation.

## 4. Payment Enclosure
**Decision**: The system enforces "Wallet-First" logic.
**Rationale**: To improve platform liquidity and reduce "Cash on Delivery" risks, the UI proactively locks the payment method to the wallet if the balance allows it, removing cognitive load from the user.

## 5. Design System: "Liquid Glass & Aero-Mesh"
**Decision**: High-vibrancy light theme, utilizing animated mesh gradients (Blue/Purple/Green) and frosted glass containers.
**Rationale**: Moving away from traditional dark logistics interfaces, Jangoes uses a "fintech-premium" look. The branding uses a custom green gradient (`#78AA64` to `#96C882`) to emphasize growth and reliability against a clean, white-space heavy layout.