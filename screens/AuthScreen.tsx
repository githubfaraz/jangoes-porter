import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserRole } from '../types.ts';
import { auth, db } from '../src/firebase.ts';
import { signInWithPopup, GoogleAuthProvider, OAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface AuthScreenProps {
  onLogin: (role: UserRole) => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const navigate = useNavigate();
  const [role, setRole] = useState<UserRole>(UserRole.CUSTOMER);
  const [phoneNumber, setPhoneNumber] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showError = (msg: string) => {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    setError(msg);
    errorTimerRef.current = setTimeout(() => setError(null), 5000);
  };

  useEffect(() => () => { if (errorTimerRef.current) clearTimeout(errorTimerRef.current); }, []);

  const createUserProfileIfNeeded = async (uid: string, extraData?: Record<string, any>) => {
    const userDocRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userDocRef);
    if (!userDoc.exists()) {
      await setDoc(userDocRef, {
        role,
        kycCompleted: false,
        createdAt: new Date().toISOString(),
        walletBalance: 0,
        ...extraData,
      });
      return role;
    }
    return userDoc.data().role as UserRole;
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const finalRole = await createUserProfileIfNeeded(user.uid, {
        name: user.displayName || '',
        email: user.email || '',
        phoneNumber: user.phoneNumber || '',
      });
      onLogin(finalRole);
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        showError(err?.message || 'Google sign-in failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    setIsLoading(true);
    try {
      const provider = new OAuthProvider('apple.com');
      provider.addScope('email');
      provider.addScope('name');
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const finalRole = await createUserProfileIfNeeded(user.uid, {
        name: user.displayName || '',
        email: user.email || '',
      });
      onLogin(finalRole);
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        showError(err?.message || 'Apple sign-in failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleProceed = async () => {
    console.log('handleProceed called, phone:', phoneNumber);
    if (phoneNumber.length === 10) {
      setIsLoading(true);
      try {
        console.log('Fetching /api/auth/send-otp...');
        const response = await fetch('/api/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mobile: phoneNumber }),
        });
        
        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Response data:', data);
        
        if (response.ok) {
          if (data.demo) {
            alert(`DEMO MODE: OTP is ${data.otp}`);
          }
          console.log('Navigating to /otp');
          navigate('/otp', { state: { role, phoneNumber } });
        } else {
          alert(data.error || 'Failed to send OTP');
        }
      } catch (error) {
        console.error('Error sending OTP:', error);
        alert('Network error. Please try again.');
      } finally {
        setIsLoading(false);
      }
    } else {
      console.log('Phone number length is not 10:', phoneNumber.length);
    }
  };

  return (
    <div className="relative flex flex-col min-h-screen bg-white overflow-hidden font-sans selection:bg-primary/20">
      
      {/* 1. VIBRANT AERO-MESH BACKGROUND */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        {/* Colorful Animated Blobs */}
        <div className="absolute top-[-10%] left-[-20%] w-[100%] h-[70%] bg-gradient-to-br from-primary/15 via-purple-400/10 to-transparent rounded-full blur-[100px] animate-pulse duration-[12s]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[80%] h-[60%] bg-gradient-to-tr from-accent/20 via-primary/5 to-transparent rounded-full blur-[120px] animate-pulse duration-[10s] delay-1000" />
        <div className="absolute top-[20%] right-[-30%] w-[60%] h-[40%] bg-blue-300/10 rounded-full blur-[80px] animate-bounce duration-[15s] opacity-60" />
        
        {/* Subtle Paper Texture/Grid */}
        <div className="absolute inset-0 opacity-[0.03]" 
             style={{ backgroundImage: 'radial-gradient(#2B59A2 1px, transparent 0)', backgroundSize: '32px 32px' }} />
      </div>

      {/* 2. PREMIUM BRANDING SECTION */}
      <div className="relative z-10 flex flex-col items-center pt-20 pb-10 px-8 text-center">
        <div className="mb-8 relative animate-in zoom-in duration-700">
          {/* Logo Backdrop Glow */}
          <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150" />
          
          <div className="relative size-24 bg-gradient-to-br from-primary to-primary-dark rounded-[36px] flex items-center justify-center shadow-[0_25px_50px_-12px_rgba(43,89,162,0.4)] transform hover:scale-105 transition-transform duration-500">
            <span className="material-symbols-outlined text-5xl text-white filled">local_shipping</span>
            {/* Speed Badge */}
            <div className="absolute -right-2 -top-2 size-10 bg-accent rounded-2xl flex items-center justify-center text-white shadow-xl border-4 border-white animate-bounce delay-700">
              <span className="material-symbols-outlined text-lg filled">bolt</span>
            </div>
          </div>
        </div>
        
        <h1 className="inline-block leading-normal pb-1 bg-gradient-to-r from-[#78AA64] to-[#96C882] bg-clip-text text-transparent text-5xl font-[900] tracking-tighter mb-4 animate-in slide-in-from-top-4 duration-700 delay-200">
          Jangoes
        </h1>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em] animate-in fade-in duration-1000 delay-500">
          Speed • Safety • Reliability
        </p>
      </div>

      {/* 3. INTERACTION CARD */}
      <div className="relative z-20 flex-1 px-6 pb-12 flex flex-col">
        <div className="bg-white/70 backdrop-blur-3xl border border-white rounded-[48px] p-8 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)] animate-in slide-in-from-bottom-12 duration-1000">
          
          {/* Professional Role Toggle */}
          <div className="relative flex p-1.5 bg-slate-100 rounded-3xl mb-10 h-16 items-center">
            {/* Sliding Island Background */}
            <div 
              className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-white rounded-2xl shadow-lg shadow-black/5 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                role === UserRole.CUSTOMER ? 'translate-x-0' : 'translate-x-full'
              }`}
            />
            
            <button 
              onClick={() => setRole(UserRole.CUSTOMER)}
              className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-4 text-[11px] font-[900] uppercase tracking-widest transition-colors duration-300 ${
                role === UserRole.CUSTOMER ? 'text-primary' : 'text-slate-400'
              }`}
            >
              <span className={`material-symbols-outlined text-lg ${role === UserRole.CUSTOMER ? 'filled' : ''}`}>person</span>
              Customer
            </button>
            <button 
              onClick={() => setRole(UserRole.DRIVER)}
              className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-4 text-[11px] font-[900] uppercase tracking-widest transition-colors duration-300 ${
                role === UserRole.DRIVER ? 'text-accent' : 'text-slate-400'
              }`}
            >
              <span className={`material-symbols-outlined text-lg ${role === UserRole.DRIVER ? 'filled' : ''}`}>local_shipping</span>
              Driver
            </button>
          </div>

          {/* Form Content */}
          <div className="space-y-8">
            <div className="flex flex-col gap-2.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Secure Phone Login</label>
              <div className="flex items-center h-20 px-6 rounded-[30px] bg-slate-50 border-2 border-slate-50 focus-within:bg-white focus-within:border-primary/20 focus-within:shadow-xl focus-within:shadow-primary/5 transition-all duration-300 group">
                <div className="flex items-center gap-3 pr-5 border-r border-slate-200 mr-5">
                  <img src="https://flagcdn.com/w40/in.png" className="w-6 rounded-sm shadow-sm opacity-80" alt="IN" />
                  <span className="text-base font-black text-slate-900">+91</span>
                </div>
                <input 
                  type="tel" 
                  maxLength={10}
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="00000 00000"
                  className="flex-1 bg-transparent border-none text-xl font-black tracking-widest text-slate-900 placeholder:text-slate-300 focus:ring-0 p-0"
                />
              </div>
            </div>

            <button 
              onClick={handleProceed}
              disabled={phoneNumber.length !== 10 || isLoading}
              className={`w-full h-20 rounded-[30px] flex items-center justify-center gap-3 transition-all duration-500 active:scale-95 shadow-2xl relative overflow-hidden group disabled:opacity-50 ${
                role === UserRole.CUSTOMER 
                  ? 'bg-gradient-to-r from-primary to-primary-dark shadow-primary/30' 
                  : 'bg-gradient-to-r from-accent to-accent-dark shadow-accent/30'
              }`}
            >
              {/* Shine Animation */}
              <div className="absolute inset-0 w-1/2 h-full bg-white/20 skew-x-[-25deg] -translate-x-full group-hover:translate-x-[250%] transition-transform duration-1000" />
              
              <span className="text-sm font-black uppercase tracking-[0.2em] text-white">
                {isLoading ? 'Sending...' : 'Get Started'}
              </span>
              {!isLoading && <span className="material-symbols-outlined text-white font-black group-hover:translate-x-1 transition-transform">arrow_forward</span>}
            </button>
          </div>

          <div className="mt-12">
            <div className="flex items-center gap-4 mb-8">
              <div className="h-px flex-1 bg-slate-100"></div>
              <span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.4em]">Fast Sign-in</span>
              <div className="h-px flex-1 bg-slate-100"></div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-500 text-sm font-semibold px-4 py-3 rounded-2xl">
                <span className="material-symbols-outlined text-base">error</span>
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="h-16 bg-white border border-slate-100 rounded-2xl flex items-center justify-center gap-3 hover:bg-slate-50 transition-all shadow-sm active:scale-95 disabled:opacity-50"
              >
                <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" className="size-5" alt="Google" />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Google</span>
              </button>
              <button
                onClick={handleAppleLogin}
                disabled={isLoading}
                className="h-16 bg-slate-900 rounded-2xl flex items-center justify-center gap-3 hover:bg-black transition-all shadow-xl active:scale-95 disabled:opacity-50"
              >
                <span className="text-[10px] font-black text-white uppercase tracking-widest">Apple</span>
              </button>
            </div>
          </div>
        </div>

        {/* TRUST BADGES & FOOTER */}
        <div className="mt-auto flex flex-col items-center gap-8 animate-in fade-in duration-1000 delay-700">
          <div className="flex items-center gap-4 px-6 py-2.5 bg-white/40 border border-white/60 rounded-full backdrop-blur-md shadow-sm">
            
            <div className="w-px h-3 bg-slate-200" />
            
          </div>
          
          <div className="text-center space-y-2">
            <p className="text-[10px] text-slate-400 font-medium max-w-[240px] leading-relaxed">
              By joining, you agree to our <span className="text-primary font-bold">Terms of Use</span> and <span className="text-primary font-bold">Privacy Policy</span>.
            </p>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">© 2024 Jangoes Logistics Private Ltd.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;