import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../src/firebase.ts';
import { uploadToCloudinary } from './cloudinaryUpload.ts';

// ── Helpers ──────────────────────────────────────────────────────────────────

export function namesMatch(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ');
  return norm(a) === norm(b);
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () =>
      resolve((reader.result as string).replace(/^data:image\/\w+;base64,/, ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function saveProgress(uid: string, data: Record<string, any>) {
  try {
    await updateDoc(doc(db, 'users', uid), data);
  } catch (e: any) {
    if (e?.code === 'not-found') {
      await setDoc(doc(db, 'users', uid), data, { merge: true });
    } else {
      throw e;
    }
  }
}

export const DL_STATES = [
  { name: 'Andhra Pradesh', code: 'AP' }, { name: 'Arunachal Pradesh', code: 'AR' },
  { name: 'Assam', code: 'AS' }, { name: 'Bihar', code: 'BR' },
  { name: 'Chhattisgarh', code: 'CG' }, { name: 'Delhi', code: 'DL' },
  { name: 'Goa', code: 'GA' }, { name: 'Gujarat', code: 'GJ' },
  { name: 'Haryana', code: 'HR' }, { name: 'Himachal Pradesh', code: 'HP' },
  { name: 'Jharkhand', code: 'JH' }, { name: 'Karnataka', code: 'KA' },
  { name: 'Kerala', code: 'KL' }, { name: 'Madhya Pradesh', code: 'MP' },
  { name: 'Maharashtra', code: 'MH' }, { name: 'Manipur', code: 'MN' },
  { name: 'Meghalaya', code: 'ML' }, { name: 'Mizoram', code: 'MZ' },
  { name: 'Nagaland', code: 'NL' }, { name: 'Odisha', code: 'OD' },
  { name: 'Punjab', code: 'PB' }, { name: 'Rajasthan', code: 'RJ' },
  { name: 'Sikkim', code: 'SK' }, { name: 'Tamil Nadu', code: 'TN' },
  { name: 'Telangana', code: 'TS' }, { name: 'Tripura', code: 'TR' },
  { name: 'Uttar Pradesh', code: 'UP' }, { name: 'Uttarakhand', code: 'UK' },
  { name: 'West Bengal', code: 'WB' },
];

// ── Auto-check all verified ─────────────────────────────────────────────────

async function checkAndSetAllVerified(uid: string) {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return;
  const kd = snap.data().kycData || {};
  const panOk = kd.panStatus === 'verified' || kd.panVerified === true;
  const dlOk = kd.dlStatus === 'verified' || kd.dlVerified === true;
  const rcOk = kd.rcVerifyStatus === 'verified' || kd.rcVerified === true;
  if (panOk && dlOk && rcOk) {
    await setDoc(doc(db, 'users', uid), { kycAllVerified: true, pendingDocNames: [] }, { merge: true });
  }
}

// ── PAN Re-submission ────────────────────────────────────────────────────────

export async function resubmitPan(
  uid: string, panFile: File, aadhaarName: string
): Promise<{ success: boolean; status?: string; error?: string }> {
  const base64 = await fileToBase64(panFile);
  const res = await fetch('/api/kyc/pan-ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64 }),
  });
  const data = await res.json();
  if (!data.success || !data.data) {
    return { success: false, error: data.message || 'Could not read PAN card. Try a clearer image.' };
  }

  const extracted = data.data;
  const ocrName = extracted.name || '';
  const matched = ocrName && aadhaarName && namesMatch(ocrName, aadhaarName);
  const status = matched ? 'verified' : 'pending_review';

  const imageUrl = await uploadToCloudinary(panFile, `kyc/${uid}/pan-card`);

  await saveProgress(uid, {
    'kycData.panVerified': matched,
    'kycData.panStatus': status,
    'kycData.panName': ocrName,
    'kycData.panNumber': extracted.pan_number || '',
    'kycData.panImageUrl': imageUrl,
    'kycData.panRejectReason': '',
  });

  // Update pendingDocNames
  await updatePendingDocNames(uid);
  if (status === 'verified') await checkAndSetAllVerified(uid);

  return { success: true, status };
}

// ── DL Re-submission ─────────────────────────────────────────────────────────

export async function resubmitDl(
  uid: string, dlState: string, dlNumber: string, dlDob: string, aadhaarName: string
): Promise<{ success: boolean; status?: string; error?: string }> {
  const stateObj = DL_STATES.find(s => s.code === dlState || s.name === dlState);
  const prefix = stateObj ? `${stateObj.code}-` : '';
  const fullNumber = prefix + dlNumber.trim();

  const res = await fetch('/api/kyc/driving-license', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_number: fullNumber, dob: dlDob }),
  });
  const data = await res.json();
  if (!data.success || !data.data) {
    return { success: false, error: data.message || 'Could not verify Driving License.' };
  }

  const extracted = data.data;
  const doe = extracted.doe || '';
  if (doe) {
    const expiryDate = new Date(doe);
    expiryDate.setHours(23, 59, 59, 999);
    if (expiryDate < new Date()) {
      return { success: false, error: `Your Driving License expired on ${doe}. Please renew and try again.` };
    }
  }

  const apiName = extracted.name || '';
  const matched = apiName && aadhaarName && namesMatch(apiName, aadhaarName);
  const status = matched ? 'verified' : 'pending_review';

  await saveProgress(uid, {
    'kycData.dlVerified': matched,
    'kycData.dlStatus': status,
    'kycData.dlName': apiName,
    'kycData.dlDoe': doe,
    'kycData.dlNumber': extracted.license_number || fullNumber,
    'kycData.dlState': stateObj?.code || dlState,
    'kycData.dlRejectReason': '',
  });

  await updatePendingDocNames(uid);
  if (status === 'verified') await checkAndSetAllVerified(uid);

  return { success: true, status };
}

// ── RC Re-submission ─────────────────────────────────────────────────────────

export async function resubmitRc(
  uid: string, rcNumber: string, aadhaarName: string
): Promise<{ success: boolean; status?: string; error?: string }> {
  const res = await fetch('/api/kyc/rc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_number: rcNumber.trim().toUpperCase() }),
  });
  const data = await res.json();
  if (!data.success || !data.data) {
    return { success: false, error: data.message || 'Could not verify RC number.' };
  }

  const e = data.data;

  if (!e.rc_number) return { success: false, error: 'RC number not found in response.' };

  const rcStatus = (e.rc_status || '').toUpperCase();
  if (rcStatus && rcStatus !== 'ACTIVE') {
    return { success: false, error: `RC status is "${e.rc_status}". Only Active RC accepted.` };
  }
  if (e.fit_up_to) {
    const exp = new Date(e.fit_up_to); exp.setHours(23, 59, 59, 999);
    if (exp < new Date()) return { success: false, error: `Vehicle fitness expired on ${e.fit_up_to}. Please renew.` };
  }
  if (e.insurance_upto) {
    const exp = new Date(e.insurance_upto); exp.setHours(23, 59, 59, 999);
    if (exp < new Date()) return { success: false, error: `Vehicle insurance expired on ${e.insurance_upto}. Please renew.` };
  }

  const ownerName = e.owner_name || '';
  const matched = ownerName && aadhaarName && namesMatch(ownerName, aadhaarName);
  const verifyStatus = matched ? 'verified' : 'pending_review';

  await saveProgress(uid, {
    'kycData.rcNumber': e.rc_number,
    'kycData.rcOwnerName': ownerName,
    'kycData.rcRegistrationDate': e.registration_date || '',
    'kycData.rcFitnessExpiry': e.fit_up_to || '',
    'kycData.rcInsuranceValidity': e.insurance_upto || '',
    'kycData.rcStatus': e.rc_status || '',
    'kycData.rcMakerModel': e.maker_model || '',
    'kycData.rcFuelType': e.fuel_type || '',
    'kycData.rcVerified': matched,
    'kycData.rcVerifyStatus': verifyStatus,
    'kycData.rcRejectReason': '',
  });

  await updatePendingDocNames(uid);
  if (verifyStatus === 'verified') await checkAndSetAllVerified(uid);

  return { success: true, status: verifyStatus };
}

// ── Update pendingDocNames array ─────────────────────────────────────────────

async function updatePendingDocNames(uid: string) {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return;
  const kd = snap.data().kycData || {};
  const names: string[] = [];
  if (kd.panStatus === 'pending_review') names.push('PAN Card');
  if (kd.dlStatus === 'pending_review') names.push('Driving License');
  if (kd.rcVerifyStatus === 'pending_review') names.push('RC / Vehicle Registration');
  await setDoc(doc(db, 'users', uid), { pendingDocNames: names }, { merge: true });
}
