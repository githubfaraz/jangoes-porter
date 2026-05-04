// Tiny shared-state module for the driver "online" toggle.
//
// Why not Context? Two consumers — the Dashboard (toggle UI) and the App-level
// TripRequestOverlay (listener) — need to stay in sync, but the surrounding
// surface area is small. This module-level pub/sub keeps one source of truth
// in sessionStorage, exposes a `useDriverOnline` hook with React semantics,
// and avoids wrapping the driver section of App.tsx in a Provider.
//
// sessionStorage persists across reloads in the same tab, which matches the
// previous Dashboard.tsx behavior.

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'driverOnline';

let onlineState = (() => {
  try { return sessionStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
})();

const listeners = new Set<(v: boolean) => void>();

export function getDriverOnline(): boolean {
  return onlineState;
}

export function setDriverOnline(v: boolean): void {
  if (v === onlineState) return;
  onlineState = v;
  try { sessionStorage.setItem(STORAGE_KEY, v ? 'true' : 'false'); } catch {}
  listeners.forEach(fn => fn(v));
}

export function useDriverOnline(): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState<boolean>(onlineState);
  useEffect(() => {
    const fn = (v: boolean) => setValue(v);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);
  return [value, setDriverOnline];
}
