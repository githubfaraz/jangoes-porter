import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../src/firebase.ts';
import { doc, onSnapshot } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { resubmitPan, resubmitDl, resubmitRc, DL_STATES } from '../../services/kycVerification.ts';
import { extractKycData } from '../../services/kycHelper.ts';

interface PendingVerificationProps {
  onVerified: () => void;
}

const PendingVerification: React.FC<PendingVerificationProps> = ({ onVerified }) => {
  const navigate = useNavigate();
  const [pendingDocNames, setPendingDocNames] = useState<string[]>([]);
  const [rejectedDocs, setRejectedDocs] = useState<{ name: string; reason: string; type: string }[]>([]);
  const [driverName, setDriverName] = useState('');
  const [aadhaarName, setAadhaarName] = useState('');
  const [showVerifiedAnim, setShowVerifiedAnim] = useState(false);

  // Re-upload state
  const [reuploadingDoc, setReuploadingDoc] = useState<string | null>(null);
  const [reuploadLoading, setReuploadLoading] = useState(false);
  const [reuploadError, setReuploadError] = useState('');
  const [reuploadSuccess, setReuploadSuccess] = useState('');

  // PAN re-upload
  const panInputRef = useRef<HTMLInputElement>(null);
  const [panFile, setPanFile] = useState<File | null>(null);
  const [panPreview, setPanPreview] = useState('');

  // DL re-upload
  const [dlState, setDlState] = useState('');
  const [dlNumber, setDlNumber] = useState('');
  const [dlDob, setDlDob] = useState('');

  // RC re-upload
  const [rcNumber, setRcNumber] = useState('');

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      setDriverName(d.name || '');

      const kd = extractKycData(d);
      setAadhaarName(kd.aadhaarName || '');

      // Build rejected docs list
      const rejected: { name: string; reason: string; type: string }[] = [];
      if (kd.panStatus === 'rejected') rejected.push({ name: 'PAN Card', reason: kd.panRejectReason || 'Document rejected by admin', type: 'pan' });
      if (kd.dlStatus === 'rejected') rejected.push({ name: 'Driving License', reason: kd.dlRejectReason || 'Document rejected by admin', type: 'dl' });
      if (kd.rcVerifyStatus === 'rejected') rejected.push({ name: 'RC / Vehicle Registration', reason: kd.rcRejectReason || 'Document rejected by admin', type: 'rc' });
      setRejectedDocs(rejected);

      // Build pending docs list
      const names: string[] = [];
      if (kd.panStatus === 'pending_review') names.push('PAN Card');
      if (kd.dlStatus === 'pending_review') names.push('Driving License');
      if (kd.rcVerifyStatus === 'pending_review') names.push('RC / Vehicle Registration');
      if (names.length === 0 && rejected.length === 0) {
        const saved = d.pendingDocNames || [];
        names.push(...saved);
      }
      setPendingDocNames(names);

      // Auto-redirect when admin approves all
      if (d.kycAllVerified === true && d.kycCompleted) {
        setShowVerifiedAnim(true);
        setTimeout(() => onVerified(), 3000);
      }
    });

    return () => unsubscribe();
  }, [onVerified]);

  const firstName = driverName.split(' ')[0] || 'Partner';

  const handlePanReupload = async () => {
    if (!panFile || !auth.currentUser) return;
    setReuploadLoading(true); setReuploadError(''); setReuploadSuccess('');
    try {
      const result = await resubmitPan(auth.currentUser.uid, panFile, aadhaarName);
      if (!result.success) { setReuploadError(result.error || 'Verification failed'); return; }
      setReuploadSuccess(result.status === 'verified' ? 'PAN Card verified successfully!' : 'PAN Card re-submitted for review.');
      setPanFile(null); setPanPreview('');
      setReuploadingDoc(null);
    } catch (err: any) { setReuploadError(err.message || 'Request failed'); }
    finally { setReuploadLoading(false); }
  };

  const handleDlReupload = async () => {
    if (!dlState || !dlNumber.trim() || !dlDob || !auth.currentUser) return;
    setReuploadLoading(true); setReuploadError(''); setReuploadSuccess('');
    try {
      const result = await resubmitDl(auth.currentUser.uid, dlState, dlNumber, dlDob, aadhaarName);
      if (!result.success) { setReuploadError(result.error || 'Verification failed'); return; }
      setReuploadSuccess(result.status === 'verified' ? 'Driving License verified successfully!' : 'Driving License re-submitted for review.');
      setDlState(''); setDlNumber(''); setDlDob('');
      setReuploadingDoc(null);
    } catch (err: any) { setReuploadError(err.message || 'Request failed'); }
    finally { setReuploadLoading(false); }
  };

  const handleRcReupload = async () => {
    if (!rcNumber.trim() || !auth.currentUser) return;
    setReuploadLoading(true); setReuploadError(''); setReuploadSuccess('');
    try {
      const result = await resubmitRc(auth.currentUser.uid, rcNumber, aadhaarName);
      if (!result.success) { setReuploadError(result.error || 'Verification failed'); return; }
      setReuploadSuccess(result.status === 'verified' ? 'RC verified successfully!' : 'RC re-submitted for review.');
      setRcNumber('');
      setReuploadingDoc(null);
    } catch (err: any) { setReuploadError(err.message || 'Request failed'); }
    finally { setReuploadLoading(false); }
  };

  // ── Celebration screen ──
  if (showVerifiedAnim) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-slate-950 animate-in fade-in duration-500">
        <div className="size-28 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-8 animate-in zoom-in-50 duration-500">
          <span className="material-symbols-outlined text-green-500 text-6xl filled">verified_user</span>
        </div>
        <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-3">You're All Set!</h2>
        <p className="text-slate-500 text-sm font-medium max-w-xs mb-2">
          All your documents have been verified successfully. Welcome aboard, {firstName}!
        </p>
        <p className="text-primary text-xs font-black uppercase tracking-widest animate-pulse">Redirecting to dashboard...</p>
      </div>
    );
  }

  const totalIssues = pendingDocNames.length + rejectedDocs.length;
  const selectedDlState = DL_STATES.find(s => s.code === dlState);

  return (
    <div className="min-h-screen w-full flex flex-col bg-white dark:bg-slate-950">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-amber-500 to-orange-600 px-6 pt-16 pb-12">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-black/5 rounded-full translate-y-1/2 -translate-x-1/4" />
        <div className="relative z-10">
          <div className="size-16 bg-white/20 rounded-2xl backdrop-blur-md flex items-center justify-center border border-white/20 mb-6">
            <span className="material-symbols-outlined text-white text-3xl">hourglass_top</span>
          </div>
          <h1 className="text-white text-2xl font-black leading-tight mb-2">Verification In Progress</h1>
          <p className="text-white/80 text-sm font-medium leading-relaxed max-w-sm">
            Hi {firstName}, your registration is complete but some documents need attention.
          </p>
        </div>
      </div>

      <div className="flex-1 px-6 py-8 flex flex-col gap-6">

        {/* Success message */}
        {reuploadSuccess && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl px-4 py-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-green-500 text-xl">check_circle</span>
            <p className="text-green-700 dark:text-green-400 text-sm font-bold">{reuploadSuccess}</p>
          </div>
        )}

        {/* Error message */}
        {reuploadError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl px-4 py-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-red-500 text-xl">error</span>
            <p className="text-red-600 dark:text-red-400 text-sm font-bold">{reuploadError}</p>
          </div>
        )}

        {/* Documents section */}
        <div className="bg-amber-50 dark:bg-amber-900/10 border-2 border-amber-200 dark:border-amber-800 rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="size-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-amber-600 text-xl">pending_actions</span>
            </div>
            <div>
              <h3 className="font-black text-amber-800 dark:text-amber-300 text-sm">Documents Requiring Attention</h3>
              <p className="text-amber-600/70 dark:text-amber-400/70 text-[10px] font-bold uppercase tracking-widest">
                {totalIssues} document{totalIssues !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {/* Pending docs */}
            {pendingDocNames.map((name, i) => (
              <div key={`p-${i}`} className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-amber-100 dark:border-amber-900/40">
                <div className="flex items-center gap-3 mb-2">
                  <span className="material-symbols-outlined text-amber-500 text-lg">description</span>
                  <span className="font-black text-sm text-slate-900 dark:text-white">{name}</span>
                  <span className="ml-auto text-[9px] font-black bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2.5 py-1 rounded-full uppercase tracking-widest">Under Review</span>
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-xs font-medium pl-8">Being reviewed by our team</p>
              </div>
            ))}

            {/* Rejected docs with re-upload */}
            {rejectedDocs.map((d) => (
              <div key={d.type} className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-red-200 dark:border-red-900/40 overflow-hidden">
                <div className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="material-symbols-outlined text-red-500 text-lg">error</span>
                    <span className="font-black text-sm text-slate-900 dark:text-white">{d.name}</span>
                    <span className="ml-auto text-[9px] font-black bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-2.5 py-1 rounded-full uppercase tracking-widest">Rejected</span>
                  </div>
                  <div className="ml-8 bg-red-50 dark:bg-red-900/10 rounded-xl px-3 py-2 mb-3">
                    <p className="text-red-600 dark:text-red-400 text-xs font-medium"><span className="font-black">Reason: </span>{d.reason}</p>
                  </div>
                  {reuploadingDoc !== d.type && (
                    <button
                      onClick={() => { setReuploadingDoc(d.type); setReuploadError(''); setReuploadSuccess(''); }}
                      className="ml-8 px-4 py-2 bg-primary text-white text-xs font-black rounded-xl active:scale-95 transition-transform flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-sm">upload</span>
                      Re-upload Document
                    </button>
                  )}
                </div>

                {/* ── PAN Re-upload Form ── */}
                {reuploadingDoc === 'pan' && d.type === 'pan' && (
                  <div className="border-t border-red-100 dark:border-red-900/40 p-4 bg-slate-50 dark:bg-slate-800/50 space-y-3">
                    <p className="text-xs font-bold text-slate-500">Upload a clear image of your PAN card</p>
                    <input ref={panInputRef} type="file" accept="image/*" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) { setPanFile(f); setPanPreview(URL.createObjectURL(f)); } e.target.value = ''; }} />
                    {panPreview ? (
                      <div className="relative rounded-xl overflow-hidden border border-slate-200 h-40">
                        <img src={panPreview} alt="PAN" className="w-full h-full object-cover" />
                        <button onClick={() => { setPanFile(null); setPanPreview(''); }}
                          className="absolute top-2 right-2 size-7 bg-black/50 text-white rounded-full flex items-center justify-center">
                          <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => panInputRef.current?.click()}
                        className="w-full h-32 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-400 active:scale-[0.98]">
                        <span className="material-symbols-outlined text-3xl">add_a_photo</span>
                        <span className="text-xs font-bold">Tap to select PAN card image</span>
                      </button>
                    )}
                    <div className="flex gap-2">
                      <button onClick={() => { setReuploadingDoc(null); setPanFile(null); setPanPreview(''); }}
                        className="flex-1 h-11 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-500">Cancel</button>
                      <button onClick={handlePanReupload} disabled={!panFile || reuploadLoading}
                        className="flex-[2] h-11 bg-primary text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                        {reuploadLoading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Verifying...</> : 'Verify PAN Card'}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── DL Re-upload Form ── */}
                {reuploadingDoc === 'dl' && d.type === 'dl' && (
                  <div className="border-t border-red-100 dark:border-red-900/40 p-4 bg-slate-50 dark:bg-slate-800/50 space-y-3">
                    <p className="text-xs font-bold text-slate-500">Re-enter your Driving License details</p>
                    <div className="space-y-2">
                      <select value={dlState} onChange={e => setDlState(e.target.value)}
                        className="w-full h-11 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 text-sm font-bold">
                        <option value="">Select DL issuing state</option>
                        {DL_STATES.map(s => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}
                      </select>
                      <div className="flex gap-2 items-center">
                        {selectedDlState && <span className="text-sm font-black text-primary shrink-0">{selectedDlState.code}-</span>}
                        <input value={dlNumber} onChange={e => setDlNumber(e.target.value)} placeholder="License number"
                          className="flex-1 h-11 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 text-sm font-bold" />
                      </div>
                      <input type="date" value={dlDob} onChange={e => setDlDob(e.target.value)} placeholder="Date of Birth"
                        className="w-full h-11 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 text-sm font-bold" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setReuploadingDoc(null); setDlState(''); setDlNumber(''); setDlDob(''); }}
                        className="flex-1 h-11 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-500">Cancel</button>
                      <button onClick={handleDlReupload} disabled={!dlState || !dlNumber.trim() || !dlDob || reuploadLoading}
                        className="flex-[2] h-11 bg-primary text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                        {reuploadLoading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Verifying...</> : 'Verify License'}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── RC Re-upload Form ── */}
                {reuploadingDoc === 'rc' && d.type === 'rc' && (
                  <div className="border-t border-red-100 dark:border-red-900/40 p-4 bg-slate-50 dark:bg-slate-800/50 space-y-3">
                    <p className="text-xs font-bold text-slate-500">Re-enter your vehicle registration number</p>
                    <input value={rcNumber} onChange={e => setRcNumber(e.target.value.replace(/\s/g, '').toUpperCase())}
                      placeholder="e.g. DL1CAB1234" maxLength={15}
                      className="w-full h-11 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 text-sm font-black uppercase tracking-widest" />
                    <div className="flex gap-2">
                      <button onClick={() => { setReuploadingDoc(null); setRcNumber(''); }}
                        className="flex-1 h-11 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-500">Cancel</button>
                      <button onClick={handleRcReupload} disabled={rcNumber.trim().length < 6 || reuploadLoading}
                        className="flex-[2] h-11 bg-primary text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                        {reuploadLoading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Verifying...</> : 'Verify RC'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* What happens next */}
        <div className="bg-slate-50 dark:bg-slate-900 rounded-3xl p-6">
          <h3 className="font-black text-sm text-slate-900 dark:text-white mb-5 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-primary rounded-full"></span>
            What Happens Next?
          </h3>
          <div className="flex flex-col gap-5 relative pl-1">
            <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-slate-200 dark:bg-slate-700"></div>
            <div className="flex items-start gap-4 relative">
              <div className="size-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs shrink-0 z-10 ring-4 ring-slate-50 dark:ring-slate-900">
                <span className="material-symbols-outlined text-sm">check</span>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">Registration Complete</p>
                <p className="text-xs text-slate-500">All your documents have been submitted</p>
              </div>
            </div>
            <div className="flex items-start gap-4 relative">
              <div className="size-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs shrink-0 z-10 ring-4 ring-slate-50 dark:ring-slate-900 animate-pulse">
                <span className="material-symbols-outlined text-sm">more_horiz</span>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {rejectedDocs.length > 0 ? 'Re-upload Rejected Documents' : 'Manual Review'}
                </p>
                <p className="text-xs text-slate-500">
                  {rejectedDocs.length > 0 ? 'Fix rejected documents above, then our team will review again' : 'Our team is verifying your flagged documents'}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4 relative">
              <div className="size-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-400 flex items-center justify-center text-xs shrink-0 z-10 ring-4 ring-slate-50 dark:ring-slate-900">
                <span className="material-symbols-outlined text-sm">local_shipping</span>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-400">Start Earning</p>
                <p className="text-xs text-slate-400">Go online and accept delivery requests</p>
              </div>
            </div>
          </div>
        </div>

        {/* Estimated time */}
        <div className="bg-primary/5 border border-primary/10 rounded-3xl p-6 flex items-center gap-4">
          <div className="size-12 bg-primary/10 rounded-2xl flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary text-2xl">schedule</span>
          </div>
          <div>
            <p className="text-sm font-black text-slate-900 dark:text-white">Estimated Review Time</p>
            <p className="text-xs text-slate-500 font-medium">Typically completed within 24–48 hours. You'll be notified automatically once verified.</p>
          </div>
        </div>

        {/* Info note */}
        <div className="bg-slate-100 dark:bg-slate-800/60 rounded-2xl px-4 py-3 flex items-start gap-3">
          <span className="material-symbols-outlined text-slate-400 text-lg mt-0.5 shrink-0">info</span>
          <p className="text-slate-500 dark:text-slate-400 text-xs font-medium leading-relaxed">
            This page updates automatically. Once our team approves your documents, you'll be redirected to your dashboard instantly.
          </p>
        </div>

        {/* Contact support */}
        <button onClick={() => navigate('/help')}
          className="w-full h-14 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-center gap-3 font-black text-sm text-slate-700 dark:text-slate-200 active:scale-[0.98] transition-transform">
          <span className="material-symbols-outlined text-primary text-xl">support_agent</span>
          <span>Contact Support</span>
        </button>

        {/* Logout */}
        <button onClick={() => signOut(auth)}
          className="w-full h-12 flex items-center justify-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest active:scale-95 transition-transform">
          <span className="material-symbols-outlined text-lg">logout</span>
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default PendingVerification;
