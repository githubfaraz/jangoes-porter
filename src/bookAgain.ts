// Build the router-state shape OrderSummary expects, from a stored Trip doc.
// Used by the "Book Again" buttons in OrderHistory + TripDetails to skip the
// search → details → vehicle picker steps when a customer wants to repeat a
// past delivery. The returned object is passed verbatim as `location.state`
// when navigating to /summary.
//
// The booking-flow screens (SearchLocation, ParcelDetails, ExchangeDetails,
// VehicleSelection) write into this same shape when threading state forward,
// so OrderSummary handles either path identically.

import type { Trip } from '../types.ts';

export type BookAgainState = {
  pickup: { address: string; lat: number; lng: number; name?: string; mobile?: string };
  drop: { address: string; lat: number; lng: number; name?: string; mobile?: string };
  vehicle: { id: string; name: string; capacity?: string };
  fare: number;
  serviceType: Trip['serviceType'];
  parcel?: { category?: string; fragile?: boolean };
  dimensions?: { chargeableWeight?: number; estimatedCost?: number };
  exchange?: {
    productA: { description: string; category?: string };
    productB: { description: string; category?: string };
    qcRequired: boolean;
    qcItems: any[];
    productAPhotos: string[];
    productBPhotos: string[];
  };
};

export function buildBookAgainState(trip: Trip & { id?: string }): BookAgainState {
  const state: BookAgainState = {
    pickup: {
      address: trip.pickup?.address || '',
      lat: trip.pickup?.lat ?? 0,
      lng: trip.pickup?.lng ?? 0,
      name: trip.senderName || undefined,
      mobile: trip.senderPhone || undefined,
    },
    drop: {
      address: trip.dropoff?.address || '',
      lat: trip.dropoff?.lat ?? 0,
      lng: trip.dropoff?.lng ?? 0,
      name: trip.receiverName || undefined,
      mobile: trip.receiverPhone || undefined,
    },
    vehicle: {
      id: (trip as any).vehicleId || '',
      name: trip.vehicleType || 'Standard Vehicle',
    },
    fare: trip.fare || 0,
    serviceType: trip.serviceType || 'parcel',
    parcel: {
      category: (trip as any).parcelCategory || undefined,
      fragile: (trip as any).parcelFragile ?? false,
    },
    dimensions: {
      chargeableWeight: (trip as any).parcelWeight ?? 0,
      estimatedCost: trip.fare,
    },
  };

  if (trip.serviceType === 'exchange' && trip.exchange) {
    const ex = trip.exchange as any;
    state.exchange = {
      productA: {
        description: ex.productA?.description || '',
        category: ex.productA?.category,
      },
      productB: {
        description: ex.productB?.description || '',
        category: ex.productB?.category,
      },
      qcRequired: ex.qcRequired === true,
      qcItems: ex.qcItems || [],
      productAPhotos: ex.productA?.referencePhotos || [],
      productBPhotos: ex.productB?.referencePhotos || [],
    };
  }

  return state;
}
