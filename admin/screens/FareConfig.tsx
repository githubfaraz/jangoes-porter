import React, { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../src/firebase';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { logAdminAction } from '../services/activityLog';

/* ── Types ── */
interface VehicleRateV2 {
  id: string;
  name: string;
  baseFare: number;
  includedKm: number;
  perKmRate: number;
  perMinuteRate: number;
  minFare: number;
  freeWaitMins: number;
  waitChargePerMin: number;
  capacityKg: number;
  freeWeightKg: number;
  extraKgRate: number;
  gstPercent: number;
  active: boolean;
}

type RatesMap = Record<string, VehicleRateV2>;

/* ── Default seed data ── */
const DEFAULT_RATES: RatesMap = {
  bike: { id: 'bike', name: 'Bike', baseFare: 60, includedKm: 4, perKmRate: 8, perMinuteRate: 1.5, minFare: 60, freeWaitMins: 10, waitChargePerMin: 2, capacityKg: 20, freeWeightKg: 15, extraKgRate: 5, gstPercent: 5, active: true },
  car: { id: 'car', name: 'Car', baseFare: 150, includedKm: 4, perKmRate: 14, perMinuteRate: 2.0, minFare: 150, freeWaitMins: 10, waitChargePerMin: 3, capacityKg: 200, freeWeightKg: 50, extraKgRate: 3, gstPercent: 5, active: true },
  'tata-ace': { id: 'tata-ace', name: 'Tata Ace', baseFare: 220, includedKm: 4, perKmRate: 22, perMinuteRate: 2.5, minFare: 220, freeWaitMins: 15, waitChargePerMin: 4, capacityKg: 750, freeWeightKg: 500, extraKgRate: 6, gstPercent: 5, active: true },
  bolero: { id: 'bolero', name: 'Bolero', baseFare: 380, includedKm: 4, perKmRate: 28, perMinuteRate: 3.0, minFare: 380, freeWaitMins: 15, waitChargePerMin: 5, capacityKg: 1500, freeWeightKg: 1000, extraKgRate: 6, gstPercent: 5, active: true },
  'tata-407': { id: 'tata-407', name: 'Tata 407', baseFare: 580, includedKm: 4, perKmRate: 38, perMinuteRate: 3.5, minFare: 580, freeWaitMins: 20, waitChargePerMin: 6, capacityKg: 2500, freeWeightKg: 2000, extraKgRate: 6, gstPercent: 5, active: true },
  'large-truck': { id: 'large-truck', name: 'Large Truck', baseFare: 900, includedKm: 4, perKmRate: 55, perMinuteRate: 4.0, minFare: 900, freeWaitMins: 20, waitChargePerMin: 8, capacityKg: 4000, freeWeightKg: 3000, extraKgRate: 6, gstPercent: 5, active: true },
};

/* ── Field metadata for the edit modal ── */
const FIELD_GROUPS: { label: string; fields: { key: keyof VehicleRateV2; label: string; unit?: string }[] }[] = [
  {
    label: 'Base Pricing',
    fields: [
      { key: 'baseFare', label: 'Base Fare', unit: '₹' },
      { key: 'includedKm', label: 'Included Km', unit: 'km' },
      { key: 'perKmRate', label: 'Per Km Rate', unit: '₹/km' },
      { key: 'perMinuteRate', label: 'Per Minute Rate', unit: '₹/min' },
      { key: 'minFare', label: 'Minimum Fare', unit: '₹' },
    ],
  },
  {
    label: 'Wait Charges',
    fields: [
      { key: 'freeWaitMins', label: 'Free Wait Minutes', unit: 'min' },
      { key: 'waitChargePerMin', label: 'Wait Charge / Min', unit: '₹/min' },
    ],
  },
  {
    label: 'Weight & Capacity',
    fields: [
      { key: 'capacityKg', label: 'Max Capacity', unit: 'kg' },
      { key: 'freeWeightKg', label: 'Free Weight', unit: 'kg' },
      { key: 'extraKgRate', label: 'Extra Weight Rate', unit: '₹/kg' },
    ],
  },
  {
    label: 'Tax',
    fields: [
      { key: 'gstPercent', label: 'GST', unit: '%' },
    ],
  },
];

const VEHICLE_ICONS: Record<string, string> = {
  bike: 'two_wheeler',
  car: 'directions_car',
  'tata-ace': 'local_shipping',
  bolero: 'local_shipping',
  'tata-407': 'local_shipping',
  'large-truck': 'fire_truck',
};

/* ── Helpers ── */
function formatTimestamp(ts: any): string {
  if (!ts) return '—';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/* ── Component ── */
export default function FareConfig() {
  const [rates, setRates] = useState<RatesMap>({});
  const [updatedAt, setUpdatedAt] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [editVehicle, setEditVehicle] = useState<VehicleRateV2 | null>(null);
  const [editDraft, setEditDraft] = useState<VehicleRateV2 | null>(null);

  const DOC_REF = doc(db, 'config', 'vehicleRates');

  /* ── Load rates ── */
  const loadRates = async () => {
    try {
      const snap = await getDoc(DOC_REF);
      if (snap.exists()) {
        const data = snap.data();
        setRates((data.rates || {}) as RatesMap);
        setUpdatedAt(data.updatedAt || null);
      } else {
        setRates({});
        setUpdatedAt(null);
      }
    } catch (err: any) {
      setError('Failed to load fare config. Check Firestore rules.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRates(); }, []);

  /* ── Flash success message ── */
  const flashSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  /* ── Save rates to Firestore ── */
  const saveRates = async (newRates: RatesMap) => {
    setSaving(true);
    try {
      await setDoc(DOC_REF, {
        version: 2,
        updatedAt: serverTimestamp(),
        rates: newRates,
      });
      setRates(newRates);
      // Re-fetch to get the server timestamp
      const snap = await getDoc(DOC_REF);
      if (snap.exists()) setUpdatedAt(snap.data().updatedAt);
      await logAdminAction({ action: 'fare.updated', details: 'Updated fare configuration', metadata: { vehicleCount: Object.keys(newRates).length } });
      flashSuccess('Fare rates saved successfully.');
    } catch (err: any) {
      setError('Failed to save fare config: ' + (err?.message || 'Unknown error'));
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  /* ── Seed defaults — only adds missing vehicles, never overwrites existing ── */
  const handleSeedDefaults = async () => {
    setSeeding(true);
    const merged = { ...rates };
    let added = 0;
    for (const [id, rate] of Object.entries(DEFAULT_RATES)) {
      if (!merged[id]) {
        merged[id] = rate;
        added++;
      }
    }
    if (added === 0) {
      alert('All default vehicle rates already exist. Nothing to add.');
      setSeeding(false);
      return;
    }
    await saveRates(merged);
    setSeeding(false);
    flashSuccess(`Added ${added} missing vehicle rate${added > 1 ? 's' : ''}. Existing rates were not changed.`);
  };

  /* ── Toggle active ── */
  const handleToggleActive = async (vehicleId: string) => {
    const updated = { ...rates };
    updated[vehicleId] = { ...updated[vehicleId], active: !updated[vehicleId].active };
    await saveRates(updated);
  };

  /* ── Open edit modal ── */
  const openEdit = (rate: VehicleRateV2) => {
    setEditVehicle(rate);
    setEditDraft({ ...rate });
  };

  /* ── Save edit ── */
  const handleSaveEdit = async () => {
    if (!editDraft) return;
    const updated = { ...rates };
    updated[editDraft.id] = { ...editDraft };
    setEditVehicle(null);
    setEditDraft(null);
    await saveRates(updated);
  };

  /* ── Update draft field ── */
  const updateDraftField = (key: keyof VehicleRateV2, value: string) => {
    if (!editDraft) return;
    if (key === 'name' || key === 'id') {
      setEditDraft({ ...editDraft, [key]: value });
    } else if (key === 'active') {
      setEditDraft({ ...editDraft, active: value === 'true' });
    } else {
      setEditDraft({ ...editDraft, [key]: parseFloat(value) || 0 });
    }
  };

  const ratesList = (Object.values(rates) as VehicleRateV2[]).sort((a, b) => a.baseFare - b.baseFare);
  const hasRates = ratesList.length > 0;

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <div className="w-10 h-10 border-4 border-gray-200 border-t-primary rounded-full animate-spin" />
          <span className="text-sm">Loading fare config...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-800">Fare Configuration</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Manage vehicle fare rates for all delivery types
            {updatedAt && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs text-gray-400">
                <span className="material-symbols-outlined text-xs">schedule</span>
                Last updated: {formatTimestamp(updatedAt)}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={handleSeedDefaults}
          disabled={seeding || saving}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition-colors disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-lg">restart_alt</span>
          {seeding ? 'Seeding...' : 'Seed Defaults'}
        </button>
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

      {/* ── Success ── */}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
          <span className="material-symbols-outlined text-green-600">check_circle</span>
          <p className="text-green-700 text-sm font-semibold">{successMsg}</p>
        </div>
      )}

      {/* ── Empty state ── */}
      {!hasRates && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 py-16 text-center">
          <span className="material-symbols-outlined text-5xl text-gray-300">local_shipping</span>
          <p className="mt-3 text-gray-500 font-semibold">No fare rates configured yet</p>
          <p className="text-sm text-gray-400 mt-1">Click "Seed Defaults" to add the default vehicle rates.</p>
        </div>
      )}

      {/* ── Rates Table ── */}
      {hasRates && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Vehicle</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Base Fare</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Per Km</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Per Min</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Included Km</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Capacity</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Min Fare</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {ratesList.map(rate => (
                  <tr key={rate.id} className={`hover:bg-gray-50 transition-colors ${!rate.active ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${rate.active ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-400'}`}>
                          <span className="material-symbols-outlined text-xl">{VEHICLE_ICONS[rate.id] || 'local_shipping'}</span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-800">{rate.name}</p>
                          <p className="text-[11px] text-gray-400 font-mono">{rate.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-800">₹{rate.baseFare}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">₹{rate.perKmRate}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">₹{rate.perMinuteRate}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{rate.includedKm} km</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{rate.capacityKg} kg</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-800">₹{rate.minFare}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleActive(rate.id)}
                        disabled={saving}
                        className="group relative"
                        title={rate.active ? 'Click to deactivate' : 'Click to activate'}
                      >
                        {rate.active ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-green-100 text-green-700 hover:bg-green-200 transition-colors">
                            <span className="material-symbols-outlined text-xs">check_circle</span>
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">
                            <span className="material-symbols-outlined text-xs">cancel</span>
                            Inactive
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openEdit(rate)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary footer */}
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              {ratesList.length} vehicle type{ratesList.length !== 1 ? 's' : ''} configured
              <span className="mx-1.5">·</span>
              {ratesList.filter(r => r.active).length} active
            </p>
            <p className="text-xs text-gray-400">
              GST: {ratesList.length > 0 ? ratesList[0].gstPercent : 0}%
            </p>
          </div>
        </div>
      )}

      {/* ── Rate Cards (mobile-friendly summary) ── */}
      {hasRates && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {ratesList.filter(r => r.active).map(rate => (
            <div key={rate.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">{VEHICLE_ICONS[rate.id] || 'local_shipping'}</span>
                </div>
                <div>
                  <p className="font-bold text-gray-800 text-sm">{rate.name}</p>
                  <p className="text-[11px] text-gray-400">Up to {rate.capacityKg} kg</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Base fare</span>
                  <span className="font-bold text-gray-800">₹{rate.baseFare}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">After {rate.includedKm} km</span>
                  <span className="font-semibold text-gray-700">₹{rate.perKmRate}/km</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Per minute</span>
                  <span className="font-semibold text-gray-700">₹{rate.perMinuteRate}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Free weight</span>
                  <span className="font-semibold text-gray-700">{rate.freeWeightKg} kg</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editVehicle && editDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => { setEditVehicle(null); setEditDraft(null); }}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 rounded-t-3xl px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">{VEHICLE_ICONS[editDraft.id] || 'local_shipping'}</span>
                </div>
                <div>
                  <p className="font-bold text-gray-800 text-lg">Edit {editDraft.name}</p>
                  <p className="text-xs text-gray-400 font-mono">{editDraft.id}</p>
                </div>
              </div>
              <button onClick={() => { setEditVehicle(null); setEditDraft(null); }} className="text-gray-400 hover:text-gray-600 p-1">
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 space-y-6">
              {/* Display Name */}
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Display Name</label>
                <input
                  type="text"
                  value={editDraft.name}
                  onChange={e => updateDraftField('name', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
                />
              </div>

              {/* Field Groups */}
              {FIELD_GROUPS.map(group => (
                <div key={group.label}>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">{group.label}</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {group.fields.map(field => (
                      <div key={field.key}>
                        <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                          {field.label}
                          {field.unit && <span className="text-gray-300 ml-1">({field.unit})</span>}
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={editDraft[field.key] as number}
                          onChange={e => updateDraftField(field.key, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Active Toggle */}
              <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">Active Status</p>
                  <p className="text-xs text-gray-400">Inactive vehicles won't appear for customers</p>
                </div>
                <button
                  onClick={() => setEditDraft({ ...editDraft, active: !editDraft.active })}
                  className={`relative w-12 h-7 rounded-full transition-colors ${editDraft.active ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${editDraft.active ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white border-t border-gray-100 rounded-b-3xl px-6 py-4 flex items-center justify-end gap-3">
              <button
                onClick={() => { setEditVehicle(null); setEditDraft(null); }}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-primary hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-primary/20"
              >
                {saving ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
                ) : (
                  <><span className="material-symbols-outlined text-sm">save</span> Save Changes</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
