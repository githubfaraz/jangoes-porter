import React, { useEffect, useMemo, useState } from 'react';
import {
  collection, getDocs, query, orderBy, writeBatch, doc, serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../../src/firebase';
import { Trip, Settlement } from '../../types';
import { summarizeSettlement, COMMISSION_RATE, SettlementSummary } from '../../src/settlement';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { logAdminAction } from '../services/activityLog';

const COMPLETED = new Set(['COMPLETED', 'EXCHANGE_COMPLETED', 'EXCHANGE_FAILED']);

interface DriverRow {
  driverId: string;
  driverName: string;
  unsettled: (Trip & { id: string })[];
  summary: SettlementSummary;
}

function fmt(n: number) { return `₹${(n || 0).toFixed(2)}`; }

function settleDate(ts: any): string {
  if (!ts) return '—';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function Settlements() {
  const { can, uid, name } = useAdminAuth();
  const canSettle = can('settlements.settle');

  const [trips, setTrips] = useState<(Trip & { id: string })[]>([]);
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<(Settlement & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmRow, setConfirmRow] = useState<DriverRow | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [tripsSnap, usersSnap, settleSnap] = await Promise.all([
        getDocs(collection(db, 'trips')),
        getDocs(collection(db, 'users')),
        getDocs(query(collection(db, 'settlements'), orderBy('createdAt', 'desc'))).catch(() => null),
      ]);
      const uMap: Record<string, string> = {};
      usersSnap.forEach(d => { uMap[d.id] = d.data().name || d.data().email || d.id; });
      setUserMap(uMap);
      const list: (Trip & { id: string })[] = [];
      tripsSnap.forEach(d => list.push({ ...(d.data() as Trip), id: d.id }));
      setTrips(list);
      if (settleSnap) {
        const h: (Settlement & { id: string })[] = [];
        settleSnap.forEach(d => h.push({ ...(d.data() as Settlement), id: d.id }));
        setHistory(h);
      }
    } catch (err: any) {
      setError('Failed to load settlements. Check Firestore rules (settlements collection).');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Build per-driver unsettled balances.
  const rows = useMemo<DriverRow[]>(() => {
    const byDriver = new Map<string, (Trip & { id: string })[]>();
    for (const t of trips) {
      if (!t.driverId) continue;
      if (!COMPLETED.has(t.status as string)) continue;
      if (t.settled) continue;
      if (!byDriver.has(t.driverId)) byDriver.set(t.driverId, []);
      byDriver.get(t.driverId)!.push(t);
    }
    return Array.from(byDriver.entries())
      .map(([driverId, ts]) => ({
        driverId,
        driverName: userMap[driverId] || driverId.slice(0, 12),
        unsettled: ts,
        summary: summarizeSettlement(ts),
      }))
      .sort((a, b) => Math.abs(b.summary.net) - Math.abs(a.summary.net));
  }, [trips, userMap]);

  const totals = useMemo(() => {
    let driverOwes = 0, jangoesOwes = 0, tripCount = 0;
    for (const r of rows) {
      if (r.summary.net > 0) driverOwes += r.summary.net;
      else jangoesOwes += Math.abs(r.summary.net);
      tripCount += r.summary.tripCount;
    }
    return { driverOwes, jangoesOwes, trips: tripCount };
  }, [rows]);

  const directionFor = (net: number): Settlement['direction'] =>
    net > 0.005 ? 'driver_to_jangoes' : net < -0.005 ? 'jangoes_to_driver' : 'nil';

  const handleSettle = async () => {
    if (!confirmRow) return;
    setSaving(true);
    try {
      const s = confirmRow.summary;
      const batch = writeBatch(db);
      const settleRef = doc(collection(db, 'settlements'));
      const record: Settlement = {
        driverId: confirmRow.driverId,
        driverName: confirmRow.driverName,
        amount: Math.abs(s.net),
        direction: directionFor(s.net),
        cashCollected: s.cashCollected,
        cashCommission: s.cashCommission,
        onlineCollected: s.onlineCollected,
        onlineEarnings: s.onlineEarnings,
        tripCount: s.tripCount,
        tripIds: s.tripIds,
        note: note.trim() || '',
        createdAt: serverTimestamp(),
        createdByUid: uid,
        createdByName: name || 'Admin',
      };
      batch.set(settleRef, record as any);
      for (const id of s.tripIds) {
        batch.update(doc(db, 'trips', id), { settled: true, settlementId: settleRef.id });
      }
      await batch.commit();
      await logAdminAction({
        action: 'settle_driver',
        target: confirmRow.driverId,
        details: `Settled ${s.tripCount} trips for ${confirmRow.driverName} — ${directionFor(s.net) === 'driver_to_jangoes' ? 'driver pays' : directionFor(s.net) === 'jangoes_to_driver' ? 'Jangoes pays' : 'nil'} ${fmt(Math.abs(s.net))}`,
        metadata: { amount: s.net, tripCount: s.tripCount },
      });
      setConfirmRow(null);
      setNote('');
      await load();
    } catch (err: any) {
      alert('Settlement failed: ' + (err?.message || 'Unknown error'));
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <div className="w-10 h-10 border-4 border-gray-200 border-t-primary rounded-full animate-spin" />
          <span className="text-sm">Loading settlements...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700">
        <span className="material-symbols-outlined align-middle mr-2">error</span>{error}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Drivers owe Jangoes</p>
          <p className="text-2xl font-black text-red-600 mt-1">{fmt(totals.driverOwes)}</p>
          <p className="text-[11px] text-gray-400 mt-1">Commission on cash trips</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Jangoes owes drivers</p>
          <p className="text-2xl font-black text-green-600 mt-1">{fmt(totals.jangoesOwes)}</p>
          <p className="text-[11px] text-gray-400 mt-1">Earnings on online/wallet trips</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Unsettled</p>
          <p className="text-2xl font-black text-gray-800 mt-1">{totals.trips}</p>
          <p className="text-[11px] text-gray-400 mt-1">{rows.length} driver{rows.length === 1 ? '' : 's'} · {Math.round(COMMISSION_RATE * 100)}% commission</p>
        </div>
      </div>

      {/* Pending balances */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800">Pending Driver Balances</h3>
        </div>
        {rows.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <span className="material-symbols-outlined text-5xl">task_alt</span>
            <p className="mt-2 text-sm">All drivers are settled up.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  <th className="px-5 py-3">Driver</th>
                  <th className="px-4 py-3">Trips</th>
                  <th className="px-4 py-3">Cash collected</th>
                  <th className="px-4 py-3">Commission</th>
                  <th className="px-4 py-3">Online earnings</th>
                  <th className="px-4 py-3">Net</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map(r => {
                  const net = r.summary.net;
                  const driverPays = net > 0.005;
                  const jangoesPays = net < -0.005;
                  return (
                    <tr key={r.driverId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 text-sm font-semibold text-gray-700">{r.driverName}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{r.summary.tripCount}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{fmt(r.summary.cashCollected)}</td>
                      <td className="px-4 py-3 text-sm text-red-600">{fmt(r.summary.cashCommission)}</td>
                      <td className="px-4 py-3 text-sm text-green-600">{fmt(r.summary.onlineEarnings)}</td>
                      <td className="px-4 py-3 text-sm font-bold">
                        {driverPays ? (
                          <span className="text-red-600">Driver pays {fmt(net)}</span>
                        ) : jangoesPays ? (
                          <span className="text-green-600">Pay driver {fmt(Math.abs(net))}</span>
                        ) : (
                          <span className="text-gray-400">{fmt(0)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => { setNote(''); setConfirmRow(r); }}
                          disabled={!canSettle}
                          title={canSettle ? 'Record settlement' : 'No permission to settle'}
                          className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Mark Settled
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* History */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800">Settlement History</h3>
        </div>
        {history.length === 0 ? (
          <div className="py-10 text-center text-gray-400 text-sm">No settlements recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  <th className="px-5 py-3">Date</th>
                  <th className="px-4 py-3">Driver</th>
                  <th className="px-4 py-3">Direction</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Trips</th>
                  <th className="px-4 py-3">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {history.map(h => (
                  <tr key={h.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">{settleDate(h.createdAt)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{h.driverName}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className={`px-2 py-0.5 rounded-full font-bold ${h.direction === 'driver_to_jangoes' ? 'bg-red-100 text-red-700' : h.direction === 'jangoes_to_driver' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {h.direction === 'driver_to_jangoes' ? 'Driver → Jangoes' : h.direction === 'jangoes_to_driver' ? 'Jangoes → Driver' : 'Nil'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-800">{fmt(h.amount)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{h.tripCount}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{h.createdByName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirm modal */}
      {confirmRow && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !saving && setConfirmRow(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 mb-1">Record settlement</h3>
            <p className="text-sm text-gray-500 mb-4">{confirmRow.driverName} · {confirmRow.summary.tripCount} trips</p>

            <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1.5 mb-4">
              <div className="flex justify-between"><span className="text-gray-500">Cash collected</span><span className="font-semibold">{fmt(confirmRow.summary.cashCollected)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Commission owed ({Math.round(COMMISSION_RATE * 100)}%)</span><span className="font-semibold text-red-600">{fmt(confirmRow.summary.cashCommission)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Online collected</span><span className="font-semibold">{fmt(confirmRow.summary.onlineCollected)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Online earnings due</span><span className="font-semibold text-green-600">{fmt(confirmRow.summary.onlineEarnings)}</span></div>
              <div className="flex justify-between border-t border-gray-200 pt-1.5 mt-1.5">
                <span className="text-gray-700 font-bold">Net</span>
                <span className="font-black">
                  {confirmRow.summary.net > 0.005
                    ? `Driver pays ${fmt(confirmRow.summary.net)}`
                    : confirmRow.summary.net < -0.005
                      ? `Pay driver ${fmt(Math.abs(confirmRow.summary.net))}`
                      : fmt(0)}
                </span>
              </div>
            </div>

            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Note (optional)</label>
            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. UPI ref / cash received"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary mb-5"
            />

            <p className="text-[11px] text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-4">
              This marks all {confirmRow.summary.tripCount} trips as settled and cannot be undone from the app.
            </p>

            <div className="flex gap-3">
              <button onClick={() => setConfirmRow(null)} disabled={saving} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold disabled:opacity-50">Cancel</button>
              <button onClick={handleSettle} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-dark disabled:opacity-50">
                {saving ? 'Saving…' : 'Confirm Settlement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
