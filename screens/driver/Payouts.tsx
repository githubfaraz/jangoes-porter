import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../src/firebase.ts';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { BookingStatus, Trip } from '../../types.ts';

const COMPLETED_STATUSES = [
  BookingStatus.COMPLETED,
  BookingStatus.EXCHANGE_COMPLETED,
  BookingStatus.EXCHANGE_FAILED,
];

function formatDate(ts: any): string {
  if (!ts) return '';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function tripIcon(t: Trip): string {
  if (t.serviceType === 'exchange') return 'swap_horiz';
  if (t.status === BookingStatus.CANCELLED) return 'block';
  return 'local_shipping';
}

function tripLabel(t: Trip & { id: string }): string {
  if (t.serviceType === 'exchange') return `Exchange #${t.id.slice(-6).toUpperCase()}`;
  return `Delivery #${t.id.slice(-6).toUpperCase()}`;
}

const DriverPayouts: React.FC = () => {
  const navigate = useNavigate();
  const [trips, setTrips] = useState<(Trip & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) { setLoading(false); return; }

    const q = query(collection(db, 'trips'), where('driverId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs
        .map(d => ({ ...(d.data() as Trip), id: d.id }))
        .filter(t => COMPLETED_STATUSES.includes(t.status))
        .sort((a, b) => {
          const aT = a.completedAt ? new Date(a.completedAt).getTime() : (a.updatedAt ? new Date(a.updatedAt).getTime() : 0);
          const bT = b.completedAt ? new Date(b.completedAt).getTime() : (b.updatedAt ? new Date(b.updatedAt).getTime() : 0);
          return bT - aT;
        });
      setTrips(arr);
      setLoading(false);
    }, (err) => {
      console.error('[Payouts] Firestore error:', err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const totalEarnings = trips.reduce((sum, t) => sum + (t.fare || 0), 0);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday = start of week

  const dailyEarnings = trips
    .filter(t => t.completedAt && new Date(t.completedAt).getTime() >= todayStart)
    .reduce((sum, t) => sum + (t.fare || 0), 0);

  const weeklyEarnings = trips
    .filter(t => t.completedAt && new Date(t.completedAt).getTime() >= weekStart.getTime())
    .reduce((sum, t) => sum + (t.fare || 0), 0);

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark overflow-x-hidden">
      <header className="flex items-center p-4 pb-2 justify-between sticky top-0 z-10 bg-white/95 dark:bg-background-dark/95 backdrop-blur-sm">
        <div className="size-10"></div>
        <h2 className="text-lg font-bold flex-1 text-center pr-10">Payouts</h2>
        <button onClick={() => navigate('/help')} className="p-2"><span className="material-symbols-outlined">help</span></button>
      </header>

      <main className="flex-1 overflow-y-auto pb-28 px-4 no-scrollbar">
        <section className="flex flex-col items-center pt-6 pb-8">
          <p className="text-slate-500 text-sm font-medium uppercase tracking-wider mb-2">Total Earnings</p>
          <h1 className="text-[40px] font-bold leading-tight mb-6">₹{totalEarnings.toFixed(2)}</h1>
          <button className="w-full bg-primary hover:bg-primary-dark text-white font-bold h-14 rounded-xl shadow-lg flex items-center justify-center gap-2">
            <span className="material-symbols-outlined">account_balance</span>
            Withdraw to Bank
          </button>
          <p className="text-center text-[10px] text-slate-400 mt-3 flex items-center justify-center gap-1">
            <span className="material-symbols-outlined text-[14px]">lock</span>
            Secure transaction via Stripe
          </p>
        </section>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-white dark:bg-surface-dark rounded-xl p-4 flex flex-col gap-1 border border-slate-100">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-lg bg-green-500/10 text-green-500">
                <span className="material-symbols-outlined text-[20px]">trending_up</span>
              </div>
              <span className="text-xs text-slate-500 font-medium">Today</span>
            </div>
            <p className="text-2xl font-bold">₹{dailyEarnings.toFixed(2)}</p>
            <p className="text-[9px] text-slate-400">Earnings today</p>
          </div>
          <div className="bg-white dark:bg-surface-dark rounded-xl p-4 flex flex-col gap-1 border border-slate-100">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-lg bg-blue-50 text-blue-500">
                <span className="material-symbols-outlined text-[20px]">calendar_view_week</span>
              </div>
              <span className="text-xs text-slate-500 font-medium">This Week</span>
            </div>
            <p className="text-2xl font-bold">₹{weeklyEarnings.toFixed(2)}</p>
            <p className="text-[9px] text-slate-400">Current week total</p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-base font-bold">Transaction History</h3>
            <span className="text-slate-400 text-xs">{trips.length} {trips.length === 1 ? 'trip' : 'trips'}</span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
              <span className="text-sm font-bold">Loading transactions...</span>
            </div>
          ) : trips.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
              <span className="material-symbols-outlined text-5xl">receipt_long</span>
              <span className="text-sm font-bold">No earnings yet</span>
              <span className="text-xs">Complete a trip to see it here</span>
            </div>
          ) : (
            trips.map((t) => {
              const failed = t.status === BookingStatus.EXCHANGE_FAILED;
              const colorClass = failed ? 'text-amber-500' : t.serviceType === 'exchange' ? 'text-rose-500' : 'text-primary';
              return (
                <div key={t.id} className="flex items-center justify-between p-4 bg-white dark:bg-surface-dark rounded-xl shadow-sm border border-slate-50">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`size-10 rounded-full bg-slate-50 flex items-center justify-center shrink-0 ${colorClass}`}>
                      <span className="material-symbols-outlined">{tripIcon(t)}</span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-sm truncate">{tripLabel(t)}</span>
                      <span className="text-slate-400 text-[10px] truncate">
                        {formatDate(t.completedAt || t.updatedAt)}
                        {failed ? ' • Failed' : ''}
                      </span>
                    </div>
                  </div>
                  <span className="font-bold text-sm shrink-0 ml-2">+₹{(t.fare || 0).toFixed(2)}</span>
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
};

export default DriverPayouts;
