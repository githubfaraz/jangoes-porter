
import React from 'react';
import { useNavigate } from 'react-router-dom';

const DriverPayouts: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark overflow-x-hidden">
      <header className="flex items-center p-4 pb-2 justify-between sticky top-0 z-10 bg-white/95 dark:bg-background-dark/95 backdrop-blur-sm">
        <div 
          className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 border-2 border-primary" 
          style={{ backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuBhBI5Vdihy_QlKv8L0VboQNtkbFXBjp3Xyo2Cegm6UYR5JtwxTvqsjCbeZO79YIu65uKWkf3jJIINhNA-cscjQlLUBEPOk2kyIZ7CbHdg24inGzOBbuETSjBsXamci3rsfLBucjBQhP_MqiUMF_vlICW6qL-Wg3jCd13IREH5UtGNLYlCYelUWtyIw0F76nx2LinlVyJZB3Zbb1GGraMCE_zBBD8uVjAMSwtOxas0QEXyuW52IRYrD8kdWRTziDI_Of6eEJa_brg')` }}
        />
        <h2 className="text-lg font-bold flex-1 text-center pr-10">Payouts</h2>
        <button onClick={() => navigate('/help')} className="p-2"><span className="material-symbols-outlined">help</span></button>
      </header>

      <main className="flex-1 overflow-y-auto pb-28 px-4 no-scrollbar">
        <section className="flex flex-col items-center pt-6 pb-8">
          <p className="text-slate-500 text-sm font-medium uppercase tracking-wider mb-2">Available Balance</p>
          <h1 className="text-[40px] font-bold leading-tight mb-6">₹12,240.50</h1>
          <button className="w-full bg-primary hover:bg-primary-dark text-white font-bold h-14 rounded-xl shadow-lg flex items-center justify-center gap-2">
            <span className="material-symbols-outlined">account_balance</span>
            Withdraw to Bank
          </button>
          <p className="text-center text-[10px] text-slate-400 mt-3 flex items-center justify-center gap-1">
            <span className="material-symbols-outlined text-[14px]">lock</span>
            Secure transaction via Stripe
          </p>
        </section>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-white dark:bg-surface-dark rounded-xl p-4 flex flex-col gap-1 border border-slate-100">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-lg bg-green-500/10 text-green-500">
                <span className="material-symbols-outlined text-[20px]">trending_up</span>
              </div>
              <span className="text-xs text-slate-500 font-medium">Daily Earnings</span>
            </div>
            <p className="text-2xl font-bold">₹1,450.00</p>
            <p className="text-[9px] text-slate-400">Net after commission</p>
          </div>
          <div className="bg-white dark:bg-surface-dark rounded-xl p-4 flex flex-col gap-1 border border-slate-100">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-lg bg-blue-50 text-blue-500">
                <span className="material-symbols-outlined text-[20px]">calendar_view_week</span>
              </div>
              <span className="text-xs text-slate-500 font-medium">Weekly Payout</span>
            </div>
            <p className="text-2xl font-bold">₹8,500.00</p>
            <p className="text-[9px] text-slate-400">Current week total</p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-base font-bold">Recent Activity</h3>
            <button className="text-primary text-sm font-medium">See all</button>
          </div>
          {[
            { label: 'Delivery #4920', date: 'Today, 2:30 PM', amount: '+₹245.50', icon: 'local_shipping', color: 'text-primary' },
            { label: 'Weekly Bonus', date: 'Yesterday • Incentive', amount: '+₹500.00', icon: 'stars', color: 'text-purple-500' },
            { label: 'Withdrawal', date: 'Mon, 10:00 AM • Bank', amount: '-₹5000.00', icon: 'arrow_outward', color: 'text-slate-400' },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-white dark:bg-surface-dark rounded-xl shadow-sm border border-slate-50">
              <div className="flex items-center gap-3">
                <div className={`size-10 rounded-full bg-slate-50 flex items-center justify-center shrink-0 ${item.color}`}>
                  <span className="material-symbols-outlined">{item.icon}</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-sm">{item.label}</span>
                  <span className="text-slate-400 text-[10px]">{item.date}</span>
                </div>
              </div>
              <span className="font-bold text-sm">{item.amount}</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default DriverPayouts;
