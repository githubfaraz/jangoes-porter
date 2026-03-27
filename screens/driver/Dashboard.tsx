import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../../src/firebase.ts';
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore';
import { BookingStatus, Trip } from '../../types.ts';
import { extractKycData } from '../../services/kycHelper.ts';

interface KycData {
  panStatus?: string;
  dlStatus?: string;
  rcVerifyStatus?: string;
  vehiclePhotos?: string[];
  selfieUrl?: string;
  aadhaarName?: string;
}

function getPendingDocs(kycData: KycData): string[] {
  const pending: string[] = [];
  if (kycData.panStatus === 'pending_review') pending.push('PAN Card');
  if (kycData.dlStatus === 'pending_review') pending.push('Driving License');
  if (kycData.rcVerifyStatus === 'pending_review') pending.push('RC / Vehicle Registration');
  return pending;
}

const DriverDashboard: React.FC = () => {
  const [isOnline, setIsOnline] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [currentRequest, setCurrentRequest] = useState<(Trip & { id: string }) | null>(null);
  const navigate = useNavigate();

  // Driver profile + KYC status (real-time)
  const [driverName, setDriverName] = useState('');
  const [driverPhoto, setDriverPhoto] = useState('');
  const [kycData, setKycData] = useState<KycData>({});
  const [pendingDocs, setPendingDocs] = useState<string[]>([]);
  const [verifiedNotification, setVerifiedNotification] = useState(false);
  const prevPendingRef = useRef<string[]>([]);

  const offers = [
    { id: 1, title: 'Diwali Peak Bonus', desc: 'Get ₹50 extra on every order from 6PM to 10PM today!', color: 'from-orange-500 to-red-600', icon: 'celebration' },
    { id: 2, title: 'Weekend Warrior', desc: 'Complete 20 trips this weekend and earn a ₹1000 bonus!', color: 'from-blue-600 to-indigo-700', icon: 'military_tech' },
    { id: 3, title: 'Fuel Cashback', desc: 'Flat 5% cashback on all fuel spends via Jangoes Card.', color: 'from-emerald-500 to-teal-700', icon: 'local_gas_station' }
  ];

  // ── Real-time KYC status listener ─────────────────────────────────────────
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();

      setDriverName(d.name || '');
      setDriverPhoto(d.photoURL || '');

      const kd: KycData = extractKycData(d) as KycData;
      setKycData(kd);

      const currentPending = getPendingDocs(kd);
      setPendingDocs(currentPending);

      // Detect transition: had pending docs before, now all clear → show verified notification
      if (prevPendingRef.current.length > 0 && currentPending.length === 0) {
        setVerifiedNotification(true);
        setTimeout(() => setVerifiedNotification(false), 6000);
      }
      prevPendingRef.current = currentPending;
    });

    return () => unsubscribe();
  }, []);

  // ── Trip listener — only active when online AND no pending docs ────────────
  useEffect(() => {
    console.log('[DASHBOARD] Trip listener check — isOnline:', isOnline, 'pendingDocs:', pendingDocs);
    if (!isOnline || pendingDocs.length > 0) {
      setShowRequest(false);
      setCurrentRequest(null);
      return;
    }

    console.log('[DASHBOARD] Trip listener ACTIVE — listening for SEARCHING trips');
    const q = query(collection(db, 'trips'), where('status', '==', BookingStatus.SEARCHING));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log('[DASHBOARD] Trip snapshot — empty:', snapshot.empty, 'count:', snapshot.size);
      if (!snapshot.empty) {
        const d = snapshot.docs[0];
        const tripData = d.data();
        console.log('[DASHBOARD] Trip data:', JSON.stringify(tripData));
        setCurrentRequest({ ...tripData as Trip, id: d.id });
        setShowRequest(true);
      } else {
        setShowRequest(false);
        setCurrentRequest(null);
      }
    });

    return () => unsubscribe();
  }, [isOnline, pendingDocs]);

  const handleToggleOnline = (value: boolean) => {
    if (value && pendingDocs.length > 0) return; // blocked
    setIsOnline(value);
  };

  const handleAcceptRequest = async () => {
    if (!currentRequest || !auth.currentUser) return;
    try {
      await updateDoc(doc(db, 'trips', currentRequest.id), {
        status: BookingStatus.ACCEPTED,
        driverId: auth.currentUser.uid,
        acceptedAt: new Date().toISOString()
      });
      setShowRequest(false);
      navigate('/active-trip', { state: { tripId: currentRequest.id } });
    } catch (error) {
      console.error("Accept Trip Error:", error);
      alert("Failed to accept trip. It might have been taken by another driver.");
    }
  };

  const firstName = driverName.split(' ')[0] || 'Driver';

  return (
    <div className="relative min-h-screen w-full flex flex-col bg-slate-50 dark:bg-slate-950 overflow-y-auto no-scrollbar font-sans text-slate-900 dark:text-white pb-32">

      {/* Background Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-5%] left-[-10%] w-[80%] h-[40%] bg-primary/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[50%] bg-accent/5 rounded-full blur-[100px]" />
      </div>

      {/* ── Verified notification toast ── */}
      {verifiedNotification && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] w-[calc(100%-3rem)] max-w-sm animate-in slide-in-from-top-4 duration-300">
          <div className="bg-green-500 text-white rounded-2xl px-5 py-4 flex items-center gap-3 shadow-2xl shadow-green-500/30">
            <div className="size-9 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-white filled">verified_user</span>
            </div>
            <div className="flex flex-col flex-1">
              <span className="font-black text-sm">Documents Verified!</span>
              <span className="text-xs text-white/80 font-medium">All your documents are now approved. You can go online and accept rides.</span>
            </div>
            <button onClick={() => setVerifiedNotification(false)} className="shrink-0 opacity-70">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Pending docs banner ── */}
      {pendingDocs.length > 0 && (
        <div className="relative z-10 mx-4 mt-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl px-4 py-4">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-amber-500 text-xl shrink-0 mt-0.5">pending_actions</span>
            <div className="flex flex-col gap-1 flex-1">
              <span className="text-sm font-black text-amber-800 dark:text-amber-300">Documents Pending Verification</span>
              <span className="text-xs text-amber-700/80 dark:text-amber-400/80 font-medium leading-relaxed">
                The following document(s) are under review. You cannot accept rides until verified (24–48 hrs):
              </span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {pendingDocs.map(d => (
                  <span key={d} className="text-[10px] font-black bg-amber-200/60 dark:bg-amber-800/60 text-amber-800 dark:text-amber-200 px-2.5 py-1 rounded-full">
                    {d}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="relative z-10 px-6 pt-10 pb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/profile')}
            className="size-12 rounded-2xl border-2 border-white dark:border-slate-800 shadow-xl overflow-hidden active:scale-90 transition-transform bg-slate-200 dark:bg-slate-700"
          >
            {driverPhoto ? (
              <img src={driverPhoto} alt={firstName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="material-symbols-outlined text-slate-400 text-2xl">person</span>
              </div>
            )}
          </button>
          <div className="flex flex-col">
            {pendingDocs.length === 0 ? (
              <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-1 leading-none">Verified Partner</span>
            ) : (
              <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.3em] mb-1 leading-none">Pending Verification</span>
            )}
            <h2 className="text-xl font-black tracking-tight leading-none">Hi, {firstName}!</h2>
          </div>
        </div>
        <button className="size-12 flex items-center justify-center rounded-2xl bg-white dark:bg-slate-900 shadow-lg border border-slate-50 dark:border-slate-800 text-slate-600 dark:text-slate-400 active:scale-90 transition-all">
          <span className="material-symbols-outlined filled">notifications</span>
        </button>
      </div>

      <div className="relative z-10 px-6 flex flex-col gap-6">

        {/* Main Status Toggle Card */}
        <div className={`p-6 rounded-[32px] transition-all duration-500 border-2 ${
          pendingDocs.length > 0
            ? 'bg-slate-100 dark:bg-slate-900 border-transparent opacity-70'
            : isOnline
            ? 'bg-white dark:bg-slate-900 border-primary shadow-2xl shadow-primary/10'
            : 'bg-slate-100 dark:bg-slate-900 border-transparent shadow-none'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-xl font-black">
                {pendingDocs.length > 0 ? 'Account Restricted' : isOnline ? 'Active Online' : 'You are Offline'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {pendingDocs.length > 0
                  ? 'Documents pending — rides disabled'
                  : isOnline ? 'Receiving local requests' : 'Start work to earn'}
              </p>
            </div>
            <label className={`relative inline-flex items-center ${pendingDocs.length > 0 ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
              <input
                checked={isOnline && pendingDocs.length === 0}
                onChange={e => handleToggleOnline(e.target.checked)}
                disabled={pendingDocs.length > 0}
                className="sr-only peer"
                type="checkbox"
              />
              <div className="w-16 h-9 bg-slate-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-7 peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-7 after:w-7 after:transition-all peer-checked:bg-primary shadow-inner"></div>
            </label>
          </div>

          {pendingDocs.length > 0 ? (
            <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-200/60 dark:border-amber-800/40">
              <span className="material-symbols-outlined text-amber-500 text-xl">lock</span>
              <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">Rides locked until documents verified</span>
            </div>
          ) : isOnline ? (
            <div className="flex items-center gap-3 px-4 py-3 bg-primary/5 rounded-2xl border border-primary/10 animate-pulse">
              <span className="material-symbols-outlined text-primary text-xl">radar</span>
              <span className="text-[10px] font-black text-primary uppercase tracking-widest">Searching for nearby parcels...</span>
            </div>
          ) : null}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div onClick={() => navigate('/payouts')} className="bg-white dark:bg-slate-900 p-5 rounded-[28px] border border-slate-50 dark:border-slate-800 shadow-sm flex flex-col gap-3 group cursor-pointer active:scale-95 transition-all">
            <div className="size-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined filled">payments</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Today's Pay</span>
              <span className="text-2xl font-black text-slate-900 dark:text-white">₹1,240</span>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-5 rounded-[28px] border border-slate-50 dark:border-slate-800 shadow-sm flex flex-col gap-3 active:scale-95 transition-all">
            <div className="size-11 rounded-2xl bg-accent/10 flex items-center justify-center text-accent">
              <span className="material-symbols-outlined filled">local_shipping</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trips Done</span>
              <span className="text-2xl font-black text-slate-900 dark:text-white">12</span>
            </div>
          </div>
        </div>

        {/* Admin Offer Banners */}
        <div className="mt-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
              <span className="w-1.5 h-6 bg-primary rounded-full"></span>
              Partner Perks
            </h3>
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Admin Verified</span>
          </div>
          <div className="flex gap-4 overflow-x-auto no-scrollbar snap-x">
            {offers.map((offer) => (
              <div key={offer.id} className={`min-w-[280px] snap-center bg-gradient-to-br ${offer.color} p-6 rounded-[32px] shadow-xl relative overflow-hidden group`}>
                <div className="relative z-10 flex flex-col gap-2">
                  <div className="size-10 bg-white/20 rounded-xl backdrop-blur-md flex items-center justify-center text-white border border-white/20 mb-2">
                    <span className="material-symbols-outlined">{offer.icon}</span>
                  </div>
                  <h4 className="text-white text-lg font-black leading-tight">{offer.title}</h4>
                  <p className="text-white/80 text-[11px] font-medium leading-relaxed max-w-[200px]">{offer.desc}</p>
                  <button className="mt-4 bg-white text-slate-900 text-[10px] font-black px-5 py-2.5 rounded-xl self-start shadow-xl active:scale-95 transition-all">VIEW DETAILS</button>
                </div>
                <span className="material-symbols-outlined text-[120px] absolute -right-4 -bottom-4 text-white/10 rotate-12">{offer.icon}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Refer & Earn */}
        <div className="mt-2 p-6 rounded-[32px] bg-accent/10 border border-accent/20 flex items-center justify-between relative overflow-hidden group active:scale-[0.99] transition-all cursor-pointer">
          <div className="relative z-10 flex flex-col gap-2">
            <span className="text-[9px] font-black text-accent uppercase tracking-[0.3em] leading-none mb-1">Viral Growth</span>
            <h4 className="text-xl font-black text-slate-900 dark:text-white leading-tight">Refer a Partner &<br/>Earn ₹500</h4>
            <button className="mt-3 bg-accent text-white text-[10px] font-black px-5 py-2.5 rounded-xl self-start shadow-xl shadow-accent/20">SEND INVITE</button>
          </div>
          <div className="size-24 rounded-full bg-accent/5 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-5xl text-accent filled group-hover:scale-110 transition-transform">card_giftcard</span>
          </div>
        </div>
      </div>

      {/* Incoming Job Modal */}
      {showRequest && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[40px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col">
            <div className="bg-primary p-8 text-white relative">
              <div className="flex justify-between items-start mb-6">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80">
                    {currentRequest?.serviceType === 'exchange' ? 'Exchange Request' : 'New Pickup Request'}
                  </span>
                  {currentRequest?.serviceType === 'exchange' && (
                    <span className="text-[9px] font-black bg-rose-500 text-white px-2 py-0.5 rounded-full mt-1 inline-block">ROUNDTRIP EXCHANGE</span>
                  )}
                  <h3 className="text-4xl font-black tracking-tight mt-1">₹{currentRequest?.fare || '450.00'}</h3>
                </div>
                <div className="size-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/20 animate-bounce">
                  <span className="material-symbols-outlined text-3xl">local_shipping</span>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black opacity-70 uppercase tracking-widest">Vehicle</span>
                  <span className="text-sm font-black">{currentRequest?.vehicleType || 'Mini Truck'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-black opacity-70 uppercase tracking-widest">Sender</span>
                  <span className="text-sm font-black">{currentRequest?.senderName || 'Customer'}</span>
                </div>
              </div>
            </div>

            <div className="p-8 flex flex-col gap-8">
              <div className="flex flex-col gap-6 relative">
                <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-slate-100 dark:bg-slate-800 border-l border-dashed"></div>
                <div className="flex items-start gap-4">
                  <div className="size-4 rounded-full bg-accent mt-1 relative z-10 border-4 border-white dark:border-slate-900 shadow-sm"></div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pickup</span>
                    <span className="text-sm font-black text-slate-900 dark:text-white">{currentRequest?.pickup.address || 'Andheri West, Mumbai'}</span>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="size-4 rounded-full bg-red-500 mt-1 relative z-10 border-4 border-white dark:border-slate-900 shadow-sm"></div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Dropoff</span>
                    <span className="text-sm font-black text-slate-900 dark:text-white">{currentRequest?.dropoff.address || 'Colaba Causeway, Mumbai'}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setShowRequest(false)}
                  className="flex-1 h-16 bg-slate-50 dark:bg-slate-800 text-slate-500 font-black rounded-2xl text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                >
                  Decline
                </button>
                <button
                  onClick={handleAcceptRequest}
                  className="flex-[2] h-16 bg-primary text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-primary/30 active:scale-95 transition-all"
                >
                  Accept Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverDashboard;
