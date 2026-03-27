import React, { useState } from 'react';
import { auth, db } from '../../src/firebase.ts';
import { doc, setDoc } from 'firebase/firestore';

interface SetupProfileProps {
  onComplete: () => void;
}

const SetupProfile: React.FC<SetupProfileProps> = ({ onComplete }) => {
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter your name.');
      return;
    }
    if (trimmed.length < 2) {
      setError('Name must be at least 2 characters.');
      return;
    }

    const user = auth.currentUser;
    if (!user) return;

    setIsLoading(true);
    try {
      await setDoc(doc(db, 'users', user.uid), { name: trimmed }, { merge: true });
      onComplete();
    } catch (err: any) {
      console.error('Error saving name:', err?.code, err?.message);
      setError(err?.message || 'Failed to save. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-white items-center justify-center px-8 font-sans">
      {/* Icon */}
      <div className="relative size-24 mb-8">
        <div className="absolute inset-0 bg-primary/10 rounded-[36px] rotate-6" />
        <div className="relative size-24 bg-white rounded-[36px] shadow-[0_20px_40px_rgba(0,0,0,0.08)] flex items-center justify-center border border-slate-50">
          <span className="material-symbols-outlined text-5xl text-primary filled">person</span>
        </div>
      </div>

      <h2 className="text-3xl font-black tracking-tight text-slate-900 mb-2 text-center">What's your name?</h2>
      <p className="text-sm text-slate-400 font-medium text-center mb-10 max-w-[240px]">
        This is how you'll appear on Jangoes.
      </p>

      <div className="w-full flex flex-col gap-4">
        <div className="flex items-center h-18 px-6 py-5 rounded-[28px] bg-slate-50 border-2 border-slate-50 focus-within:bg-white focus-within:border-primary/20 focus-within:shadow-xl focus-within:shadow-primary/5 transition-all">
          <input
            type="text"
            autoFocus
            value={name}
            onChange={(e) => { setName(e.target.value); setError(null); }}
            onKeyDown={(e) => e.key === 'Enter' && handleContinue()}
            placeholder="Enter your full name"
            maxLength={50}
            className="w-full bg-transparent text-lg font-black text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-0 border-none p-0"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-500 text-sm font-semibold px-4 py-3 rounded-2xl">
            <span className="material-symbols-outlined text-base">error</span>
            {error}
          </div>
        )}

        <button
          onClick={handleContinue}
          disabled={isLoading || !name.trim()}
          className="w-full h-18 py-5 rounded-[28px] bg-gradient-to-r from-primary to-primary-dark text-white font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-primary/30 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
        >
          {isLoading ? (
            <span className="material-symbols-outlined animate-spin">sync</span>
          ) : (
            <>
              <span>Continue</span>
              <span className="material-symbols-outlined">arrow_forward</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default SetupProfile;
