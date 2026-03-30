import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit, startAfter, where, Timestamp, getCountFromServer } from 'firebase/firestore';
import { db } from '../../src/firebase';
import { useAdminAuth } from '../hooks/useAdminAuth';

/* ── Types ── */
interface LogEntry {
  id: string;
  adminUid: string;
  adminName: string;
  adminEmail: string;
  action: string;
  target: string;
  details: string;
  metadata: Record<string, any>;
  timestamp: any;
}

interface Filters {
  adminUid: string;
  action: string;
  dateFrom: string;
  dateTo: string;
}

/* ── Constants ── */
const PAGE_SIZE = 50;

const ACTION_TYPES = [
  { value: '', label: 'All Actions' },
  { value: 'driver.doc.approved', label: 'Driver Doc Approved' },
  { value: 'driver.doc.rejected', label: 'Driver Doc Rejected' },
  { value: 'fare.updated', label: 'Fare Updated' },
  { value: 'admin.created', label: 'Admin Created' },
  { value: 'admin.updated', label: 'Admin Updated' },
  { value: 'admin.disabled', label: 'Admin Disabled' },
  { value: 'admin.enabled', label: 'Admin Enabled' },
  { value: 'trip.cancelled', label: 'Trip Cancelled' },
  { value: 'user.updated', label: 'User Updated' },
];

/* ── Helpers ── */
function formatTimestamp(ts: any): string {
  if (!ts) return '\u2014';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatJson(obj: Record<string, any>): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

/* ── Component ── */
export default function ActivityLogs() {
  const { isSuperAdmin } = useAdminAuth();

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Stats
  const [totalLogs, setTotalLogs] = useState(0);
  const [uniqueAdmins, setUniqueAdmins] = useState(0);

  // Admin list for filter dropdown
  const [adminUsers, setAdminUsers] = useState<{ uid: string; name: string; email: string }[]>([]);

  // Filters
  const [filters, setFilters] = useState<Filters>({
    adminUid: '',
    action: '',
    dateFrom: '',
    dateTo: '',
  });
  const [appliedFilters, setAppliedFilters] = useState<Filters>({
    adminUid: '',
    action: '',
    dateFrom: '',
    dateTo: '',
  });

  /* ── Access guard ── */
  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center max-w-md">
          <span className="material-symbols-outlined text-4xl text-red-400">lock</span>
          <p className="mt-3 font-bold text-red-700">Access Denied</p>
          <p className="text-sm text-red-500 mt-1">Activity logs are only accessible to Super Admins.</p>
        </div>
      </div>
    );
  }

  /* ── Build Firestore query ── */
  const buildQuery = (f: Filters, lastSnapshot?: any) => {
    const constraints: any[] = [orderBy('timestamp', 'desc')];

    if (f.adminUid) {
      constraints.unshift(where('adminUid', '==', f.adminUid));
    }
    if (f.action) {
      constraints.unshift(where('action', '==', f.action));
    }
    if (f.dateFrom) {
      const from = new Date(f.dateFrom);
      from.setHours(0, 0, 0, 0);
      constraints.push(where('timestamp', '>=', Timestamp.fromDate(from)));
    }
    if (f.dateTo) {
      const to = new Date(f.dateTo);
      to.setHours(23, 59, 59, 999);
      constraints.push(where('timestamp', '<=', Timestamp.fromDate(to)));
    }
    if (lastSnapshot) {
      constraints.push(startAfter(lastSnapshot));
    }
    constraints.push(limit(PAGE_SIZE));

    return query(collection(db, 'adminLogs'), ...constraints);
  };

  /* ── Load admin users for filter dropdown ── */
  const loadAdminUsers = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('roles', 'array-contains', 'ADMIN')));
      const list: { uid: string; name: string; email: string }[] = [];
      snap.forEach(d => {
        const data = d.data();
        list.push({ uid: d.id, name: data.name || 'Unknown', email: data.email || '' });
      });
      list.sort((a, b) => a.name.localeCompare(b.name));
      setAdminUsers(list);
    } catch (err) {
      console.error('Failed to load admin users:', err);
    }
  };

  /* ── Load logs ── */
  const loadLogs = async (f: Filters, append = false, lastSnap?: any) => {
    if (append) setLoadingMore(true);
    else setLoading(true);

    try {
      const q = buildQuery(f, lastSnap);
      const snap = await getDocs(q);

      const entries: LogEntry[] = [];
      snap.forEach(d => {
        entries.push({ ...d.data() as Omit<LogEntry, 'id'>, id: d.id });
      });

      if (append) {
        setLogs(prev => [...prev, ...entries]);
      } else {
        setLogs(entries);
      }

      setHasMore(entries.length === PAGE_SIZE);
      setLastDoc(snap.docs[snap.docs.length - 1] || null);
    } catch (err: any) {
      console.error('Failed to load logs:', err);
      setError('Failed to load activity logs. ' + (err?.message || ''));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  /* ── Load summary stats ── */
  const loadStats = async () => {
    try {
      const countSnap = await getCountFromServer(collection(db, 'adminLogs'));
      setTotalLogs(countSnap.data().count);

      // Get unique admins from the logs
      const allSnap = await getDocs(query(collection(db, 'adminLogs'), orderBy('timestamp', 'desc'), limit(500)));
      const adminSet = new Set<string>();
      allSnap.forEach(d => {
        const uid = d.data().adminUid;
        if (uid) adminSet.add(uid);
      });
      setUniqueAdmins(adminSet.size);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  /* ── Initial load ── */
  useEffect(() => {
    loadLogs(appliedFilters);
    loadAdminUsers();
    loadStats();
  }, []);

  /* ── Apply filters ── */
  const handleApplyFilters = () => {
    setAppliedFilters({ ...filters });
    setLastDoc(null);
    setHasMore(true);
    loadLogs(filters);
  };

  /* ── Clear filters ── */
  const handleClearFilters = () => {
    const empty: Filters = { adminUid: '', action: '', dateFrom: '', dateTo: '' };
    setFilters(empty);
    setAppliedFilters(empty);
    setLastDoc(null);
    setHasMore(true);
    loadLogs(empty);
  };

  /* ── Load more ── */
  const handleLoadMore = () => {
    if (!lastDoc || loadingMore) return;
    loadLogs(appliedFilters, true, lastDoc);
  };

  /* ── Toggle row expand ── */
  const toggleRow = (id: string) => {
    setExpandedRow(prev => prev === id ? null : id);
  };

  const hasActiveFilters = appliedFilters.adminUid || appliedFilters.action || appliedFilters.dateFrom || appliedFilters.dateTo;

  /* ── Action badge color ── */
  const actionBadge = (action: string) => {
    if (action.includes('approved') || action.includes('created') || action.includes('enabled')) {
      return 'bg-green-100 text-green-700';
    }
    if (action.includes('rejected') || action.includes('disabled')) {
      return 'bg-red-100 text-red-700';
    }
    if (action.includes('updated')) {
      return 'bg-blue-100 text-blue-700';
    }
    return 'bg-gray-100 text-gray-600';
  };

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <div className="w-10 h-10 border-4 border-gray-200 border-t-primary rounded-full animate-spin" />
          <span className="text-sm">Loading activity logs...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-black text-gray-800">Activity Logs</h1>
        <p className="text-sm text-gray-400 mt-0.5">Audit trail of all admin actions</p>
      </div>

      {/* ── Summary Stats ── */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'Total Logs', value: totalLogs, icon: 'receipt_long', color: 'bg-purple-50 text-purple-600' },
          { label: 'Unique Admins', value: uniqueAdmins, icon: 'admin_panel_settings', color: 'bg-blue-50 text-blue-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}>
              <span className="material-symbols-outlined text-xl">{s.icon}</span>
            </div>
            <div>
              <p className="text-2xl font-black text-gray-800">{s.value.toLocaleString()}</p>
              <p className="text-xs text-gray-400 font-semibold">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-red-500">error</span>
          <div className="flex-1">
            <p className="font-semibold text-red-700 text-sm">Error</p>
            <p className="text-red-600 text-sm mt-0.5">{error}</p>
          </div>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="material-symbols-outlined text-gray-400 text-lg">filter_list</span>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Filters</p>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          {/* Admin User */}
          <div className="min-w-48">
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Admin User</label>
            <select
              value={filters.adminUid}
              onChange={e => setFilters(f => ({ ...f, adminUid: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors bg-white"
            >
              <option value="">All Admins</option>
              {adminUsers.map(a => (
                <option key={a.uid} value={a.uid}>{a.name} ({a.email})</option>
              ))}
            </select>
          </div>

          {/* Action Type */}
          <div className="min-w-48">
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Action Type</label>
            <select
              value={filters.action}
              onChange={e => setFilters(f => ({ ...f, action: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors bg-white"
            >
              {ACTION_TYPES.map(a => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div className="min-w-40">
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">From Date</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
            />
          </div>

          {/* Date To */}
          <div className="min-w-40">
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">To Date</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleApplyFilters}
              className="px-4 py-2 rounded-lg text-sm font-bold bg-primary text-white hover:bg-primary/90 transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">search</span>
              Apply
            </button>
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">clear</span>
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Logs Table ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {logs.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <span className="material-symbols-outlined text-5xl">receipt_long</span>
            <p className="mt-2 text-sm font-semibold">No activity logs found</p>
            {hasActiveFilters && <p className="text-xs mt-1">Try adjusting your filters.</p>}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide w-8"></th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Admin</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Action</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Target</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {logs.map(log => (
                    <React.Fragment key={log.id}>
                      <tr
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => toggleRow(log.id)}
                      >
                        {/* Expand icon */}
                        <td className="px-4 py-3">
                          {log.metadata && Object.keys(log.metadata).length > 0 && (
                            <span className={`material-symbols-outlined text-gray-400 text-lg transition-transform ${expandedRow === log.id ? 'rotate-90' : ''}`}>
                              chevron_right
                            </span>
                          )}
                        </td>

                        {/* Time */}
                        <td className="px-4 py-3">
                          <p className="text-xs text-gray-600 whitespace-nowrap">{formatTimestamp(log.timestamp)}</p>
                        </td>

                        {/* Admin */}
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{log.adminName || '\u2014'}</p>
                            <p className="text-[11px] text-gray-400">{log.adminEmail}</p>
                          </div>
                        </td>

                        {/* Action */}
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${actionBadge(log.action)}`}>
                            {log.action}
                          </span>
                        </td>

                        {/* Target */}
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-700 font-mono max-w-48 truncate" title={log.target}>{log.target || '\u2014'}</p>
                        </td>

                        {/* Details */}
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-600 max-w-64 truncate" title={log.details}>{log.details || '\u2014'}</p>
                        </td>
                      </tr>

                      {/* Expanded metadata row */}
                      {expandedRow === log.id && log.metadata && Object.keys(log.metadata).length > 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-0">
                            <div className="bg-gray-50 rounded-xl mx-4 mb-3 p-4 border border-gray-100">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="material-symbols-outlined text-gray-400 text-sm">data_object</span>
                                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Metadata</p>
                              </div>
                              <pre className="text-xs text-gray-600 font-mono whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
                                {formatJson(log.metadata)}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table footer */}
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-400">
                Showing {logs.length} log{logs.length !== 1 ? 's' : ''}
                {totalLogs > 0 && <span> of {totalLogs.toLocaleString()} total</span>}
              </p>

              {hasMore && (
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                >
                  {loadingMore ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">expand_more</span>
                      Load More
                    </>
                  )}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
