
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SERVICES } from '../../constants.tsx';
import { loadAppSettings } from '../../services/appSettings.ts';

const Services: React.FC = () => {
  const navigate = useNavigate();
  const [enabledServices, setEnabledServices] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadAppSettings().then(s => setEnabledServices(s.services || {}));
  }, []);

  const activeServices = SERVICES.filter(s => enabledServices[s.id] !== false);

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark min-h-screen">
      <header className="fixed top-0 left-0 right-0 max-w-md mx-auto z-[100] bg-white/95 dark:bg-surface-dark/95 backdrop-blur-md px-4 py-4 flex items-center justify-between shadow-sm">
        <button 
          onClick={() => navigate('/home')} 
          className="p-3 -ml-2 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-90"
        >
          <span className="material-symbols-outlined text-slate-700 dark:text-white">arrow_back</span>
        </button>
        <h2 className="text-xl font-black tracking-tight">Our Services</h2>
        <div className="w-10"></div>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar p-5 pt-24 pb-32">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">Choose a Service</h1>
            <p className="text-sm text-slate-500 font-medium">Reliable logistics for every need</p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {activeServices.map((service) => (
              <button
                key={service.id}
                onClick={() => navigate('/search', { state: { serviceType: service.id } })}
                className={`group relative overflow-hidden bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 flex items-center gap-5 transition-all active:scale-[0.98] shadow-sm hover:shadow-xl hover:border-primary/20`}
              >
                {/* Decorative Background Gradient */}
                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${service.color || 'from-slate-100 to-slate-200'} opacity-[0.05] group-hover:opacity-10 transition-opacity rounded-bl-full`}></div>
                
                {/* Icon Container */}
                <div className={`size-16 rounded-2xl bg-gradient-to-br ${service.color || 'from-slate-100 to-slate-200'} flex items-center justify-center text-white shadow-lg shrink-0`}>
                  <span className="material-symbols-outlined text-3xl filled">{service.icon}</span>
                </div>

                {/* Content */}
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{service.name}</h3>
                    {service.tag && (
                      <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[8px] font-black tracking-widest uppercase">
                        {service.tag}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-medium line-clamp-1">{service.description}</p>
                </div>

                <div className="size-8 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center text-slate-300 group-hover:text-primary group-hover:bg-primary/10 transition-all">
                  <span className="material-symbols-outlined text-sm font-bold">arrow_forward</span>
                </div>
              </button>
            ))}
          </div>

          {/* Special Delivery Banner */}
          <div className="mt-4 p-6 rounded-3xl bg-primary relative overflow-hidden shadow-xl shadow-primary/20">
             <div className="absolute top-0 right-0 p-4 opacity-20 transform translate-x-4 -translate-y-4">
                <span className="material-symbols-outlined text-8xl text-white">electric_moped</span>
             </div>
             <div className="relative z-10 flex flex-col gap-4">
                <h4 className="text-white text-xl font-black leading-tight">Need it faster?</h4>
                <p className="text-white/80 text-xs font-medium max-w-[200px]">Our 2-Wheeler express service guarantees delivery within 45 minutes in local areas.</p>
                <button 
                  onClick={() => navigate('/search')}
                  className="bg-white text-primary text-xs font-black px-5 py-2.5 rounded-xl self-start shadow-lg"
                >
                  BOOK EXPRESS
                </button>
             </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Services;
