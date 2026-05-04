// Coupon management — list, create, edit, delete, activate/deactivate.
// Reads/writes the `coupons/{CODE}` collection. Server's /api/validate-coupon
// honors the `active` flag; setting it to false disables a coupon without
// deleting its history (usedCount stays).
//
// All mutations are logged via logAdminAction so the activity trail is
// visible in /activity-logs.

import React, { useEffect, useMemo, useState } from 'react';
import {
  collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc,
  serverTimestamp, getDoc,
} from 'firebase/firestore';
import { auth, db } from '../../src/firebase';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { logAdminAction } from '../services/activityLog';

interface Coupon {
  code: string;
  discountType: 'flat' | 'percent';
  discountValue: number;
  validFrom?: string;
  validUntil?: string;
  usageLimit?: number;
  usedCount?: number;
  minOrderAmount?: number;
  active?: boolean;
  createdAt?: any;
  createdBy?: string;
  updatedAt?: any;
}

const EMPTY_FORM: Coupon = {
  code: '',
  discountType: 'flat',
  discountValue: 0,
  validFrom: '',
  validUntil: '',
  usageLimit: undefined,
  usedCount: 0,
  minOrderAmount: undefined,
  active: true,
};

// `<input type="datetime-local">` wants `YYYY-MM-DDTHH:mm`, but we store
// ISO timestamps in Firestore. These helpers translate at the form boundary.
function isoToDateTimeLocal(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return ''; }
}

function dateTimeLocalToIso(local: string): string | undefined {
  if (!local) return undefined;
  const d = new Date(local);
  if (isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function describeDiscount(c: Coupon): string {
  if (c.discountType === 'percent') return `${c.discountValue}% off`;
  return `₹${c.discountValue} off`;
}

function describeWindow(c: Coupon): string {
  const fmt = (iso?: string) => iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : null;
  const from = fmt(c.validFrom);
  const until = fmt(c.validUntil);
  if (from && until) return `${from} → ${until}`;
  if (from) return `From ${from}`;
  if (until) return `Until ${until}`;
  return 'Always';
}

function describeUsage(c: Coupon): string {
  const used = c.usedCount ?? 0;
  if (c.usageLimit == null) return `${used} used`;
  return `${used} / ${c.usageLimit}`;
}

export default function Coupons() {
  const { can } = useAdminAuth();
  const canEdit = can('coupons.edit');

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);  // null = creating
  const [form, setForm] = useState<Coupon>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Coupon | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'coupons'), (snap) => {
      const list: Coupon[] = snap.docs.map(d => {
        const data = d.data() as Partial<Coupon>;
        return {
          code: d.id,
          discountType: (data.discountType === 'percent' ? 'percent' : 'flat') as 'flat' | 'percent',
          discountValue: Number(data.discountValue) || 0,
          validFrom: data.validFrom,
          validUntil: data.validUntil,
          usageLimit: data.usageLimit,
          usedCount: data.usedCount ?? 0,
          minOrderAmount: data.minOrderAmount,
          // Backwards-compat: pre-rollout docs don't have `active` — treat as on.
          active: data.active !== false,
          createdAt: data.createdAt,
          createdBy: data.createdBy,
          updatedAt: data.updatedAt,
        };
      }).sort((a, b) => a.code.localeCompare(b.code));
      setCoupons(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const openCreate = () => {
    setEditingCode(null);
    setForm(EMPTY_FORM);
    setError('');
    setShowForm(true);
  };

  const openEdit = (c: Coupon) => {
    setEditingCode(c.code);
    setForm({
      ...c,
      validFrom: c.validFrom ? isoToDateTimeLocal(c.validFrom) : '',
      validUntil: c.validUntil ? isoToDateTimeLocal(c.validUntil) : '',
    });
    setError('');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingCode(null);
    setForm(EMPTY_FORM);
    setError('');
  };

  const flashSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleSave = async () => {
    setError('');
    const code = form.code.trim().toUpperCase();
    if (!code) { setError('Code is required.'); return; }
    if (!/^[A-Z0-9_-]{2,32}$/.test(code)) {
      setError('Code must be 2–32 chars: letters, digits, underscore, dash.');
      return;
    }
    const value = Number(form.discountValue);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Discount value must be greater than zero.');
      return;
    }
    if (form.discountType === 'percent' && value > 100) {
      setError('Percent discount cannot exceed 100.');
      return;
    }
    const validFromIso = dateTimeLocalToIso((form.validFrom as string) || '');
    const validUntilIso = dateTimeLocalToIso((form.validUntil as string) || '');
    if (validFromIso && validUntilIso && new Date(validFromIso) >= new Date(validUntilIso)) {
      setError('Valid From must be earlier than Valid Until.');
      return;
    }

    setSaving(true);
    try {
      const ref = doc(db, 'coupons', code);

      if (editingCode === null) {
        // Create — guard against overwriting an existing code.
        const existing = await getDoc(ref);
        if (existing.exists()) {
          setError(`Coupon "${code}" already exists.`);
          return;
        }
        const payload: Coupon & { createdAt: any; createdBy: string; updatedAt: any } = {
          code,
          discountType: form.discountType,
          discountValue: value,
          ...(validFromIso ? { validFrom: validFromIso } : {}),
          ...(validUntilIso ? { validUntil: validUntilIso } : {}),
          ...(form.usageLimit != null && form.usageLimit !== ('' as any)
            ? { usageLimit: Number(form.usageLimit) } : {}),
          usedCount: 0,
          ...(form.minOrderAmount != null && form.minOrderAmount !== ('' as any)
            ? { minOrderAmount: Number(form.minOrderAmount) } : {}),
          active: form.active !== false,
          createdAt: serverTimestamp(),
          createdBy: auth.currentUser?.uid || '',
          updatedAt: serverTimestamp(),
        };
        await setDoc(ref, payload);
        await logAdminAction({
          action: 'coupon.created', target: code,
          details: `Created coupon ${code} (${describeDiscount({ ...form, discountValue: value } as Coupon)})`,
          metadata: { code, discountType: form.discountType, discountValue: value },
        });
        flashSuccess(`Coupon "${code}" created.`);
      } else {
        // Update — preserve usedCount + createdAt + createdBy.
        const updates: Record<string, any> = {
          discountType: form.discountType,
          discountValue: value,
          validFrom: validFromIso ?? null,
          validUntil: validUntilIso ?? null,
          usageLimit: (form.usageLimit != null && form.usageLimit !== ('' as any)) ? Number(form.usageLimit) : null,
          minOrderAmount: (form.minOrderAmount != null && form.minOrderAmount !== ('' as any)) ? Number(form.minOrderAmount) : null,
          active: form.active !== false,
          updatedAt: serverTimestamp(),
        };
        await updateDoc(ref, updates);
        await logAdminAction({
          action: 'coupon.updated', target: code,
          details: `Updated coupon ${code}`,
          metadata: updates,
        });
        flashSuccess(`Coupon "${code}" updated.`);
      }
      closeForm();
    } catch (err: any) {
      console.error('[Coupons] save error:', err);
      setError(err?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (c: Coupon) => {
    if (!canEdit) return;
    const next = !(c.active !== false);
    try {
      await updateDoc(doc(db, 'coupons', c.code), { active: next, updatedAt: serverTimestamp() });
      await logAdminAction({
        action: next ? 'coupon.activated' : 'coupon.deactivated', target: c.code,
        details: `${next ? 'Activated' : 'Deactivated'} coupon ${c.code}`,
      });
      flashSuccess(`${c.code} ${next ? 'activated' : 'deactivated'}.`);
    } catch (err: any) {
      alert('Failed to update: ' + (err?.message || 'Unknown error'));
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'coupons', confirmDelete.code));
      await logAdminAction({
        action: 'coupon.deleted', target: confirmDelete.code,
        details: `Deleted coupon ${confirmDelete.code}`,
      });
      flashSuccess(`Coupon "${confirmDelete.code}" deleted.`);
      setConfirmDelete(null);
    } catch (err: any) {
      alert('Failed to delete: ' + (err?.message || 'Unknown error'));
    } finally {
      setDeleting(false);
    }
  };

  const stats = useMemo(() => {
    const total = coupons.length;
    const active = coupons.filter(c => c.active !== false).length;
    const exhausted = coupons.filter(c => c.usageLimit != null && (c.usedCount ?? 0) >= c.usageLimit).length;
    return { total, active, exhausted };
  }, [coupons]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-green-500">check_circle</span>
          <span className="text-green-700 text-sm font-semibold">{success}</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total</p>
          <p className="text-2xl font-black text-gray-800 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Active</p>
          <p className="text-2xl font-black text-green-600 mt-1">{stats.active}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Limit Reached</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{stats.exhausted}</p>
        </div>
      </div>

      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-800">All Coupons</h2>
          <p className="text-xs text-gray-400 mt-0.5">Codes customers can apply at checkout in Order Summary.</p>
        </div>
        {canEdit && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-primary text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-primary-dark transition-colors"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            Add Coupon
          </button>
        )}
      </div>

      {/* List */}
      {coupons.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 px-6 py-16 text-center">
          <span className="material-symbols-outlined text-gray-300 text-5xl">local_offer</span>
          <p className="text-gray-500 text-sm font-semibold mt-3">No coupons yet</p>
          {canEdit && (
            <button onClick={openCreate} className="mt-4 text-primary text-sm font-bold hover:underline">
              Create your first coupon
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                <th className="px-5 py-3 text-left">Code</th>
                <th className="px-5 py-3 text-left">Discount</th>
                <th className="px-5 py-3 text-left">Valid</th>
                <th className="px-5 py-3 text-left">Usage</th>
                <th className="px-5 py-3 text-left">Min Order</th>
                <th className="px-5 py-3 text-center">Active</th>
                <th className="px-5 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {coupons.map(c => (
                <tr key={c.code} className="hover:bg-gray-50/50">
                  <td className="px-5 py-4">
                    <span className="font-mono font-bold text-gray-800 text-sm tracking-wider">{c.code}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-gray-700 font-semibold">{describeDiscount(c)}</span>
                  </td>
                  <td className="px-5 py-4 text-gray-500 text-xs">{describeWindow(c)}</td>
                  <td className="px-5 py-4 text-gray-500 text-xs">{describeUsage(c)}</td>
                  <td className="px-5 py-4 text-gray-500 text-xs">
                    {c.minOrderAmount != null ? `₹${c.minOrderAmount}` : '—'}
                  </td>
                  <td className="px-5 py-4 text-center">
                    <label className={`relative inline-flex items-center ${canEdit ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
                      <input
                        type="checkbox"
                        checked={c.active !== false}
                        onChange={() => handleToggleActive(c)}
                        disabled={!canEdit}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </td>
                  <td className="px-5 py-4 text-right">
                    {canEdit ? (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(c)}
                          className="size-8 rounded-lg hover:bg-primary/10 text-primary flex items-center justify-center"
                          title="Edit"
                        >
                          <span className="material-symbols-outlined text-base">edit</span>
                        </button>
                        <button
                          onClick={() => setConfirmDelete(c)}
                          className="size-8 rounded-lg hover:bg-red-50 text-red-500 flex items-center justify-center"
                          title="Delete"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-300 uppercase tracking-widest">Read-only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={closeForm}>
          <div
            className="w-full max-w-lg bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">
                {editingCode ? `Edit ${editingCode}` : 'Add Coupon'}
              </h3>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 overflow-y-auto">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-700">{error}</div>
              )}

              {/* Code */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Code</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  disabled={editingCode !== null}
                  placeholder="SAVE100"
                  className="w-full h-11 px-3 border border-gray-200 rounded-xl text-sm font-mono tracking-wider focus:border-primary focus:outline-none disabled:bg-gray-50 disabled:text-gray-500"
                />
                <p className="text-[10px] text-gray-400 mt-1">Letters, digits, underscore, dash. 2–32 chars. Code is the doc ID and can't be changed later.</p>
              </div>

              {/* Discount type + value */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Type</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, discountType: 'flat' })}
                      className={`flex-1 h-11 rounded-xl text-sm font-bold border transition-colors ${
                        form.discountType === 'flat'
                          ? 'bg-primary/10 border-primary text-primary'
                          : 'bg-white border-gray-200 text-gray-500'
                      }`}
                    >
                      Flat ₹
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, discountType: 'percent' })}
                      className={`flex-1 h-11 rounded-xl text-sm font-bold border transition-colors ${
                        form.discountType === 'percent'
                          ? 'bg-primary/10 border-primary text-primary'
                          : 'bg-white border-gray-200 text-gray-500'
                      }`}
                    >
                      Percent %
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Value {form.discountType === 'percent' ? '(%)' : '(₹)'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.discountValue}
                    onChange={e => setForm({ ...form, discountValue: e.target.value === '' ? 0 : Number(e.target.value) })}
                    className="w-full h-11 px-3 border border-gray-200 rounded-xl text-sm focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              {/* Validity */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Valid From</label>
                  <input
                    type="datetime-local"
                    value={(form.validFrom as string) || ''}
                    onChange={e => setForm({ ...form, validFrom: e.target.value })}
                    className="w-full h-11 px-3 border border-gray-200 rounded-xl text-sm focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Valid Until</label>
                  <input
                    type="datetime-local"
                    value={(form.validUntil as string) || ''}
                    onChange={e => setForm({ ...form, validUntil: e.target.value })}
                    className="w-full h-11 px-3 border border-gray-200 rounded-xl text-sm focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
              <p className="text-[10px] text-gray-400 -mt-2">Leave both blank for an always-on coupon.</p>

              {/* Limits */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Usage Limit</label>
                  <input
                    type="number"
                    min={0}
                    value={form.usageLimit ?? ''}
                    onChange={e => setForm({ ...form, usageLimit: e.target.value === '' ? undefined : Number(e.target.value) })}
                    placeholder="Unlimited"
                    className="w-full h-11 px-3 border border-gray-200 rounded-xl text-sm focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Min Order ₹</label>
                  <input
                    type="number"
                    min={0}
                    value={form.minOrderAmount ?? ''}
                    onChange={e => setForm({ ...form, minOrderAmount: e.target.value === '' ? undefined : Number(e.target.value) })}
                    placeholder="None"
                    className="w-full h-11 px-3 border border-gray-200 rounded-xl text-sm focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              {/* Active toggle */}
              <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-gray-700">Active</p>
                  <p className="text-[11px] text-gray-400">Inactive coupons are rejected at checkout but kept for reference.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.active !== false}
                    onChange={e => setForm({ ...form, active: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={closeForm}
                className="flex-1 h-11 bg-gray-100 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 h-11 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : editingCode ? 'Save Changes' : 'Create Coupon'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setConfirmDelete(null)}>
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="size-12 mx-auto rounded-full bg-red-50 flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-red-500 text-2xl">delete</span>
            </div>
            <h3 className="text-base font-bold text-center text-gray-800">Delete coupon?</h3>
            <p className="text-sm text-gray-500 text-center mt-1">
              <span className="font-mono font-bold">{confirmDelete.code}</span> will be permanently removed.
              Past redemptions on existing trips are unaffected.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 h-11 bg-gray-100 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 h-11 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
