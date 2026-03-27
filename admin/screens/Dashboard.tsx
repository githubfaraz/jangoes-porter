import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../src/firebase';

interface Stats {
  totalUsers: number;
  totalCustomers: number;
  totalDrivers: number;
  totalTrips: number;
  activeTrips: number;
  completedTrips: number;
  totalRevenue: number;
}

interface RecentTrip {
  id: string;
  customerId: string;
  status: string;
  fare: number;
  pickup: { address: string };
  dropoff: { address: string };
  vehicleType: string;
  createdAt: any;
}

const ACTIVE_STATUSES = ['SEARCHING', 'ACCEPTED', 'ARRIVED_AT_PICKUP', 'PICKING_UP', 'IN_TRANSIT', 'ARRIVED_AT_DESTINATION', 'DROPPING_OFF'];

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

function StatCard({ icon, label, value, color, sub }: { icon: string; label: string; value: string | number; color: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
          <p className="text-3xl font-black text-gray-800 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          <span className="material-symbols-outlined text-xl">{icon}</span>
        </div>
      </div>
    </div>
  );
}

function shortStatus(s: string) {
  return s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function shortAddr(addr: string) {
  return addr?.length > 35 ? addr.slice(0, 35) + '…' : addr;
}

function formatDate(ts: any) {
  if (!ts) return '—';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentTrips, setRecentTrips] = useState<RecentTrip[]>([]);
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [usersSnap, tripsSnap] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(query(collection(db, 'trips'), orderBy('createdAt', 'desc'), limit(100))),
        ]);

        const uMap: Record<string, string> = {};
        let customers = 0, drivers = 0;
        usersSnap.forEach(d => {
          const data = d.data();
          uMap[d.id] = data.name || data.email || d.id;
          if (data.role === 'CUSTOMER') customers++;
          else if (data.role === 'DRIVER') drivers++;
        });
        setUserMap(uMap);

        let active = 0, completed = 0, revenue = 0;
        const trips: RecentTrip[] = [];
        tripsSnap.forEach(d => {
          const data = d.data() as RecentTrip;
          trips.push({ ...data, id: d.id });
          if (ACTIVE_STATUSES.includes(data.status)) active++;
          if (data.status === 'COMPLETED') { completed++; revenue += (data.fare || 0); }
        });

        setStats({
          totalUsers: usersSnap.size,
          totalCustomers: customers,
          totalDrivers: drivers,
          totalTrips: tripsSnap.size,
          activeTrips: active,
          completedTrips: completed,
          totalRevenue: revenue,
        });
        setRecentTrips(trips.slice(0, 8));
      } catch (err: any) {
        setError('Failed to load data. Make sure Firestore security rules allow admin read access.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <div className="w-10 h-10 border-4 border-gray-200 border-t-primary rounded-full animate-spin" />
          <span className="text-sm">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-red-500">error</span>
          <div>
            <p className="font-semibold text-red-700">Error Loading Data</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
            <div className="mt-3 p-3 bg-red-100 rounded-xl text-xs text-red-700 font-mono">
              {`match /users/{uid} { allow read: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'ADMIN'; }`}
            </div>
            <p className="text-xs text-red-500 mt-2">Add the above rule to Firestore Security Rules in Firebase Console.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="group" label="Total Users" value={stats!.totalUsers} color="bg-blue-50 text-blue-600" />
        <StatCard icon="person" label="Customers" value={stats!.totalCustomers} color="bg-green-50 text-green-600" />
        <StatCard icon="person_pin" label="Drivers" value={stats!.totalDrivers} color="bg-purple-50 text-purple-600" />
        <StatCard icon="local_shipping" label="Total Trips" value={stats!.totalTrips} color="bg-orange-50 text-orange-600" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          icon="directions_car"
          label="Active Trips"
          value={stats!.activeTrips}
          color="bg-yellow-50 text-yellow-600"
          sub="In progress right now"
        />
        <StatCard
          icon="check_circle"
          label="Completed"
          value={stats!.completedTrips}
          color="bg-green-50 text-green-600"
          sub="All time"
        />
        <StatCard
          icon="currency_rupee"
          label="Total Revenue"
          value={`₹${stats!.totalRevenue.toLocaleString('en-IN')}`}
          color="bg-primary/10 text-primary"
          sub="From completed trips"
        />
      </div>

      {/* Recent Trips */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-800">Recent Trips</h2>
          <a href="#/trips" className="text-primary text-sm font-semibold hover:underline">View all →</a>
        </div>
        {recentTrips.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <span className="material-symbols-outlined text-4xl">local_shipping</span>
            <p className="mt-2 text-sm">No trips yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-gray-100">
                  <th className="px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Trip ID</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Customer</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Route</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Fare</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentTrips.map(trip => (
                  <tr key={trip.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3">
                      <span className="text-xs font-mono text-gray-500">{trip.id.slice(0, 8)}…</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{userMap[trip.customerId] || trip.customerId.slice(0, 10)}</td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-gray-600">{shortAddr(trip.pickup?.address)}</p>
                      <p className="text-xs text-gray-400">→ {shortAddr(trip.dropoff?.address)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLORS[trip.status] || 'bg-gray-100 text-gray-600'}`}>
                        {shortStatus(trip.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-800">₹{trip.fare}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{formatDate(trip.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
