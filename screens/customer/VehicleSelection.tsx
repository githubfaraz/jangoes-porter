import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { VEHICLE_TYPES } from '../../constants.tsx';
import { estimateFareV2, estimateExchangeFareV2, getRoadDistance, loadVehicleRates, getVehicleRates, haversineKm, type FareBreakdownV2 } from '../../services/fareService.ts';
import { loadAppSettings } from '../../services/appSettings.ts';
import { auth, db } from '../../src/firebase.ts';
import { doc, getDoc } from 'firebase/firestore';

const VehicleSelection: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const bookingState = location.state || {};

  const [selected, setSelected] = useState('');
  const [fares, setFares] = useState<Record<string, FareBreakdownV2>>({});
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [loadingFares, setLoadingFares] = useState(true);
  const [availableCategories, setAvailableCategories] = useState<Record<string, number>>({});
  const [loadingAvailability, setLoadingAvailability] = useState(true);
  const [enabledVehicles, setEnabledVehicles] = useState<Record<string, boolean>>({});

  const [walletBalance, setWalletBalance] = useState(0);

  // Load real wallet balance
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      if (snap.exists()) setWalletBalance(snap.data().walletBalance ?? 0);
    });
  }, []);

  const pickup = bookingState.pickup;
  const drop   = bookingState.drop;
  const weightKg: number = bookingState.dimensions?.chargeableWeight ?? 0;
  const isExchange = bookingState.serviceType === 'exchange';
  const qcRequired = bookingState.exchange?.qcRequired ?? false;

  const pickupTitle = pickup?.title || pickup?.address || 'Pickup location';
  const dropTitle   = drop?.title   || drop?.address   || 'Drop location';

  // Check which vehicle categories have registered drivers
  useEffect(() => {
    async function checkAvailability() {
      try {
        const [availRes, settings] = await Promise.all([
          fetch('/api/driver-availability').then(r => r.json()),
          loadAppSettings(),
        ]);
        const counts: Record<string, number> = availRes.counts || {};
        setAvailableCategories(counts);
        setEnabledVehicles(settings.vehicles || {});
        const visibleVehicles = VEHICLE_TYPES.filter(v => (settings.vehicles || {})[v.id] !== false);
        const firstAvailable = visibleVehicles.find(v => counts[v.id] && counts[v.id] > 0);
        if (firstAvailable) setSelected(firstAvailable.id);
        else if (visibleVehicles.length > 0) setSelected(visibleVehicles[0].id);
      } catch (err) {
        console.error('Error checking driver availability:', err);
      } finally {
        setLoadingAvailability(false);
      }
    }
    checkAvailability();
  }, []);

  // Calculate real fares for all vehicles on mount
  useEffect(() => {
    if (!pickup?.lat || !drop?.lat) {
      // No coordinates — fall back to VEHICLE_TYPES static prices
      setLoadingFares(false);
      return;
    }

    async function loadFares() {
      setLoadingFares(true);
      try {
        // Load admin-configurable rates from Firestore
        await loadVehicleRates();
        const rates = getVehicleRates();

        // Get road distance + traffic-aware duration
        let km: number;
        let mins: number;
        try {
          const result = await getRoadDistance(
            { lat: pickup.lat, lng: pickup.lng },
            { lat: drop.lat, lng: drop.lng },
          );
          km = result.distanceKm;
          mins = result.durationMins;
        } catch {
          // Fallback: Haversine × 1.4, estimate duration at 25 km/h
          km = haversineKm(pickup, drop) * 1.4;
          mins = Math.ceil(km / 25 * 60);
        }
        setDistanceKm(km);

        // Build fares for every vehicle
        const computed: Record<string, FareBreakdownV2> = {};
        for (const vid of Object.keys(rates)) {
          computed[vid] = isExchange
            ? estimateExchangeFareV2(vid, km, mins, qcRequired)
            : estimateFareV2(vid, km, mins);
        }
        setFares(computed);
      } finally {
        setLoadingFares(false);
      }
    }
    loadFares();
  }, [pickup?.lat, pickup?.lng, drop?.lat, drop?.lng, weightKg]);

  const selectedVehicle  = VEHICLE_TYPES.find(v => v.id === selected);
  const selectedFare     = fares[selected];
  const displayFare: number = selectedFare?.estimatedTotal ?? (selectedVehicle?.price ?? 0);

  // Price shown on each card
  const cardFare = (vehicleId: string): number => {
    if (fares[vehicleId]) return fares[vehicleId].estimatedTotal;
    return VEHICLE_TYPES.find(v => v.id === vehicleId)?.price ?? 0;
  };

  return (
    <div className="relative h-screen w-full flex flex-col bg-background-light dark:bg-background-dark overflow-hidden text-slate-900 dark:text-white">
      <div className="absolute inset-0 z-0 h-2/3 w-full bg-cover bg-center" style={{ backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuCSr2eqmT0Cbxqj4DqJZcskF6seYnmtNuDrdSl2PXvuU0YsSq0i2Bwv5Bwaeo58m7tnyNfVnjRhsAAvCIZClCVL5fywRsdDqB-ziZLcOlIcmE24x_JxUKLYB-sdyd2nK_QY_FX6gpr-azvXDbM9MIYT2Q-XbkPYTNeS42iPGyN8evYSDTMYLRbT1Z4zIQ3kfWg0FLBkROgVy8OYkTwfYieJYc71vv44GVmhJadjSl2BdJOYzX1mVpBi_hWvHWNNaV6jjQcW5B3sCw')` }} />

      {/* Route header */}
      <div className="absolute top-0 left-0 right-0 z-10 pt-12 px-4">
        <div className="bg-white dark:bg-surface-dark shadow-xl rounded-lg p-4 flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-1 rounded-full hover:bg-slate-100">
            <span className="material-symbols-outlined text-slate-600">arrow_back</span>
          </button>
          <div className="flex-1 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <p className="text-xs font-medium text-slate-500 truncate">{pickupTitle}</p>
            </div>
            <div className="h-3 border-l border-dashed border-slate-300 ml-[3px]"></div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <p className="text-sm font-semibold truncate">{dropTitle}</p>
            </div>
          </div>
          {distanceKm !== null && (
            <div className="shrink-0 text-right">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Distance</p>
              <p className="text-sm font-black text-primary">{distanceKm.toFixed(1)} km</p>
            </div>
          )}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col" style={{ maxHeight: '70vh' }}>
        <div className="bg-white dark:bg-surface-dark rounded-t-3xl shadow-sheet pt-2 pb-24 overflow-y-auto">
          <div className="flex justify-center py-2">
            <div className="h-1 w-12 rounded-full bg-slate-200 dark:bg-slate-600"></div>
          </div>

          <div className="px-5 pt-1 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Select a vehicle</h2>
              <p className="text-xs text-slate-500">Available vehicles for your items</p>
            </div>
            {loadingFares && (
              <div className="flex items-center gap-1.5 text-primary">
                <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                <span className="text-[10px] font-black uppercase tracking-widest">Calculating...</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 px-5 pb-4">
            {VEHICLE_TYPES.filter(v => enabledVehicles[v.id] !== false).map((v) => {
              const driverCount = availableCategories[v.id] || 0;
              const isAvailable = driverCount > 0;
              const isUnavailable = !loadingAvailability && !isAvailable;
              return (
              <button
                key={v.id}
                onClick={() => isAvailable && setSelected(v.id)}
                disabled={isUnavailable}
                className={`relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                  isUnavailable ? 'border-slate-100 bg-slate-50 dark:bg-slate-900 opacity-40 cursor-not-allowed' :
                  selected === v.id ? 'border-primary bg-blue-50/50 dark:bg-primary/10 shadow-md ring-1 ring-primary/20' : 'border-slate-100 bg-white dark:bg-slate-800'
                }`}
              >
                {/* Icon */}
                <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isUnavailable ? 'bg-slate-100' : selected === v.id ? 'bg-primary/10' : 'bg-slate-50 dark:bg-slate-700'
                }`}>
                  <span className={`material-symbols-outlined text-2xl ${isUnavailable ? 'text-slate-300' : selected === v.id ? 'text-primary' : 'text-slate-400'}`}>{(v as any).icon || 'local_shipping'}</span>
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold truncate">{v.name}</span>
                    {isUnavailable && <span className="text-[8px] font-black bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full uppercase">No Drivers</span>}
                    {!isUnavailable && v.bestValue && <span className="text-[8px] font-black bg-primary text-white px-1.5 py-0.5 rounded-full">BEST</span>}
                    {!isUnavailable && isAvailable && !v.bestValue && <span className="text-[8px] font-black bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">{driverCount} online</span>}
                  </div>
                  <span className="text-[10px] text-slate-400">{v.capacity} • {v.time}</span>
                </div>
                {/* Price */}
                <div className="text-right shrink-0">
                  {loadingFares ? (
                    <div className="h-4 w-12 bg-slate-100 rounded animate-pulse" />
                  ) : (
                    <span className="text-base font-black">₹{cardFare(v.id)}</span>
                  )}
                </div>
              </button>
              );
            })}
          </div>

          {/* Fare detail breakdown for selected vehicle */}
          {selectedFare && !loadingFares && (
            <div className="mx-5 mb-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl px-4 py-3 flex flex-col gap-1.5 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Base Charge</span>
                <span className="font-bold text-slate-700">₹{selectedFare.baseFare}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Distance Charge ({distanceKm !== null ? `${distanceKm.toFixed(1)} km` : 'est.'})</span>
                <span className="font-bold text-slate-700">₹{selectedFare.distanceCharge}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Time Charge ({selectedFare.durationMins} min)</span>
                <span className="font-bold text-slate-700">₹{selectedFare.timeCharge}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>GST (5%)</span>
                <span className="font-bold text-slate-700">₹{selectedFare.gst}</span>
              </div>
              {isExchange && (
                <div className="flex justify-between items-center text-rose-500">
                  <span className="flex items-center gap-1 text-xs font-bold">
                    <span className="material-symbols-outlined text-sm">swap_horiz</span>
                    Roundtrip Exchange (1.8x)
                  </span>
                  <span className="text-[9px] font-black bg-rose-50 text-rose-500 px-2 py-0.5 rounded-full">ROUNDTRIP</span>
                </div>
              )}
              <div className="border-t border-slate-200 dark:border-slate-700 mt-1 pt-1.5 flex justify-between font-black text-slate-900 dark:text-white">
                <span>Estimated Total</span>
                <span className="text-primary">₹{selectedFare.estimatedTotal}</span>
              </div>
              <p className="text-[9px] text-slate-400 mt-1">Final fare may include waiting charges</p>
            </div>
          )}

          <div className="px-5 flex flex-col gap-4">
            <button
              disabled={!selected || (!loadingAvailability && !(availableCategories[selected] > 0))}
              onClick={() => navigate('/summary', {
                state: {
                  ...bookingState,
                  vehicle:      { id: selectedVehicle?.id, name: selectedVehicle?.name || '', capacity: selectedVehicle?.capacity || '' },
                  fare:         displayFare,
                  fareBreakdown: selectedFare ?? null,
                  distanceKm,
                },
              })}
              className="w-full bg-primary hover:bg-primary-dark text-white font-black py-4 rounded-[20px] shadow-2xl shadow-primary/30 flex items-center justify-between px-7 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex flex-col items-start leading-none">
                <span className="text-[9px] font-bold text-white/70 uppercase tracking-widest mb-1">Estimated Fare</span>
                <span className="text-xl font-black tracking-tight text-white">₹{displayFare}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold uppercase tracking-widest">Book Now</span>
                <span className="material-symbols-outlined font-black">arrow_forward</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VehicleSelection;
