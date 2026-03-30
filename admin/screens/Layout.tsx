import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../src/firebase';
import { useAdminAuth } from '../hooks/useAdminAuth';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  permission?: string;    // required permission (omit = always visible)
  superAdminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: 'dashboard', permission: 'dashboard' },
  { path: '/trips', label: 'Trips', icon: 'local_shipping', permission: 'trips' },
  { path: '/drivers', label: 'Drivers', icon: 'person_pin', permission: 'drivers' },
  { path: '/customers', label: 'Customers', icon: 'group', permission: 'customers' },
  { path: '/fare-config', label: 'Fare Config', icon: 'payments', permission: 'fare_config' },
  { path: '/service-config', label: 'Services & Vehicles', icon: 'toggle_on', superAdminOnly: true },
  { path: '/admin-users', label: 'Admin Users', icon: 'admin_panel_settings', superAdminOnly: true },
  { path: '/activity-logs', label: 'Activity Logs', icon: 'history', superAdminOnly: true },
];

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/trips': 'Trips',
  '/drivers': 'Drivers',
  '/customers': 'Customers',
  '/fare-config': 'Fare Configuration',
  '/service-config': 'Services & Vehicle Configuration',
  '/admin-users': 'Admin User Management',
  '/activity-logs': 'Activity Logs',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [signingOut, setSigningOut] = useState(false);
  const { name: adminName, email: adminEmail, adminRole, isSuperAdmin, can } = useAdminAuth();

  const handleSignOut = async () => {
    setSigningOut(true);
    try { await signOut(auth); } catch { setSigningOut(false); }
  };

  const pageTitle = PAGE_TITLES[location.pathname] || 'Admin Panel';

  // Filter nav items by permissions
  const visibleNav = NAV_ITEMS.filter(item => {
    if (item.superAdminOnly) return isSuperAdmin;
    if (item.permission) return can(item.permission);
    return true;
  });

  const roleBadge = isSuperAdmin
    ? { label: 'Super Admin', color: 'bg-amber-500' }
    : { label: 'Admin', color: 'bg-primary' };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 bg-primary-dark flex flex-col">
        {/* Brand */}
        <div className="px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-white text-xl">local_shipping</span>
            </div>
            <div>
              <div className="text-white font-black text-sm tracking-tight">JANGOES</div>
              <div className="text-white/40 text-[10px] font-semibold uppercase tracking-widest">Admin Panel</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {visibleNav.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-white/15 text-white'
                    : 'text-white/60 hover:text-white hover:bg-white/8'
                }`
              }
            >
              <span className="material-symbols-outlined text-xl">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User + Logout */}
        <div className="px-3 py-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">
                {adminName ? adminName.charAt(0).toUpperCase() : 'A'}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-white text-xs font-semibold truncate">{adminName}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`text-[8px] font-black text-white px-1.5 py-0.5 rounded ${roleBadge.color} uppercase tracking-widest`}>
                  {roleBadge.label}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-white/60 hover:text-white hover:bg-white/8 text-sm font-semibold transition-all disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-xl">logout</span>
            {signingOut ? 'Signing out...' : 'Sign Out'}
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-6 flex-shrink-0">
          <h1 className="text-lg font-bold text-gray-800">{pageTitle}</h1>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-gray-700">{adminName}</p>
              <p className="text-[10px] text-gray-400">{adminRole === 'SUPER_ADMIN' ? 'Super Administrator' : 'Administrator'}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
              <span className="text-white font-bold text-sm">
                {adminName ? adminName.charAt(0).toUpperCase() : 'A'}
              </span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
