import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SERVICES } from '../../constants.tsx';
import { auth, db } from '../../src/firebase.ts';
import { doc, getDoc } from 'firebase/firestore';
import LocationPermission from '../shared/LocationPermission.tsx';
import { loadAppSettings, isServiceEnabled } from '../../services/appSettings.ts';

const CustomerHome: React.FC = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState('');
  const [userPhoto, setUserPhoto] = useState('');
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [enabledServices, setEnabledServices] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    if (user.photoURL) setUserPhoto(user.photoURL);
    getDoc(doc(db, 'users', user.uid)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.name) setUserName(data.name);
        if (data.photoURL) setUserPhoto(data.photoURL);
        setWalletBalance(data.walletBalance ?? 0);
      }
    });
    // Load service config
    loadAppSettings().then(s => setEnabledServices(s.services || {}));
  }, []);

  const activeServices = SERVICES.filter(s => enabledServices[s.id] !== false);

  return (
    <LocationPermission onGranted={() => {}}>
    <div className="relative min-h-screen w-full flex flex-col bg-slate-50 dark:bg-slate-950 overflow-y-auto no-scrollbar font-sans text-slate-900 dark:text-white pb-32">
      {/* Premium Mesh Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[50%] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[50%] bg-accent/5 rounded-full blur-[120px]" />
      </div>

      {/* Header Section */}
      <div className="relative z-10 flex flex-col gap-6 px-6 pt-14 pb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/profile')}
              className="relative size-12 rounded-2xl border-2 border-white dark:border-slate-800 shadow-xl overflow-hidden active:scale-90 transition-transform bg-primary/10 flex items-center justify-center"
            >
              {userPhoto ? (
                <div className="w-full h-full bg-cover bg-center" style={{ backgroundImage: `url('${userPhoto}')` }} />
              ) : (
                <span className="text-primary font-black text-lg">
                  {userName ? userName.charAt(0).toUpperCase() : '?'}
                </span>
              )}
            </button>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-1">Elite Member</span>
              <h2 className="text-xl font-black tracking-tight leading-none">
                Hello, {userName ? userName.split(' ')[0] : ''}!
              </h2>
            </div>
          </div>
          <button className="size-12 flex items-center justify-center rounded-2xl bg-white dark:bg-slate-900 shadow-lg border border-slate-50 dark:border-slate-800 text-slate-600 dark:text-slate-400 active:scale-90 transition-all">
            <span className="material-symbols-outlined filled">notifications</span>
          </button>
        </div>

        {/* Quick Wallet Summary Card */}
        <div 
          onClick={() => navigate('/wallet')}
          className="relative overflow-hidden w-full bg-gradient-to-br from-primary to-primary-dark p-6 rounded-[32px] shadow-2xl shadow-primary/20 group cursor-pointer active:scale-[0.98] transition-all"
        >
          <div className="relative z-10 flex justify-between items-center">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Available Balance</span>
              <span className="text-3xl font-black text-white tracking-tight">₹{walletBalance !== null ? walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '...'}</span>
            </div>
            <div className="size-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/20">
              <span className="material-symbols-outlined text-2xl">account_balance_wallet</span>
            </div>
          </div>
          {/* Abstract Pattern */}
          <div className="absolute -right-4 -bottom-4 size-32 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-colors" />
        </div>
      </div>

      {/* Main Services Section */}
      <div className="relative z-10 px-6 flex flex-col gap-8">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
              <span className="w-1.5 h-6 bg-accent rounded-full"></span>
              Our Services
            </h3>
            <button 
              onClick={() => navigate('/services')}
              className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline"
            >
              View All
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {activeServices.slice(0, 4).map((service) => (
              <button
                key={service.id}
                onClick={() => navigate('/search', { state: { serviceType: service.id } })}
                className="group flex flex-col bg-white dark:bg-slate-900 border border-slate-50 dark:border-slate-800 p-5 rounded-[28px] shadow-[0_10px_30px_rgba(0,0,0,0.02)] hover:shadow-xl hover:border-primary/20 transition-all text-left active:scale-95"
              >
                <div className={`size-14 rounded-2xl bg-gradient-to-br ${service.color} flex items-center justify-center text-white shadow-lg mb-4 group-hover:scale-110 transition-transform`}>
                  <span className="material-symbols-outlined text-2xl filled">{service.icon}</span>
                </div>
                <span className="text-sm font-black text-slate-900 dark:text-white mb-1">{service.name}</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter line-clamp-1">{service.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Refer & Earn Section */}
        <div className="p-6 rounded-[32px] bg-primary/5 border border-primary/10 flex items-center justify-between relative overflow-hidden group active:scale-[0.99] transition-all cursor-pointer">
           <div className="relative z-10 flex flex-col gap-2">
              <span className="text-[9px] font-black text-primary uppercase tracking-[0.3em] leading-none mb-1">Growth Reward</span>
              <h4 className="text-xl font-black text-slate-900 dark:text-white leading-tight">Refer a Friend &<br/>Get ₹100 Off</h4>
              <button className="mt-3 bg-primary text-white text-[10px] font-black px-5 py-2.5 rounded-xl self-start shadow-xl shadow-primary/20">INVITE NOW</button>
           </div>
           <div className="size-24 rounded-full bg-primary/5 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-5xl text-primary filled group-hover:scale-110 transition-transform">card_giftcard</span>
           </div>
        </div>

        {/* Quick Access List */}
        <div className="flex flex-col gap-4">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-1">Saved Locations</h3>
          <div className="flex flex-col gap-3">
            {[
              { label: 'Home', address: '123 Green Avenue, Block C', icon: 'home' },
              { label: 'Office', address: 'Tech Park, Tower 4, 12th Floor', icon: 'work' }
            ].map((loc, idx) => (
              <button 
                key={idx}
                onClick={() => navigate('/search')}
                className="flex items-center gap-4 p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-50 dark:border-slate-800 shadow-sm active:bg-slate-50 dark:active:bg-slate-800 transition-all text-left group"
              >
                <div className="size-11 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-primary group-hover:bg-primary/5 transition-all">
                  <span className="material-symbols-outlined filled">{loc.icon}</span>
                </div>
                <div className="flex flex-col flex-1">
                  <span className="text-sm font-black text-slate-900 dark:text-white">{loc.label}</span>
                  <span className="text-xs font-medium text-slate-400 truncate">{loc.address}</span>
                </div>
                <span className="material-symbols-outlined text-slate-200 group-hover:text-primary transition-colors">chevron_right</span>
              </button>
            ))}
          </div>
        </div>

        {/* Promotion Banner */}
        <div className="bg-accent/10 border border-accent/20 rounded-[32px] p-6 flex items-center justify-between overflow-hidden relative group cursor-pointer active:scale-[0.99] transition-all">
          <div className="relative z-10 flex flex-col gap-2">
            <span className="text-[10px] font-black text-accent uppercase tracking-widest">New Launch</span>
            <h4 className="text-lg font-black text-slate-900 dark:text-white leading-tight max-w-[150px]">Get 20% Off on Interstate Logistics</h4>
            <button className="mt-2 text-xs font-black text-white bg-accent px-4 py-2 rounded-xl w-fit shadow-lg shadow-accent/20">Claim Offer</button>
          </div>
          <span className="material-symbols-outlined text-7xl text-accent/20 absolute -right-2 -bottom-2 group-hover:scale-110 transition-transform">local_shipping</span>
        </div>
      </div>
    </div>
    </LocationPermission>
  );
};

export default CustomerHome;