import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../src/firebase.ts';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { BookingStatus, Trip, Settlement } from '../../types.ts';
import {
  paymentLabel, isCashPayment, summarizeSettlement, COMMISSION_RATE,
} from '../../src/settlement.ts';

const COMPLETED_STATUSES = [
  BookingStatus.COMPLETED,
  BookingStatus.EXCHANGE_COMPLETED,
  BookingStatus.EXCHANGE_FAILED,
];

const TX_PAGE_SIZE = 8;

// Robust completion time: exchange trips historically lacked `completedAt`, so
// fall back to updatedAt then createdAt. This is the fix for the "today total
// shows wrong" bug — exchange earnings were being dropped by the date filter.
function tripTime(t: Trip): number {
  if (t.completedAt) return new Date(t.completedAt).getTime();
  if (t.updatedAt) return new Date(t.updatedAt).getTime();
  const c: any = t.createdAt;
  if (c?.toDate) return c.toDate().getTime();
  if (c) return new Date(c).getTime();
  return 0;
}

function formatDate(t: Trip): string {
  const ms = tripTime(t);
  if (!ms) return '';
  return new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
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

interface Split { total: number; online: number; cash: number; }

function splitFares(trips: Trip[]): Split {
  let total = 0, online = 0, cash = 0;
  for (const t of trips) {
    const fare = t.fare || 0;
    total += fare;
    if (isCashPayment(t.paymentMethod)) cash += fare; else online += fare;
  }
  return { total, online, cash };
}

const SplitBox: React.FC<{ icon: string; tint: string; label: string; sub: string; split: Split }> = ({ icon, tint, label, sub, split }) => (
  <div className="bg-white dark:bg-surface-dark rounded-xl p-4 flex flex-col gap-1 border border-slate-100">
    <div className="flex items-center gap-2 mb-1">
      <div className={`p-1.5 rounded-lg ${tint}`}>
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
      </div>
      <span className="text-xs text-slate-500 font-medium">{label}</span>
    </div>
    <p className="text-2xl font-bold">₹{split.total.toFixed(2)}</p>
    <div className="flex items-center gap-2 mt-1 flex-wrap">
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full">
        Online ₹{split.online.toFixed(0)}
      </span>
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full">
        Cash ₹{split.cash.toFixed(0)}
      </span>
    </div>
    <p className="text-[9px] text-slate-400 mt-0.5">{sub}</p>
  </div>
);

const DriverPayouts: React.FC = () => {
  const navigate = useNavigate();
  const [trips, setTrips] = useState<(Trip & { id: string })[]>([]);
  const [settlements, setSettlements] = useState<(Settlement & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [txPage, setTxPage] = useState(0);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) { setLoading(false); return; }

    const tripsQ = query(collection(db, 'trips'), where('driverId', '==', user.uid));
    const unsubTrips = onSnapshot(tripsQ, (snap) => {
      const arr = snap.docs
        .map(d => ({ ...(d.data() as Trip), id: d.id }))
        .filter(t => COMPLETED_STATUSES.includes(t.status))
        .sort((a, b) => tripTime(b) - tripTime(a));
      setTrips(arr);
      setLoading(false);
    }, (err) => {
      console.error('[Payouts] Firestore error:', err);
      setLoading(false);
    });

    const settleQ = query(collection(db, 'settlements'), where('driverId', '==', user.uid));
    const unsubSettle = onSnapshot(settleQ, (snap) => {
      const arr = snap.docs
        .map(d => ({ ...(d.data() as Settlement), id: d.id }))
        .sort((a, b) => {
          const at = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
          const bt = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
          return bt - at;
        });
      setSettlements(arr);
    }, () => { /* settlements may not exist yet — non-fatal */ });

    return () => { unsubTrips(); unsubSettle(); };
  }, []);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekStart = (() => { const d = new Date(todayStart); d.setDate(d.getDate() - d.getDay()); return d.getTime(); })();

  const totalSplit = useMemo(() => splitFares(trips), [trips]);
  const todaySplit = useMemo(() => splitFares(trips.filter(t => tripTime(t) >= todayStart)), [trips, todayStart]);
  const weekSplit = useMemo(() => splitFares(trips.filter(t => tripTime(t) >= weekStart)), [trips, weekStart]);

  // Month-wise earnings (req 4) — grouped by calendar month, newest first.
  const monthly = useMemo(() => {
    const map = new Map<string, { label: string; trips: Trip[] }>();
    for (const t of trips) {
      const ms = tripTime(t);
      if (!ms) continue;
      const d = new Date(ms);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      if (!map.has(key)) map.set(key, { label, trips: [] });
      map.get(key)!.trips.push(t);
    }
    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([key, v]) => ({ key, label: v.label, count: v.trips.length, split: splitFares(v.trips) }));
  }, [trips]);

  // Settlement: net unsettled balance (driver ↔ Jangoes).
  const unsettled = useMemo(() => trips.filter(t => !t.settled), [trips]);
  const balance = useMemo(() => summarizeSettlement(unsettled), [unsettled]);
  const lastSettlement = settlements[0];

  // Transaction history pagination
  const txTotalPages = Math.max(1, Math.ceil(trips.length / TX_PAGE_SIZE));
  const txPageTrips = useMemo(
    () => trips.slice(txPage * TX_PAGE_SIZE, (txPage + 1) * TX_PAGE_SIZE),
    [trips, txPage],
  );
  useEffect(() => { if (txPage >= txTotalPages) setTxPage(txTotalPages - 1); }, [txTotalPages, txPage]);

  const driverOwes = balance.net > 0.005;
  const jangoesOwes = balance.net < -0.005;

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark overflow-x-hidden">
      <header className="flex items-center p-4 pb-2 justify-between sticky top-0 z-10 bg-white/95 dark:bg-background-dark/95 backdrop-blur-sm">
        <div className="size-10"></div>
        <h2 className="text-lg font-bold flex-1 text-center pr-10">Payouts</h2>
        <button onClick={() => navigate('/help')} className="p-2"><span className="material-symbols-outlined">help</span></button>
      </header>

      <main className="flex-1 overflow-y-auto pb-28 px-4 no-scrollbar">
        <section className="flex flex-col items-center pt-6 pb-6">
          <p className="text-slate-500 text-sm font-medium uppercase tracking-wider mb-2">Total Earnings</p>
          <h1 className="text-[40px] font-bold leading-tight mb-1">₹{totalSplit.total.toFixed(2)}</h1>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-green-600 bg-green-500/10 px-2.5 py-1 rounded-full">Online ₹{totalSplit.online.toFixed(0)}</span>
            <span className="text-xs font-bold text-amber-600 bg-amber-500/10 px-2.5 py-1 rounded-full">Cash ₹{totalSplit.cash.toFixed(0)}</span>
          </div>
        </section>

        {/* ── Settlement card (driver ↔ Jangoes) ───────────────────────────── */}
        <div className={`rounded-2xl p-5 mb-6 border ${driverOwes ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40' : jangoesOwes ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/40' : 'bg-slate-50 dark:bg-surface-dark border-slate-100 dark:border-slate-800'}`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Settlement Balance</span>
            <span className="material-symbols-outlined text-slate-400 text-[20px]">account_balance</span>
          </div>

          {driverOwes ? (
            <>
              <p className="text-3xl font-black text-red-600 dark:text-red-400">₹{balance.net.toFixed(2)}</p>
              <p className="text-xs font-semibold text-red-500 mb-3">You owe Jangoes (commission on cash trips)</p>
            </>
          ) : jangoesOwes ? (
            <>
              <p className="text-3xl font-black text-green-600 dark:text-green-400">₹{Math.abs(balance.net).toFixed(2)}</p>
              <p className="text-xs font-semibold text-green-600 mb-3">Jangoes owes you (online earnings)</p>
            </>
          ) : (
            <>
              <p className="text-3xl font-black text-slate-700 dark:text-slate-200">₹0.00</p>
              <p className="text-xs font-semibold text-slate-400 mb-3">All settled up</p>
            </>
          )}

          <div className="grid grid-cols-2 gap-2 text-xs border-t border-black/5 dark:border-white/10 pt-3">
            <div className="flex flex-col">
              <span className="text-slate-400">Cash collected</span>
              <span className="font-bold">₹{balance.cashCollected.toFixed(2)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-slate-400">Commission owed ({Math.round(COMMISSION_RATE * 100)}%)</span>
              <span className="font-bold text-red-500">₹{balance.cashCommission.toFixed(2)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-slate-400">Online collected</span>
              <span className="font-bold">₹{balance.onlineCollected.toFixed(2)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-slate-400">Online earnings due</span>
              <span className="font-bold text-green-600">₹{balance.onlineEarnings.toFixed(2)}</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-3 flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">info</span>
            {balance.tripCount} unsettled trip{balance.tripCount === 1 ? '' : 's'}. Settlements are processed by Jangoes.
          </p>
          {lastSettlement && (
            <p className="text-[10px] text-slate-400 mt-1">
              Last settled: ₹{lastSettlement.amount.toFixed(2)} on {lastSettlement.createdAt?.toDate ? lastSettlement.createdAt.toDate().toLocaleDateString('en-IN') : '—'}
            </p>
          )}
        </div>

        {/* ── Today / This Week (req 4) ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <SplitBox icon="trending_up" tint="bg-green-500/10 text-green-500" label="Today" sub="Earnings today" split={todaySplit} />
          <SplitBox icon="calendar_view_week" tint="bg-blue-50 text-blue-500" label="This Week" sub="Current week total" split={weekSplit} />
        </div>

        {/* ── Monthly earnings (req 4) ──────────────────────────────────────── */}
        {monthly.length > 0 && (
          <div className="flex flex-col gap-2 mb-6">
            <h3 className="text-base font-bold px-1 mb-1">Monthly Earnings</h3>
            {monthly.map(m => (
              <div key={m.key} className="bg-white dark:bg-surface-dark rounded-xl p-4 border border-slate-100 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-sm font-bold">{m.label}</span>
                  <span className="text-[10px] text-slate-400">{m.count} trip{m.count === 1 ? '' : 's'}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-lg font-black">₹{m.split.total.toFixed(2)}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-bold text-green-600">On ₹{m.split.online.toFixed(0)}</span>
                    <span className="text-[9px] font-bold text-amber-600">Cash ₹{m.split.cash.toFixed(0)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Transaction history (paginated, req 2) ────────────────────────── */}
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
            <>
              {txPageTrips.map((t) => {
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
                          {formatDate(t)}
                          {failed ? ' • Failed' : ''}
                          {` • ${paymentLabel(t.paymentMethod)}`}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end shrink-0 ml-2">
                      <span className="font-bold text-sm">+₹{(t.fare || 0).toFixed(2)}</span>
                      {t.settled && <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Settled</span>}
                    </div>
                  </div>
                );
              })}

              {txTotalPages > 1 && (
                <div className="flex items-center justify-between gap-3 pt-1">
                  <button
                    onClick={() => setTxPage(p => Math.max(0, p - 1))}
                    disabled={txPage === 0}
                    className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 active:scale-[0.98] transition-transform disabled:opacity-40 flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-base">chevron_left</span>
                    Prev
                  </button>
                  <span className="text-sm font-bold text-slate-500">Page {txPage + 1} of {txTotalPages}</span>
                  <button
                    onClick={() => setTxPage(p => Math.min(txTotalPages - 1, p + 1))}
                    disabled={txPage >= txTotalPages - 1}
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
      </main>
    </div>
  );
};

export default DriverPayouts;
