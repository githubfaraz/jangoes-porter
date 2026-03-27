import React, { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, getDoc, query, where, doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../../src/firebase';
import { extractKycData } from '../../services/kycHelper';

interface Driver {
  id: string;
  name: string;
  phoneNumber?: string;
  email?: string;
  photoURL?: string;
  kycCompleted: boolean;
  kycAllVerified?: boolean;
  kycTimestamp?: string;
  walletBalance: number;
  createdAt: string;
  pendingDocNames?: string[];
  kycData?: Record<string, any>;
}

interface DocItem {
  key: string;           // Firestore field prefix (e.g. 'pan')
  statusField: string;   // e.g. 'panStatus'
  label: string;
  nameField?: string;    // e.g. 'panName'
  numberField?: string;  // e.g. 'panNumber'
  imageField?: string;   // e.g. 'panImageUrl'
  rejectField: string;   // e.g. 'panRejectReason'
}

const DOC_ITEMS: DocItem[] = [
  { key: 'aadhaar', statusField: 'aadhaarVerified', label: 'Aadhaar Card', nameField: 'aadhaarName', numberField: 'aadhaarNumber', imageField: 'aadhaarFrontUrl', rejectField: 'aadhaarRejectReason' },
  { key: 'aadhaarBack', statusField: 'aadhaarVerified', label: 'Aadhaar Back', imageField: 'aadhaarBackUrl', rejectField: 'aadhaarBackRejectReason' },
  { key: 'pan', statusField: 'panStatus', label: 'PAN Card', nameField: 'panName', numberField: 'panNumber', imageField: 'panImageUrl', rejectField: 'panRejectReason' },
  { key: 'dl', statusField: 'dlStatus', label: 'Driving License', nameField: 'dlName', numberField: 'dlNumber', rejectField: 'dlRejectReason' },
  { key: 'rc', statusField: 'rcVerifyStatus', label: 'RC / Vehicle Registration', nameField: 'rcOwnerName', numberField: 'rcNumber', rejectField: 'rcRejectReason' },
  { key: 'selfie', statusField: '', label: 'Driver Selfie', imageField: 'selfieUrl', rejectField: 'selfieRejectReason' },
];

function formatDate(ts: any) {
  if (!ts) return '—';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getDocStatus(kd: Record<string, any>, item: DocItem): string {
  if (!item.statusField) return kd[item.imageField || ''] ? 'verified' : 'not_uploaded';
  const val = kd[item.statusField];
  if (val === 'pending_review') return 'pending_review';
  if (val === 'rejected') return 'rejected';
  if (val === true || val === 'verified') return 'verified';
  // Check if we have any data for this doc even if status field is missing
  if (item.nameField && kd[item.nameField]) return 'verified';
  if (item.numberField && kd[item.numberField]) return 'verified';
  if (item.imageField && kd[item.imageField]) return 'verified';
  return 'not_uploaded';
}

export default function Drivers() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [tripCounts, setTripCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [kycFilter, setKycFilter] = useState<'ALL' | 'VERIFIED' | 'PENDING' | 'REVIEW'>('ALL');
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [actionLoading, setActionLoading] = useState('');
  const [rejectingDoc, setRejectingDoc] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [previewImage, setPreviewImage] = useState('');

  const loadDrivers = async () => {
    try {
      const [driversSnap, tripsSnap] = await Promise.all([
        getDocs(query(collection(db, 'users'), where('role', '==', 'DRIVER'))),
        getDocs(collection(db, 'trips')),
      ]);
      const list: Driver[] = [];
      driversSnap.forEach(d => list.push({ ...d.data() as Driver, id: d.id }));
      list.sort((a, b) => {
        const aTime = (a.createdAt as any)?.toDate ? (a.createdAt as any).toDate().getTime() : new Date(a.createdAt || 0).getTime();
        const bTime = (b.createdAt as any)?.toDate ? (b.createdAt as any).toDate().getTime() : new Date(b.createdAt || 0).getTime();
        return bTime - aTime;
      });
      setDrivers(list);
      const counts: Record<string, number> = {};
      tripsSnap.forEach(d => { const id = d.data().driverId; if (id) counts[id] = (counts[id] || 0) + 1; });
      setTripCounts(counts);
    } catch (err: any) {
      setError('Failed to load drivers.');
      console.error(err);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadDrivers(); }, []);

  const getDriverStatus = (d: Driver) => {
    if (!d.kycCompleted) return 'incomplete';
    if (d.kycAllVerified === false) return 'review';
    return 'verified';
  };

  // Admin updates write to BOTH flat keys and nested map to handle mixed storage
  const adminUpdateKycField = async (driverId: string, fields: Record<string, any>) => {
    const ref = doc(db, 'users', driverId);

    // Write flat keys via setDoc merge (for legacy format)
    const flatUpdates: Record<string, any> = {};
    for (const [field, value] of Object.entries(fields)) {
      flatUpdates[`kycData.${field}`] = value;
    }
    await setDoc(ref, flatUpdates, { merge: true });

    // Also write nested map via updateDoc (for new format)
    try {
      const nestedUpdates: Record<string, any> = {};
      for (const [field, value] of Object.entries(fields)) {
        nestedUpdates[`kycData.${field}`] = value;
      }
      await updateDoc(ref, nestedUpdates);
    } catch {
      // Ignore if nested write fails — flat keys are already updated
    }
  };

  const handleApproveDoc = async (driver: Driver, item: DocItem) => {
    setActionLoading(item.key);
    try {
      const fields: Record<string, any> = {};
      if (item.statusField) fields[item.statusField] = 'verified';
      fields[item.rejectField] = '';
      await adminUpdateKycField(driver.id, fields);

      // Check if all docs are now verified → approve driver fully
      const updatedKd = { ...driver.kycData, [item.statusField]: 'verified', [item.rejectField]: '' };
      const allClear = DOC_ITEMS.every(di => {
        if (!di.statusField) return true;
        const s = updatedKd[di.statusField];
        return s === 'verified' || s === true;
      });
      if (allClear) {
        await setDoc(doc(db, 'users', driver.id), { kycAllVerified: true, pendingDocNames: [] }, { merge: true });
      }

      await loadDrivers();
      const refreshed = await getDoc(doc(db, 'users', driver.id));
      if (refreshed.exists()) { const raw = refreshed.data(); setSelectedDriver({ ...raw as Driver, id: refreshed.id, kycData: extractKycData(raw) }); }
    } catch (err: any) { console.error('[ADMIN] Approve error:', err?.message, err?.code, err); alert('Failed to approve document: ' + (err?.message || 'Unknown error')); }
    finally { setActionLoading(''); }
  };

  const handleRejectDoc = async (driver: Driver, item: DocItem) => {
    if (!rejectReason.trim()) { alert('Please enter a reason for rejection.'); return; }
    setActionLoading(item.key);
    try {
      const fields: Record<string, any> = {};
      if (item.statusField) fields[item.statusField] = 'rejected';
      fields[item.rejectField] = rejectReason.trim();
      await adminUpdateKycField(driver.id, fields);
      setRejectingDoc(null);
      setRejectReason('');
      await loadDrivers();
      const refreshed = await getDoc(doc(db, 'users', driver.id));
      if (refreshed.exists()) { const raw = refreshed.data(); setSelectedDriver({ ...raw as Driver, id: refreshed.id, kycData: extractKycData(raw) }); }
    } catch (err: any) { console.error('[ADMIN] Reject error:', err?.message, err?.code, err); alert('Failed to reject document: ' + (err?.message || 'Unknown error')); }
    finally { setActionLoading(''); }
  };

  const handleApproveAll = async (driver: Driver) => {
    setActionLoading('all');
    try {
      // Update all KYC statuses to verified
      const kycFields: Record<string, any> = {};
      const kd = driver.kycData || {};
      if (kd.panStatus === 'pending_review' || kd.panStatus === 'rejected') kycFields['panStatus'] = 'verified';
      if (kd.dlStatus === 'pending_review' || kd.dlStatus === 'rejected') kycFields['dlStatus'] = 'verified';
      if (kd.rcVerifyStatus === 'pending_review' || kd.rcVerifyStatus === 'rejected') kycFields['rcVerifyStatus'] = 'verified';
      DOC_ITEMS.forEach(di => { kycFields[di.rejectField] = ''; });

      await adminUpdateKycField(driver.id, kycFields);
      await setDoc(doc(db, 'users', driver.id), { kycAllVerified: true, pendingDocNames: [] }, { merge: true });

      alert('All documents approved!');
      setSelectedDriver(null);
      await loadDrivers();
    } catch (err: any) { console.error('[ADMIN] Approve all error:', err?.message, err?.code, err); alert('Failed to approve all: ' + (err?.message || 'Unknown error')); }
    finally { setActionLoading(''); }
  };

  const filtered = useMemo(() => {
    let list = drivers;
    if (kycFilter === 'VERIFIED') list = list.filter(d => getDriverStatus(d) === 'verified');
    if (kycFilter === 'PENDING') list = list.filter(d => getDriverStatus(d) === 'incomplete');
    if (kycFilter === 'REVIEW') list = list.filter(d => getDriverStatus(d) === 'review');
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(d => d.name?.toLowerCase().includes(q) || d.phoneNumber?.includes(q) || d.email?.toLowerCase().includes(q));
    }
    return list;
  }, [drivers, kycFilter, search]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-gray-200 border-t-primary rounded-full animate-spin" /></div>;
  if (error) return <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700">{error}</div>;

  const verified = drivers.filter(d => getDriverStatus(d) === 'verified').length;
  const pendingKyc = drivers.filter(d => getDriverStatus(d) === 'incomplete').length;
  const needsReview = drivers.filter(d => getDriverStatus(d) === 'review').length;

  const statusBadge = (s: string) => {
    if (s === 'verified') return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">Verified</span>;
    if (s === 'pending_review') return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">Pending Review</span>;
    if (s === 'rejected') return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">Rejected</span>;
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500">Not Uploaded</span>;
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Drivers', value: drivers.length, icon: 'person_pin', color: 'bg-purple-50 text-purple-600' },
          { label: 'Verified', value: verified, icon: 'verified', color: 'bg-green-50 text-green-600' },
          { label: 'Needs Review', value: needsReview, icon: 'rate_review', color: 'bg-amber-50 text-amber-600' },
          { label: 'Incomplete', value: pendingKyc, icon: 'pending', color: 'bg-red-50 text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}><span className="material-symbols-outlined text-xl">{s.icon}</span></div>
            <div><p className="text-2xl font-black text-gray-800">{s.value}</p><p className="text-xs text-gray-400 font-semibold">{s.label}</p></div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 flex-1 min-w-48">
          <span className="material-symbols-outlined text-gray-400 text-xl">search</span>
          <input type="text" placeholder="Search by name, phone, email…" value={search} onChange={e => setSearch(e.target.value)} className="flex-1 text-sm focus:outline-none text-gray-700 placeholder-gray-400" />
          {search && <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600"><span className="material-symbols-outlined text-xl">close</span></button>}
        </div>
        <div className="flex gap-2">
          {(['ALL', 'REVIEW', 'VERIFIED', 'PENDING'] as const).map(f => (
            <button key={f} onClick={() => setKycFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${kycFilter === f ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {f === 'ALL' ? 'All' : f === 'REVIEW' ? `Needs Review (${needsReview})` : f === 'VERIFIED' ? 'Verified' : 'Incomplete'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400"><span className="material-symbols-outlined text-5xl">person_pin</span><p className="mt-2 text-sm">No drivers found</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Driver</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Trips</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Joined</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Action</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(driver => {
                  const st = getDriverStatus(driver);
                  return (
                    <tr key={driver.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3"><div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {(driver.photoURL || driver.kycData?.selfieUrl) ? <img src={driver.photoURL || driver.kycData?.selfieUrl} alt="" className="w-full h-full object-cover" /> : <span className="text-purple-600 font-bold text-sm">{driver.name?.charAt(0) || '?'}</span>}
                        </div>
                        <div><p className="text-sm font-semibold text-gray-800">{driver.name || '—'}</p></div>
                      </div></td>
                      <td className="px-4 py-3 text-sm text-gray-700 font-mono">{driver.phoneNumber || '—'}</td>
                      <td className="px-4 py-3">
                        {st === 'verified' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700"><span className="material-symbols-outlined text-xs">verified</span>Verified</span>}
                        {st === 'review' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 animate-pulse"><span className="material-symbols-outlined text-xs">rate_review</span>Needs Review</span>}
                        {st === 'incomplete' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700"><span className="material-symbols-outlined text-xs">pending</span>Incomplete</span>}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-700">{tripCounts[driver.id] || 0}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{formatDate(driver.createdAt)}</td>
                      <td className="px-4 py-3">
                        <button onClick={async () => {
                          setRejectingDoc(null); setRejectReason('');
                          // Fetch full document directly to ensure kycData is included
                          try {
                            const snap = await getDoc(doc(db, 'users', driver.id));
                            if (snap.exists()) {
                              const raw = snap.data();
                              const kycData = extractKycData(raw);
                              const fullData = { ...raw as Driver, id: snap.id, kycData };
                              console.log('[ADMIN] kycData:', JSON.stringify(kycData));
                              setSelectedDriver(fullData);
                            } else {
                              setSelectedDriver(driver);
                            }
                          } catch (err) {
                            console.error('[ADMIN] Error fetching driver:', err);
                            setSelectedDriver(driver);
                          }
                        }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${st === 'review' ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                          {st === 'review' ? 'Review Docs' : 'View'}
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

      {/* ── Image Preview Modal ── */}
      {previewImage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80" onClick={() => setPreviewImage('')}>
          <img src={previewImage} alt="Document" className="max-w-[90vw] max-h-[90vh] rounded-2xl shadow-2xl" />
          <button onClick={() => setPreviewImage('')} className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2"><span className="material-symbols-outlined">close</span></button>
        </div>
      )}

      {/* ── Driver Review Modal ── */}
      {selectedDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setSelectedDriver(null)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 rounded-t-3xl px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center overflow-hidden">
                  {(selectedDriver.photoURL || selectedDriver.kycData?.selfieUrl) ? <img src={selectedDriver.photoURL || selectedDriver.kycData?.selfieUrl} alt="" className="w-full h-full object-cover" />
                    : <span className="text-purple-600 font-bold text-lg">{selectedDriver.name?.charAt(0) || '?'}</span>}
                </div>
                <div>
                  <p className="font-bold text-gray-800 text-lg">{selectedDriver.name || 'Driver'}</p>
                  <p className="text-xs text-gray-400">{selectedDriver.phoneNumber || selectedDriver.id} • Joined {formatDate(selectedDriver.createdAt)}</p>
                </div>
              </div>
              <button onClick={() => setSelectedDriver(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            <div className="px-6 py-5 space-y-6">
              {/* Documents */}
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">KYC Documents</h4>
                <div className="space-y-4">
                  {DOC_ITEMS.map(item => {
                    const kd = selectedDriver.kycData || {};
                    const status = getDocStatus(kd, item);
                    const imageUrl = item.imageField ? kd[item.imageField] : null;
                    const name = item.nameField ? kd[item.nameField] : null;
                    const number = item.numberField ? kd[item.numberField] : null;
                    const rejectComment = kd[item.rejectField] || '';
                    const isRejecting = rejectingDoc === item.key;

                    return (
                      <div key={item.key} className="border border-gray-100 rounded-2xl overflow-hidden">
                        <div className="p-4 flex items-start gap-4">
                          {/* Document Image Thumbnail */}
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={item.label}
                              className="w-20 h-20 rounded-xl object-cover border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity shrink-0"
                              onClick={() => setPreviewImage(imageUrl)}
                            />
                          ) : (
                            <div className="w-20 h-20 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                              <span className="material-symbols-outlined text-gray-300 text-3xl">image</span>
                            </div>
                          )}

                          {/* Doc Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold text-gray-800">{item.label}</p>
                              {statusBadge(status)}
                            </div>
                            {name && <p className="text-sm text-gray-600">Name: <span className="font-medium">{name}</span></p>}
                            {number && <p className="text-sm text-gray-500">Number: <span className="font-mono">{number}</span></p>}
                            {item.key === 'dl' && kd.dlDoe && <p className="text-sm text-gray-500">Expires: {kd.dlDoe}</p>}
                            {item.key === 'rc' && kd.rcMakerModel && <p className="text-sm text-gray-500">Vehicle: {kd.rcMakerModel} • {kd.rcFuelType}</p>}
                            {status === 'rejected' && rejectComment && (
                              <div className="mt-2 bg-red-50 rounded-lg px-3 py-2">
                                <p className="text-xs text-red-600"><span className="font-bold">Rejection reason:</span> {rejectComment}</p>
                              </div>
                            )}
                          </div>

                          {/* Action Buttons */}
                          {(status === 'pending_review' || status === 'rejected') && item.statusField && (
                            <div className="flex flex-col gap-2 shrink-0">
                              <button
                                onClick={() => handleApproveDoc(selectedDriver, item)}
                                disabled={!!actionLoading}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                              >
                                {actionLoading === item.key ? '...' : 'Approve'}
                              </button>
                              <button
                                onClick={() => { setRejectingDoc(isRejecting ? null : item.key); setRejectReason(''); }}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Reject Reason Input */}
                        {isRejecting && (
                          <div className="px-4 pb-4 pt-0">
                            <div className="bg-red-50 rounded-xl p-3 space-y-3">
                              <p className="text-xs font-bold text-red-700">Rejection Reason (will be shown to driver):</p>
                              <textarea
                                value={rejectReason}
                                onChange={e => setRejectReason(e.target.value)}
                                placeholder="e.g. Document image is blurry, name is not readable..."
                                rows={2}
                                className="w-full text-sm border border-red-200 rounded-lg px-3 py-2 focus:outline-none focus:border-red-400 resize-none"
                              />
                              <div className="flex gap-2 justify-end">
                                <button onClick={() => setRejectingDoc(null)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600">Cancel</button>
                                <button
                                  onClick={() => handleRejectDoc(selectedDriver, item)}
                                  disabled={!rejectReason.trim() || !!actionLoading}
                                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                                >
                                  {actionLoading === item.key ? 'Rejecting...' : 'Confirm Rejection'}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Vehicle Photos */}
              {selectedDriver.kycData?.vehiclePhotos?.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Vehicle Photos ({selectedDriver.kycData.vehiclePhotos.length})</h4>
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {selectedDriver.kycData.vehiclePhotos.map((url: string, i: number) => (
                      <img key={i} src={url} alt={`Vehicle ${i + 1}`}
                        className="w-28 h-28 rounded-xl object-cover border border-gray-100 shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setPreviewImage(url)} />
                    ))}
                  </div>
                </div>
              )}

              {/* Approve All */}
              {getDriverStatus(selectedDriver) === 'review' && (
                <button onClick={() => handleApproveAll(selectedDriver)} disabled={!!actionLoading}
                  className="w-full py-3.5 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-green-600/20">
                  {actionLoading === 'all' ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Approving All...</>
                    : <><span className="material-symbols-outlined text-lg">verified</span> Approve All Documents</>}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
