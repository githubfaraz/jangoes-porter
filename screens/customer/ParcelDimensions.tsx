import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const ParcelDimensions: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const bookingState = location.state || {};
  const [weight, setWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'g'>('g');
  const [dimensions, setDimensions] = useState({ length: '', width: '', height: '' });
  const [unit, setUnit] = useState<'cm' | 'inches'>('cm');
  const [productCost, setProductCost] = useState('');
  const [volumetricWeight, setVolumetricWeight] = useState(0);
  const [chargeableWeight, setChargeableWeight] = useState(0);
  const [estimatedCost, setEstimatedCost] = useState(0);

  useEffect(() => {
    const { length, width, height } = dimensions;
    const l = parseFloat(length) || 0;
    const w = parseFloat(width) || 0;
    const h = parseFloat(height) || 0;

    let vWeight = 0;
    if (l > 0 && w > 0 && h > 0) {
      if (unit === 'cm') {
        // Standard divisor for cm is 5000
        vWeight = (l * w * h) / 5000;
      } else {
        // Convert inches to cm then divide by 5000 (roughly 305 for inch calculation)
        vWeight = (l * w * h) / 305.1;
      }
    }
    setVolumetricWeight(parseFloat(vWeight.toFixed(2)));

    // Actual weight handling
    let actualWeightNum = parseFloat(weight) || 0;
    if (weightUnit === 'g') {
      actualWeightNum = actualWeightNum / 1000;
    }

    // Chargeable weight is the higher of volumetric vs actual
    const finalWeight = Math.max(vWeight, actualWeightNum);
    setChargeableWeight(parseFloat(finalWeight.toFixed(2)));

    // Simple cost calculation: Base 150 + 25 per kg
    const basePrice = 150;
    const pricePerKg = 25;
    const cost = finalWeight > 0 ? basePrice + (finalWeight * pricePerKg) : 0;
    setEstimatedCost(Math.round(cost));
  }, [dimensions, unit, weight, weightUnit]);

  const handleInputChange = (field: string, value: string) => {
    if (/^\d*\.?\d*$/.test(value)) {
      setDimensions(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleWeightChange = (value: string) => {
    if (/^\d*\.?\d*$/.test(value)) {
      setWeight(value);
    }
  };

  const isFormValid = dimensions.length && dimensions.width && dimensions.height && weight;

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark min-h-screen">
      <header className="fixed top-0 left-0 right-0 max-w-md mx-auto z-[100] bg-white dark:bg-surface-dark px-4 py-3 flex items-center justify-between shadow-sm">
        <button 
          onClick={() => navigate('/parcel-details')} 
          className="p-3 -ml-2 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-90"
        >
          <span className="material-symbols-outlined text-slate-700 dark:text-white">arrow_back</span>
        </button>
        <h2 className="text-lg font-bold">Parcel Size & Weight</h2>
        <div className="w-10"></div>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar p-6 flex flex-col gap-8 pt-20 pb-32">
        {/* Weight Section */}
        <div className="flex flex-col gap-4 animate-in fade-in duration-500">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-black leading-tight tracking-tight">Package Weight</h1>
              <p className="text-xs text-slate-500 font-medium">Enter the actual weight of your items.</p>
            </div>
            {/* Weight Unit Toggle */}
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl w-fit">
              <button 
                onClick={() => setWeightUnit('kg')}
                className={`px-4 py-1.5 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest ${weightUnit === 'kg' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-400'}`}
              >
                kg
              </button>
              <button 
                onClick={() => setWeightUnit('g')}
                className={`px-4 py-1.5 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest ${weightUnit === 'g' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-400'}`}
              >
                grams
              </button>
            </div>
          </div>

          <div className="relative group">
            <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-700">
              <span className="material-symbols-outlined text-3xl filled">weight</span>
            </div>
            <input 
              type="text" 
              inputMode="decimal"
              value={weight}
              onChange={(e) => handleWeightChange(e.target.value)}
              placeholder="0.0"
              className="w-full bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-3xl pl-16 pr-20 py-6 text-3xl font-black text-slate-900 dark:text-white focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all text-center placeholder:text-slate-200 dark:placeholder:text-slate-800"
            />
            <div className="absolute right-6 top-1/2 -translate-y-1/2">
              <span className="text-xs font-black text-slate-300 uppercase tracking-[0.2em]">{weightUnit}</span>
            </div>
          </div>
        </div>

        {/* Product Cost */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-lg">currency_rupee</span>
            <span className="text-sm font-black text-slate-700 dark:text-slate-200">Product Value (in Rupees)</span>
          </div>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">₹</span>
            <input
              type="number"
              inputMode="numeric"
              value={productCost}
              onChange={e => setProductCost(e.target.value)}
              placeholder="0"
              className="w-full h-14 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl pl-10 pr-5 text-base font-bold focus:border-primary transition-all"
            />
          </div>
          <p className="text-[9px] text-slate-400 font-medium ml-1">Declared value for insurance and liability purposes.</p>
        </div>

        <div className="h-px bg-slate-100 dark:bg-slate-800"></div>

        {/* Dimensions Section */}
        <div className="flex flex-col gap-4 animate-in fade-in duration-500 delay-150">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-black leading-tight tracking-tight">Dimensions</h2>
              <p className="text-xs text-slate-500 font-medium">L x W x H for volumetric calculation.</p>
            </div>
            {/* Dim Unit Toggle */}
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl w-fit">
              <button 
                onClick={() => setUnit('cm')}
                className={`px-4 py-1.5 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest ${unit === 'cm' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-400'}`}
              >
                cm
              </button>
              <button 
                onClick={() => setUnit('inches')}
                className={`px-4 py-1.5 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest ${unit === 'inches' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-400'}`}
              >
                in
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-center">Length</label>
              <div className="relative">
                <input 
                  type="text" 
                  inputMode="decimal"
                  value={dimensions.length}
                  onChange={(e) => handleInputChange('length', e.target.value)}
                  placeholder="0.0"
                  className="w-full bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl px-4 py-4 text-lg font-black focus:border-primary focus:ring-0 transition-all text-center"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-center">Width</label>
              <div className="relative">
                <input 
                  type="text" 
                  inputMode="decimal"
                  value={dimensions.width}
                  onChange={(e) => handleInputChange('width', e.target.value)}
                  placeholder="0.0"
                  className="w-full bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl px-4 py-4 text-lg font-black focus:border-primary focus:ring-0 transition-all text-center"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-center">Height</label>
              <div className="relative">
                <input 
                  type="text" 
                  inputMode="decimal"
                  value={dimensions.height}
                  onChange={(e) => handleInputChange('height', e.target.value)}
                  placeholder="0.0"
                  className="w-full bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl px-4 py-4 text-lg font-black focus:border-primary focus:ring-0 transition-all text-center"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Calculation Result */}
        <div className={`mt-2 p-6 rounded-[32px] border transition-all duration-500 shadow-xl ${isFormValid ? 'bg-primary/5 border-primary/20 shadow-primary/5 opacity-100' : 'bg-slate-50 border-slate-100 opacity-50 shadow-none'}`}>
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chargeable Weight</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-primary">{chargeableWeight || '0.00'}</span>
                  <span className="text-sm font-bold text-primary/60">kg</span>
                </div>
                <p className="text-[9px] font-medium text-slate-400 mt-1 uppercase tracking-tighter">
                  Higher of Actual ({weight || 0}{weightUnit}) vs Volumetric ({volumetricWeight}kg)
                </p>
              </div>
              <div className="size-14 bg-white dark:bg-slate-700 rounded-3xl flex items-center justify-center text-primary shadow-lg border border-primary/10">
                <span className="material-symbols-outlined text-3xl">scale</span>
              </div>
            </div>

            <div className="h-px bg-slate-100 dark:bg-slate-700"></div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Est. Starting Fare</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-slate-900 dark:text-white">₹{estimatedCost || '---'}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-green-50 dark:bg-green-900/20 text-green-600 border border-green-100 dark:border-green-900/30">
                <span className="material-symbols-outlined text-sm filled">verified</span>
                <span className="text-[9px] font-black uppercase tracking-widest">Best Rate</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-[24px] flex gap-4 items-start border border-slate-100 dark:border-slate-800">
          <div className="size-8 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
            <span className="material-symbols-outlined text-slate-300 text-lg">info</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
            Shipping costs are determined by whichever is greater: the physical weight or the space the package occupies (volumetric weight).
          </p>
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-5 bg-white/95 dark:bg-surface-dark/95 backdrop-blur-md border-t border-slate-100 dark:border-slate-800 z-[60] shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
        <button 
          onClick={() => navigate('/vehicles', { state: { ...bookingState, dimensions: { chargeableWeight, estimatedCost }, productCost: parseFloat(productCost) || 0 } })}
          disabled={!isFormValid}
          className="w-full bg-primary hover:bg-primary-dark text-white font-black h-16 rounded-[24px] shadow-2xl shadow-primary/30 flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale transition-all active:scale-[0.98]"
        >
          <span className="text-base uppercase tracking-widest font-bold">Next</span>
          <span className="material-symbols-outlined font-black">local_shipping</span>
        </button>
      </footer>
    </div>
  );
};

export default ParcelDimensions;