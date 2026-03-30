import React, { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../src/firebase';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { PERMISSIONS, PERMISSION_GROUPS, type AdminRole } from '../rbac';
import { logAdminAction } from '../services/activityLog';

interface AdminUserDoc {
  id: string;
  name: string;
  email: string;
  adminRole: AdminRole;
  permissions: string[];
  disabled?: boolean;
  createdAt?: any;
}

function formatDate(ts: any) {
  if (!ts) return '\u2014';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ------------------------------------------------------------------ */
/*  Modal backdrop                                                     */
/* ------------------------------------------------------------------ */
function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Permission checkboxes grouped                                      */
/* ------------------------------------------------------------------ */
function PermissionCheckboxes({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (perms: string[]) => void;
}) {
  const toggle = (key: string) => {
    onChange(selected.includes(key) ? selected.filter(k => k !== key) : [...selected, key]);
  };

  const selectAll = () => onChange(PERMISSIONS.map(p => p.key));
  const clearAll = () => onChange([]);

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <button type="button" onClick={selectAll} className="text-xs text-primary font-semibold hover:underline">
          Select all
        </button>
        <button type="button" onClick={clearAll} className="text-xs text-gray-400 font-semibold hover:underline">
          Clear all
        </button>
      </div>
      {PERMISSION_GROUPS.map(group => (
        <div key={group}>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">{group}</p>
          <div className="space-y-1.5">
            {PERMISSIONS.filter(p => p.group === group).map(perm => (
              <label key={perm.key} className="flex items-start gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selected.includes(perm.key)}
                  onChange={() => toggle(perm.key)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <div>
                  <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900">{perm.label}</p>
                  <p className="text-xs text-gray-400">{perm.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */
export default function AdminUsers() {
  const { isSuperAdmin, uid: myUid, name: myName } = useAdminAuth();

  const [admins, setAdmins] = useState<AdminUserDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createPerms, setCreatePerms] = useState<string[]>([]);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState('');

  // Edit modal
  const [editUser, setEditUser] = useState<AdminUserDoc | null>(null);
  const [editPerms, setEditPerms] = useState<string[]>([]);
  const [editBusy, setEditBusy] = useState(false);

  /* ---- access guard ---- */
  if (!isSuperAdmin) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700">
        <span className="material-symbols-outlined align-middle mr-2">lock</span>
        Access denied. Only Super Admins can manage admin users.
      </div>
    );
  }

  /* ---- fetch admins ---- */
  const loadAdmins = async () => {
    setLoading(true);
    setError('');
    try {
      // Query users where role or roles contain ADMIN
      const snap = await getDocs(collection(db, 'users'));
      const list: AdminUserDoc[] = [];
      snap.forEach(d => {
        const data = d.data();
        const roles: string[] = data.roles || [data.role];
        if (roles.includes('ADMIN')) {
          list.push({
            id: d.id,
            name: data.name || '',
            email: data.email || '',
            adminRole: data.adminRole || 'ADMIN',
            permissions: data.permissions || [],
            disabled: data.disabled || false,
            createdAt: data.createdAt,
          });
        }
      });
      list.sort((a, b) => {
        // Super admins first, then by name
        if (a.adminRole === 'SUPER_ADMIN' && b.adminRole !== 'SUPER_ADMIN') return -1;
        if (b.adminRole === 'SUPER_ADMIN' && a.adminRole !== 'SUPER_ADMIN') return 1;
        return (a.name || '').localeCompare(b.name || '');
      });
      setAdmins(list);
    } catch (err: any) {
      setError('Failed to load admin users.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdmins();
  }, []);

  /* ---- filtered list ---- */
  const filtered = useMemo(() => {
    if (!search.trim()) return admins;
    const q = search.toLowerCase();
    return admins.filter(
      a => a.name?.toLowerCase().includes(q) || a.email?.toLowerCase().includes(q)
    );
  }, [admins, search]);

  /* ---- create admin ---- */
  const handleCreate = async () => {
    const email = createEmail.trim().toLowerCase();
    if (!email) {
      setCreateError('Please enter an email address.');
      return;
    }
    setCreateBusy(true);
    setCreateError('');
    try {
      // Search for an existing user by email
      const snap = await getDocs(query(collection(db, 'users'), where('email', '==', email)));
      if (snap.empty) {
        setCreateError('No user found with this email. The user must already have an account.');
        setCreateBusy(false);
        return;
      }

      const userDoc = snap.docs[0];
      const userData = userDoc.data();

      // Don't allow promoting someone who is already a SUPER_ADMIN
      if (userData.adminRole === 'SUPER_ADMIN') {
        setCreateError('This user is already a Super Admin.');
        setCreateBusy(false);
        return;
      }

      // Update user doc with admin role and permissions
      const existingRoles: string[] = userData.roles || [userData.role].filter(Boolean);
      const roles = existingRoles.includes('ADMIN') ? existingRoles : [...existingRoles, 'ADMIN'];

      await updateDoc(doc(db, 'users', userDoc.id), {
        roles,
        adminRole: 'ADMIN' as AdminRole,
        permissions: createPerms,
      });

      await logAdminAction({
        action: 'CREATE_ADMIN',
        target: userDoc.id,
        details: `Granted admin access to ${userData.name || email}`,
        metadata: { email, permissions: createPerms },
      });

      setShowCreate(false);
      setCreateEmail('');
      setCreatePerms([]);
      await loadAdmins();
    } catch (err: any) {
      setCreateError('Failed to create admin. ' + (err.message || ''));
      console.error(err);
    } finally {
      setCreateBusy(false);
    }
  };

  /* ---- edit permissions ---- */
  const openEdit = (user: AdminUserDoc) => {
    setEditUser(user);
    setEditPerms([...user.permissions]);
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    setEditBusy(true);
    try {
      await updateDoc(doc(db, 'users', editUser.id), {
        permissions: editPerms,
      });

      await logAdminAction({
        action: 'UPDATE_PERMISSIONS',
        target: editUser.id,
        details: `Updated permissions for ${editUser.name || editUser.email}`,
        metadata: { permissions: editPerms },
      });

      setEditUser(null);
      await loadAdmins();
    } catch (err: any) {
      console.error(err);
    } finally {
      setEditBusy(false);
    }
  };

  /* ---- disable / enable ---- */
  const handleToggleDisable = async (user: AdminUserDoc) => {
    // Don't allow disabling yourself
    if (user.id === myUid) return;
    // Don't allow disabling other SUPER_ADMINs
    if (user.adminRole === 'SUPER_ADMIN') return;

    const newDisabled = !user.disabled;
    try {
      await updateDoc(doc(db, 'users', user.id), { disabled: newDisabled });

      await logAdminAction({
        action: newDisabled ? 'DISABLE_ADMIN' : 'ENABLE_ADMIN',
        target: user.id,
        details: `${newDisabled ? 'Disabled' : 'Enabled'} admin ${user.name || user.email}`,
      });

      await loadAdmins();
    } catch (err: any) {
      console.error(err);
    }
  };

  /* ---- permission label helper ---- */
  const permLabel = (key: string) => PERMISSIONS.find(p => p.key === key)?.label || key;

  /* ---- render ---- */
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <div className="w-10 h-10 border-4 border-gray-200 border-t-primary rounded-full animate-spin" />
          <span className="text-sm">Loading admin users...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700">
        <span className="material-symbols-outlined align-middle mr-2">error</span>{error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Admins', value: admins.length, icon: 'admin_panel_settings', color: 'bg-purple-50 text-purple-600' },
          { label: 'Active', value: admins.filter(a => !a.disabled).length, icon: 'check_circle', color: 'bg-green-50 text-green-600' },
          { label: 'Disabled', value: admins.filter(a => a.disabled).length, icon: 'block', color: 'bg-red-50 text-red-600' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.color}`}>
              <span className="material-symbols-outlined text-xl">{stat.icon}</span>
            </div>
            <div>
              <p className="text-2xl font-black text-gray-800">{stat.value}</p>
              <p className="text-xs text-gray-400 font-semibold">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters + Create Button */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 flex-1 min-w-48">
          <span className="material-symbols-outlined text-gray-400 text-xl">search</span>
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 text-sm focus:outline-none text-gray-700 placeholder-gray-400"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          )}
        </div>
        <span className="text-xs text-gray-400 font-semibold">{filtered.length} admins</span>
        <button
          onClick={() => {
            setShowCreate(true);
            setCreateEmail('');
            setCreatePerms([]);
            setCreateError('');
          }}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <span className="material-symbols-outlined text-lg">person_add</span>
          Create Admin
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <span className="material-symbols-outlined text-5xl">admin_panel_settings</span>
            <p className="mt-2 text-sm">No admin users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Admin</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Permissions</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Created</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(admin => (
                  <tr key={admin.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-purple-600 font-bold text-sm">
                            {admin.name?.charAt(0)?.toUpperCase() || '?'}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">
                            {admin.name || '\u2014'}
                            {admin.id === myUid && (
                              <span className="ml-1.5 text-xs text-gray-400 font-normal">(you)</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{admin.email || '\u2014'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                          admin.adminRole === 'SUPER_ADMIN'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-blue-50 text-blue-600'
                        }`}
                      >
                        <span className="material-symbols-outlined text-xs">
                          {admin.adminRole === 'SUPER_ADMIN' ? 'shield' : 'verified_user'}
                        </span>
                        {admin.adminRole === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {admin.adminRole === 'SUPER_ADMIN' ? (
                        <span className="text-xs text-amber-600 font-medium">All permissions</span>
                      ) : admin.permissions.length === 0 ? (
                        <span className="text-xs text-gray-400">None</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {admin.permissions.slice(0, 3).map(p => (
                            <span key={p} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                              {permLabel(p)}
                            </span>
                          ))}
                          {admin.permissions.length > 3 && (
                            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">
                              +{admin.permissions.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                          admin.disabled
                            ? 'bg-red-50 text-red-600'
                            : 'bg-green-50 text-green-600'
                        }`}
                      >
                        <span className="material-symbols-outlined text-xs">
                          {admin.disabled ? 'block' : 'check_circle'}
                        </span>
                        {admin.disabled ? 'Disabled' : 'Active'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{formatDate(admin.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {/* Edit permissions (not for super admins) */}
                        {admin.adminRole !== 'SUPER_ADMIN' && (
                          <button
                            onClick={() => openEdit(admin)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                            title="Edit permissions"
                          >
                            <span className="material-symbols-outlined text-lg">edit</span>
                          </button>
                        )}
                        {/* Disable/Enable (not for self or super admins) */}
                        {admin.id !== myUid && admin.adminRole !== 'SUPER_ADMIN' && (
                          <button
                            onClick={() => handleToggleDisable(admin)}
                            className={`p-1.5 rounded-lg hover:bg-gray-100 transition-colors ${
                              admin.disabled
                                ? 'text-green-500 hover:text-green-700'
                                : 'text-red-400 hover:text-red-600'
                            }`}
                            title={admin.disabled ? 'Enable admin' : 'Disable admin'}
                          >
                            <span className="material-symbols-outlined text-lg">
                              {admin.disabled ? 'toggle_on' : 'toggle_off'}
                            </span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---- Create Admin Modal ---- */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)}>
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">Create Admin</h2>
            <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <p className="text-xs text-gray-400 bg-gray-50 rounded-xl p-3">
            <span className="material-symbols-outlined text-sm align-middle mr-1">info</span>
            The user must already have an account (signed in via Google at least once). Enter their Google email to grant admin access.
          </p>

          {createError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
              {createError}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email address</label>
            <input
              type="email"
              value={createEmail}
              onChange={e => setCreateEmail(e.target.value)}
              placeholder="admin@example.com"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Role</label>
            <div className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 text-gray-600">
              Admin
              <span className="text-xs text-gray-400 ml-2">(Super Admin can only be set in database)</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Permissions</label>
            <PermissionCheckboxes selected={createPerms} onChange={setCreatePerms} />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowCreate(false)}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={createBusy}
              className="flex-1 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {createBusy ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating...
                </span>
              ) : (
                'Grant Admin Access'
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* ---- Edit Permissions Modal ---- */}
      <Modal open={!!editUser} onClose={() => setEditUser(null)}>
        {editUser && (
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">Edit Permissions</h2>
              <button onClick={() => setEditUser(null)} className="text-gray-400 hover:text-gray-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <span className="text-purple-600 font-bold">{editUser.name?.charAt(0)?.toUpperCase() || '?'}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">{editUser.name || '\u2014'}</p>
                <p className="text-xs text-gray-400">{editUser.email}</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Permissions</label>
              <PermissionCheckboxes selected={editPerms} onChange={setEditPerms} />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setEditUser(null)}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editBusy}
                className="flex-1 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {editBusy ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </span>
                ) : (
                  'Save Permissions'
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
