/**
 * Pure fare calculation functions — no side effects, no browser/Node deps.
 * Shared between client (fareService.ts) and server (server.ts).
 */

export interface VehicleRateV2 {
  id: string;
  name: string;
  baseFare: number;
  includedKm: number;
  perKmRate: number;
  perMinuteRate: number;
  minFare: number;
  freeWaitMins: number;
  waitChargePerMin: number;
  capacityKg: number;
  freeWeightKg: number;
  extraKgRate: number;
  gstPercent: number;
  active: boolean;
}

export interface FareInputV2 {
  vehicleId: string;
  distanceKm: number;
  durationMins: number;
  weightKg?: number;
}

export interface FareBreakdownV2 {
  baseFare: number;
  distanceCharge: number;
  timeCharge: number;
  tripFare: number;         // base + distance + time (pre-GST)
  gst: number;
  estimatedTotal: number;   // tripFare + GST
  distanceKm: number;
  durationMins: number;
  vehicleId: string;
  minFare: number;
}

export interface FinalFareResult {
  tripFare: number;
  loadingWaitMins: number;
  loadingWaitCharge: number;
  unloadingWaitMins: number;
  unloadingWaitCharge: number;
  taxable: number;
  gst: number;
  total: number;
}

/**
 * Calculate estimated fare for a trip (V2 algorithm).
 * Fare = Base Charge + Distance Charge + Time Charge
 */
export function calculateFareV2(input: FareInputV2, rate: VehicleRateV2): FareBreakdownV2 {
  const { distanceKm, durationMins } = input;

  // Base charge
  const baseFare = rate.baseFare;

  // Distance charge: (distance - freeKm) × perKmRate, min 0
  const billableKm = Math.max(0, distanceKm - rate.includedKm);
  const distanceCharge = Math.round(billableKm * rate.perKmRate);

  // Time charge: duration × perMinuteRate
  const timeCharge = Math.round(durationMins * rate.perMinuteRate);

  // Trip fare (pre-GST)
  const rawTripFare = baseFare + distanceCharge + timeCharge;
  const tripFare = Math.max(rawTripFare, rate.minFare);

  // GST
  const gst = Math.round(tripFare * rate.gstPercent / 100);
  const estimatedTotal = tripFare + gst;

  return {
    baseFare,
    distanceCharge,
    timeCharge,
    tripFare,
    gst,
    estimatedTotal,
    distanceKm,
    durationMins,
    vehicleId: input.vehicleId,
    minFare: rate.minFare,
  };
}

/**
 * Calculate final fare after trip completion (with actual waiting charges).
 */
export function calculateFinalFare(
  tripFare: number,
  loadingWaitMins: number,
  unloadingWaitMins: number,
  rate: VehicleRateV2
): FinalFareResult {
  const freeWait = rate.freeWaitMins;
  const chargePerMin = rate.waitChargePerMin;

  // Cap chargeable wait to prevent gaming (max 30 min loading, 15 min unloading)
  const cappedLoading = Math.min(Math.max(0, loadingWaitMins - freeWait), 30);
  const cappedUnloading = Math.min(Math.max(0, unloadingWaitMins - freeWait), 15);

  const loadingWaitCharge = Math.round(cappedLoading * chargePerMin);
  const unloadingWaitCharge = Math.round(cappedUnloading * chargePerMin);

  const taxable = tripFare + loadingWaitCharge + unloadingWaitCharge;
  const gst = Math.round(taxable * rate.gstPercent / 100);
  const total = taxable + gst;

  return {
    tripFare,
    loadingWaitMins: Math.round(loadingWaitMins * 10) / 10,
    loadingWaitCharge,
    unloadingWaitMins: Math.round(unloadingWaitMins * 10) / 10,
    unloadingWaitCharge,
    taxable,
    gst,
    total,
  };
}

/**
 * Calculate exchange fare (roundtrip 1.8x + QC surcharge).
 */
export function calculateExchangeFareV2(
  input: FareInputV2, rate: VehicleRateV2, qcRequired = false
): FareBreakdownV2 {
  const oneWay = calculateFareV2(input, rate);
  const multiplier = 1.8;
  const qcSurcharge = qcRequired ? 50 : 0;

  const baseFare = Math.round(oneWay.baseFare * multiplier);
  const distanceCharge = Math.round(oneWay.distanceCharge * multiplier);
  const timeCharge = Math.round(oneWay.timeCharge * multiplier) + qcSurcharge;
  const tripFare = Math.max(baseFare + distanceCharge + timeCharge, Math.round(rate.minFare * multiplier));
  const gst = Math.round(tripFare * rate.gstPercent / 100);

  return {
    baseFare,
    distanceCharge,
    timeCharge,
    tripFare,
    gst,
    estimatedTotal: tripFare + gst,
    distanceKm: input.distanceKm,
    durationMins: input.durationMins,
    vehicleId: input.vehicleId,
    minFare: Math.round(rate.minFare * multiplier),
  };
}

/**
 * Validate fare: returns true if client fare is within ±10% of server fare.
 */
export function validateFare(clientFare: number, serverFare: number): { valid: boolean; difference: number } {
  if (serverFare === 0) return { valid: true, difference: 0 };
  const difference = Math.abs(clientFare - serverFare) / serverFare;
  return { valid: difference <= 0.10, difference: Math.round(difference * 100) };
}
