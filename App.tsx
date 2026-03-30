import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { UserRole } from './types.ts';
import { auth, db } from './src/firebase.ts';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { extractKycData } from './services/kycHelper.ts';

// Auth Components
import AuthScreen from './screens/AuthScreen.tsx';
import OTPScreen from './screens/OTPScreen.tsx';

// Customer Screens
import CustomerHome from './screens/customer/Home.tsx';
import SearchLocation from './screens/customer/SearchLocation.tsx';
import ParcelDetails from './screens/customer/ParcelDetails.tsx';
import ParcelDimensions from './screens/customer/ParcelDimensions.tsx';
import VehicleSelection from './screens/customer/VehicleSelection.tsx';
import OrderSummary from './screens/customer/OrderSummary.tsx';
import Tracking from './screens/customer/Tracking.tsx';
import CustomerWallet from './screens/customer/Wallet.tsx';
import CustomerProfile from './screens/customer/Profile.tsx';
import Services from './screens/customer/Services.tsx';
import ExchangeDetails from './screens/customer/ExchangeDetails.tsx';

// Driver Screens
import DriverDashboard from './screens/driver/Dashboard.tsx';
import DriverPayouts from './screens/driver/Payouts.tsx';
import DriverProfile from './screens/driver/Profile.tsx';
import RegistrationFlow from './screens/driver/RegistrationFlow.tsx';
import ActiveTrip from './screens/driver/ActiveTrip.tsx';
import PendingVerification from './screens/driver/PendingVerification.tsx';

// Shared
import HelpSupport from './screens/shared/HelpSupport.tsx';
import ChatScreen from './screens/shared/ChatScreen.tsx';
import OrderHistory from './screens/shared/OrderHistory.tsx';
import SetupProfile from './screens/shared/SetupProfile.tsx';

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>(UserRole.CUSTOMER);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [isKycDone, setIsKycDone] = useState(false);
  const [isKycVerified, setIsKycVerified] = useState(false);
  const [isProfileComplete, setIsProfileComplete] = useState(false);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    let unsubFirestore: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      console.log('[APP] onAuthStateChanged —', user ? `uid: ${user.uid}` : 'NULL (no user)');
      // Clean up previous Firestore listener
      if (unsubFirestore) { unsubFirestore(); unsubFirestore = null; }

      if (user) {
        setIsLoggedIn(true);
        // Real-time listener so admin approval instantly unlocks the dashboard
        unsubFirestore = onSnapshot(
          doc(db, 'users', user.uid),
          (snap) => {
            console.log('[APP] onSnapshot — exists:', snap.exists(), 'uid:', user.uid);
            if (snap.exists()) {
              const d = snap.data();
              const kycDone = d.kycCompleted || false;
              const kycVerified = d.kycAllVerified === true;

              console.log('[APP] onSnapshot fired —', {
                kycCompleted: d.kycCompleted,
                kycAllVerified: d.kycAllVerified,
                kycDone,
                kycVerified,
                role: d.role,
                name: d.name,
              });

              const roles: string[] = d.roles || [d.role];
              setUserRoles(roles);
              setUserRole(d.role as UserRole);
              setIsKycDone(kycDone);
              setIsKycVerified(kycVerified);
              setIsProfileComplete(!!(d.name));
            } else {
              console.log('[APP] User document does not exist yet — waiting for creation');
            }
            setLoading(false);
          },
          (error) => {
            console.error('[APP] onSnapshot ERROR:', error.code, error.message);
            // Don't sign out on permission errors — the document might not exist yet
            setLoading(false);
          }
        );
      } else {
        console.log('[APP] onAuthStateChanged — user is null (logged out)');
        setIsLoggedIn(false);
        setUserRole(UserRole.CUSTOMER);
        setIsKycDone(false);
        setIsKycVerified(false);
        setIsProfileComplete(false);
        setLoading(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubFirestore) unsubFirestore();
    };
  }, []);

  const handleLogin = (role: UserRole) => {
    setUserRole(role);
    setIsLoggedIn(true);
  };

  const handleSwitchRole = async () => {
    const newRole = userRole === UserRole.CUSTOMER ? UserRole.DRIVER : UserRole.CUSTOMER;
    if (!userRoles.includes(newRole)) return;
    const user = auth.currentUser;
    if (user) {
      // Update active role in Firestore
      const { setDoc: sd } = await import('firebase/firestore');
      await sd(doc(db, 'users', user.uid), { role: newRole }, { merge: true });
    }
    setUserRole(newRole);
  };

  const canSwitchRole = userRoles.length > 1 || (userRole === UserRole.CUSTOMER && userRoles.includes(UserRole.DRIVER));

  const handleLogout = async () => {
    await signOut(auth);
    setIsLoggedIn(false);
    setIsKycDone(false);
    setIsKycVerified(false);
    setIsProfileComplete(false);
  };

  const completeProfile = () => setIsProfileComplete(true);

  const completeKyc = () => {
    setIsKycDone(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="flex flex-col items-center gap-6">
          <div className="relative flex items-center justify-center">
            <div className="absolute w-20 h-20 border-4 border-primary/10 rounded-full"></div>
            <div className="absolute w-20 h-20 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <span className="material-symbols-outlined text-primary text-3xl">local_shipping</span>
          </div>
          <span className="font-black text-2xl tracking-tighter text-primary">JANGOES.COM</span>
        </div>
      </div>
    );
  }

  return (
    <HashRouter>
      <div className="mx-auto max-w-md min-h-screen bg-background-light dark:bg-background-dark shadow-2xl relative flex flex-col overflow-x-hidden">
        <Routes>
          {!isLoggedIn ? (
            <>
              <Route path="/auth" element={<AuthScreen onLogin={handleLogin} />} />
              <Route path="/otp" element={<OTPScreen onVerify={(role) => handleLogin(role)} />} />
              <Route path="*" element={<Navigate to="/auth" />} />
            </>
          ) : (
            <>
              <Route path="/help" element={<HelpSupport />} />
              <Route path="/chat" element={<ChatScreen />} />
              <Route path="/activity" element={<OrderHistory />} />

              {userRole === UserRole.CUSTOMER ? (
                <>
                  {!isProfileComplete ? (
                    <>
                      <Route path="/setup-profile" element={<SetupProfile onComplete={completeProfile} />} />
                      <Route path="*" element={<Navigate to="/setup-profile" />} />
                    </>
                  ) : (
                    <>
                      <Route path="/home" element={<CustomerHome />} />
                      <Route path="/services" element={<Services />} />
                      <Route path="/search" element={<SearchLocation />} />
                      <Route path="/parcel-details" element={<ParcelDetails />} />
                      <Route path="/parcel-dimensions" element={<ParcelDimensions />} />
                      <Route path="/exchange-details" element={<ExchangeDetails />} />
                      <Route path="/vehicles" element={<VehicleSelection />} />
                      <Route path="/summary" element={<OrderSummary />} />
                      <Route path="/tracking" element={<Tracking />} />
                      <Route path="/wallet" element={<CustomerWallet />} />
                      <Route path="/profile" element={<CustomerProfile onLogout={handleLogout} canSwitchRole={userRoles.includes(UserRole.DRIVER)} onSwitchRole={handleSwitchRole} />} />
                      <Route path="*" element={<Navigate to="/home" />} />
                    </>
                  )}
                </>
              ) : (
                <>
                  {/* Driver Route Protection: Registration → Pending Verification → Dashboard */}
                  {console.log('[APP] Routing decision — isKycDone:', isKycDone, 'isKycVerified:', isKycVerified)}
                  {!isKycDone ? (
                    <>
                      <Route path="/registration" element={<RegistrationFlow onComplete={completeKyc} />} />
                      <Route path="*" element={<Navigate to="/registration" />} />
                    </>
                  ) : !isKycVerified ? (
                    <>
                      <Route path="/pending-verification" element={
                        <PendingVerification onVerified={() => setIsKycVerified(true)} />
                      } />
                      <Route path="/help" element={<HelpSupport />} />
                      <Route path="*" element={<Navigate to="/pending-verification" />} />
                    </>
                  ) : (
                    <>
                      <Route path="/dashboard" element={<DriverDashboard />} />
                      <Route path="/payouts" element={<DriverPayouts />} />
                      <Route path="/active-trip" element={<ActiveTrip />} />
                      <Route path="/profile" element={<DriverProfile onLogout={handleLogout} canSwitchRole={userRoles.includes(UserRole.CUSTOMER)} onSwitchRole={handleSwitchRole} />} />
                      <Route path="*" element={<Navigate to="/dashboard" />} />
                    </>
                  )}
                </>
              )}
            </>
          )}
        </Routes>
        
        {isLoggedIn && ((userRole === UserRole.CUSTOMER && isProfileComplete) || (userRole === UserRole.DRIVER && isKycDone && isKycVerified)) && <BottomNav role={userRole} />}
      </div>
    </HashRouter>
  );
};

const BottomNav: React.FC<{ role: UserRole }> = ({ role }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const hideOnPaths = [
    '/parcel-details',
    '/parcel-dimensions',
    '/exchange-details', 
    '/vehicles', 
    '/summary', 
    '/tracking', 
    '/search',
    '/registration',
    '/pending-verification',
    '/active-trip',
    '/services',
    '/auth',
    '/otp',
    '/setup-profile'
  ];
  
  if (hideOnPaths.includes(location.pathname)) return null;

  const items = role === UserRole.CUSTOMER ? [
    { label: 'Home', icon: 'home', path: '/home' },
    { label: 'Activity', icon: 'history', path: '/activity' },
    { label: 'Wallet', icon: 'account_balance_wallet', path: '/wallet' },
    { label: 'Profile', icon: 'person', path: '/profile' },
  ] : [
    { label: 'Home', icon: 'home', path: '/dashboard' },
    { label: 'Payouts', icon: 'payments', path: '/payouts' },
    { label: 'History', icon: 'history', path: '/activity' },
    { label: 'Profile', icon: 'person', path: '/profile' },
  ];

  return (
    <nav className="fixed bottom-0 max-w-md w-full bg-white dark:bg-surface-dark border-t border-slate-100 dark:border-slate-800 py-3 pb-6 flex justify-around items-center z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      {items.map((item) => (
        <button
          key={item.label}
          onClick={() => navigate(item.path)}
          className={`flex flex-col items-center gap-1 transition-colors ${
            location.pathname === item.path ? 'text-primary' : 'text-slate-400'
          }`}
        >
          <span className={`material-symbols-outlined text-[24px] ${location.pathname === item.path ? 'filled' : ''}`}>
            {item.icon}
          </span>
          <span className="text-[10px] font-medium">{item.label}</span>
        </button>
      ))}
    </nav>
  );
};

export default App;