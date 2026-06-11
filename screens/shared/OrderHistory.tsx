import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../src/firebase.ts';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { BookingStatus, Trip, UserRole } from '../../types.ts';
import { buildBookAgainState } from '../../src/bookAgain.ts';

const ONGOING_STATUSES = [
  BookingStatus.SEARCHING, BookingStatus.ACCEPTED, BookingStatus.ARRIVED_AT_PICKUP,
  BookingStatus.PICKING_UP, BookingStatus.IN_TRANSIT, BookingStatus.ARRIVED_AT_DESTINATION,
  BookingStatus.DROPPING_OFF,
  // Exchange statuses
  BookingStatus.ARRIVED_AT_RECEIVER, BookingStatus.PICKING_UP_PRODUCT_B,
  BookingStatus.QC_PENDING, BookingStatus.QC_APPROVED, BookingStatus.QC_REJECTED,
  BookingStatus.RETURNING_PRODUCT_B, BookingStatus.RETURNING_PRODUCT_A,
  BookingStatus.ARRIVED_AT_ORIGIN_RETURN,
];

const PAST_STATUSES = [
  BookingStatus.COMPLETED, BookingStatus.CANCELLED,
  BookingStatus.EXCHANGE_COMPLETED, BookingStatus.EXCHANGE_FAILED,
];

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

function vehicleLabel(v?: string): string {
  if (!v) return 'Delivery';
  return VEHICLE_LABEL[v] || v;
}

function vehicleIcon(v?: string): string {
  if (!v) return 'local_shipping';
  return VEHICLE_ICON[v] || 'local_shipping';
}

function formatDate(ts: any): string {
  if (!ts) return '';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function statusPill(s: BookingStatus): { label: string; color: string; icon: string } {
  if (s === BookingStatus.COMPLETED || s === BookingStatus.EXCHANGE_COMPLETED) {
    return { label: 'Completed', color: 'text-green-600', icon: 'check_circle' };
  }
  if (s === BookingStatus.CANCELLED) {
    return { label: 'Cancelled', color: 'text-red-500', icon: 'cancel' };
  }
  if (s === BookingStatus.EXCHANGE_FAILED) {
    return { label: 'Exchange Failed', color: 'text-amber-600', icon: 'error' };
  }
  return { label: 'Ongoing', color: 'text-blue-600', icon: 'pending' };
}

const OrderHistory: React.FC<{ role?: UserRole }> = ({ role }) => {
  const navigate = useNavigate();
  // Drivers don't book or pay, so Mail Invoice + Book Again are customer-only.
  const isDriver = role === UserRole.DRIVER;
  const [trips, setTrips] = useState<(Trip & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [mailingTripId, setMailingTripId] = useState<string | null>(null);

  // Mirrors TripDetails.handleMailInvoice — same /api/email-invoice endpoint,
  // works for ongoing trips too (the server doesn't gate on status).
  const handleMailInvoice = async (trip: Trip & { id: string }) => {
    const recipient = auth.currentUser?.email || prompt('Email the invoice to:') || '';
    if (!recipient) return;
    setMailingTripId(trip.id);
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
      setMailingTripId(null);
    }
  };

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) { setLoading(false); return; }

    const customerQ = query(collection(db, 'trips'), where('customerId', '==', user.uid));
    const driverQ = query(collection(db, 'trips'), where('driverId', '==', user.uid));

    const allTrips = new Map<string, Trip & { id: string }>();

    const update = () => {
      const sorted = Array.from(allTrips.values()).sort((a, b) => {
        const aT = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
        const bT = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
        return bT - aT;
      });
      setTrips(sorted);
      setLoading(false);
    };

    const unsub1 = onSnapshot(customerQ, (snap) => {
      snap.docs.forEach(d => allTrips.set(d.id, { ...d.data() as Trip, id: d.id }));
      snap.docChanges().forEach(c => { if (c.type === 'removed') allTrips.delete(c.doc.id); });
      update();
    });

    const unsub2 = onSnapshot(driverQ, (snap) => {
      snap.docs.forEach(d => allTrips.set(d.id, { ...d.data() as Trip, id: d.id }));
      snap.docChanges().forEach(c => { if (c.type === 'removed') allTrips.delete(c.doc.id); });
      update();
    });

    return () => { unsub1(); unsub2(); };
  }, []);

  const ongoing = trips.filter(t => ONGOING_STATUSES.includes(t.status));
  const pastAll = trips.filter(t => PAST_STATUSES.includes(t.status));
  const past = pastAll.slice(0, 5);
  const hasMorePast = pastAll.length > 5;

  return (
    <div className="flex flex-col h-screen bg-background-light dark:bg-background-dark">
      <header className="px-5 pt-12 pb-3 bg-white dark:bg-background-dark shrink-0">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Orders</h1>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-32">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
            <span className="text-sm font-bold">Loading orders...</span>
          </div>
        ) : trips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <span className="material-symbols-outlined text-5xl">inbox</span>
            <span className="text-sm font-bold">No orders yet</span>
          </div>
        ) : (
          <>
            {/* Ongoing — kept above Past so customers can still jump back into an active trip */}
            {ongoing.length > 0 && (
              <>
                <div className="bg-slate-100 dark:bg-slate-800/40 px-5 py-2.5">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ongoing</span>
                </div>
                {ongoing.map(trip => (
                  <div
                    key={trip.id}
                    className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-5 py-4 flex items-center gap-3"
                  >
                    <button
                      onClick={() => navigate('/tracking', { state: { tripId: trip.id } })}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left active:opacity-80 transition-opacity"
                    >
                      <span className="material-symbols-outlined text-primary text-2xl">{vehicleIcon(trip.vehicleType)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{vehicleLabel(trip.vehicleType)}</p>
                        <p className="text-xs text-slate-400">{formatDate(trip.createdAt)}</p>
                      </div>
                      <span className="text-sm font-black text-slate-900 dark:text-white">₹{trip.fare?.toFixed(0) || '0'}</span>
                    </button>
                    {!isDriver && (
                      <button
                        onClick={() => handleMailInvoice(trip)}
                        disabled={mailingTripId === trip.id}
                        aria-label="Mail invoice"
                        className="size-9 rounded-full border border-primary text-primary flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50 shrink-0"
                      >
                        <span className="material-symbols-outlined text-base">
                          {mailingTripId === trip.id ? 'hourglass_top' : 'mail'}
                        </span>
                      </button>
                    )}
                    <button
                      onClick={() => navigate('/tracking', { state: { tripId: trip.id } })}
                      aria-label="Open tracking"
                      className="text-slate-400 shrink-0"
                    >
                      <span className="material-symbols-outlined">chevron_right</span>
                    </button>
                  </div>
                ))}
              </>
            )}

            {/* Past */}
            {past.length > 0 && (
              <>
                <div className="bg-slate-100 dark:bg-slate-800/40 px-5 py-2.5 mt-px">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Past</span>
                </div>
                <div className="bg-white dark:bg-slate-900">
                  {past.map((trip, idx) => {
                    const pill = statusPill(trip.status);
                    const isFirst = idx === 0;
                    return (
                      <div key={trip.id} className={`px-5 pt-4 pb-5 ${!isFirst ? 'border-t-8 border-slate-100 dark:border-slate-800/40' : ''}`}>
                        {/* Header row: vehicle icon + label + date + fare + chevron */}
                        <button
                          onClick={() => navigate('/trip-details', { state: { tripId: trip.id } })}
                          className="w-full flex items-center gap-3 mb-3 text-left active:opacity-80 transition-opacity"
                        >
                          <div className="size-12 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-primary text-2xl">{vehicleIcon(trip.vehicleType)}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-base font-bold text-slate-900 dark:text-white">{vehicleLabel(trip.vehicleType)}</p>
                            <p className="text-xs text-slate-400">{formatDate(trip.createdAt)}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-base font-black text-slate-900 dark:text-white">₹{trip.fare?.toFixed(0) || '0'}</span>
                            <span className="material-symbols-outlined text-slate-400">chevron_right</span>
                          </div>
                        </button>

                        {/* Address card — Exchange shows 3 legs (sender → receiver → sender return) */}
                        {trip.serviceType === 'exchange' ? (
                        <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4 mb-3">
                          <div className="flex gap-3">
                            <div className="flex flex-col items-center pt-2 shrink-0">
                              <span className="size-2.5 rounded-full bg-green-500"></span>
                              <span className="w-px flex-1 bg-slate-300 dark:bg-slate-600 my-1 min-h-[28px] border-l border-dashed border-slate-300 dark:border-slate-600"></span>
                              <span className="size-2.5 rounded-full bg-red-500"></span>
                              <span className="w-px flex-1 bg-slate-300 dark:bg-slate-600 my-1 min-h-[28px] border-l border-dashed border-slate-300 dark:border-slate-600"></span>
                              <span className="size-2.5 rounded-full bg-green-500 ring-2 ring-green-200"></span>
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col gap-3">
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Leg 1 · Pick up Product A</p>
                                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                  {trip.senderName || 'Sender'}{trip.senderPhone ? ` • ${trip.senderPhone}` : ''}
                                </p>
                                <p className="text-xs text-slate-500 truncate">{trip.pickup?.address || '—'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Leg 2 · Deliver A / Collect B</p>
                                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                  {trip.receiverName || 'Receiver'}{trip.receiverPhone ? ` • ${trip.receiverPhone}` : ''}
                                </p>
                                <p className="text-xs text-slate-500 truncate">{trip.dropoff?.address || '—'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                                  Leg 3 · {trip.status === BookingStatus.EXCHANGE_FAILED ? "Return Product 'A'" : "Return Product 'B'"} to you
                                </p>
                                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                  {trip.senderName || 'Sender'}{trip.senderPhone ? ` • ${trip.senderPhone}` : ''}
                                </p>
                                <p className="text-xs text-slate-500 truncate">{trip.pickup?.address || '—'}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        ) : (
                        <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4 mb-3">
                          <div className="flex gap-3">
                            <div className="flex flex-col items-center pt-2 shrink-0">
                              <span className="size-2.5 rounded-full bg-green-500"></span>
                              <span className="w-px flex-1 bg-slate-300 dark:bg-slate-600 my-1 min-h-[28px] border-l border-dashed border-slate-300 dark:border-slate-600"></span>
                              <span className="size-2.5 rounded-full bg-red-500"></span>
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col gap-3">
                              <div>
                                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                  {trip.senderName || 'Sender'}{trip.senderPhone ? ` • ${trip.senderPhone}` : ''}
                                </p>
                                <p className="text-xs text-slate-500 truncate">{trip.pickup?.address || '—'}</p>
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                  {trip.receiverName || 'Receiver'}{trip.receiverPhone ? ` • ${trip.receiverPhone}` : ''}
                                </p>
                                <p className="text-xs text-slate-500 truncate">{trip.dropoff?.address || '—'}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        )}

                        {/* Status + Mail Invoice + Book Again row */}
                        <div className="flex items-center justify-between gap-2">
                          <div className={`flex items-center gap-1.5 ${pill.color} min-w-0`}>
                            <span className="material-symbols-outlined text-base">{pill.icon}</span>
                            <span className="text-sm font-bold truncate">{pill.label}</span>
                          </div>
                          {!isDriver && (
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => handleMailInvoice(trip)}
                                disabled={mailingTripId === trip.id}
                                className="px-3 h-10 border border-primary text-primary text-xs font-bold rounded-xl active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center gap-1.5"
                              >
                                <span className="material-symbols-outlined text-base">
                                  {mailingTripId === trip.id ? 'hourglass_top' : 'mail'}
                                </span>
                                {mailingTripId === trip.id ? 'Sending…' : 'Mail Invoice'}
                              </button>
                              <button
                                onClick={() => navigate('/search', { state: buildBookAgainState(trip) })}
                                className="px-4 h-10 bg-primary text-white text-sm font-bold rounded-xl active:scale-[0.98] transition-transform"
                              >
                                Book Again
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {hasMorePast && (
                  <div className="bg-white dark:bg-slate-900 px-5 py-4 border-t-8 border-slate-100 dark:border-slate-800/40">
                    <button
                      onClick={() => navigate('/orders/all')}
                      className="w-full h-12 border-2 border-primary text-primary text-sm font-bold rounded-xl active:scale-[0.98] transition-transform flex items-center justify-center gap-1.5"
                    >
                      View All ({pastAll.length})
                      <span className="material-symbols-outlined text-base">arrow_forward</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default OrderHistory;
