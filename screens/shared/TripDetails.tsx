// Trip Details — read-only post-trip summary screen.
// Modeled on EXTRAS/order-history-2.jpeg. Reached from a Past card's chevron
// in OrderHistory. Shows: date + CRN + total fare; driver row with rating;
// pickup/drop addresses; fare breakdown (uses finalFare if present, falls
// back to fare); payment method line; Mail Invoice (mailto:) + Book Again
// (navigates to /home for a fresh booking) at the bottom.

import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { db, auth } from '../../src/firebase.ts';
import { doc, getDoc } from 'firebase/firestore';
import { Trip } from '../../types.ts';
import { buildBookAgainState } from '../../src/bookAgain.ts';

const VEHICLE_LABEL: Record<string, string> = {
  bike: '2 Wheeler',
  car: '4 Wheeler',
  'tata-ace': 'Mini Truck',
  bolero: 'Pickup Truck',
  'tata-407': 'Medium Truck',
  'large-truck': 'Large Truck',
};

const VEHICLE_ICON: Record<string, string> = {
  bike: 'two_wheeler',
  car: 'directions_car',
  'tata-ace': 'local_shipping',
  bolero: 'local_shipping',
  'tata-407': 'local_shipping',
  'large-truck': 'local_shipping',
};

function vehicleLabel(v?: string): string { return (v && VEHICLE_LABEL[v]) || v || 'Delivery'; }
function vehicleIcon(v?: string): string { return (v && VEHICLE_ICON[v]) || 'local_shipping'; }

function formatDate(ts: any): string {
  if (!ts) return '';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatCrn(id?: string): string {
  if (!id) return 'CRN —';
  return `CRN${id.slice(0, 10).toUpperCase()}`;
}

const TripDetails: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const tripId: string | undefined = location.state?.tripId;

  const [trip, setTrip] = useState<(Trip & { id: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [driverName, setDriverName] = useState('');
  const [driverRcNumber, setDriverRcNumber] = useState('');

  useEffect(() => {
    if (!tripId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'trips', tripId));
        if (!snap.exists() || cancelled) { setLoading(false); return; }
        const data = { ...(snap.data() as Trip), id: snap.id };
        setTrip(data);
        if (data.driverId) {
          try {
            const res = await fetch(`/api/driver-info/${data.driverId}`);
            const info = await res.json();
            if (info?.found && !cancelled) {
              setDriverName(info.name || '');
              setDriverRcNumber(info.rcNumber || '');
            }
          } catch { /* non-fatal */ }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tripId]);

  const fareLines = useMemo(() => {
    if (!trip) return null;
    const f = trip.finalFare;
    const couponDiscount = trip.couponDiscount ?? 0;
    const couponCode = trip.couponCode;
    if (f) {
      const tripFare = f.tripFare ?? 0;
      const taxable = f.taxable ?? tripFare;
      const gst = f.gst ?? 0;
      const total = f.total ?? trip.fare ?? 0;
      const rounding = +(total - taxable - gst + couponDiscount).toFixed(2);
      return { tripFare, couponDiscount, couponCode, fareWithoutTax: taxable, gst, rounding, total };
    }
    return {
      tripFare: trip.estimatedTotal ?? (trip.fare ?? 0) + couponDiscount,
      couponDiscount,
      couponCode,
      fareWithoutTax: null as number | null,
      gst: null as number | null,
      rounding: null as number | null,
      total: trip.fare ?? 0,
    };
  }, [trip]);

  const [sendingInvoice, setSendingInvoice] = useState(false);
  const handleMailInvoice = async () => {
    if (!trip) return;
    const recipient = auth.currentUser?.email || prompt('Email the invoice to:') || '';
    if (!recipient) return;
    setSendingInvoice(true);
    try {
      const res = await fetch('/api/email-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId: trip.id, recipientEmail: recipient }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.message || data.error || 'Failed to send invoice. Please try again.');
        return;
      }
      alert(`Invoice sent to ${recipient}.`);
    } catch (err: any) {
      alert('Failed to send invoice: ' + (err?.message || 'Unknown error'));
    } finally {
      setSendingInvoice(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-slate-400 gap-3">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
        <span className="text-sm font-bold">Loading trip…</span>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-slate-400 gap-3 px-6 text-center">
        <span className="material-symbols-outlined text-5xl">error</span>
        <p className="text-sm font-bold">Trip not found</p>
        <button onClick={() => navigate(-1)} className="px-5 py-2 bg-primary text-white rounded-xl text-sm font-bold mt-2">Go back</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-slate-950">
      {/* Header */}
      <header className="px-5 pt-12 pb-3 flex items-center gap-3 border-b border-slate-100 dark:border-slate-800">
        <button onClick={() => navigate(-1)} aria-label="Back" className="size-10 -ml-2 flex items-center justify-center text-slate-700 dark:text-slate-300">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-xl font-bold dark:text-white">Trip details</h1>
      </header>

      <div className="flex-1 overflow-y-auto pb-32">
        {/* Date + CRN + total */}
        <div className="px-5 py-4 flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col">
            <p className="text-base font-bold text-slate-900 dark:text-white">{formatDate(trip.createdAt)}</p>
            <p className="text-xs text-slate-400 mt-0.5">{formatCrn(trip.id)}</p>
          </div>
          <p className="text-lg font-black text-slate-900 dark:text-white whitespace-nowrap">₹{(trip.fare ?? 0).toFixed(1)}</p>
        </div>

        {/* Driver row */}
        <div className="px-5 py-4 flex items-center gap-3 border-b border-slate-100 dark:border-slate-800">
          <div className="size-12 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary text-2xl">{vehicleIcon(trip.vehicleType)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-slate-900 dark:text-white truncate">{driverName || '—'}</p>
            <p className="text-xs text-slate-500 truncate">
              {vehicleLabel(trip.vehicleType)}{driverRcNumber ? ` | ${driverRcNumber}` : ''}
            </p>
          </div>
          {trip.rating && trip.rating > 0 && (
            <div className="flex items-center gap-0.5 shrink-0">
              {[1, 2, 3, 4, 5].map(i => (
                <span key={i} className={`material-symbols-outlined text-base ${i <= trip.rating! ? 'text-amber-400 filled' : 'text-slate-200 dark:text-slate-700'}`}>star</span>
              ))}
            </div>
          )}
        </div>

        {/* Addresses */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex gap-3">
            <div className="flex flex-col items-center pt-1.5 shrink-0">
              <span className="size-3 rounded-full bg-green-500"></span>
              <span className="w-px flex-1 my-1 min-h-[20px] border-l border-dashed border-slate-300 dark:border-slate-600"></span>
              <span className="size-3 rounded-sm bg-red-500"></span>
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-3">
              <p className="text-sm text-slate-700 dark:text-slate-300 truncate">{trip.pickup?.address || '—'}</p>
              <p className="text-sm text-slate-700 dark:text-slate-300 truncate">{trip.dropoff?.address || '—'}</p>
            </div>
          </div>
        </div>

        {/* Fare details */}
        <div className="px-5 pt-5 pb-3">
          <p className="text-sm font-medium text-slate-400 mb-3">Fare details</p>
          <div className="flex flex-col gap-2.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-700 dark:text-slate-300">Trip Fare</span>
              <span className="font-medium text-slate-900 dark:text-white">₹{fareLines!.tripFare.toFixed(2)}</span>
            </div>
            {fareLines!.couponDiscount > 0 && (
              <div className="flex items-center justify-between text-green-600">
                <span>Coupon discount{fareLines!.couponCode ? ` (${fareLines!.couponCode})` : ''}</span>
                <span className="font-medium">−₹{fareLines!.couponDiscount.toFixed(2)}</span>
              </div>
            )}
            {fareLines!.fareWithoutTax !== null && (
              <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-2.5">
                <span className="text-slate-700 dark:text-slate-300">Fare Without Tax</span>
                <span className="font-medium text-slate-900 dark:text-white">₹{fareLines!.fareWithoutTax.toFixed(2)}</span>
              </div>
            )}
            {fareLines!.gst !== null && (
              <div className="flex items-center justify-between">
                <span className="text-slate-700 dark:text-slate-300">IGST Tax (5%)</span>
                <span className="font-medium text-slate-900 dark:text-white">₹{fareLines!.gst.toFixed(2)}</span>
              </div>
            )}
            {fareLines!.rounding !== null && fareLines!.rounding !== 0 && (
              <div className="flex items-center justify-between">
                <span className="text-slate-700 dark:text-slate-300">Rounding</span>
                <span className="font-medium text-slate-900 dark:text-white">₹{fareLines!.rounding.toFixed(2)}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-2.5">
              <span className="text-slate-900 dark:text-white font-semibold">Total Order Fare</span>
              <span className="font-black text-slate-900 dark:text-white">₹{fareLines!.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Payment details */}
        <div className="px-5 pt-5 pb-3 border-t border-slate-100 dark:border-slate-800">
          <p className="text-sm font-medium text-slate-400 mb-3">Payment details</p>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-700 dark:text-slate-300">
              {trip.paymentMethod === 'cash' ? 'Cash' : trip.paymentMethod === 'online' ? 'Online' : 'Wallet'}
            </span>
            <span className="font-medium text-slate-900 dark:text-white">₹{(trip.fare ?? 0).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 px-5 py-4 flex gap-3">
        <button
          onClick={handleMailInvoice}
          disabled={sendingInvoice}
          className="flex-1 h-12 border-2 border-primary text-primary font-bold rounded-full text-sm active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          {sendingInvoice ? 'Sending…' : 'Mail Invoice'}
        </button>
        <button
          onClick={() => navigate('/search', { state: buildBookAgainState(trip) })}
          className="flex-1 h-12 bg-primary text-white font-bold rounded-full text-sm shadow-md shadow-primary/20 active:scale-[0.98] transition-transform"
        >
          Book Again
        </button>
      </div>
    </div>
  );
};

export default TripDetails;
