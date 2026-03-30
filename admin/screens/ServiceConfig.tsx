import React, { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../src/firebase';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { logAdminAction } from '../services/activityLog';

const DOC_REF = doc(db, 'config', 'appSettings');

const DEFAULT_SERVICES = [
  { id: 'parcels', name: 'Parcels', icon: 'package_2', enabled: true },
  { id: 'reverse-parcels', name: 'Reverse Parcels', icon: 'assignment_return', enabled: true },
  { id: 'exchange', name: 'Exchange', icon: 'swap_horiz', enabled: true },
];

const DEFAULT_VEHICLES = [
  { id: 'bike', name: 'Bike', icon: 'motorcycle', enabled: true },
  { id: 'car', name: 'Car', icon: 'directions_car', enabled: true },
  { id: 'tata-ace', name: 'Mini Truck (Tata Ace)', icon: 'local_shipping', enabled: true },
  { id: 'bolero', name: 'Pickup Truck (Bolero)', icon: 'local_shipping', enabled: true },
  { id: 'tata-407', name: 'Medium Truck (Tata 407)', icon: 'local_shipping', enabled: true },
  { id: 'large-truck', name: 'Large Truck', icon: 'local_shipping', enabled: true },
];

interface ToggleItem {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
}

export default function ServiceConfig() {
  const { isSuperAdmin } = useAdminAuth();
  const [services, setServices] = useState<ToggleItem[]>(DEFAULT_SERVICES);
  const [vehicles, setVehicles] = useState<ToggleItem[]>(DEFAULT_VEHICLES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const snap = await getDoc(DOC_REF);
      if (snap.exists()) {
        const data = snap.data();
        if (data.services) {
          setServices(DEFAULT_SERVICES.map(s => ({
            ...s,
            enabled: data.services[s.id] !== false, // default to enabled if not set
          })));
        }
        if (data.vehicles) {
          setVehicles(DEFAULT_VEHICLES.map(v => ({
            ...v,
            enabled: data.vehicles[v.id] !== false,
          })));
        }
      }
    } catch (err) {
      console.error('Failed to load config:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (newServices: ToggleItem[], newVehicles: ToggleItem[]) => {
    setSaving(true);
    try {
      const servicesMap: Record<string, boolean> = {};
      newServices.forEach(s => { servicesMap[s.id] = s.enabled; });
      const vehiclesMap: Record<string, boolean> = {};
      newVehicles.forEach(v => { vehiclesMap[v.id] = v.enabled; });

      await setDoc(DOC_REF, {
        services: servicesMap,
        vehicles: vehiclesMap,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      await logAdminAction({
        action: 'config.services_updated',
        details: `Updated services/vehicles configuration`,
        metadata: { services: servicesMap, vehicles: vehiclesMap },
      });

      setSuccess('Configuration saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      alert('Failed to save: ' + (err?.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const toggleService = (id: string) => {
    const updated = services.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s);
    setServices(updated);
    saveConfig(updated, vehicles);
  };

  const toggleVehicle = (id: string) => {
    const updated = vehicles.map(v => v.id === id ? { ...v, enabled: !v.enabled } : v);
    setVehicles(updated);
    saveConfig(services, updated);
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <span className="material-symbols-outlined text-red-400 text-5xl">admin_panel_settings</span>
          <p className="text-gray-500 mt-3 font-semibold">Only Super Admin can access this page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-green-500">check_circle</span>
          <span className="text-green-700 text-sm font-semibold">{success}</span>
        </div>
      )}

      {/* Services */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-800">Services</h3>
            <p className="text-xs text-gray-400 mt-0.5">Enable or disable services visible to customers</p>
          </div>
          <span className="material-symbols-outlined text-gray-300 text-2xl">miscellaneous_services</span>
        </div>
        <div className="divide-y divide-gray-50">
          {services.map(s => (
            <div key={s.id} className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`size-10 rounded-xl flex items-center justify-center ${s.enabled ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-400'}`}>
                  <span className="material-symbols-outlined text-xl">{s.icon}</span>
                </div>
                <div>
                  <p className={`text-sm font-bold ${s.enabled ? 'text-gray-800' : 'text-gray-400'}`}>{s.name}</p>
                  <p className="text-[10px] text-gray-400 font-mono">{s.id}</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={s.enabled} onChange={() => toggleService(s.id)} disabled={saving} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Vehicle Types */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-800">Vehicle Types</h3>
            <p className="text-xs text-gray-400 mt-0.5">Enable or disable vehicle types available for booking</p>
          </div>
          <span className="material-symbols-outlined text-gray-300 text-2xl">local_shipping</span>
        </div>
        <div className="divide-y divide-gray-50">
          {vehicles.map(v => (
            <div key={v.id} className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`size-10 rounded-xl flex items-center justify-center ${v.enabled ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-400'}`}>
                  <span className="material-symbols-outlined text-xl">{v.icon}</span>
                </div>
                <div>
                  <p className={`text-sm font-bold ${v.enabled ? 'text-gray-800' : 'text-gray-400'}`}>{v.name}</p>
                  <p className="text-[10px] text-gray-400 font-mono">{v.id}</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={v.enabled} onChange={() => toggleVehicle(v.id)} disabled={saving} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center">Changes take effect immediately for all users.</p>
    </div>
  );
}
