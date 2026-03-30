import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../src/firebase';

export interface LogParams {
  action: string;
  target?: string;
  details: string;
  metadata?: Record<string, any>;
}

/**
 * Log an admin action to the adminLogs collection.
 * Automatically captures the current admin user's info.
 */
export async function logAdminAction(params: LogParams): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  try {
    await addDoc(collection(db, 'adminLogs'), {
      adminUid: user.uid,
      adminName: user.displayName || user.email || 'Admin',
      adminEmail: user.email || '',
      action: params.action,
      target: params.target || '',
      details: params.details,
      metadata: params.metadata || {},
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.error('[ActivityLog] Failed to log action:', err);
  }
}
