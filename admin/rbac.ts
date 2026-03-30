/** Role-Based Access Control definitions for Admin Panel */

export type AdminRole = 'SUPER_ADMIN' | 'ADMIN';

export interface AdminPermissionDef {
  key: string;
  label: string;
  description: string;
  group: string;
}

export const PERMISSIONS: AdminPermissionDef[] = [
  { key: 'dashboard',       label: 'View Dashboard',       description: 'Access dashboard statistics',         group: 'Dashboard' },
  { key: 'trips',           label: 'View Trips',           description: 'View all trip records',               group: 'Trips' },
  { key: 'drivers',         label: 'View Drivers',         description: 'View driver list and profiles',       group: 'Drivers' },
  { key: 'drivers.review',  label: 'Review Driver Docs',   description: 'Approve or reject KYC documents',     group: 'Drivers' },
  { key: 'customers',       label: 'View Customers',       description: 'View customer list',                  group: 'Customers' },
  { key: 'fare_config',     label: 'View Fare Config',     description: 'View fare rate configuration',        group: 'Fare Config' },
  { key: 'fare_config.edit',label: 'Edit Fare Config',     description: 'Modify vehicle fare rates',           group: 'Fare Config' },
];

export const PERMISSION_GROUPS = [...new Set(PERMISSIONS.map(p => p.group))];

export function hasPermission(userPermissions: string[], required: string): boolean {
  return userPermissions.includes(required);
}

export interface AdminUser {
  uid: string;
  name: string;
  email: string;
  adminRole: AdminRole;
  permissions: string[];
  disabled?: boolean;
  createdBy?: string;
  createdAt?: string;
}
