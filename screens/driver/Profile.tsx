import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../src/firebase.ts';
import { doc, onSnapshot } from 'firebase/firestore';
import { extractKycData } from '../../services/kycHelper.ts';

interface KycData {
  aadhaarName?: string;
  aadhaarNumber?: string;
  panName?: string;
  panNumber?: string;
  panStatus?: string;
  dlName?: string;
  dlNumber?: string;
  dlStatus?: string;
  dlDoe?: string;
  rcNumber?: string;
  rcOwnerName?: string;
  rcMakerModel?: string;
  rcFuelType?: string;
  rcVerifyStatus?: string;
  selfieUrl?: string;
  vehiclePhotos?: string[];
}

const DriverProfile: React.FC<{ onLogout: () => void; canSwitchRole?: boolean; onSwitchRole?: () => void }> = ({ onLogout, canSwitchRole, onSwitchRole }) => {
  const navigate = useNavigate();
  const [driverName, setDriverName] = useState('');
  const [driverPhoto, setDriverPhoto] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [kycData, setKycData] = useState<KycData>({});

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      setDriverName(d.name || '');
      const kd = extractKycData(d);
      setDriverPhoto(d.photoURL || kd.selfieUrl || '');
      setPhoneNumber(d.phoneNumber || user.uid.replace('phone_', '') || '');
      setKycData(kd as KycData);
    });

    return () => unsubscribe();
  }, []);

  const getStatusBadge = (status?: string) => {
    if (status === 'verified') return { label: 'Verified', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
    if (status === 'pending_review') return { label: 'Pending', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' };
    return { label: 'Done', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
  };

  const documents = [
    {
      name: 'Aadhaar Card',
      icon: 'fingerprint',
      number: kycData.aadhaarNumber ? `XXXX-XXXX-${kycData.aadhaarNumber.slice(-4)}` : '',
      status: 'verified',
    },
    {
      name: 'PAN Card',
      icon: 'badge',
      number: kycData.panNumber || '',
      status: kycData.panStatus || 'verified',
      adminUploadUrl: kycData.panAdminUploadUrl,
      adminUploadedBy: kycData.panAdminUploadedByName,
      adminUploadedAt: kycData.panAdminUploadedAt,
    },
    {
      name: "Driving License",
      icon: 'credit_card',
      number: kycData.dlNumber || '',
      status: kycData.dlStatus || 'verified',
      extra: kycData.dlDoe ? `Expires: ${kycData.dlDoe}` : '',
      adminUploadUrl: kycData.dlAdminUploadUrl,
      adminUploadedBy: kycData.dlAdminUploadedByName,
      adminUploadedAt: kycData.dlAdminUploadedAt,
    },
    {
      name: 'RC / Vehicle Registration',
      icon: 'assignment',
      number: kycData.rcNumber || '',
      status: kycData.rcVerifyStatus || 'verified',
      adminUploadUrl: kycData.rcAdminUploadUrl,
      adminUploadedBy: kycData.rcAdminUploadedByName,
      adminUploadedAt: kycData.rcAdminUploadedAt,
    },
    {
      name: 'Profile Photo',
      icon: 'account_circle',
      number: '',
      status: kycData.selfieUrl ? 'verified' : 'pending',
    },
    {
      name: 'Vehicle Photos',
      icon: 'photo_library',
      number: kycData.vehiclePhotos ? `${kycData.vehiclePhotos.length} photos` : '',
      status: kycData.vehiclePhotos?.length ? 'verified' : 'pending',
    },
  ];

  const vehicleType = kycData.rcMakerModel || '';
  const vehiclePlate = kycData.rcNumber || '';
  const vehicleFuel = kycData.rcFuelType || '';

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark relative overflow-hidden font-sans">
      <header className="sticky top-0 z-50 bg-white/95 dark:bg-background-dark/95 backdrop-blur-sm border-b dark:border-slate-800 px-6 py-5 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h2 className="text-lg font-black text-slate-900 dark:text-white">Partner Profile</h2>
        <div className="w-10"></div>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar pb-32 pt-6 px-6">
        {/* Profile Header */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="relative">
            {driverPhoto ? (
              <div
                className="size-24 rounded-[32px] bg-cover bg-center border-4 border-white dark:border-slate-800 shadow-2xl"
                style={{ backgroundImage: `url('${driverPhoto}')` }}
              />
            ) : (
              <div className="size-24 rounded-[32px] bg-slate-200 dark:bg-slate-700 border-4 border-white dark:border-slate-800 shadow-2xl flex items-center justify-center">
                <span className="material-symbols-outlined text-slate-400 text-4xl">person</span>
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 bg-accent text-white p-1.5 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center shadow-lg">
              <span className="material-symbols-outlined text-[16px] font-black">verified</span>
            </div>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">{driverName || 'Driver'}</h1>
            {phoneNumber && (
              <p className="text-xs text-slate-400 font-bold mt-1">+91 {phoneNumber}</p>
            )}
          </div>
        </div>

        {/* Community & Referral */}
        <section className="mb-8">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-3">Partner Growth</h3>
          <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-50 dark:border-slate-800 overflow-hidden shadow-sm">
            <button className="w-full flex items-center justify-between p-5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="size-11 rounded-2xl bg-accent/10 flex items-center justify-center text-accent">
                  <span className="material-symbols-outlined filled">card_giftcard</span>
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">Refer a Partner</span>
                  <span className="text-[10px] text-slate-400 font-medium">Earn ₹500 for every successful referral</span>
                </div>
              </div>
              <span className="material-symbols-outlined text-slate-300">chevron_right</span>
            </button>
          </div>
        </section>

        {/* Support */}
        <section className="mb-8">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-3">Support & Safety</h3>
          <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-50 dark:border-slate-800 overflow-hidden shadow-sm">
            <button
              onClick={() => navigate('/help')}
              className="w-full flex items-center justify-between p-5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="size-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined filled">support_agent</span>
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">Help & Support</span>
                  <span className="text-[10px] text-slate-400 font-medium">SOS, FAQs, & Contact Support</span>
                </div>
              </div>
              <span className="material-symbols-outlined text-slate-300">chevron_right</span>
            </button>
          </div>
        </section>

        {/* Vehicle Section */}
        {(vehicleType || vehiclePlate) && (
          <section className="mb-8">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-3">Active Vehicle</h3>
            <div className="bg-white dark:bg-slate-900 rounded-[32px] p-5 border border-slate-50 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-5">
                <div className="size-16 bg-primary/5 rounded-[24px] flex items-center justify-center text-primary shrink-0 border border-primary/10">
                  <span className="material-symbols-outlined text-3xl filled">local_shipping</span>
                </div>
                <div className="flex-1 flex flex-col">
                  <p className="text-lg font-black text-slate-900 dark:text-white leading-tight">{vehicleType || 'Vehicle'}</p>
                  <p className="text-xs text-slate-400 font-black tracking-[0.2em] mt-1">{vehiclePlate}</p>
                  {vehicleFuel && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px] text-accent filled">local_gas_station</span>
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">{vehicleFuel}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Documents */}
        <section className="mb-10">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-3">Verification Documents</h3>
          <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-50 dark:border-slate-800 divide-y divide-slate-50 dark:divide-slate-800 overflow-hidden shadow-sm">
            {documents.map((d) => {
              const badge = getStatusBadge(d.status);
              return (
                <div
                  key={d.name}
                  className="w-full flex items-center justify-between p-5 text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="size-11 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                      <span className="material-symbols-outlined">{d.icon}</span>
                    </div>
                    <div className="flex flex-col flex-1">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">{d.name}</span>
                      <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-0.5">
                        {d.number || (d as any).extra || ''}
                      </span>
                      {(d as any).adminUploadUrl && (
                        <div className="mt-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-blue-500 text-xs">verified</span>
                            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">
                              Verified by {(d as any).adminUploadedBy || 'Admin'}
                            </span>
                          </div>
                          {(d as any).adminUploadedAt && (
                            <span className="text-[9px] text-blue-400 block mt-0.5">
                              {new Date((d as any).adminUploadedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className={`text-[8px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest shrink-0 ${badge.color}`}>
                    {badge.label}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {canSwitchRole && onSwitchRole && (
          <button
            onClick={onSwitchRole}
            className="w-full bg-primary/5 text-primary font-black py-5 rounded-[32px] border border-primary/20 flex items-center justify-center gap-3 active:scale-95 transition-all shadow-sm mb-3"
          >
            <span className="material-symbols-outlined filled">person</span>
            <span className="text-sm uppercase tracking-widest">Switch to Customer Mode</span>
          </button>
        )}

        <button
          onClick={onLogout}
          className="w-full bg-red-50 dark:bg-red-950/20 text-red-600 font-black py-5 rounded-[32px] border border-red-100 dark:border-red-900/20 flex items-center justify-center gap-3 active:scale-95 transition-all shadow-sm"
        >
          <span className="material-symbols-outlined">logout</span>
          <span className="text-sm uppercase tracking-widest">Sign Out</span>
        </button>
        <p className="text-center text-[9px] font-black text-slate-300 uppercase tracking-[0.5em] mt-8 mb-4">Build 1204.A • Jangoes PRO</p>
      </main>
    </div>
  );
};

export default DriverProfile;
