import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLogisticsSupport } from '../../services/geminiService.ts';

const HelpSupport: React.FC = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    const aiRes = await getLogisticsSupport(query);
    setResponse(aiRes || "No response found.");
    setLoading(false);
  };

  const faqs = [
    { q: "How do I update my KYC documents?", a: "Go to Profile > Verification Documents and select the document you wish to update." },
    { q: "What should I do in case of an accident?", a: "Use the SOS button immediately to alert our emergency team and local authorities." },
    { q: "When will I receive my payouts?", a: "Payouts are processed daily and reflected in your bank account within 24-48 hours." },
    { q: "How to report a damaged parcel?", a: "Contact support immediately via the call button or chat with us through the 'Activity' tab." }
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 font-sans min-h-screen">
      <header className="sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b dark:border-slate-800 px-6 py-5 flex items-center justify-between shadow-sm">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-slate-700 dark:text-white">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h2 className="text-lg font-black text-slate-900 dark:text-white">Help & Support</h2>
        <div className="w-10"></div>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar p-6 flex flex-col gap-8 pb-32">
        
        {/* SOS SECTION - HIGH PRIORITY */}
        <section className="animate-in fade-in slide-in-from-top-4 duration-500">
           <div className="bg-red-500 rounded-[32px] p-6 shadow-2xl shadow-red-500/30 flex items-center justify-between text-white relative overflow-hidden group active:scale-[0.98] transition-all">
              <div className="relative z-10">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80 leading-none">Emergency Service</span>
                <h3 className="text-3xl font-black mt-2 leading-none">SOS</h3>
                <p className="text-[10px] font-medium mt-2 opacity-90 max-w-[140px]">Alert authorities and emergency team instantly.</p>
              </div>
              <div className="size-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20 animate-pulse">
                <span className="material-symbols-outlined text-4xl filled">emergency_share</span>
              </div>
              {/* Abstract Backdrop */}
              <span className="absolute -right-10 -bottom-10 material-symbols-outlined text-[150px] text-white/10 rotate-12">warning</span>
           </div>
        </section>

        {/* SUPPORT CONTACTS */}
        <div className="grid grid-cols-2 gap-4">
           <a href="tel:+918888888888" className="bg-white dark:bg-slate-900 p-6 rounded-[28px] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col gap-3 active:scale-95 transition-all text-left group">
              <div className="size-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                <span className="material-symbols-outlined filled">call</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Call Support</span>
                <span className="text-sm font-black text-slate-900 dark:text-white">+91 88888 88888</span>
              </div>
           </a>
           <div className="bg-white dark:bg-slate-900 p-6 rounded-[28px] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col gap-3 active:scale-95 transition-all text-left">
              <div className="size-11 rounded-2xl bg-accent/10 flex items-center justify-center text-accent">
                <span className="material-symbols-outlined filled">chat</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Chat with Us</span>
                <span className="text-sm font-black text-slate-900 dark:text-white">Active Now</span>
              </div>
           </div>
        </div>

        {/* NEAREST CENTRE */}
        <section>
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-4 flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
            Operational Presence
          </h3>
          <div className="bg-white dark:bg-slate-900 p-5 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-5 group cursor-pointer active:scale-[0.99] transition-all">
            <div className="size-14 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors overflow-hidden">
               <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuBes5Mc7qiz3Rzjs9RJsfcmnld_e8cWavdG6adIdWA0zjBMYis2pkCG_LVyk4Xsp7SYYBg4exR-1QqA8nwVY_on99FTZDTxtboRVZ0OSkG4pr5gZ8pkxeqYct1P_ozLNZRv1gtTJaRRDny-XyXDo8UtQOxFy54Yt2L_0bw79s5EUcgn3ovN235ub4FyEQKnbRyvmaQiiufr-WYNnE0109OqwfkxDGB1fsdWxLh_ul8p2GJNFmatR5_mGUZ5JRwE2JYUcO09_XmZxA" className="size-full object-cover opacity-50 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all" alt="Map" />
            </div>
            <div className="flex-1 flex flex-col">
               <span className="text-sm font-black text-slate-900 dark:text-white">Nearest Hub Centre</span>
               <p className="text-xs text-slate-500 font-medium leading-tight mt-0.5">Andheri West, Opp. Metro Station</p>
               <div className="mt-2 flex items-center gap-1.5">
                 <span className="material-symbols-outlined text-[14px] text-primary">directions</span>
                 <span className="text-[9px] font-black text-primary uppercase tracking-widest">Open till 10:00 PM</span>
               </div>
            </div>
          </div>
        </section>

        {/* AI SEARCH */}
        <div className="flex flex-col gap-3">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1">AI Smart Search</h3>
          <div className="flex w-full items-stretch rounded-[24px] h-16 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 transition-all focus-within:border-primary/20 shadow-sm overflow-hidden">
            <div className="text-slate-400 flex items-center justify-center pl-6">
              <span className="material-symbols-outlined">search</span>
            </div>
            <input 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1 bg-transparent border-none focus:ring-0 px-4 text-sm font-bold" 
              placeholder="Ask anything about Jangoes..." 
            />
            <button onClick={handleSearch} className="px-6 text-primary font-black text-[10px] uppercase tracking-widest bg-primary/5 hover:bg-primary/10 transition-colors">Ask AI</button>
          </div>
        </div>

        {loading && (
          <div className="p-10 flex flex-col items-center justify-center gap-4 animate-pulse">
            <div className="size-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
              <span className="material-symbols-outlined animate-spin">sync</span>
            </div>
            <p className="text-[10px] font-black text-primary uppercase tracking-widest">Consulting Logistics Guide...</p>
          </div>
        )}

        {response && !loading && (
          <div className="bg-primary/5 border border-primary/10 rounded-[32px] p-8 animate-in zoom-in duration-500">
            <div className="flex items-center gap-2 mb-4">
              <div className="size-6 bg-primary rounded-lg flex items-center justify-center text-white">
                <span className="material-symbols-outlined text-xs filled">auto_awesome</span>
              </div>
              <h4 className="text-[10px] font-black text-primary uppercase tracking-widest">AI Intelligence</h4>
            </div>
            <p className="text-sm font-medium leading-relaxed text-slate-700 dark:text-slate-300">{response}</p>
          </div>
        )}

        {/* FAQ SECTION */}
        <section>
          <div className="flex items-center justify-between mb-4 px-1">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Common Questions</h3>
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">4 Found</span>
          </div>
          <div className="flex flex-col gap-3">
            {faqs.map((faq, idx) => (
              <div key={idx} className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm transition-all duration-300">
                <button 
                  onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between p-6 text-left group"
                >
                  <span className="text-sm font-black text-slate-900 dark:text-white pr-4">{faq.q}</span>
                  <span className={`material-symbols-outlined text-slate-300 transition-transform duration-300 ${activeFaq === idx ? 'rotate-180 text-primary' : ''}`}>expand_more</span>
                </button>
                {activeFaq === idx && (
                  <div className="px-6 pb-6 animate-in slide-in-from-top-2 duration-300">
                    <div className="h-px bg-slate-50 dark:bg-slate-800 mb-4"></div>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <p className="text-center text-[9px] font-black text-slate-300 uppercase tracking-[0.5em] mt-10 mb-4">Help Center v1.2</p>
      </main>
    </div>
  );
};

export default HelpSupport;