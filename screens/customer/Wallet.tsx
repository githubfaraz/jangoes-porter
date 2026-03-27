import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../src/firebase.ts';
import { doc, onSnapshot, updateDoc, increment, collection, addDoc, query, orderBy, limit, getDocs, serverTimestamp, Timestamp } from 'firebase/firestore';

interface Transaction {
  id: string;
  amount: number;
  type: 'credit' | 'debit';
  description: string;
  createdAt: Timestamp | null;
}

const CustomerWallet: React.FC = () => {
  const navigate = useNavigate();
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addAmount, setAddAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const uid = auth.currentUser?.uid;

  // Real-time balance listener
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, 'users', uid), (snap) => {
      if (snap.exists()) {
        setBalance(snap.data().walletBalance ?? 0);
      }
    });
    return () => unsub();
  }, [uid]);

  // Fetch recent transactions
  const fetchTransactions = async () => {
    if (!uid) return;
    setLoadingTx(true);
    try {
      const txRef = collection(db, 'users', uid, 'transactions');
      const q = query(txRef, orderBy('createdAt', 'desc'), limit(20));
      const snap = await getDocs(q);
      const txs: Transaction[] = snap.docs.map(d => ({
        id: d.id,
        ...(d.data() as Omit<Transaction, 'id'>),
      }));
      setTransactions(txs);
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    } finally {
      setLoadingTx(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [uid]);

  const handleAddMoney = async () => {
    const amount = parseFloat(addAmount);
    if (isNaN(amount) || amount <= 0 || !uid) return;

    setIsProcessing(true);
    setError('');

    try {
      // Update wallet balance with atomic increment
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, { walletBalance: increment(amount) });

      // Save transaction record
      const txRef = collection(db, 'users', uid, 'transactions');
      await addDoc(txRef, {
        amount,
        type: 'credit',
        description: 'Wallet Top-up',
        createdAt: serverTimestamp(),
      });

      setIsProcessing(false);
      setIsSuccess(true);

      // Refresh transactions list
      await fetchTransactions();

      setTimeout(() => {
        setIsSuccess(false);
        setShowAddModal(false);
        setAddAmount('');
      }, 2000);
    } catch (err: any) {
      console.error('Add money failed:', err);
      setIsProcessing(false);
      setError('Something went wrong. Please try again.');
    }
  };

  const quickAmounts = [100, 500, 1000, 2000];

  const formatDate = (ts: Timestamp | null) => {
    if (!ts) return '';
    const d = ts.toDate();
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
      ' · ' +
      d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark relative">
      <header className="flex items-center px-4 py-3 justify-between sticky top-0 z-10 bg-white/95 dark:bg-background-dark/95 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-slate-100">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h2 className="text-xl font-bold">My Wallet</h2>
        </div>
        <button onClick={() => navigate('/help')} className="p-2 rounded-full hover:bg-slate-100">
          <span className="material-symbols-outlined">help_outline</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto pb-28 px-4 no-scrollbar">
        <div className="py-4">
          <div className="relative w-full rounded-2xl bg-gradient-to-br from-[#0052cc] to-[#003d99] shadow-lg p-6 text-white overflow-hidden">
            <div className="relative z-10 flex flex-col justify-between gap-8">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-blue-100 text-sm font-medium mb-1">Total Balance</p>
                  <h1 className="text-4xl font-bold tracking-tight">
                    {balance === null ? (
                      <span className="inline-block w-32 h-10 bg-white/20 rounded-lg animate-pulse"></span>
                    ) : (
                      `₹${balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    )}
                  </h1>
                </div>
                <div className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold">ACTIVE</div>
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-white text-primary font-bold py-3 rounded-xl shadow-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                <span className="material-symbols-outlined text-lg">add</span>
                Add Money
              </button>
            </div>
            {/* Background design elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { icon: 'add_card', label: 'Top Up', action: () => setShowAddModal(true) },
            { icon: 'send', label: 'Send', action: () => {} },
            { icon: 'request_quote', label: 'Request', action: () => {} },
            { icon: 'more_horiz', label: 'More', action: () => {} },
          ].map(action => (
            <button key={action.label} onClick={action.action} className="flex flex-col items-center gap-2 group">
              <div className="w-14 h-14 rounded-xl bg-white dark:bg-surface-dark flex items-center justify-center shadow-sm text-primary group-active:scale-95 transition-transform">
                <span className="material-symbols-outlined text-2xl">{action.icon}</span>
              </div>
              <span className="text-[10px] font-medium text-slate-500">{action.label}</span>
            </button>
          ))}
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-bold mb-3">Saved Payment Methods</h3>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
            <div className="min-w-[280px] bg-white dark:bg-surface-dark p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-4 shadow-sm">
              <div className="w-12 h-12 rounded-lg bg-blue-50 dark:bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined">credit_card</span>
              </div>
              <div className="flex-1">
                <p className="font-bold text-sm">Visa •••• 4242</p>
                <p className="text-xs text-slate-500">Expires 12/25</p>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-bold mb-3">Recent Transactions</h3>
          <div className="flex flex-col gap-3">
            {loadingTx ? (
              // Skeleton loaders
              [...Array(3)].map((_, i) => (
                <div key={i} className="bg-white dark:bg-surface-dark p-4 rounded-xl flex items-center justify-between border border-slate-100 dark:border-slate-800 shadow-sm animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800"></div>
                    <div>
                      <div className="w-28 h-4 bg-slate-100 dark:bg-slate-800 rounded mb-1.5"></div>
                      <div className="w-20 h-3 bg-slate-100 dark:bg-slate-800 rounded"></div>
                    </div>
                  </div>
                  <div className="w-16 h-4 bg-slate-100 dark:bg-slate-800 rounded"></div>
                </div>
              ))
            ) : transactions.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-slate-400">
                <span className="material-symbols-outlined text-5xl mb-3">receipt_long</span>
                <p className="font-semibold text-sm">No transactions yet</p>
                <p className="text-xs mt-1">Add money to get started</p>
              </div>
            ) : (
              transactions.map((tx) => {
                const isCredit = tx.type === 'credit';
                return (
                  <div key={tx.id} className="bg-white dark:bg-surface-dark p-4 rounded-xl flex items-center justify-between border border-slate-100 dark:border-slate-800 shadow-sm active:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center ${isCredit ? 'text-green-600' : 'text-primary'}`}>
                        <span className="material-symbols-outlined">
                          {isCredit ? 'arrow_downward' : 'local_shipping'}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{tx.description}</p>
                        <p className="text-xs text-slate-500">{formatDate(tx.createdAt)}</p>
                      </div>
                    </div>
                    <p className={`font-bold text-sm ${isCredit ? 'text-green-600' : 'text-slate-900 dark:text-white'}`}>
                      {isCredit ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN')}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      {/* Add Money Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-[32px] p-6 pb-12 shadow-2xl animate-in slide-in-from-bottom duration-500"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-6"></div>

            {isSuccess ? (
              <div className="flex flex-col items-center py-10 animate-in zoom-in duration-300">
                <div className="size-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-4">
                  <span className="material-symbols-outlined text-5xl filled">check_circle</span>
                </div>
                <h3 className="text-2xl font-bold">Funds Added!</h3>
                <p className="text-slate-500 text-sm mt-2">Your balance has been updated successfully.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-bold">Add Money</h3>
                  <button onClick={() => { setShowAddModal(false); setError(''); }} className="p-2 text-slate-400">
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Enter Amount</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-300">₹</span>
                      <input
                        type="number"
                        value={addAmount}
                        onChange={(e) => setAddAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full h-16 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl pl-10 pr-4 text-2xl font-black text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {quickAmounts.map(amt => (
                      <button
                        key={amt}
                        onClick={() => setAddAmount(amt.toString())}
                        className="py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-primary/10 hover:text-primary transition-all active:scale-95"
                      >
                        +₹{amt}
                      </button>
                    ))}
                  </div>

                  <div className="bg-blue-50 dark:bg-primary/10 rounded-2xl p-4 flex items-center gap-4 border border-primary/10">
                    <div className="size-10 bg-white dark:bg-slate-800 rounded-lg flex items-center justify-center text-primary shadow-sm">
                      <span className="material-symbols-outlined">account_balance_wallet</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter leading-none mb-1">Payment Method</p>
                      <p className="text-sm font-bold">UPI / GPay / PhonePe</p>
                    </div>
                    <span className="material-symbols-outlined text-slate-300 text-sm">chevron_right</span>
                  </div>

                  {error && (
                    <p className="text-red-500 text-sm text-center font-medium">{error}</p>
                  )}

                  <button
                    disabled={!addAmount || parseFloat(addAmount) <= 0 || isProcessing}
                    onClick={handleAddMoney}
                    className="w-full bg-primary hover:bg-primary-dark disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white font-bold h-14 rounded-2xl shadow-xl shadow-primary/20 flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
                  >
                    {isProcessing ? (
                      <>
                        <span className="material-symbols-outlined animate-spin">sync</span>
                        Processing...
                      </>
                    ) : (
                      <>
                        <span>Add ₹{addAmount || '0'}</span>
                        <span className="material-symbols-outlined">arrow_forward</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerWallet;
