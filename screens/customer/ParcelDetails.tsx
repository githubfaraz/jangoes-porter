import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { classifyParcel } from '../../services/geminiService.ts';

const ParcelDetails: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const bookingState = location.state || {};
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<{ category: string, fragile: boolean, estimatedWeight: number } | null>(null);
  const [images, setImages] = useState<string[]>([]);

  // Analyze parcel details using Gemini AI, including any uploaded images
  const handleAnalyze = async () => {
    if (!description.trim()) return;
    setLoading(true);
    try {
      // Corrected call to include images collected in state
      const result = await classifyParcel(description, images);
      setAnalysis(result);
    } catch (err) {
      console.error("Analysis failed", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      // Fix: added explicit : File type to ensure correct Blob assignment for readAsDataURL
      Array.from(files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          // Cast result to string for storage in state
          if (typeof reader.result === 'string') {
            setImages(prev => [...prev, reader.result as string]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const isFormValid = description.trim().length > 3;

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark min-h-screen">
      <header className="fixed top-0 left-0 right-0 max-w-md mx-auto z-[100] bg-white dark:bg-surface-dark px-4 py-3 flex items-center justify-between shadow-sm">
        <button 
          onClick={() => navigate('/search')} 
          className="p-3 -ml-2 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-90"
        >
          <span className="material-symbols-outlined text-slate-700 dark:text-white">arrow_back</span>
        </button>
        <h2 className="text-lg font-bold">Parcel Details</h2>
        <div className="w-10"></div>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar p-6 flex flex-col gap-6 pt-20 pb-40">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-black leading-tight tracking-tight">What are you sending?</h1>
          <p className="text-sm text-slate-500 font-medium">Help us handle your items with care.</p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="relative">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full h-32 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-3xl p-5 text-base font-medium focus:ring-primary/20 focus:border-primary transition-all resize-none shadow-sm placeholder:text-slate-300 dark:placeholder:text-slate-600"
              placeholder="Describe your items (e.g., 2 boxes of clothes, 1 laptop...)"
            />
            
            {description.trim().length > 5 && !analysis && !loading && (
              <button 
                onClick={handleAnalyze}
                className="absolute bottom-4 right-4 bg-primary text-white text-[10px] font-black px-4 py-2 rounded-xl shadow-lg flex items-center gap-1.5 animate-in fade-in zoom-in duration-300 active:scale-95"
              >
                <span className="material-symbols-outlined text-sm filled">auto_awesome</span>
                AI ANALYZE
              </button>
            )}
          </div>

          {/* Photo Section */}
          <div className="flex flex-col gap-3">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Add Photos (Recommended)</h3>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
              <input 
                type="file" 
                multiple 
                accept="image/*" 
                capture="environment" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleFileChange}
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="size-24 bg-white dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center shrink-0 hover:border-primary hover:bg-primary/5 transition-all group"
              >
                <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors text-3xl">add_a_photo</span>
                <span className="text-[9px] font-black text-slate-400 mt-1 uppercase tracking-tighter">Capture</span>
              </button>

              {images.map((img, idx) => (
                <div key={idx} className="relative size-24 shrink-0 animate-in zoom-in duration-300">
                  <div 
                    className="w-full h-full rounded-2xl bg-cover bg-center border border-slate-100 dark:border-slate-700 shadow-sm"
                    style={{ backgroundImage: `url(${img})` }}
                  />
                  <button 
                    onClick={() => removeImage(idx)}
                    className="absolute -top-2 -right-2 size-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white dark:border-slate-900 active:scale-90"
                  >
                    <span className="material-symbols-outlined text-[14px] font-black">close</span>
                  </button>
                </div>
              ))}
            </div>
            <p className="text-[9px] text-slate-400 font-medium ml-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">info</span>
              Photos help the driver assess load requirements.
            </p>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-8 gap-3 text-primary animate-pulse bg-blue-50/50 dark:bg-primary/5 rounded-3xl border border-dashed border-primary/20">
              <span className="material-symbols-outlined animate-spin text-xl">sync</span>
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Analyzing items...</span>
            </div>
          )}

          {analysis && (
            <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-primary/20 shadow-xl shadow-primary/5 flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-6 bg-primary/10 rounded-lg flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary text-sm filled">auto_awesome</span>
                    </div>
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">AI Assessment</h3>
                  </div>
                  <button onClick={() => { setAnalysis(null); setDescription(''); setImages([]); }} className="text-[10px] text-red-500 font-black hover:bg-red-50 px-2 py-1 rounded transition-colors">CLEAR ALL</button>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1 p-4 bg-slate-50 dark:bg-primary/5 rounded-2xl border border-slate-100 dark:border-primary/10">
                    <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Category</span>
                    <span className="text-sm font-black text-slate-900 dark:text-white">{analysis.category}</span>
                  </div>
                  <div className="flex flex-col gap-1 p-4 bg-slate-50 dark:bg-primary/5 rounded-2xl border border-slate-100 dark:border-primary/10">
                    <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Est. Weight</span>
                    <span className="text-sm font-black text-slate-900 dark:text-white">{analysis.estimatedWeight} kg</span>
                  </div>
                </div>

                {analysis.fragile && (
                  <div className="flex items-center gap-4 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-200 dark:border-amber-900/30">
                    <div className="size-10 bg-amber-100 dark:bg-amber-900/50 rounded-xl flex items-center justify-center text-amber-600">
                      <span className="material-symbols-outlined filled">warning</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-amber-900 dark:text-amber-200 uppercase tracking-tight">Fragile Alert</span>
                      <span className="text-[10px] text-amber-700/70 dark:text-amber-400/70 font-medium">Extra care will be requested.</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <section className="mt-2">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Suggestions</h3>
          <div className="flex flex-wrap gap-2">
            {['Furniture', 'Electronics', 'Apparels', 'Footwear', 'Kitchenware', 'Documents', 'Food'].map(cat => (
              <button 
                key={cat} 
                onClick={() => setDescription(prev => prev ? `${prev}, ${cat}` : cat)} 
                className="px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all active:scale-95 shadow-sm"
              >
                {cat}
              </button>
            ))}
          </div>
        </section>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 bg-white/95 dark:bg-surface-dark/95 backdrop-blur-md border-t border-slate-100 dark:border-slate-800 z-[60] shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
        <button 
          onClick={() => navigate('/parcel-dimensions', { state: { ...bookingState, parcel: { description, category: analysis?.category || '', fragile: analysis?.fragile || false, estimatedWeight: analysis?.estimatedWeight || 0 } } })}
          disabled={!isFormValid}
          className="w-full bg-primary hover:bg-primary-dark disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white font-black h-16 rounded-[24px] shadow-2xl shadow-primary/20 flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
        >
          <span className="text-base uppercase tracking-widest font-bold">Next</span>
          <span className="material-symbols-outlined font-black">arrow_forward</span>
        </button>
      </footer>
    </div>
  );
};

export default ParcelDetails;