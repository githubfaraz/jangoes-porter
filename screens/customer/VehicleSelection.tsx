import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { VEHICLE_TYPES } from '../../constants.tsx';
import { estimateFare, estimateExchangeFare, getRoadDistance, VEHICLE_RATES, type FareBreakdown } from '../../services/fareService.ts';

const VehicleSelection: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const bookingState = location.state || {};

  const [selected, setSelected] = useState('tata-ace');
  const [fares, setFares] = useState<Record<string, FareBreakdown>>({});
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [loadingFares, setLoadingFares] = useState(true);

  // Mocking wallet balance (consistent with Wallet.tsx)
  const walletBalance = 2450.00;

  const pickup = bookingState.pickup;
  const drop   = bookingState.drop;
  const weightKg: number = bookingState.dimensions?.chargeableWeight ?? 0;
  const isExchange = bookingState.serviceType === 'exchange';
  const qcRequired = bookingState.exchange?.qcRequired ?? false;

  const pickupTitle = pickup?.title || pickup?.address || 'Pickup location';
  const dropTitle   = drop?.title   || drop?.address   || 'Drop location';

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
        // Try real road distance first
        let km: number;
        try {
          const { distanceKm: roadKm } = await getRoadDistance(
            { lat: pickup.lat, lng: pickup.lng },
            { lat: drop.lat,   lng: drop.lng   },
          );
          km = roadKm;
        } catch {
          // Fallback to Haversine estimate if API fails
          const R = 6371;
          const dLat = (drop.lat - pickup.lat) * Math.PI / 180;
          const dLng = (drop.lng - pickup.lng) * Math.PI / 180;
          const a = Math.sin(dLat / 2) ** 2
            + Math.cos(pickup.lat * Math.PI / 180)
            * Math.cos(drop.lat * Math.PI / 180)
            * Math.sin(dLng / 2) ** 2;
          km = R * 2 * Math.asin(Math.sqrt(a)) * 1.4; // ×1.4 road correction
        }
        setDistanceKm(km);

        // Build fares for every vehicle
        const computed: Record<string, FareBreakdown> = {};
        for (const vid of Object.keys(VEHICLE_RATES)) {
          computed[vid] = isExchange
            ? estimateExchangeFare(vid, pickup, drop, weightKg, qcRequired)
            : estimateFare(vid, pickup, drop, weightKg);
          // Override distanceKm with real value if we got it
          computed[vid] = { ...computed[vid], distanceKm: km };
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
  const displayFare: number = selectedFare?.total ?? (selectedVehicle?.price ?? 0);
  const hasSufficientFunds = walletBalance >= displayFare;

  // Price shown on each card
  const cardFare = (vehicleId: string): number => {
    if (fares[vehicleId]) return fares[vehicleId].total;
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

      <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col">
        <div className="bg-white dark:bg-surface-dark rounded-t-3xl shadow-sheet pt-2 pb-24 overflow-hidden">
          <div className="flex justify-center py-3">
            <div className="h-1 w-12 rounded-full bg-slate-200 dark:bg-slate-600"></div>
          </div>

          <div className="px-5 pt-2 pb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Select a vehicle</h2>
              <p className="text-sm text-slate-500">Available trucks for your items</p>
            </div>
            {loadingFares && (
              <div className="flex items-center gap-1.5 text-primary">
                <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                <span className="text-[10px] font-black uppercase tracking-widest">Calculating...</span>
              </div>
            )}
          </div>

          <div className="flex gap-3 overflow-x-auto no-scrollbar px-5 pb-6 snap-x">
            {VEHICLE_TYPES.map((v) => (
              <button
                key={v.id}
                onClick={() => setSelected(v.id)}
                className={`relative flex flex-col w-40 p-4 rounded-xl border-2 transition-all text-left snap-center ${
                  selected === v.id ? 'border-primary bg-blue-50/50 dark:bg-primary/10 shadow-md ring-1 ring-primary/20' : 'border-slate-100 bg-white dark:bg-slate-800'
                }`}
              >
                {v.bestValue && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">BEST</div>
                )}
                <div
                  className="w-full aspect-[4/3] bg-contain bg-center bg-no-repeat mb-3"
                  style={{ backgroundImage: `url('${v.image}')` }}
                />
                <div className="flex flex-col">
                  <span className="text-sm font-bold">{v.name}</span>
                  <span className="text-[10px] text-slate-500">{v.capacity}</span>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex justify-between items-end">
                  {loadingFares ? (
                    <div className="h-4 w-12 bg-slate-100 rounded animate-pulse" />
                  ) : (
                    <span className="text-base font-bold">₹{cardFare(v.id)}</span>
                  )}
                  <span className="text-[10px] text-slate-400">{v.time}</span>
                </div>
                {fares[v.id]?.surchargeLabel && (
                  <div className="mt-1 text-[9px] font-black text-amber-600 bg-amber-50 rounded-lg px-1.5 py-0.5">
                    {fares[v.id].surchargeLabel}
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Fare detail breakdown for selected vehicle */}
          {selectedFare && !loadingFares && (
            <div className="mx-5 mb-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl px-4 py-3 flex flex-col gap-1.5 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Base fare ({distanceKm !== null ? `${distanceKm.toFixed(1)} km` : 'est.'})</span>
                <span className="font-bold text-slate-700">₹{selectedFare.baseFare + selectedFare.distanceCharge}</span>
              </div>
              {selectedFare.weightSurcharge > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Weight surcharge</span>
                  <span className="font-bold text-slate-700">₹{selectedFare.weightSurcharge}</span>
                </div>
              )}
              {(selectedFare.nightSurcharge > 0 || selectedFare.peakSurcharge > 0) && (
                <div className="flex justify-between text-amber-600">
                  <span>{selectedFare.surchargeLabel}</span>
                  <span className="font-bold">+₹{selectedFare.nightSurcharge || selectedFare.peakSurcharge}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-500">
                <span>GST (5%)</span>
                <span className="font-bold text-slate-700">₹{selectedFare.gst}</span>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-700 mt-1 pt-1.5 flex justify-between font-black text-slate-900 dark:text-white">
                <span>Total</span>
                <span className="text-primary">₹{selectedFare.total}</span>
              </div>
            </div>
          )}

          <div className="px-5 flex flex-col gap-4">
            {/* Payment Method */}
            <div className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${
              hasSufficientFunds
                ? 'bg-primary/5 border-primary/20'
                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700'
            }`}>
              <div className="flex items-center gap-4">
                <div className={`size-10 rounded-xl flex items-center justify-center shadow-sm ${
                  hasSufficientFunds ? 'bg-primary text-white' : 'bg-green-100 text-green-600'
                }`}>
                  <span className="material-symbols-outlined text-xl filled">
                    {hasSufficientFunds ? 'account_balance_wallet' : 'payments'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                    {hasSufficientFunds ? 'Wallet Payment' : 'Primary Payment'}
                  </span>
                  <span className="text-sm font-black text-slate-900 dark:text-white">
                    {hasSufficientFunds ? `Wallet (₹${walletBalance})` : 'Cash on Delivery'}
                  </span>
                </div>
              </div>
              {hasSufficientFunds ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary">
                  <span className="material-symbols-outlined text-xs filled">lock</span>
                  <span className="text-[9px] font-black uppercase tracking-widest">Locked</span>
                </div>
              ) : (
                <button className="text-primary text-[10px] font-black uppercase tracking-widest hover:underline px-2 py-1">
                  Change
                </button>
              )}
            </div>

            <button
              onClick={() => navigate('/summary', {
                state: {
                  ...bookingState,
                  vehicle:      { id: selectedVehicle?.id, name: selectedVehicle?.name || '', capacity: selectedVehicle?.capacity || '' },
                  fare:         displayFare,
                  fareBreakdown: selectedFare ?? null,
                  distanceKm,
                },
              })}
              className="w-full bg-primary hover:bg-primary-dark text-white font-black py-4 rounded-[20px] shadow-2xl shadow-primary/30 flex items-center justify-between px-7 transition-all active:scale-[0.98]"
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
