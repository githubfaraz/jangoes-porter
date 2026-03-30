import React, { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

interface LocationPermissionProps {
  onGranted: (lat: number, lng: number) => void;
  children: React.ReactNode;
}

const isNative = Capacitor.isNativePlatform();

/**
 * Wraps children and shows a location permission prompt if GPS is not enabled.
 * Uses Capacitor Geolocation on native (Android/iOS) and browser API on web.
 * Handles both permission request and location services (GPS) check.
 */
const LocationPermission: React.FC<LocationPermissionProps> = ({ onGranted, children }) => {
  const [status, setStatus] = useState<'checking' | 'granted' | 'denied' | 'unavailable' | 'location_off'>('checking');
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    checkPermission();
  }, []);

  const checkPermission = async () => {
    if (isNative) {
      // ── Native (Android / iOS) ──
      try {
        const perm = await Geolocation.checkPermissions();
        if (perm.location === 'granted' || perm.coarseLocation === 'granted') {
          await requestLocation();
        } else if (perm.location === 'denied') {
          setStatus('denied');
        } else {
          // 'prompt' or 'prompt-with-rationale'
          setStatus('denied');
        }
      } catch {
        setStatus('denied');
      }
    } else {
      // ── Browser ──
      if (!('geolocation' in navigator)) {
        setStatus('unavailable');
        return;
      }
      if ('permissions' in navigator) {
        try {
          const result = await navigator.permissions.query({ name: 'geolocation' });
          if (result.state === 'granted') {
            await requestLocation();
            return;
          }
          if (result.state === 'denied') {
            setStatus('denied');
            return;
          }
          setStatus('denied'); // 'prompt'
        } catch {
          await requestLocation();
        }
      } else {
        await requestLocation();
      }
    }
  };

  const requestLocation = async () => {
    setRequesting(true);
    try {
      if (isNative) {
        // Request permission first on native
        const perm = await Geolocation.requestPermissions({ permissions: ['location'] });
        if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
          setStatus('denied');
          setRequesting(false);
          return;
        }
        // Get current position
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
        setStatus('granted');
        setRequesting(false);
        onGranted(pos.coords.latitude, pos.coords.longitude);
      } else {
        // Browser
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setStatus('granted');
            setRequesting(false);
            onGranted(pos.coords.latitude, pos.coords.longitude);
          },
          (err) => {
            console.warn('Location error:', err.message);
            if (err.code === 1) setStatus('denied');          // PERMISSION_DENIED
            else if (err.code === 2) setStatus('location_off'); // POSITION_UNAVAILABLE (GPS off)
            else setStatus('denied');
            setRequesting(false);
          },
          { enableHighAccuracy: true, timeout: 15000 }
        );
      }
    } catch (err: any) {
      console.warn('Location request failed:', err?.message);
      setStatus('denied');
      setRequesting(false);
    }
  };

  if (status === 'checking') {
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-slate-400 font-medium">Checking location...</p>
        </div>
      </div>
    );
  }

  if (status === 'granted') {
    return <>{children}</>;
  }

  // ── Permission / Location prompt screen ──
  const isGpsOff = status === 'location_off';

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white dark:bg-slate-950 p-8 text-center">
      <div className={`size-24 rounded-full flex items-center justify-center mb-6 ${isGpsOff ? 'bg-amber-100' : 'bg-primary/10'}`}>
        <span className={`material-symbols-outlined text-5xl ${isGpsOff ? 'text-amber-500' : 'text-primary'}`}>
          {isGpsOff ? 'location_disabled' : 'location_on'}
        </span>
      </div>

      <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-3">
        {isGpsOff ? 'Turn On Location' : status === 'unavailable' ? 'Location Not Supported' : 'Enable Location'}
      </h2>

      <p className="text-slate-500 text-sm font-medium max-w-xs mb-2 leading-relaxed">
        {isGpsOff
          ? 'Your device\'s location service (GPS) is turned off. Please enable it in your device settings to continue.'
          : status === 'unavailable'
          ? 'Your device does not support location services.'
          : 'We need your location to show nearby services and connect you with the closest drivers.'
        }
      </p>

      <p className="text-slate-400 text-xs max-w-xs mb-8">
        Your location is only used while the app is active and is never shared without your consent.
      </p>

      {status !== 'unavailable' && (
        <button
          onClick={requestLocation}
          disabled={requesting}
          className="w-full max-w-xs h-14 bg-primary text-white font-black rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-primary/20 disabled:opacity-50 active:scale-[0.98] transition-transform"
        >
          {requesting ? (
            <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Requesting...</>
          ) : isGpsOff ? (
            <><span className="material-symbols-outlined">settings</span> Open Settings & Retry</>
          ) : (
            <><span className="material-symbols-outlined">my_location</span> Allow Location Access</>
          )}
        </button>
      )}

      {(status === 'denied' || isGpsOff) && !requesting && (
        <div className="mt-6 bg-amber-50 dark:bg-amber-900/20 rounded-2xl px-5 py-4 max-w-xs">
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined text-amber-500 text-lg mt-0.5 shrink-0">info</span>
            <p className="text-xs text-amber-700 dark:text-amber-400 font-medium leading-relaxed">
              {isGpsOff ? (
                <>Go to your device <strong>Settings → Location</strong> and turn on GPS/Location Services, then tap the button above.</>
              ) : isNative ? (
                <>Go to <strong>Settings → Apps → Jangoes Porter → Permissions</strong> and allow Location access.</>
              ) : (
                <>If the button doesn't work, go to your browser's <strong>Site Settings</strong> and allow location for this site, then refresh the page.</>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationPermission;
