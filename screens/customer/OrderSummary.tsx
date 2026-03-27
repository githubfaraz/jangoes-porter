import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../../src/firebase.ts';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { BookingStatus } from '../../types.ts';

const OrderSummary: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isBooking, setIsBooking] = useState(false);
  const [error, setError] = useState('');

  // All data passed through the booking flow
  const { pickup, drop, parcel, dimensions, vehicle, fare: routeFare, fareBreakdown, distanceKm, serviceType, exchange: exchangeData } = location.state || {};
  const isExchange = serviceType === 'exchange';

  // Fallback guard — if state was lost (e.g. direct URL navigation), go back to search
  const isMissingData = !pickup || !drop;

  // OTPs generated once per mount and held in refs so they don't change on re-render
  const pickupPinRef = useRef(Math.floor(1000 + Math.random() * 9000).toString());
  const dropoffOtpRef = useRef(Math.floor(1000 + Math.random() * 9000).toString());
  // Exchange-specific OTPs
  const returnOtpRef = useRef(Math.floor(1000 + Math.random() * 9000).toString());
  const productBPickupOtpRef = useRef(Math.floor(1000 + Math.random() * 9000).toString());
  const productAHandoverOtpRef = useRef(Math.floor(1000 + Math.random() * 9000).toString());

  const fare: number = routeFare ?? dimensions?.estimatedCost ?? 0;

  // Use real breakdown from fareService if available, else split proportionally
  const baseFare       = fareBreakdown?.baseFare        ?? Math.round(fare * 0.64);
  const distanceCharge = fareBreakdown ? (fareBreakdown.baseFare + fareBreakdown.distanceCharge - fareBreakdown.baseFare) || fareBreakdown.distanceCharge : fare - baseFare;
  const gst            = fareBreakdown?.gst             ?? 0;
  const surchargeAmt   = (fareBreakdown?.nightSurcharge ?? 0) + (fareBreakdown?.peakSurcharge ?? 0);
  const surchargeLabel = fareBreakdown?.surchargeLabel  ?? '';

  const handleConfirmBooking = async () => {
    if (!auth.currentUser) return;
    if (isMissingData) {
      navigate('/search');
      return;
    }

    setIsBooking(true);
    setError('');
    try {
      const tripData: Record<string, any> = {
        customerId:    auth.currentUser.uid,
        status:        BookingStatus.SEARCHING,
        serviceType:   serviceType || 'parcel',
        pickup: {
          address: pickup.address,
          lat:     pickup.lat     ?? 0,
          lng:     pickup.lng     ?? 0,
        },
        dropoff: {
          address: drop.address,
          lat:     drop.lat     ?? 0,
          lng:     drop.lng     ?? 0,
        },
        vehicleType:   vehicle?.name  || 'Standard Vehicle',
        fare,
        createdAt:     serverTimestamp(),
        pickupPin:     pickupPinRef.current,
        dropoffOtp:    dropoffOtpRef.current,
        senderName:    pickup.name    || '',
        senderPhone:   pickup.mobile  || '',
        receiverName:  drop.name      || '',
        receiverPhone: drop.mobile    || '',
        parcelCategory:   parcel?.category      || '',
        parcelFragile:    parcel?.fragile        || false,
        parcelWeight:     dimensions?.chargeableWeight ?? 0,
      };

      // Add exchange-specific data
      if (isExchange && exchangeData) {
        tripData.exchange = {
          productA: {
            description: exchangeData.productA?.description || '',
            category: exchangeData.productA?.category || '',
            images: [],
          },
          productB: {
            description: exchangeData.productB?.description || '',
            category: exchangeData.productB?.category || '',
            images: [],
          },
          qcRequired: exchangeData.qcRequired || false,
          qcInstructions: exchangeData.qcInstructions || '',
          returnOtp: returnOtpRef.current,
          productBPickupOtp: productBPickupOtpRef.current,
          productAHandoverOtp: productAHandoverOtpRef.current,
        };
      }

      const docRef = await addDoc(collection(db, 'trips'), tripData);
      navigate('/tracking', { state: { tripId: docRef.id } });
    } catch (err: any) {
      console.error('Booking Error:', err);
      setError('Failed to create booking. Please try again.');
    } finally {
      setIsBooking(false);
    }
  };

  if (isMissingData) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-4 p-8 text-center bg-background-light dark:bg-background-dark">
        <span className="material-symbols-outlined text-5xl text-slate-300">error</span>
        <p className="text-slate-500 text-sm font-medium">Booking data was lost. Please start again.</p>
        <button
          onClick={() => navigate('/search')}
          className="bg-primary text-white font-black px-8 py-4 rounded-2xl"
        >
          Start Over
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark">
      <header className="sticky top-0 z-50 flex items-center bg-white dark:bg-surface-dark px-4 py-3 justify-between shadow-sm">
        <button onClick={() => navigate(-1)} className="text-slate-700 dark:text-white p-2">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h2 className="text-lg font-bold">Order Summary</h2>
        <div className="w-10"></div>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar p-4 flex flex-col gap-4">

        {/* Error banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-red-500">error</span>
            <p className="text-red-600 text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Route Details */}
        <div className="bg-white dark:bg-surface-dark rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold">Route Details</h3>
            <button onClick={() => navigate('/search')} className="text-primary text-sm font-semibold">Edit</button>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-4">
              <div className="mt-1 size-3 rounded-full bg-green-500 shrink-0"></div>
              <div className="flex flex-col">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Pickup</p>
                <p className="text-sm font-medium">{pickup.address}</p>
                {pickup.name && <p className="text-xs text-slate-400 mt-0.5">{pickup.name}{pickup.mobile ? ` · ${pickup.mobile}` : ''}</p>}
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="mt-1 size-3 rounded-full bg-red-500 shrink-0"></div>
              <div className="flex flex-col">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Drop-off</p>
                <p className="text-sm font-medium">{drop.address}</p>
                {drop.name && <p className="text-xs text-slate-400 mt-0.5">{drop.name}{drop.mobile ? ` · ${drop.mobile}` : ''}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Vehicle */}
        <div className="bg-white dark:bg-surface-dark rounded-xl p-5 shadow-sm flex items-center gap-4">
          <div className="size-14 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary text-3xl">local_shipping</span>
          </div>
          <div className="flex-1">
            <p className="text-xs text-slate-500">Vehicle Type</p>
            <h4 className="text-base font-bold">{vehicle?.name || 'Standard Vehicle'}</h4>
            {vehicle?.capacity && <p className="text-xs text-slate-400">{vehicle.capacity}</p>}
          </div>
          <button onClick={() => navigate(-1)} className="text-primary text-sm font-semibold">Change</button>
        </div>

        {/* Exchange info */}
        {isExchange && exchangeData && (
          <div className="bg-white dark:bg-surface-dark rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-rose-500">swap_horiz</span>
              <h3 className="text-base font-bold">Exchange Details</h3>
              <span className="ml-auto text-[9px] font-black bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full uppercase tracking-widest">Roundtrip</span>
            </div>
            <div className="flex flex-col gap-3">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Sending (Product A)</p>
                <p className="text-sm font-medium text-slate-900 dark:text-white">{exchangeData.productA?.description}</p>
                {exchangeData.productA?.category && <p className="text-xs text-slate-400 mt-0.5">{exchangeData.productA.category}</p>}
              </div>
              <div className="flex items-center justify-center"><span className="material-symbols-outlined text-slate-300">swap_vert</span></div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3">
                <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1">Receiving (Product B)</p>
                <p className="text-sm font-medium text-slate-900 dark:text-white">{exchangeData.productB?.description}</p>
                {exchangeData.productB?.category && <p className="text-xs text-slate-400 mt-0.5">{exchangeData.productB.category}</p>}
              </div>
              {exchangeData.qcRequired && (
                <div className="flex items-center gap-2 bg-amber-50 rounded-xl px-3 py-2">
                  <span className="material-symbols-outlined text-amber-500 text-sm">verified</span>
                  <span className="text-xs font-bold text-amber-700">Quality Check enabled</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Parcel info (only if available) */}
        {!isExchange && (parcel?.category || dimensions?.chargeableWeight > 0) && (
          <div className="bg-white dark:bg-surface-dark rounded-xl p-5 shadow-sm">
            <h3 className="text-base font-bold mb-3">Parcel Info</h3>
            <div className="flex flex-col gap-2">
              {parcel?.category && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Category</span>
                  <span className="font-medium">{parcel.category}</span>
                </div>
              )}
              {dimensions?.chargeableWeight > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Chargeable Weight</span>
                  <span className="font-medium">{dimensions.chargeableWeight} kg</span>
                </div>
              )}
              {parcel?.fragile && (
                <div className="flex items-center gap-2 mt-1 bg-amber-50 rounded-xl px-3 py-2">
                  <span className="material-symbols-outlined text-amber-500 text-sm filled">warning</span>
                  <span className="text-xs font-bold text-amber-700">Fragile — handle with care</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Fare Breakdown */}
        <div className="bg-white dark:bg-surface-dark rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold">Fare Breakdown</h3>
            {distanceKm && (
              <span className="text-xs font-bold text-slate-400">{distanceKm.toFixed(1)} km road distance</span>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Base Fare</span>
              <span className="font-medium">₹{baseFare}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Distance Charge</span>
              <span className="font-medium">₹{fareBreakdown?.distanceCharge ?? distanceCharge}</span>
            </div>
            {surchargeAmt > 0 && (
              <div className="flex justify-between text-sm text-amber-600">
                <span>{surchargeLabel || 'Surcharge'}</span>
                <span className="font-medium">+₹{surchargeAmt}</span>
              </div>
            )}
            {gst > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">GST (5%)</span>
                <span className="font-medium">₹{gst}</span>
              </div>
            )}
            <div className="my-1 border-t border-dashed border-slate-200"></div>
            <div className="flex justify-between items-center">
              <span className="font-bold">Estimated Total</span>
              <span className="font-bold text-lg text-primary">₹{fare}</span>
            </div>
          </div>
        </div>

      </main>

      <div className="sticky bottom-0 bg-white dark:bg-surface-dark border-t p-4 pb-10 shadow-lg">
        <button
          onClick={handleConfirmBooking}
          disabled={isBooking}
          className="w-full bg-primary hover:bg-blue-700 text-white font-bold h-14 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isBooking ? (
            <span className="material-symbols-outlined animate-spin">sync</span>
          ) : (
            <>
              <span>Confirm Booking</span>
              <span className="material-symbols-outlined">arrow_forward</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default OrderSummary;
