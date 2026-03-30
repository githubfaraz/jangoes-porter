import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { uploadToCloudinary } from '../../services/cloudinaryUpload.ts';

const CATEGORIES = ['Electronics', 'Clothing', 'Documents', 'Furniture', 'Food', 'Other'];

const ExchangeDetails: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const bookingState = location.state || {};

  const [productA, setProductA] = useState({ description: '', category: '' });
  const [productB, setProductB] = useState({ description: '', category: '' });
  const [qcRequired, setQcRequired] = useState(false);
  const [qcItems, setQcItems] = useState<string[]>([]);
  const [newQcItem, setNewQcItem] = useState('');
  const [weight, setWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState<'g' | 'kg'>('g');
  const [productAPhotos, setProductAPhotos] = useState<string[]>([]);
  const [productBPhotos, setProductBPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const photoInputARef = useRef<HTMLInputElement>(null);
  const photoInputBRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, setPhotos: React.Dispatch<React.SetStateAction<string[]>>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadToCloudinary(file, 'exchange-reference');
      setPhotos(prev => [...prev, url]);
    } catch { alert('Photo upload failed.'); }
    finally { setUploading(false); e.target.value = ''; }
  };

  const isFormValid =
    productA.description.trim().length > 2 &&
    productA.category !== '' &&
    productB.description.trim().length > 2 &&
    productB.category !== '' &&
    parseFloat(weight) > 0;

  const handleContinue = () => {
    navigate('/vehicles', {
      state: {
        ...bookingState,
        serviceType: 'exchange',
        exchange: { productA, productB, qcRequired, qcItems: qcRequired ? qcItems : [], productAPhotos, productBPhotos },
        dimensions: { chargeableWeight: weightUnit === 'g' ? parseFloat(weight) / 1000 : parseFloat(weight), estimatedCost: 0 },
      },
    });
  };

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark min-h-screen">
      <header className="fixed top-0 left-0 right-0 max-w-md mx-auto z-[100] bg-white dark:bg-surface-dark px-4 py-3 flex items-center justify-between shadow-sm">
        <button
          onClick={() => navigate('/search')}
          className="p-3 -ml-2 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-90"
        >
          <span className="material-symbols-outlined text-slate-700 dark:text-white">arrow_back</span>
        </button>
        <h2 className="text-lg font-bold">Exchange Details</h2>
        <div className="w-10"></div>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar p-6 flex flex-col gap-6 pt-20 pb-40">
        {/* Title */}
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-black leading-tight tracking-tight">Set up your exchange</h1>
          <p className="text-sm text-slate-500 font-medium">Tell us what you're sending and what you expect back.</p>
        </div>

        {/* Exchange visual indicator */}
        <div className="flex items-center justify-center gap-3 py-3">
          <div className="flex flex-col items-center gap-1">
            <div className="size-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-primary filled">inventory_2</span>
            </div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">You Send</span>
          </div>
          <div className="size-10 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/30">
            <span className="material-symbols-outlined text-white text-xl">swap_horiz</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="size-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-emerald-500 filled">package_2</span>
            </div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">You Get</span>
          </div>
        </div>

        {/* Product A Card */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-primary/20 shadow-xl shadow-primary/5 flex flex-col gap-5">
          <div className="flex items-center gap-2">
            <div className="size-6 bg-primary/10 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-sm filled">upload</span>
            </div>
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Product A — You're Sending</h3>
          </div>

          <div className="flex flex-col gap-4">
            <div className="relative">
              <textarea
                value={productA.description}
                onChange={(e) => setProductA({ ...productA, description: e.target.value })}
                className="w-full h-24 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-3xl p-5 text-base font-medium focus:ring-primary/20 focus:border-primary transition-all resize-none shadow-sm placeholder:text-slate-300 dark:placeholder:text-slate-600"
                placeholder="Describe the item you're sending (e.g., iPhone 14 Pro, 128GB, Space Black)"
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Category</span>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setProductA({ ...productA, category: cat })}
                    className={`px-4 py-2.5 rounded-2xl border text-xs font-bold transition-all active:scale-95 shadow-sm ${
                      productA.category === cat
                        ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-primary hover:text-primary hover:bg-primary/5'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            {/* Reference photo upload */}
            <div className="flex flex-col gap-2">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Reference Photo (optional)</span>
              <input ref={photoInputARef} type="file" accept="image/*" className="hidden" onChange={e => handlePhotoUpload(e, setProductAPhotos)} />
              <div className="flex gap-2 flex-wrap">
                {productAPhotos.map((url, i) => <img key={i} src={url} className="size-14 rounded-xl object-cover border" alt="" />)}
                {productAPhotos.length < 3 && (
                  <button onClick={() => photoInputARef.current?.click()} disabled={uploading}
                    className="size-14 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-slate-300 disabled:opacity-50">
                    <span className="material-symbols-outlined text-xl">add_a_photo</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Product B Card */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-emerald-500/20 shadow-xl shadow-emerald-500/5 flex flex-col gap-5">
          <div className="flex items-center gap-2">
            <div className="size-6 bg-emerald-500/10 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-emerald-500 text-sm filled">download</span>
            </div>
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Product B — You Want Back</h3>
          </div>

          <div className="flex flex-col gap-4">
            <div className="relative">
              <textarea
                value={productB.description}
                onChange={(e) => setProductB({ ...productB, description: e.target.value })}
                className="w-full h-24 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-3xl p-5 text-base font-medium focus:ring-primary/20 focus:border-primary transition-all resize-none shadow-sm placeholder:text-slate-300 dark:placeholder:text-slate-600"
                placeholder="Describe the item you expect back (e.g., Samsung Galaxy S24, 256GB, Cream)"
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Category</span>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setProductB({ ...productB, category: cat })}
                    className={`px-4 py-2.5 rounded-2xl border text-xs font-bold transition-all active:scale-95 shadow-sm ${
                      productB.category === cat
                        ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-500 hover:bg-emerald-500/5'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            {/* Reference photo upload */}
            <div className="flex flex-col gap-2">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Reference Photo (optional)</span>
              <input ref={photoInputBRef} type="file" accept="image/*" className="hidden" onChange={e => handlePhotoUpload(e, setProductBPhotos)} />
              <div className="flex gap-2 flex-wrap">
                {productBPhotos.map((url, i) => <img key={i} src={url} className="size-14 rounded-xl object-cover border" alt="" />)}
                {productBPhotos.length < 3 && (
                  <button onClick={() => photoInputBRef.current?.click()} disabled={uploading}
                    className="size-14 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-slate-300 disabled:opacity-50">
                    <span className="material-symbols-outlined text-xl">add_a_photo</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Quality Check Toggle */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
                <span className="material-symbols-outlined text-amber-500 filled">verified</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-black text-slate-900 dark:text-white">Quality Check</span>
                <span className="text-[10px] text-slate-400 font-medium">Driver verifies items before exchange</span>
              </div>
            </div>
            <button
              onClick={() => setQcRequired(!qcRequired)}
              className={`relative w-14 h-8 rounded-full transition-all duration-300 ${
                qcRequired ? 'bg-primary shadow-inner shadow-primary/30' : 'bg-slate-200 dark:bg-slate-700'
              }`}
            >
              <div
                className={`absolute top-1 size-6 bg-white rounded-full shadow-md transition-all duration-300 ${
                  qcRequired ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>

          {qcRequired && (
            <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest ml-1">QC Checklist</span>
              <p className="text-xs text-slate-400 font-medium ml-1">Add items the driver must verify before accepting Product B.</p>

              {/* Existing QC items */}
              {qcItems.length > 0 && (
                <div className="flex flex-col gap-2">
                  {qcItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200/60 dark:border-amber-800/40 rounded-2xl px-4 py-3">
                      <div className="size-6 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-amber-600 text-sm">checklist</span>
                      </div>
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200 flex-1">{item}</span>
                      <button onClick={() => setQcItems(prev => prev.filter((_, idx) => idx !== i))}
                        className="size-7 rounded-full bg-red-100 text-red-500 flex items-center justify-center shrink-0 hover:bg-red-200 transition-colors">
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add new instruction */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newQcItem}
                  onChange={e => setNewQcItem(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newQcItem.trim().length > 2) {
                      setQcItems(prev => [...prev, newQcItem.trim()]);
                      setNewQcItem('');
                    }
                  }}
                  placeholder="e.g. Check if screen is cracked"
                  className="flex-1 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium focus:border-amber-500 focus:ring-amber-500/20 transition-all placeholder:text-slate-300"
                />
                <button
                  onClick={() => {
                    if (newQcItem.trim().length > 2) {
                      setQcItems(prev => [...prev, newQcItem.trim()]);
                      setNewQcItem('');
                    }
                  }}
                  disabled={newQcItem.trim().length <= 2}
                  className="size-12 bg-amber-500 text-white rounded-xl flex items-center justify-center shrink-0 disabled:opacity-30 active:scale-95 transition-all shadow-md shadow-amber-500/20"
                >
                  <span className="material-symbols-outlined text-xl">add</span>
                </button>
              </div>

              {qcItems.length === 0 && (
                <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4 flex items-center gap-3">
                  <span className="material-symbols-outlined text-slate-300 text-xl">playlist_add</span>
                  <p className="text-xs text-slate-400">No checklist items yet. Add at least one instruction for the driver.</p>
                </div>
              )}

              <p className="text-[9px] text-amber-500 font-bold ml-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">info</span>
                Driver must check all items before collecting Product B.
              </p>
            </div>
          )}
        </div>

        {/* Estimated Weight */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-6 bg-primary/10 rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-sm filled">scale</span>
              </div>
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Estimated Weight</h3>
            </div>
            <div className="flex bg-slate-100 dark:bg-slate-700 rounded-xl p-1">
              <button onClick={() => setWeightUnit('g')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${weightUnit === 'g' ? 'bg-white dark:bg-slate-600 shadow-sm text-primary' : 'text-slate-400'}`}>
                Grams
              </button>
              <button onClick={() => setWeightUnit('kg')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${weightUnit === 'kg' ? 'bg-white dark:bg-slate-600 shadow-sm text-primary' : 'text-slate-400'}`}>
                KG
              </button>
            </div>
          </div>

          <div className="relative">
            <input
              type="number"
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              min="0.1"
              step={weightUnit === 'g' ? '10' : '0.1'}
              className="w-full bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-2xl px-5 py-4 text-base font-bold focus:ring-primary/20 focus:border-primary transition-all shadow-sm placeholder:text-slate-300 dark:placeholder:text-slate-600 pr-16"
              placeholder={weightUnit === 'g' ? '500' : '0.5'}
            />
            <span className="absolute right-5 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400 uppercase">{weightUnit}</span>
          </div>

          <p className="text-[9px] text-slate-400 font-medium ml-1 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">info</span>
            Combined weight of both items. Used for fare calculation.
          </p>
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 bg-white/95 dark:bg-surface-dark/95 backdrop-blur-md border-t border-slate-100 dark:border-slate-800 z-[60] shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
        <button
          onClick={handleContinue}
          disabled={!isFormValid}
          className="w-full bg-primary hover:bg-primary-dark disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white font-black h-16 rounded-[24px] shadow-2xl shadow-primary/20 flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
        >
          <span className="text-base uppercase tracking-widest font-bold">Continue</span>
          <span className="material-symbols-outlined font-black">arrow_forward</span>
        </button>
      </footer>
    </div>
  );
};

export default ExchangeDetails;
