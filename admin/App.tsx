import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../src/firebase';
import Login from './screens/Login';
import Layout from './screens/Layout';
import Dashboard from './screens/Dashboard';
import Trips from './screens/Trips';
import Drivers from './screens/Drivers';
import Customers from './screens/Customers';

type AuthState = 'loading' | 'unauthenticated' | 'admin' | 'not-admin';

export default function AdminApp() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAuthState('unauthenticated');
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists() && snap.data()?.role === 'ADMIN') {
          setAdminName(snap.data()?.name || user.email || 'Admin');
          setAdminEmail(user.email || '');
          setAuthState('admin');
        } else {
          await signOut(auth);
          setAuthState('not-admin');
        }
      } catch {
        await signOut(auth);
        setAuthState('unauthenticated');
      }
    });
    return unsub;
  }, []);

  if (authState === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen bg-primary-dark">
        <div className="text-center text-white">
          <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <div className="text-sm font-semibold opacity-70">Loading Admin Panel...</div>
        </div>
      </div>
    );
  }

  if (authState === 'not-admin') {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="bg-white rounded-2xl p-8 shadow-lg max-w-sm w-full mx-4 text-center">
          <span className="material-symbols-outlined text-red-500 text-5xl">block</span>
          <h2 className="text-xl font-bold mt-3 text-gray-800">Access Denied</h2>
          <p className="text-gray-500 text-sm mt-2">
            Your account does not have admin privileges.
          </p>
          <button
            onClick={() => { signOut(auth); setAuthState('unauthenticated'); }}
            className="mt-6 w-full bg-primary text-white py-3 rounded-xl font-semibold text-sm hover:bg-primary-dark transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  if (authState === 'unauthenticated') {
    return <Login onLogin={() => {}} />;
  }

  return (
    <HashRouter>
      <Layout adminName={adminName} adminEmail={adminEmail}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/trips" element={<Trips />} />
          <Route path="/drivers" element={<Drivers />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}
