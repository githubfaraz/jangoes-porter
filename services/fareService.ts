/**
 * Jangoes Porter — Fare Calculation Service (V2)
 * Loads rates from Firestore (admin-configurable), falls back to defaults.
 * Uses V2 algorithm: Base + Distance + Time (traffic-based) + GST
 */

import { db } from '../src/firebase.ts';
import { doc, getDoc } from 'firebase/firestore';
import { calculateFareV2, calculateExchangeFareV2, calculateFinalFare, type VehicleRateV2, type FareBreakdownV2, type FinalFareResult } from './fareCalculator.ts';

export type { VehicleRateV2, FareBreakdownV2, FinalFareResult };
export { calculateFinalFare };

export interface LatLng {
  lat: number;
  lng: number;
}

// ── Default rates (fallback if Firestore is unavailable) ────────────────────

const DEFAULT_RATES: Record<string, VehicleRateV2> = {
  'bike': {
    id: 'bike', name: 'Bike (Two-Wheeler)',
    baseFare: 60, includedKm: 4, perKmRate: 8, perMinuteRate: 1.5,
    minFare: 60, freeWaitMins: 10, waitChargePerMin: 2,
    capacityKg: 20, freeWeightKg: 15, extraKgRate: 5, gstPercent: 5, active: true,
  },
  'car': {
    id: 'car', name: 'Car (Sedan/Hatchback)',
    baseFare: 150, includedKm: 4, perKmRate: 14, perMinuteRate: 2.0,
    minFare: 150, freeWaitMins: 10, waitChargePerMin: 3,
    capacityKg: 200, freeWeightKg: 50, extraKgRate: 3, gstPercent: 5, active: true,
  },
  'tata-ace': {
    id: 'tata-ace', name: 'Tata Ace (Mini Truck)',
    baseFare: 220, includedKm: 4, perKmRate: 22, perMinuteRate: 2.5,
    minFare: 220, freeWaitMins: 15, waitChargePerMin: 4,
    capacityKg: 750, freeWeightKg: 500, extraKgRate: 6, gstPercent: 5, active: true,
  },
  'bolero': {
    id: 'bolero', name: 'Bolero Pickup',
    baseFare: 380, includedKm: 4, perKmRate: 28, perMinuteRate: 3.0,
    minFare: 380, freeWaitMins: 15, waitChargePerMin: 5,
    capacityKg: 1500, freeWeightKg: 1000, extraKgRate: 6, gstPercent: 5, active: true,
  },
  'tata-407': {
    id: 'tata-407', name: 'Tata 407',
    baseFare: 580, includedKm: 4, perKmRate: 38, perMinuteRate: 3.5,
    minFare: 580, freeWaitMins: 20, waitChargePerMin: 6,
    capacityKg: 2500, freeWeightKg: 2000, extraKgRate: 6, gstPercent: 5, active: true,
  },
  'large-truck': {
    id: 'large-truck', name: 'Large Truck (14 ft)',
    baseFare: 900, includedKm: 4, perKmRate: 55, perMinuteRate: 4.0,
    minFare: 900, freeWaitMins: 20, waitChargePerMin: 8,
    capacityKg: 4000, freeWeightKg: 3000, extraKgRate: 6, gstPercent: 5, active: true,
  },
};

// ── Firestore rate loading with cache ────────────────────────────────────────

let cachedRates: Record<string, VehicleRateV2> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function loadVehicleRates(): Promise<Record<string, VehicleRateV2>> {
  // Return cache if fresh
  if (cachedRates && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedRates;
  }

  try {
    const snap = await getDoc(doc(db, 'config', 'vehicleRates'));
    if (snap.exists()) {
      const data = snap.data();
      cachedRates = data.rates as Record<string, VehicleRateV2>;
      cacheTimestamp = Date.now();
      return cachedRates;
    }
  } catch (err) {
    console.warn('[FareService] Failed to load rates from Firestore, using defaults:', err);
  }

  return DEFAULT_RATES;
}

/** Get rates synchronously (returns cached or defaults) */
export function getVehicleRates(): Record<string, VehicleRateV2> {
  return cachedRates || DEFAULT_RATES;
}

// Keep backward compat export name
export const VEHICLE_RATES = DEFAULT_RATES;

// ── V2 Fare Estimation ──────────────────────────────────────────────────────

/**
 * Calculate fare for a single vehicle using V2 algorithm.
 * Uses cached Firestore rates if available, otherwise defaults.
 */
export function estimateFareV2(
  vehicleId: string, distanceKm: number, durationMins: number
): FareBreakdownV2 {
  const rates = getVehicleRates();
  const rate = rates[vehicleId] || rates['tata-ace'];
  return calculateFareV2({ vehicleId, distanceKm, durationMins }, rate);
}

/**
 * Calculate exchange fare using V2 algorithm.
 */
export function estimateExchangeFareV2(
  vehicleId: string, distanceKm: number, durationMins: number, qcRequired = false
): FareBreakdownV2 {
  const rates = getVehicleRates();
  const rate = rates[vehicleId] || rates['tata-ace'];
  return calculateExchangeFareV2({ vehicleId, distanceKm, durationMins }, rate);
}

// ── Road Distance (with traffic-aware duration) ─────────────────────────────

export async function getRoadDistance(
  origin: LatLng, destination: LatLng
): Promise<{ distanceKm: number; durationMins: number }> {
  const res = await fetch('/api/distance-matrix', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origin, destination }),
  });

  if (!res.ok) throw new Error('Distance Matrix API failed');
  const data = await res.json();

  const element = data?.rows?.[0]?.elements?.[0];
  if (!element || element.status !== 'OK') {
    throw new Error('Could not calculate road distance');
  }

  // Prefer traffic-aware duration if available
  const durationSecs = element.duration_in_traffic?.value || element.duration.value;

  return {
    distanceKm: element.distance.value / 1000,
    durationMins: Math.ceil(durationSecs / 60),
  };
}

// ── Haversine fallback ──────────────────────────────────────────────────────

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// ── Legacy V1 exports (backward compatibility) ──────────────────────────────
// These are used by existing code that hasn't been updated yet.

export interface FareBreakdown {
  baseFare: number;
  distanceCharge: number;
  weightSurcharge: number;
  nightSurcharge: number;
  peakSurcharge: number;
  waitingCharge: number;
  tollCharges: number;
  subtotal: number;
  gst: number;
  total: number;
  surchargeLabel?: string;
  distanceKm: number;
  vehicleId?: string;
  minFare?: number;
  // V2 fields (optional, present when using V2)
  timeCharge?: number;
  durationMins?: number;
  tripFare?: number;
  estimatedTotal?: number;
}

/** V1-compatible calculateFare — delegates to V2 internally */
export function calculateFare(input: { vehicleId: string; distanceKm: number; weightKg?: number }): FareBreakdown {
  const rates = getVehicleRates();
  const rate = rates[input.vehicleId] || rates['tata-ace'];
  // Estimate duration from distance (avg 25 km/h in Delhi)
  const estimatedDurationMins = Math.ceil(input.distanceKm / 25 * 60);
  const v2 = calculateFareV2({ vehicleId: input.vehicleId, distanceKm: input.distanceKm, durationMins: estimatedDurationMins }, rate);

  return {
    baseFare: v2.baseFare,
    distanceCharge: v2.distanceCharge,
    weightSurcharge: 0,
    nightSurcharge: 0,
    peakSurcharge: 0,
    waitingCharge: 0,
    tollCharges: 0,
    subtotal: v2.tripFare,
    gst: v2.gst,
    total: v2.estimatedTotal,
    distanceKm: v2.distanceKm,
    vehicleId: v2.vehicleId,
    minFare: v2.minFare,
    timeCharge: v2.timeCharge,
    durationMins: v2.durationMins,
    tripFare: v2.tripFare,
    estimatedTotal: v2.estimatedTotal,
  };
}

/** V1-compatible estimateFare */
export function estimateFare(
  vehicleId: string, origin: LatLng, destination: LatLng, weightKg = 0
): FareBreakdown {
  const straightLineKm = haversineKm(origin, destination);
  const estimatedRoadKm = straightLineKm * 1.4;
  return calculateFare({ vehicleId, distanceKm: estimatedRoadKm, weightKg });
}

/** V1-compatible exchange fare */
export function calculateExchangeFare(input: { vehicleId: string; distanceKm: number; qcRequired?: boolean }): FareBreakdown {
  const rates = getVehicleRates();
  const rate = rates[input.vehicleId] || rates['tata-ace'];
  const estimatedDurationMins = Math.ceil(input.distanceKm / 25 * 60);
  const v2 = calculateExchangeFareV2({ vehicleId: input.vehicleId, distanceKm: input.distanceKm, durationMins: estimatedDurationMins }, rate, input.qcRequired);

  return {
    baseFare: v2.baseFare,
    distanceCharge: v2.distanceCharge,
    weightSurcharge: 0,
    nightSurcharge: 0,
    peakSurcharge: 0,
    waitingCharge: 0,
    tollCharges: 0,
    subtotal: v2.tripFare,
    gst: v2.gst,
    total: v2.estimatedTotal,
    surchargeLabel: 'Exchange Roundtrip',
    distanceKm: v2.distanceKm,
    vehicleId: v2.vehicleId,
    minFare: v2.minFare,
    timeCharge: v2.timeCharge,
    tripFare: v2.tripFare,
    estimatedTotal: v2.estimatedTotal,
  };
}

export function estimateExchangeFare(
  vehicleId: string, origin: LatLng, destination: LatLng, weightKg = 0, qcRequired = false
): FareBreakdown {
  const straightLineKm = haversineKm(origin, destination);
  const estimatedRoadKm = straightLineKm * 1.4;
  return calculateExchangeFare({ vehicleId, distanceKm: estimatedRoadKm, qcRequired });
}
