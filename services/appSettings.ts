import { doc, getDoc } from 'firebase/firestore';
import { db } from '../src/firebase.ts';

interface AppSettings {
  services: Record<string, boolean>;
  vehicles: Record<string, boolean>;
}

let cached: AppSettings | null = null;
let cacheTime = 0;
const TTL = 3 * 60 * 1000; // 3 minutes

export async function loadAppSettings(): Promise<AppSettings> {
  if (cached && Date.now() - cacheTime < TTL) return cached;
  try {
    const snap = await getDoc(doc(db, 'config', 'appSettings'));
    if (snap.exists()) {
      cached = snap.data() as AppSettings;
      cacheTime = Date.now();
      return cached;
    }
  } catch (err) {
    console.warn('Failed to load app settings:', err);
  }
  return { services: {}, vehicles: {} };
}

export function isServiceEnabled(settings: AppSettings, serviceId: string): boolean {
  return settings.services[serviceId] !== false; // default enabled if not set
}

export function isVehicleEnabled(settings: AppSettings, vehicleId: string): boolean {
  return settings.vehicles[vehicleId] !== false;
}
