import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../src/firebase.ts';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const CustomerProfile: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [userData, setUserData] = useState({ name: '', email: '', phone: '', photoURL: '', defaultBuilding: '' });
  const [editForm, setEditForm] = useState({ name: '', phone: '', defaultBuilding: '' });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const photoURL = user.photoURL || '';
    getDoc(doc(db, 'users', user.uid)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const fetched = {
          name: data.name || '',
          email: data.email || user.email || '',
          phone: data.phoneNumber ? `+91 ${data.phoneNumber}` : '',
          photoURL: data.photoURL || photoURL,
          defaultBuilding: data.defaultBuilding || '',
        };
        setUserData(fetched);
        setEditForm({ name: fetched.name, phone: data.phoneNumber || '', defaultBuilding: data.defaultBuilding || '' });
      }
    });
  }, []);

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        name: editForm.name.trim(),
        phoneNumber: editForm.phone.trim(),
        defaultBuilding: editForm.defaultBuilding.trim(),
      }, { merge: true });
      setUserData((prev) => ({
        ...prev,
        name: editForm.name.trim(),
        phone: editForm.phone.trim() ? `+91 ${editForm.phone.trim()}` : prev.phone,
        defaultBuilding: editForm.defaultBuilding.trim(),
      }));
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark font-sans">
      <header className="sticky top-0 z-50 bg-white/95 dark:bg-background-dark/95 backdrop-blur-sm border-b px-6 py-5 flex items-center justify-between">
        <button onClick={() => isEditing ? setIsEditing(false) : navigate(-1)} className="p-2 -ml-2">
          <span className="material-symbols-outlined">{isEditing ? 'close' : 'arrow_back'}</span>
        </button>
        <h2 className="text-lg font-black text-slate-900 dark:text-white">{isEditing ? 'Edit Profile' : 'Profile'}</h2>
        {isEditing ? (
          <button onClick={handleSave} disabled={isSaving} className="text-primary font-black text-sm uppercase tracking-widest disabled:opacity-50">
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        ) : (
          <button onClick={() => setIsEditing(true)} className="text-primary font-black text-sm uppercase tracking-widest">Edit</button>
        )}
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar pb-32 pt-6">
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="relative">
            <div className="size-28 rounded-[40px] border-4 border-white dark:border-slate-800 shadow-2xl overflow-hidden bg-primary/10 flex items-center justify-center">
              {userData.photoURL ? (
                <img src={userData.photoURL} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl font-black text-primary">
                  {userData.name ? userData.name.charAt(0).toUpperCase() : '?'}
                </span>
              )}
            </div>
            <button className="absolute bottom-0 right-0 bg-primary text-white p-2.5 rounded-2xl border-2 border-white dark:border-slate-800 shadow-xl active:scale-90">
              <span className="material-symbols-outlined text-sm font-black">photo_camera</span>
            </button>
          </div>
          {!isEditing ? (
            <div className="text-center">
              <h1 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">{userData.name || '—'}</h1>
              {userData.email && <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mt-1">{userData.email}</p>}
              {userData.phone && <p className="text-xs text-slate-400 font-medium mt-0.5">{userData.phone}</p>}
              <span className="mt-3 inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-[9px] font-black uppercase tracking-[0.2em]">Gold Member</span>
            </div>
          ) : (
             <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Update account details</p>
          )}
        </div>

        <div className="px-6 flex flex-col gap-8">
          {isEditing ? (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl px-5 py-4 text-sm font-bold focus:border-primary focus:ring-0 transition-all"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value.replace(/\D/g, '') })}
                  maxLength={10}
                  className="w-full bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl px-5 py-4 text-sm font-bold focus:border-primary focus:ring-0 transition-all"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Default Address (House / Flat / Building No.)</label>
                <input
                  type="text"
                  value={editForm.defaultBuilding}
                  onChange={(e) => setEditForm({ ...editForm, defaultBuilding: e.target.value })}
                  placeholder="e.g. Flat 4B, Tower C"
                  className="w-full bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl px-5 py-4 text-sm font-bold focus:border-primary focus:ring-0 transition-all"
                />
                <p className="text-[10px] text-slate-400 ml-1">This auto-fills your pickup House / Building field when booking.</p>
              </div>
            </div>
          ) : (
            <>
              <section>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-3">Community & Growth</h3>
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-50 dark:border-slate-800 divide-y divide-slate-50 dark:divide-slate-800 overflow-hidden shadow-sm">
                  <button className="w-full flex items-center justify-between p-5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="size-11 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                        <span className="material-symbols-outlined filled">card_giftcard</span>
                      </div>
                      <div className="flex flex-col text-left">
                         <span className="text-sm font-bold text-slate-900 dark:text-white">Refer a Friend</span>
                         <span className="text-[10px] text-slate-400 font-medium">Earn rewards for every join</span>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-slate-300">chevron_right</span>
                  </button>
                </div>
              </section>

              <section>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-3">Settings</h3>
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-50 dark:border-slate-800 divide-y divide-slate-50 dark:divide-slate-800 overflow-hidden shadow-sm">
                  <button className="w-full flex items-center justify-between p-5 hover:bg-slate-50">
                    <div className="flex items-center gap-4">
                      <div className="size-11 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                        <span className="material-symbols-outlined">notifications</span>
                      </div>
                      <span className="text-sm font-bold text-slate-900 dark:text-white">Notifications</span>
                    </div>
                    <span className="material-symbols-outlined text-slate-300">chevron_right</span>
                  </button>
                  <button className="w-full flex items-center justify-between p-5 hover:bg-slate-50">
                    <div className="flex items-center gap-4">
                      <div className="size-11 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                        <span className="material-symbols-outlined">location_on</span>
                      </div>
                      <span className="text-sm font-bold text-slate-900 dark:text-white">Saved Addresses</span>
                    </div>
                    <span className="material-symbols-outlined text-slate-300">chevron_right</span>
                  </button>
                </div>
              </section>

              <button 
                onClick={onLogout}
                className="w-full bg-red-50 dark:bg-red-950/20 text-red-600 font-black py-5 rounded-3xl border border-red-100 dark:border-red-900/20 flex items-center justify-center gap-3 active:scale-95 transition-all shadow-sm"
              >
                <span className="material-symbols-outlined">logout</span>
                <span className="text-sm uppercase tracking-widest">Sign Out Account</span>
              </button>
            </>
          )}
          <p className="text-center text-[9px] font-black text-slate-300 uppercase tracking-[0.5em] mt-4">Jangoes v2.5.0</p>
        </div>
      </main>
    </div>
  );
};

export default CustomerProfile;