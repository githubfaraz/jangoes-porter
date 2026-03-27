import React, { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../src/firebase';

interface Customer {
  id: string;
  name: string;
  phoneNumber?: string;
  email?: string;
  photoURL?: string;
  walletBalance: number;
  createdAt: string;
}

function formatDate(ts: any) {
  if (!ts) return '—';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tripCounts, setTripCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'trips' | 'wallet'>('newest');

  useEffect(() => {
    const load = async () => {
      try {
        const [customersSnap, tripsSnap] = await Promise.all([
          getDocs(query(collection(db, 'users'), where('role', '==', 'CUSTOMER'))),
          getDocs(collection(db, 'trips')),
        ]);
        const list: Customer[] = [];
        customersSnap.forEach(d => list.push({ ...d.data() as Customer, id: d.id }));
        list.sort((a, b) => {
          const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
          const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
          return bTime - aTime;
        });
        setCustomers(list);

        const counts: Record<string, number> = {};
        tripsSnap.forEach(d => {
          const cid = d.data().customerId;
          if (cid) counts[cid] = (counts[cid] || 0) + 1;
        });
        setTripCounts(counts);
      } catch (err: any) {
        setError('Failed to load customers. Check Firestore security rules.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    let list = [...customers];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.name?.toLowerCase().includes(q) ||
        c.phoneNumber?.includes(q) ||
        c.email?.toLowerCase().includes(q)
      );
    }
    if (sortBy === 'trips') list.sort((a, b) => (tripCounts[b.id] || 0) - (tripCounts[a.id] || 0));
    if (sortBy === 'wallet') list.sort((a, b) => (b.walletBalance || 0) - (a.walletBalance || 0));
    return list;
  }, [customers, search, sortBy, tripCounts]);

  const totalWallet = customers.reduce((sum, c) => sum + (c.walletBalance || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <div className="w-10 h-10 border-4 border-gray-200 border-t-primary rounded-full animate-spin" />
          <span className="text-sm">Loading customers...</span>
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
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Customers', value: customers.length, icon: 'group', color: 'bg-blue-50 text-blue-600' },
          { label: 'Total Bookings', value: Object.values(tripCounts).reduce((s, v) => s + v, 0), icon: 'receipt_long', color: 'bg-green-50 text-green-600' },
          { label: 'Wallet Balance', value: `₹${totalWallet.toLocaleString('en-IN')}`, icon: 'account_balance_wallet', color: 'bg-orange-50 text-orange-600' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.color}`}>
              <span className="material-symbols-outlined text-xl">{stat.icon}</span>
            </div>
            <div>
              <p className="text-2xl font-black text-gray-800">{stat.value}</p>
              <p className="text-xs text-gray-400 font-semibold">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 flex-1 min-w-48">
          <span className="material-symbols-outlined text-gray-400 text-xl">search</span>
          <input
            type="text"
            placeholder="Search by name, phone, email…"
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
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 font-semibold">Sort:</span>
          <div className="flex gap-2">
            {[
              { key: 'newest', label: 'Newest' },
              { key: 'trips', label: 'Most Trips' },
              { key: 'wallet', label: 'Wallet' },
            ].map(s => (
              <button
                key={s.key}
                onClick={() => setSortBy(s.key as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${sortBy === s.key ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <span className="text-xs text-gray-400 font-semibold">{filtered.length} customers</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <span className="material-symbols-outlined text-5xl">group</span>
            <p className="mt-2 text-sm">No customers found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Total Trips</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Wallet</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(customer => (
                  <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {customer.photoURL ? (
                            <img src={customer.photoURL} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-blue-600 font-bold text-sm">{customer.name?.charAt(0) || '?'}</span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-gray-800">{customer.name || '—'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 font-mono">{customer.phoneNumber || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{customer.email || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold text-gray-700">{tripCounts[customer.id] || 0}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold text-gray-700">₹{(customer.walletBalance || 0).toLocaleString('en-IN')}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{formatDate(customer.createdAt)}</td>
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
