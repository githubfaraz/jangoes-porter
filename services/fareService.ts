/**
 * Jangoes Porter — Fare Calculation Service
 * Market rates calibrated for New Delhi, India (2025)
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface VehicleRate {
  id:            string;
  name:          string;
  baseFare:      number;   // covers first `includedKm` km
  includedKm:    number;   // km included in base fare
  perKmRate:     number;   // ₹ per km after included km
  minFare:       number;   // floor, even for 0.5 km trips
  freeWaitMins:  number;   // minutes before waiting charges kick in
  waitPerMin:    number;   // ₹ per minute after free wait
  capacityKg:    number;   // for weight surcharge logic
  freeWeightKg:  number;   // kg included free
  extraKgRate:   number;   // ₹ per kg above free limit
}

export const VEHICLE_RATES: Record<string, VehicleRate> = {
  'bike': {
    id:           'bike',
    name:         'Bike (Two-Wheeler)',
    baseFare:     60,    // covers first 4 km
    includedKm:   4,
    perKmRate:    8,     // ₹8/km after included km
    minFare:      60,
    freeWaitMins: 10,    // shorter free wait vs trucks
    waitPerMin:   2,
    capacityKg:   20,
    freeWeightKg: 15,    // up to 15 kg free
    extraKgRate:  5,     // ₹5/kg above 15 kg
  },
  'tata-ace': {
    id:           'tata-ace',
    name:         'Tata Ace (Mini Truck)',
    baseFare:     220,
    includedKm:   4,
    perKmRate:    22,
    minFare:      220,
    freeWaitMins: 15,
    waitPerMin:   4,
    capacityKg:   750,
    freeWeightKg: 500,
    extraKgRate:  6,
  },
  'bolero': {
    id:           'bolero',
    name:         'Bolero Pickup',
    baseFare:     380,
    includedKm:   4,
    perKmRate:    28,
    minFare:      380,
    freeWaitMins: 15,
    waitPerMin:   5,
    capacityKg:   1500,
    freeWeightKg: 1000,
    extraKgRate:  6,
  },
  'tata-407': {
    id:           'tata-407',
    name:         'Tata 407',
    baseFare:     580,
    includedKm:   4,
    perKmRate:    38,
    minFare:      580,
    freeWaitMins: 20,
    waitPerMin:   6,
    capacityKg:   2500,
    freeWeightKg: 2000,
    extraKgRate:  6,
  },
  'large-truck': {
    id:           'large-truck',
    name:         'Large Truck (14 ft)',
    baseFare:     900,
    includedKm:   4,
    perKmRate:    55,
    minFare:      900,
    freeWaitMins: 20,
    waitPerMin:   8,
    capacityKg:   4000,
    freeWeightKg: 3000,
    extraKgRate:  6,
  },
};

export interface FareInput {
  vehicleId:       string;
  distanceKm:      number;   // road distance from Distance Matrix API
  weightKg?:       number;   // actual parcel weight
  waitingMins?:    number;   // actual waiting time (known at trip end)
  tollCharges?:    number;   // from route details
  applyGst?:       boolean;  // default true
}

export interface FareBreakdown {
  baseFare:        number;
  distanceCharge:  number;
  weightSurcharge: number;
  nightSurcharge:  number;
  peakSurcharge:   number;
  waitingCharge:   number;
  tollCharges:     number;
  subtotal:        number;
  gst:             number;
  total:           number;
  surchargeLabel?: string;   // human-readable e.g. "Night +25%"
  distanceKm:      number;
  vehicleId?:      string;
  minFare?:        number;
}

/** Current surcharge multiplier based on time of day */
function getTimeSurcharge(date = new Date()): { multiplier: number; label: string } {
  const hour = date.getHours();
  const isNight = hour >= 22 || hour < 6;          // 10 PM – 6 AM
  const isPeak  = (hour >= 8 && hour < 11) || (hour >= 18 && hour < 21); // 8–11 AM, 6–9 PM

  if (isNight) return { multiplier: 0.25, label: 'Night +25%' };
  if (isPeak)  return { multiplier: 0.20, label: 'Peak Hour +20%' };
  return { multiplier: 0, label: '' };
}

/** Calculate full fare breakdown */
export function calculateFare(input: FareInput): FareBreakdown {
  const rate = VEHICLE_RATES[input.vehicleId];
  if (!rate) throw new Error(`Unknown vehicle: ${input.vehicleId}`);

  const { distanceKm, weightKg = 0, waitingMins = 0, tollCharges = 0 } = input;

  // 1. Base fare (covers first includedKm km)
  const baseFare = rate.baseFare;

  // 2. Distance charge (only km beyond the included km)
  const chargeableKm   = Math.max(0, distanceKm - rate.includedKm);
  const distanceCharge = Math.round(chargeableKm * rate.perKmRate);

  // 3. Weight surcharge
  const extraKg        = Math.max(0, weightKg - rate.freeWeightKg);
  const weightSurcharge = Math.round(extraKg * rate.extraKgRate);

  // 4. Time-based surcharge
  const { multiplier, label } = getTimeSurcharge();
  const timeBase       = baseFare + distanceCharge;
  const timeSurcharge  = Math.round(timeBase * multiplier);
  const nightSurcharge = label.startsWith('Night') ? timeSurcharge : 0;
  const peakSurcharge  = label.startsWith('Peak')  ? timeSurcharge : 0;

  // 5. Waiting charge (beyond free minutes)
  const chargeableWait = Math.max(0, waitingMins - rate.freeWaitMins);
  const waitingCharge  = Math.round(chargeableWait * rate.waitPerMin);

  // 6. Subtotal before GST
  const subtotal = Math.max(
    rate.minFare,
    baseFare + distanceCharge + weightSurcharge + nightSurcharge + peakSurcharge + waitingCharge + tollCharges,
  );

  // 7. GST @ 5% (goods transport by road — SAC 9965)
  const applyGst = input.applyGst !== false;
  const gst   = applyGst ? Math.round(subtotal * 0.05) : 0;
  const total = subtotal + gst;

  return {
    baseFare,
    distanceCharge,
    weightSurcharge,
    nightSurcharge,
    peakSurcharge,
    waitingCharge,
    tollCharges,
    subtotal,
    gst,
    total,
    surchargeLabel: label || undefined,
    distanceKm,
  };
}

/**
 * Fetch actual road distance + duration from Google Maps Distance Matrix API.
 * Must be called client-side (uses VITE_ API key).
 * Returns distance in km and duration in minutes.
 */
export async function getRoadDistance(
  origin:      LatLng,
  destination: LatLng,
): Promise<{ distanceKm: number; durationMins: number }> {
  const apiKey = (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY;
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json`
    + `?origins=${origin.lat},${origin.lng}`
    + `&destinations=${destination.lat},${destination.lng}`
    + `&mode=driving`
    + `&region=in`
    + `&key=${apiKey}`;

  // Distance Matrix API has CORS restrictions — must go via server proxy
  // Use the server-side route instead:
  const res = await fetch('/api/distance-matrix', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ origin, destination }),
  });

  if (!res.ok) throw new Error('Distance Matrix API failed');
  const data = await res.json();

  const element = data?.rows?.[0]?.elements?.[0];
  if (!element || element.status !== 'OK') {
    throw new Error('Could not calculate road distance');
  }

  return {
    distanceKm:   element.distance.value / 1000,          // metres → km
    durationMins: Math.ceil(element.duration.value / 60), // seconds → mins
  };
}

/** Quick estimate (no API call) using Haversine × road correction factor */
export function estimateFare(
  vehicleId:   string,
  origin:      LatLng,
  destination: LatLng,
  weightKg = 0,
): FareBreakdown {
  const straightLineKm = haversineKm(origin, destination);
  const estimatedRoadKm = straightLineKm * 1.4; // Delhi road correction ~1.4×
  return calculateFare({ vehicleId, distanceKm: estimatedRoadKm, weightKg });
}

function haversineKm(a: LatLng, b: LatLng): number {
  const R   = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h   = Math.sin(dLat / 2) ** 2
            + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/** Exchange fare = roundtrip (1.8x one-way) + QC surcharge if applicable */
export function calculateExchangeFare(input: FareInput & { qcRequired?: boolean }): FareBreakdown {
  const oneWay = calculateFare(input);
  const returnMultiplier = 1.8;
  const qcSurcharge = input.qcRequired ? 50 : 0;

  const subtotal = Math.round((oneWay.baseFare + oneWay.distanceCharge + oneWay.weightSurcharge) * returnMultiplier) + qcSurcharge;
  const { multiplier, label } = getTimeSurcharge();
  const timeSurcharge = multiplier > 1 ? Math.round(subtotal * (multiplier - 1)) : 0;
  const subWithTime = subtotal + timeSurcharge;
  const gst = Math.round(subWithTime * 0.05);
  const total = subWithTime + gst;

  const rate = VEHICLE_RATES[input.vehicleId] || VEHICLE_RATES['tata-ace'];
  const minFare = Math.round(rate.minFare * returnMultiplier);

  return {
    baseFare: Math.round(oneWay.baseFare * returnMultiplier),
    distanceCharge: Math.round(oneWay.distanceCharge * returnMultiplier),
    weightSurcharge: Math.round(oneWay.weightSurcharge * returnMultiplier) + qcSurcharge,
    nightSurcharge: label.includes('Night') ? timeSurcharge : 0,
    peakSurcharge: label.includes('Peak') ? timeSurcharge : 0,
    surchargeLabel: label || 'Exchange Roundtrip',
    waitingCharge: 0,
    tollCharges: 0,
    subtotal: subWithTime,
    gst,
    total: Math.max(total, minFare),
    minFare,
    distanceKm: input.distanceKm,
    vehicleId: input.vehicleId,
  };
}

export function estimateExchangeFare(
  vehicleId: string, origin: LatLng, destination: LatLng, weightKg = 0, qcRequired = false
): FareBreakdown {
  const straightLineKm = haversineKm(origin, destination);
  const estimatedRoadKm = straightLineKm * 1.4;
  return calculateExchangeFare({ vehicleId, distanceKm: estimatedRoadKm, weightKg, qcRequired });
}
