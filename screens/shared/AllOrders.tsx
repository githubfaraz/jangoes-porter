import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../src/firebase.ts';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { BookingStatus, Trip, UserRole } from '../../types.ts';
import { buildBookAgainState } from '../../src/bookAgain.ts';

const PAST_STATUSES = [
  BookingStatus.COMPLETED, BookingStatus.CANCELLED,
  BookingStatus.EXCHANGE_COMPLETED, BookingStatus.EXCHANGE_FAILED,
];

const PAGE_SIZE = 10;

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

const AllOrders: React.FC<{ role?: UserRole }> = ({ role }) => {
  const navigate = useNavigate();
  const isDriver = role === UserRole.DRIVER;
  const [trips, setTrips] = useState<(Trip & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [mailingTripId, setMailingTripId] = useState<string | null>(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) { setLoading(false); return; }

    const customerQ = query(collection(db, 'trips'), where('customerId', '==', user.uid));
    const driverQ = query(collection(db, 'trips'), where('driverId', '==', user.uid));
    const all = new Map<string, Trip & { id: string }>();

    const update = () => {
      const sorted = Array.from(all.values())
        .filter(t => PAST_STATUSES.includes(t.status))
        .sort((a, b) => {
          const aT = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
          const bT = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
          return bT - aT;
        });
      setTrips(sorted);
      setLoading(false);
    };

    const u1 = onSnapshot(customerQ, snap => {
      snap.docs.forEach(d => all.set(d.id, { ...(d.data() as Trip), id: d.id }));
      snap.docChanges().forEach(c => { if (c.type === 'removed') all.delete(c.doc.id); });
      update();
    });
    const u2 = onSnapshot(driverQ, snap => {
      snap.docs.forEach(d => all.set(d.id, { ...(d.data() as Trip), id: d.id }));
      snap.docChanges().forEach(c => { if (c.type === 'removed') all.delete(c.doc.id); });
      update();
    });
    return () => { u1(); u2(); };
  }, []);

  const totalPages = Math.max(1, Math.ceil(trips.length / PAGE_SIZE));
  const pageTrips = useMemo(
    () => trips.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [trips, page],
  );

  useEffect(() => {
    if (page >= totalPages) setPage(totalPages - 1);
  }, [totalPages, page]);

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

  return (
    <div className="flex flex-col h-screen bg-background-light dark:bg-background-dark">
      <header className="px-5 pt-12 pb-3 flex items-center gap-3 bg-white dark:bg-background-dark shrink-0 border-b border-slate-100 dark:border-slate-800">
        <button onClick={() => navigate(-1)} aria-label="Back" className="size-10 -ml-2 flex items-center justify-center text-slate-700 dark:text-slate-300">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-black text-slate-900 dark:text-white">Order History</h1>
          {!loading && trips.length > 0 && (
            <p className="text-xs text-slate-400">{trips.length} order{trips.length === 1 ? '' : 's'}</p>
          )}
        </div>
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
            <span className="text-sm font-bold">No past orders</span>
          </div>
        ) : (
          <>
            <div className="bg-white dark:bg-slate-900">
              {pageTrips.map((trip, idx) => {
                const pill = statusPill(trip.status);
                const isFirst = idx === 0;
                return (
                  <div key={trip.id} className={`px-5 pt-4 pb-5 ${!isFirst ? 'border-t-8 border-slate-100 dark:border-slate-800/40' : ''}`}>
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

            {totalPages > 1 && (
              <div className="px-5 py-4 flex items-center justify-between gap-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 active:scale-[0.98] transition-transform disabled:opacity-40 flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-base">chevron_left</span>
                  Prev
                </button>
                <span className="text-sm font-bold text-slate-500">
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 active:scale-[0.98] transition-transform disabled:opacity-40 flex items-center gap-1"
                >
                  Next
                  <span className="material-symbols-outlined text-base">chevron_right</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AllOrders;
