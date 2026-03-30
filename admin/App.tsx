import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../src/firebase';
import { AdminAuthProvider, useAdminAuth } from './hooks/useAdminAuth';
import Login from './screens/Login';
import Layout from './screens/Layout';
import Dashboard from './screens/Dashboard';
import Trips from './screens/Trips';
import Drivers from './screens/Drivers';
import Customers from './screens/Customers';
import FareConfig from './screens/FareConfig';
import AdminUsers from './screens/AdminUsers';
import ActivityLogs from './screens/ActivityLogs';
import ServiceConfig from './screens/ServiceConfig';

/** Renders children only if the admin has the required permission */
function ProtectedRoute({ permission, children }: { permission: string; children: React.ReactNode }) {
  const { can } = useAdminAuth();
  if (!can(permission)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <span className="material-symbols-outlined text-red-400 text-5xl">lock</span>
          <p className="text-gray-500 mt-3 font-semibold">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

/** Super admin only route */
function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { isSuperAdmin } = useAdminAuth();
  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <span className="material-symbols-outlined text-red-400 text-5xl">admin_panel_settings</span>
          <p className="text-gray-500 mt-3 font-semibold">Only Super Admin can access this page.</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

function AdminRoutes() {
  const { loading, authenticated, isAdmin } = useAdminAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-primary-dark">
        <div className="text-center text-white">
          <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <div className="text-sm font-semibold opacity-70">Loading Admin Panel...</div>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return <Login onLogin={() => {}} />;
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="bg-white rounded-2xl p-8 shadow-lg max-w-sm w-full mx-4 text-center">
          <span className="material-symbols-outlined text-red-500 text-5xl">block</span>
          <h2 className="text-xl font-bold mt-3 text-gray-800">Access Denied</h2>
          <p className="text-gray-500 text-sm mt-2">Your account does not have admin privileges.</p>
          <button
            onClick={() => signOut(auth)}
            className="mt-6 w-full bg-primary text-white py-3 rounded-xl font-semibold text-sm hover:bg-primary-dark transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<ProtectedRoute permission="dashboard"><Dashboard /></ProtectedRoute>} />
          <Route path="/trips" element={<ProtectedRoute permission="trips"><Trips /></ProtectedRoute>} />
          <Route path="/drivers" element={<ProtectedRoute permission="drivers"><Drivers /></ProtectedRoute>} />
          <Route path="/customers" element={<ProtectedRoute permission="customers"><Customers /></ProtectedRoute>} />
          <Route path="/fare-config" element={<ProtectedRoute permission="fare_config"><FareConfig /></ProtectedRoute>} />
          <Route path="/admin-users" element={<SuperAdminRoute><AdminUsers /></SuperAdminRoute>} />
          <Route path="/activity-logs" element={<SuperAdminRoute><ActivityLogs /></SuperAdminRoute>} />
          <Route path="/service-config" element={<SuperAdminRoute><ServiceConfig /></SuperAdminRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}

export default function AdminApp() {
  return (
    <AdminAuthProvider>
      <AdminRoutes />
    </AdminAuthProvider>
  );
}
