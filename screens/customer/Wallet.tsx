import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../src/firebase.ts';
import { doc, onSnapshot, updateDoc, increment, collection, addDoc, query, orderBy, limit, getDocs, serverTimestamp, Timestamp } from 'firebase/firestore';

interface Transaction {
  id: string;
  amount: number;
  type: 'credit' | 'debit';
  description: string;
  tripId?: string;
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

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, 'users', uid), (snap) => {
      if (snap.exists()) setBalance(snap.data().walletBalance ?? 0);
    });
    return () => unsub();
  }, [uid]);

  const fetchTransactions = async () => {
    if (!uid) return;
    setLoadingTx(true);
    try {
      const q = query(collection(db, 'users', uid, 'transactions'), orderBy('createdAt', 'desc'), limit(50));
      const snap = await getDocs(q);
      setTransactions(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Transaction, 'id'>) })));
    } catch (err) { console.error('Fetch tx error:', err); }
    finally { setLoadingTx(false); }
  };

  useEffect(() => { fetchTransactions(); }, [uid]);

  const handleAddMoney = async () => {
    const amount = parseFloat(addAmount);
    if (isNaN(amount) || amount <= 0 || !uid) return;
    setIsProcessing(true); setError('');
    try {
      await updateDoc(doc(db, 'users', uid), { walletBalance: increment(amount) });
      await addDoc(collection(db, 'users', uid, 'transactions'), {
        amount, type: 'credit', description: 'Wallet Top-up', createdAt: serverTimestamp(),
      });
      setIsProcessing(false); setIsSuccess(true);
      await fetchTransactions();
      setTimeout(() => { setIsSuccess(false); setShowAddModal(false); setAddAmount(''); }, 2000);
    } catch (err: any) {
      setIsProcessing(false); setError('Something went wrong. Please try again.');
    }
  };

  // Group transactions by date
  const groupedTx = transactions.reduce<Record<string, Transaction[]>>((groups, tx) => {
    const dateStr = tx.createdAt
      ? tx.createdAt.toDate().toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })
      : 'Unknown';
    if (!groups[dateStr]) groups[dateStr] = [];
    groups[dateStr].push(tx);
    return groups;
  }, {});

  const formatTime = (ts: Timestamp | null) => {
    if (!ts) return '';
    return ts.toDate().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  const formatRefDate = (ts: Timestamp | null) => {
    if (!ts) return '';
    return ts.toDate().toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950">
      {/* Header */}
      <header className="flex items-center px-4 py-3 sticky top-0 z-10 bg-white dark:bg-slate-950">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto pb-28 no-scrollbar">
        {/* Balance Section */}
        <div className="flex flex-col items-center pt-4 pb-8 px-6">
          <p className="text-sm font-semibold text-slate-500 mb-3">Jangoes Credits Balance</p>
          <div className="flex items-center gap-3 mb-6">
            <div className="size-10 bg-primary rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-xl">account_balance_wallet</span>
            </div>
            <h1 className="text-4xl font-black text-slate-900 dark:text-white">
              {balance === null ? (
                <span className="inline-block w-24 h-10 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse"></span>
              ) : (
                `₹${Math.max(0, balance).toLocaleString('en-IN')}`
              )}
            </h1>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="w-full max-w-sm h-14 bg-primary text-white font-black rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-[0.98] transition-transform text-lg"
          >
            Add Money
          </button>
        </div>

        {/* Transactions */}
        <div className="bg-slate-50 dark:bg-slate-900 rounded-t-[32px] min-h-[40vh] px-5 pt-6 pb-10">
          {loadingTx ? (
            <div className="flex flex-col gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 animate-pulse">
                  <div className="size-10 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                  <div className="flex-1"><div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded mb-2"></div><div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded"></div></div>
                  <div className="h-5 w-14 bg-slate-200 dark:bg-slate-700 rounded"></div>
                </div>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-slate-400">
              <span className="material-symbols-outlined text-5xl mb-3">receipt_long</span>
              <p className="font-bold text-sm">No transactions yet</p>
              <p className="text-xs mt-1">Add money to get started</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {(Object.entries(groupedTx) as [string, Transaction[]][]).map(([date, txs]) => (
                <div key={date}>
                  {/* Date header */}
                  <p className="text-xs font-bold text-slate-400 mb-3">{date}</p>

                  <div className="flex flex-col gap-4">
                    {txs.map(tx => {
                      const isCredit = tx.type === 'credit';
                      const refNum = `JNG${tx.id.slice(0, 10).toUpperCase()}`;
                      return (
                        <div key={tx.id}>
                          {/* Transaction row */}
                          <div className="flex items-start gap-3">
                            <div className={`size-10 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                              isCredit ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'
                            }`}>
                              <span className={`material-symbols-outlined text-xl ${isCredit ? 'text-green-600' : 'text-red-500'}`}>
                                {isCredit ? 'arrow_downward' : 'arrow_upward'}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-900 dark:text-white">{tx.description}</p>
                              {!isCredit && tx.amount > 0 && (
                                <p className="text-xs text-slate-400 mt-0.5">Trip fare: {tx.amount} | Cash: 0.0</p>
                              )}
                            </div>
                            <p className={`text-base font-black shrink-0 ${isCredit ? 'text-green-600' : 'text-red-500'}`}>
                              {isCredit ? '+' : '–'} ₹{tx.amount.toLocaleString('en-IN')}
                            </p>
                          </div>
                          {/* Reference number */}
                          <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-1.5 ml-[52px] font-mono">
                            {refNum} | {formatRefDate(tx.createdAt)}{tx.createdAt ? `, ${formatTime(tx.createdAt)}` : ''}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Add Money Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-[32px] p-6 pb-12 shadow-2xl animate-in slide-in-from-bottom duration-500" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-6"></div>

            {isSuccess ? (
              <div className="flex flex-col items-center py-10 animate-in zoom-in duration-300">
                <div className="size-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-4">
                  <span className="material-symbols-outlined text-5xl filled">check_circle</span>
                </div>
                <h3 className="text-2xl font-bold">Funds Added!</h3>
                <p className="text-slate-500 text-sm mt-2">Your balance has been updated.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold">Add Money</h3>
                  <button onClick={() => { setShowAddModal(false); setError(''); }} className="p-2 text-slate-400">
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                <div className="flex flex-col gap-5">
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-300">₹</span>
                    <input type="number" value={addAmount} onChange={e => setAddAmount(e.target.value)} placeholder="0"
                      className="w-full h-16 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl pl-10 pr-4 text-2xl font-black focus:ring-2 focus:ring-primary/20" />
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {[100, 500, 1000, 2000].map(amt => (
                      <button key={amt} onClick={() => setAddAmount(amt.toString())}
                        className="py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 hover:bg-primary/10 hover:text-primary transition-all active:scale-95">
                        +₹{amt}
                      </button>
                    ))}
                  </div>

                  {error && <p className="text-red-500 text-sm text-center font-medium">{error}</p>}

                  <button disabled={!addAmount || parseFloat(addAmount) <= 0 || isProcessing} onClick={handleAddMoney}
                    className="w-full bg-primary disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold h-14 rounded-2xl shadow-xl shadow-primary/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98]">
                    {isProcessing ? <><span className="material-symbols-outlined animate-spin">sync</span> Processing...</>
                      : <>Add ₹{addAmount || '0'}<span className="material-symbols-outlined">arrow_forward</span></>}
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
