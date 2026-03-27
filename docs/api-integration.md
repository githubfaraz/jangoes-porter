# API Integration Guide

## Google Gemini SDK
The app uses the `@google/genai` library. Every call is instantiated locally to ensure the latest environment keys are utilized.

### 1. Structured Output (Classification)
We use `responseMimeType: "application/json"` and a `responseSchema` to force Gemini to return valid JSON for parcel details.
- **Model**: `gemini-3-flash-preview`
- **Output**: `{ category, fragile, estimatedWeight }`

### 2. Google Maps Grounding
Used in `searchPlaces` to provide verified real-world locations.
- **Tool**: `googleMaps`
- **Model**: `gemini-flash-lite-latest` (Optimized for cost/speed)
- **Context**: We pass `navigator.geolocation` coordinates when available to improve local relevance.

### 3. Multi-Modal (Image) Payloads
In `ParcelDetails.tsx`, images are converted to Base64 and sent as `inlineData` parts. 
- **MimeTypes**: Supports `image/jpeg` and `image/png`.
- **Logic**: Gemini looks at the description text *and* the image to determine if the user's description matches the visual volume.

## Environment Variables
- `process.env.API_KEY`: Injected automatically. Must not be hardcoded.
