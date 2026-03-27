import React, { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../../src/firebase';

interface Trip {
  id: string;
  customerId: string;
  driverId?: string;
  status: string;
  fare: number;
  vehicleType: string;
  pickup: { address: string; lat: number; lng: number };
  dropoff: { address: string; lat: number; lng: number };
  senderName: string;
  receiverName: string;
  receiverPhone: string;
  pickupPin: string;
  createdAt: any;
  acceptedAt?: string;
}

const ALL_STATUSES = ['ALL', 'SEARCHING', 'ACCEPTED', 'ARRIVED_AT_PICKUP', 'PICKING_UP', 'IN_TRANSIT', 'ARRIVED_AT_DESTINATION', 'DROPPING_OFF', 'COMPLETED', 'CANCELLED'];

const STATUS_COLORS: Record<string, string> = {
  SEARCHING: 'bg-yellow-100 text-yellow-700',
  ACCEPTED: 'bg-blue-100 text-blue-700',
  ARRIVED_AT_PICKUP: 'bg-indigo-100 text-indigo-700',
  PICKING_UP: 'bg-indigo-100 text-indigo-700',
  IN_TRANSIT: 'bg-purple-100 text-purple-700',
  ARRIVED_AT_DESTINATION: 'bg-orange-100 text-orange-700',
  DROPPING_OFF: 'bg-orange-100 text-orange-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

function shortStatus(s: string) {
  return s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function shortAddr(addr: string = '') {
  return addr.length > 30 ? addr.slice(0, 30) + '…' : addr;
}

function formatDate(ts: any) {
  if (!ts) return '—';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function Trips() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [tripsSnap, usersSnap] = await Promise.all([
          getDocs(query(collection(db, 'trips'), orderBy('createdAt', 'desc'))),
          getDocs(collection(db, 'users')),
        ]);
        const uMap: Record<string, string> = {};
        usersSnap.forEach(d => { uMap[d.id] = d.data().name || d.data().email || d.id; });
        setUserMap(uMap);
        const list: Trip[] = [];
        tripsSnap.forEach(d => list.push({ ...d.data() as Trip, id: d.id }));
        setTrips(list);
      } catch (err: any) {
        setError('Failed to load trips. Check Firestore security rules.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    let list = trips;
    if (statusFilter !== 'ALL') list = list.filter(t => t.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.id.toLowerCase().includes(q) ||
        (userMap[t.customerId] || '').toLowerCase().includes(q) ||
        (t.driverId && (userMap[t.driverId] || '').toLowerCase().includes(q)) ||
        t.pickup?.address?.toLowerCase().includes(q) ||
        t.dropoff?.address?.toLowerCase().includes(q) ||
        t.senderName?.toLowerCase().includes(q) ||
        t.receiverName?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [trips, statusFilter, search, userMap]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <div className="w-10 h-10 border-4 border-gray-200 border-t-primary rounded-full animate-spin" />
          <span className="text-sm">Loading trips...</span>
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
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 flex-1 min-w-48">
          <span className="material-symbols-outlined text-gray-400 text-xl">search</span>
          <input
            type="text"
            placeholder="Search trips, customers, addresses…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 text-sm focus:outline-none text-gray-700 placeholder-gray-400"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          )}
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-primary text-gray-700"
        >
          {ALL_STATUSES.map(s => (
            <option key={s} value={s}>{s === 'ALL' ? 'All Statuses' : shortStatus(s)}</option>
          ))}
        </select>
        <span className="text-xs text-gray-400 font-semibold">
          {filtered.length} of {trips.length} trips
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <span className="material-symbols-outlined text-5xl">local_shipping</span>
            <p className="mt-2 text-sm">No trips found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Trip ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Driver</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Route</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Vehicle</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Fare</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Date</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(trip => (
                  <React.Fragment key={trip.id}>
                    <tr className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <span className="text-xs font-mono text-gray-500">{trip.id.slice(0, 8)}…</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{userMap[trip.customerId] || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{trip.driverId ? (userMap[trip.driverId] || trip.driverId.slice(0, 10)) : <span className="text-gray-300 text-xs">Not assigned</span>}</td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-gray-600">{shortAddr(trip.pickup?.address)}</p>
                        <p className="text-xs text-gray-400">→ {shortAddr(trip.dropoff?.address)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-600 capitalize">{trip.vehicleType?.toLowerCase() || '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLORS[trip.status] || 'bg-gray-100 text-gray-600'}`}>
                          {shortStatus(trip.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-800">₹{trip.fare}</td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{formatDate(trip.createdAt)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setExpandedId(expandedId === trip.id ? null : trip.id)}
                          className="text-gray-400 hover:text-primary transition-colors"
                        >
                          <span className="material-symbols-outlined text-xl">
                            {expandedId === trip.id ? 'expand_less' : 'expand_more'}
                          </span>
                        </button>
                      </td>
                    </tr>
                    {expandedId === trip.id && (
                      <tr className="bg-blue-50/50">
                        <td colSpan={9} className="px-5 py-4">
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                            <div>
                              <p className="text-gray-400 font-semibold uppercase tracking-wide mb-1">Full Pickup</p>
                              <p className="text-gray-700">{trip.pickup?.address || '—'}</p>
                            </div>
                            <div>
                              <p className="text-gray-400 font-semibold uppercase tracking-wide mb-1">Full Drop</p>
                              <p className="text-gray-700">{trip.dropoff?.address || '—'}</p>
                            </div>
                            <div>
                              <p className="text-gray-400 font-semibold uppercase tracking-wide mb-1">Sender</p>
                              <p className="text-gray-700">{trip.senderName || '—'}</p>
                            </div>
                            <div>
                              <p className="text-gray-400 font-semibold uppercase tracking-wide mb-1">Receiver</p>
                              <p className="text-gray-700">{trip.receiverName || '—'} · {trip.receiverPhone || '—'}</p>
                            </div>
                            <div>
                              <p className="text-gray-400 font-semibold uppercase tracking-wide mb-1">Pickup PIN</p>
                              <p className="text-gray-700 font-mono font-bold">{trip.pickupPin || '—'}</p>
                            </div>
                            <div>
                              <p className="text-gray-400 font-semibold uppercase tracking-wide mb-1">Full Trip ID</p>
                              <p className="text-gray-700 font-mono">{trip.id}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
