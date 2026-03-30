import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../src/firebase';
import type { AdminRole } from '../rbac';

interface AdminAuthState {
  loading: boolean;
  authenticated: boolean;
  isAdmin: boolean;
  uid: string;
  name: string;
  email: string;
  adminRole: AdminRole | null;
  permissions: string[];
  isSuperAdmin: boolean;
  can: (permission: string) => boolean;
}

const defaultState: AdminAuthState = {
  loading: true,
  authenticated: false,
  isAdmin: false,
  uid: '',
  name: '',
  email: '',
  adminRole: null,
  permissions: [],
  isSuperAdmin: false,
  can: () => false,
};

const AdminAuthContext = createContext<AdminAuthState>(defaultState);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AdminAuthState>(defaultState);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({ ...defaultState, loading: false });
        return;
      }

      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (!snap.exists()) {
          setState({ ...defaultState, loading: false, authenticated: true });
          return;
        }

        const data = snap.data();
        const roles: string[] = data.roles || [data.role];
        const isAdminUser = roles.includes('ADMIN');

        if (!isAdminUser) {
          setState({ ...defaultState, loading: false, authenticated: true });
          return;
        }

        if (data.disabled === true) {
          setState({ ...defaultState, loading: false, authenticated: true });
          return;
        }

        const adminRole = (data.adminRole as AdminRole) || 'ADMIN';
        const permissions: string[] = data.permissions || [];
        const isSuperAdmin = adminRole === 'SUPER_ADMIN';

        setState({
          loading: false,
          authenticated: true,
          isAdmin: true,
          uid: user.uid,
          name: data.name || user.displayName || user.email || 'Admin',
          email: user.email || '',
          adminRole,
          permissions,
          isSuperAdmin,
          can: (perm: string) => isSuperAdmin || permissions.includes(perm),
        });
      } catch {
        setState({ ...defaultState, loading: false, authenticated: true });
      }
    });

    return unsub;
  }, []);

  return (
    <AdminAuthContext.Provider value={state}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  return useContext(AdminAuthContext);
}
