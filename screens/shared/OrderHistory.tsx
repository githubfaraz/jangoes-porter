import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../src/firebase.ts';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { BookingStatus, Trip } from '../../types.ts';

const ONGOING_STATUSES = [
  BookingStatus.SEARCHING, BookingStatus.ACCEPTED, BookingStatus.ARRIVED_AT_PICKUP,
  BookingStatus.PICKING_UP, BookingStatus.IN_TRANSIT, BookingStatus.ARRIVED_AT_DESTINATION,
  BookingStatus.DROPPING_OFF,
];

function formatDate(ts: any): string {
  if (!ts) return '';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function statusLabel(s: BookingStatus): string {
  switch (s) {
    case BookingStatus.SEARCHING: return 'Searching';
    case BookingStatus.ACCEPTED: return 'Driver Assigned';
    case BookingStatus.ARRIVED_AT_PICKUP: return 'At Pickup';
    case BookingStatus.PICKING_UP: return 'Picking Up';
    case BookingStatus.IN_TRANSIT: return 'In Transit';
    case BookingStatus.ARRIVED_AT_DESTINATION: return 'At Destination';
    case BookingStatus.DROPPING_OFF: return 'Dropping Off';
    case BookingStatus.COMPLETED: return 'Delivered';
    case BookingStatus.CANCELLED: return 'Cancelled';
    default: return s;
  }
}

function statusStyle(s: BookingStatus): string {
  if (s === BookingStatus.COMPLETED) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  if (s === BookingStatus.CANCELLED) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
}

const OrderHistory: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'ongoing' | 'history'>('ongoing');
  const [trips, setTrips] = useState<(Trip & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) { setLoading(false); return; }

    // Listen for trips where user is customer OR driver
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
  const history = trips.filter(t => t.status === BookingStatus.COMPLETED || t.status === BookingStatus.CANCELLED);
  const display = activeTab === 'ongoing' ? ongoing : history;

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark">
      <header className="sticky top-0 z-20 bg-white/95 dark:bg-background-dark/95 backdrop-blur-sm border-b dark:border-slate-800 px-4 py-3">
        <h2 className="text-lg font-black text-center text-slate-900 dark:text-white">My Orders</h2>
      </header>

      {/* Tabs */}
      <div className="flex gap-3 px-4 pt-4">
        {(['ongoing', 'history'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${
              activeTab === tab
                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
            }`}
          >
            {tab === 'ongoing' ? `Ongoing (${ongoing.length})` : `History (${history.length})`}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 pb-32 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
            <span className="text-sm font-bold">Loading orders...</span>
          </div>
        ) : display.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <span className="material-symbols-outlined text-5xl">inbox</span>
            <span className="text-sm font-bold">{activeTab === 'ongoing' ? 'No active orders' : 'No order history'}</span>
          </div>
        ) : (
          display.map(trip => (
            <div
              key={trip.id}
              onClick={() => {
                if (ONGOING_STATUSES.includes(trip.status)) {
                  navigate('/tracking', { state: { tripId: trip.id } });
                }
              }}
              className={`bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm ${ONGOING_STATUSES.includes(trip.status) ? 'cursor-pointer active:scale-[0.99] transition-transform' : ''}`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {trip.vehicleType || 'Delivery'}
                </span>
                <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest ${statusStyle(trip.status)}`}>
                  {statusLabel(trip.status)}
                </span>
              </div>

              <div className="flex flex-col gap-3 relative pl-1 mb-3">
                <div className="absolute left-[5px] top-2 bottom-2 w-0.5 bg-slate-100 dark:bg-slate-800"></div>
                <div className="flex items-start gap-3 relative">
                  <div className="size-3 rounded-full bg-green-500 shrink-0 z-10 mt-0.5 ring-2 ring-white dark:ring-slate-900"></div>
                  <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{trip.pickup?.address || 'Pickup'}</span>
                </div>
                <div className="flex items-start gap-3 relative">
                  <div className="size-3 rounded-full bg-red-500 shrink-0 z-10 mt-0.5 ring-2 ring-white dark:ring-slate-900"></div>
                  <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{trip.dropoff?.address || 'Drop'}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-50 dark:border-slate-800">
                <span className="text-xs text-slate-400 font-medium">{formatDate(trip.createdAt)}</span>
                <span className="text-sm font-black text-slate-900 dark:text-white">₹{trip.fare?.toFixed(2) || '0.00'}</span>
              </div>

              {trip.rating && (
                <div className="flex items-center gap-1 mt-2">
                  {[1, 2, 3, 4, 5].map(i => (
                    <span key={i} className={`material-symbols-outlined text-sm ${i <= trip.rating! ? 'text-amber-400 filled' : 'text-slate-200'}`}>star</span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default OrderHistory;
