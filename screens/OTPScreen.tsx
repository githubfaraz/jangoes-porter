import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { UserRole } from '../types.ts';
import { auth, db } from '../src/firebase.ts';
import { signInWithCustomToken } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

interface OTPScreenProps {
  onVerify: (role: UserRole) => void;
}

const OTPScreen: React.FC<OTPScreenProps> = ({ onVerify }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const role = location.state?.role || UserRole.CUSTOMER;
  const phoneNumber = location.state?.phoneNumber || '';
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(30);
  const [resendSuccess, setResendSuccess] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showError = (msg: string) => {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    setError(msg);
    errorTimerRef.current = setTimeout(() => setError(null), 5000);
  };

  useEffect(() => {
    // Start countdown timer
    cooldownRef.current = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isResending) return;
    setIsResending(true);
    setError(null);
    setResendSuccess(false);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: phoneNumber }),
      });
      const data = await res.json();
      if (!res.ok) {
        showError(data.error || 'Failed to resend OTP. Please try again.');
      } else {
        setResendSuccess(true);
        setTimeout(() => setResendSuccess(false), 4000);
        // Reset cooldown
        setResendCooldown(30);
        cooldownRef.current = setInterval(() => {
          setResendCooldown(prev => {
            if (prev <= 1) {
              if (cooldownRef.current) clearInterval(cooldownRef.current);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } catch {
      showError('Network error. Please check your connection.');
    } finally {
      setIsResending(false);
    }
  };

  const handleVerify = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 4) {
      showError("Please enter the full 4-digit code.");
      return;
    }

    setError(null);
    setIsVerifying(true);
    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: phoneNumber, otp: otpCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        showError(data.error || "Invalid OTP. Please try again.");
        setOtp(['', '', '', '']);
        setTimeout(() => inputRefs.current[0]?.focus(), 50);
        setIsVerifying(false);
        return;
      }

      // Sign in with the custom token issued by the server (phone number as stable UID)
      const userCredential = await signInWithCustomToken(auth, data.token);
      const user = userCredential.user;

      // Check if user already exists in Firestore
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        // New user — create with selected role
        await setDoc(userDocRef, {
          phoneNumber,
          role,
          roles: [role],
          kycCompleted: false,
          createdAt: new Date().toISOString(),
          walletBalance: 0
        });
      } else {
        // Existing user — add role if not present
        const data = userDoc.data();
        const existingRoles: string[] = data.roles || [data.role];
        if (!existingRoles.includes(role)) {
          await setDoc(userDocRef, { roles: [...existingRoles, role] }, { merge: true });
        }
        // Update the active role to what user selected on login
        await setDoc(userDocRef, { role }, { merge: true });
      }

      onVerify(role);
    } catch (err: any) {
      console.error("Auth Error:", err);
      showError("Verification failed. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-slate-950 overflow-y-auto no-scrollbar relative">
      {/* Premium Background Mesh */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-5%] right-[-5%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-[20%] left-[-10%] w-[30%] h-[30%] bg-accent/5 rounded-full blur-[80px]" />
      </div>

      {/* 1. Artistic Logistics Icon Section */}
      <div className="flex flex-col items-center pt-20 pb-12 px-6 relative z-10">
        <div className="relative size-28 mb-8 animate-in zoom-in duration-700">
          {/* Decorative floating shapes */}
          <div className="absolute inset-0 bg-primary/10 rounded-[36px] rotate-6 animate-pulse" />
          <div className="absolute inset-0 bg-accent/10 rounded-[36px] -rotate-3 transition-transform duration-1000 group-hover:rotate-6" />
          
          {/* Main Icon Container */}
          <div className="relative size-28 bg-white dark:bg-slate-900 rounded-[36px] shadow-[0_20px_40px_rgba(0,0,0,0.08)] flex items-center justify-center border border-slate-50 dark:border-slate-800">
             <span className="material-symbols-outlined text-6xl text-primary filled select-none">local_shipping</span>
             
             {/* Dynamic Badge */}
             <div className="absolute -right-1 -top-1 size-10 bg-accent rounded-2xl flex items-center justify-center text-white shadow-xl border-2 border-white dark:border-slate-900 animate-bounce delay-500">
                <span className="material-symbols-outlined text-lg filled">bolt</span>
             </div>
             
             {/* Motion Lines */}
             <div className="absolute -left-6 bottom-8 space-y-1">
                <div className="h-1 w-4 bg-slate-100 dark:bg-slate-800 rounded-full"></div>
                <div className="h-1 w-6 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                <div className="h-1 w-3 bg-slate-100 dark:bg-slate-800 rounded-full"></div>
             </div>
          </div>
        </div>
      </div>

      {/* 2. Verification Form */}
      <div className="flex-1 px-8 flex flex-col pt-4 relative z-10">
        <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
          <h2 className="text-slate-900 dark:text-white text-3xl font-black leading-tight mb-3 tracking-tight">Verify Phone</h2>
          <p className="text-slate-400 dark:text-slate-500 text-[11px] font-black uppercase tracking-[0.2em]">Enter the secure code sent to</p>
          <div className="flex items-center justify-center gap-3 mt-3">
            <span className="text-slate-900 dark:text-white font-black text-xl tracking-widest">+91 {phoneNumber.slice(0,2)}••••••{phoneNumber.slice(-2)}</span>
            <button 
              onClick={() => navigate(-1)} 
              className="group flex items-center justify-center size-8 bg-primary/5 hover:bg-primary/10 rounded-full transition-all active:scale-90"
              type="button"
            >
              <span className="material-symbols-outlined text-primary text-base">edit</span>
            </button>
          </div>
        </div>

        <form className="flex flex-col gap-12">
          <div className="flex justify-center gap-4">
            {[0, 1, 2, 3].map((i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                autoFocus={i === 0}
                className={`w-16 h-20 text-center text-3xl font-black bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-xl border-2 border-slate-100 dark:border-slate-800 rounded-2xl focus:outline-none transition-all caret-primary shadow-inner ${
                   role === UserRole.CUSTOMER 
                    ? 'focus:border-primary focus:ring-8 focus:ring-primary/5' 
                    : 'focus:border-accent focus:ring-8 focus:ring-accent/5'
                }`}
                inputMode="numeric"
                maxLength={1}
                type="text"
                value={otp[i]}
                onChange={(e) => {
                  const val = e.target.value.slice(-1);
                  if (val && i < 3) {
                    const nextInput = e.target.nextElementSibling as HTMLInputElement;
                    if (nextInput) nextInput.focus();
                  }
                  const newOtp = [...otp];
                  newOtp[i] = val;
                  setOtp(newOtp);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace' && !otp[i] && i > 0) {
                    const prevInput = (e.target as HTMLInputElement).previousElementSibling as HTMLInputElement;
                    if (prevInput) prevInput.focus();
                  }
                }}
              />
            ))}
          </div>
          
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-500 text-sm font-semibold px-4 py-3 rounded-2xl -mt-6">
              <span className="material-symbols-outlined text-base">error</span>
              {error}
            </div>
          )}

          <button
            onClick={handleVerify}
            disabled={isVerifying}
            className="w-full text-white font-black h-18 rounded-[28px] shadow-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-3 group py-5 disabled:opacity-70 bg-primary shadow-primary/30 hover:bg-primary-dark"
            type="button"
          >
            {isVerifying ? (
              <>
                <span className="material-symbols-outlined animate-spin">sync</span>
                <span className="text-lg uppercase tracking-widest">Verifying...</span>
              </>
            ) : (
              <>
                <span className="text-lg">Next</span>
                <span className="material-symbols-outlined text-2xl transition-transform group-hover:scale-125">check_circle</span>
              </>
            )}
          </button>
        </form>

        <div className="text-center mt-auto pb-14 animate-in fade-in duration-1000 delay-500">
          {resendSuccess && (
            <div className="flex items-center justify-center gap-2 text-green-600 text-sm font-bold mb-3">
              <span className="material-symbols-outlined text-base">check_circle</span>
              OTP sent successfully!
            </div>
          )}
          <p className="text-slate-400 dark:text-slate-500 text-sm font-medium flex items-center justify-center gap-1">
            Didn't receive the code?
            {resendCooldown > 0 ? (
              <span className="text-slate-300 dark:text-slate-600 font-black ml-1">
                Resend in 00:{resendCooldown.toString().padStart(2, '0')}
              </span>
            ) : (
              <button
                onClick={handleResendOtp}
                disabled={isResending}
                className="text-primary dark:text-accent font-black cursor-pointer ml-1 hover:underline underline-offset-4 disabled:opacity-50"
                type="button"
              >
                {isResending ? 'Sending OTP...' : 'Resend'}
              </button>
            )}
          </p>
          {resendCooldown > 0 && (
            <div className="mt-5 flex items-center justify-center gap-2.5 text-[10px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-[0.3em]">
              <span className="material-symbols-outlined text-base">schedule</span>
              <span>Request new in 00:{resendCooldown.toString().padStart(2, '0')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OTPScreen;