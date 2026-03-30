import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../src/firebase.ts';
import { uploadToCloudinary } from '../../services/cloudinaryUpload.ts';
import { extractKycData } from '../../services/kycHelper.ts';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';

interface RegistrationFlowProps {
  onComplete: () => void;
}

const STEPS = [
  { id: 1, title: 'Your Name',       subtitle: 'As printed on Aadhaar card',  icon: 'badge'          },
  { id: 2, title: 'Aadhaar Front',   subtitle: '',                             icon: 'credit_card'    },
  { id: 3, title: 'Aadhaar Back',    subtitle: 'Address extraction',           icon: 'home_pin'       },
  { id: 4, title: 'PAN Card',        subtitle: 'Front image upload',           icon: 'badge'          },
  { id: 5, title: 'Driving License', subtitle: 'State & license number',        icon: 'id_card'        },
  { id: 6, title: 'RC Verification',   subtitle: 'Vehicle registration number', icon: 'directions_car' },
  { id: 7, title: 'Vehicle Photos',    subtitle: 'Min 3, max 6 images',         icon: 'photo_camera'   },
  { id: 8, title: 'Your Selfie',       subtitle: 'Clear photo of your face',     icon: 'face'           },
];

const DL_STATES = [
  { name: 'Andhra Pradesh',    code: 'AP' },
  { name: 'Arunachal Pradesh', code: 'AR' },
  { name: 'Assam',             code: 'AS' },
  { name: 'Bihar',             code: 'BR' },
  { name: 'Chhattisgarh',      code: 'CG' },
  { name: 'Delhi',             code: 'DL' },
  { name: 'Goa',               code: 'GA' },
  { name: 'Gujarat',           code: 'GJ' },
  { name: 'Haryana',           code: 'HR' },
  { name: 'Himachal Pradesh',  code: 'HP' },
  { name: 'Jharkhand',         code: 'JH' },
  { name: 'Karnataka',         code: 'KA' },
  { name: 'Kerala',            code: 'KL' },
  { name: 'Madhya Pradesh',    code: 'MP' },
  { name: 'Maharashtra',       code: 'MH' },
  { name: 'Manipur',           code: 'MN' },
  { name: 'Meghalaya',         code: 'ML' },
  { name: 'Mizoram',           code: 'MZ' },
  { name: 'Nagaland',          code: 'NL' },
  { name: 'Odisha',            code: 'OD' },
  { name: 'Punjab',            code: 'PB' },
  { name: 'Rajasthan',         code: 'RJ' },
  { name: 'Sikkim',            code: 'SK' },
  { name: 'Tamil Nadu',        code: 'TN' },
  { name: 'Telangana',         code: 'TS' },
  { name: 'Tripura',           code: 'TR' },
  { name: 'Uttar Pradesh',     code: 'UP' },
  { name: 'Uttarakhand',       code: 'UK' },
  { name: 'West Bengal',       code: 'WB' },
];

// Strict case-insensitive exact match
function namesMatch(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ');
  return norm(a) === norm(b);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () =>
      resolve((reader.result as string).replace(/^data:image\/\w+;base64,/, ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Save progress silently using dot-notation for nested kycData fields
async function saveProgress(uid: string, data: Record<string, any>) {
  try {
    // updateDoc treats dot-notation (e.g. 'kycData.panStatus') as nested field paths.
    // setDoc with merge does NOT — it stores them as flat string keys.
    await updateDoc(doc(db, 'users', uid), data);
  } catch (e: any) {
    // If document doesn't exist yet, fall back to setDoc
    if (e?.code === 'not-found') {
      await setDoc(doc(db, 'users', uid), data, { merge: true });
    } else {
      console.warn('[KYC] Progress save failed:', e);
    }
  }
}

function VerifiedCard({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-3xl p-5 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <div className="size-7 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-white text-sm">check</span>
        </div>
        <span className="font-black text-green-700 dark:text-green-400 text-sm">Verified Successfully</span>
      </div>
      {items.map(item => (
        <div key={item.label} className="flex justify-between items-start gap-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">{item.label}</span>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 text-right">{item.value || '—'}</span>
        </div>
      ))}
    </div>
  );
}

function PendingCard({ message }: { message: string }) {
  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-700 rounded-3xl p-5 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <div className="size-7 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-white text-sm">schedule</span>
        </div>
        <span className="font-black text-amber-700 dark:text-amber-400 text-sm">Pending Review</span>
      </div>
      <p className="text-sm text-amber-800 dark:text-amber-300 font-medium leading-relaxed">{message}</p>
    </div>
  );
}

const RegistrationFlow: React.FC<RegistrationFlowProps> = ({ onComplete }) => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [resuming, setResuming] = useState(true);
  const [error, setError] = useState('');

  // Step 1 — Name
  const [driverName, setDriverName] = useState('');

  // Step 2 — Aadhaar Front
  const frontInputRef = useRef<HTMLInputElement>(null);
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState('');
  const [frontData, setFrontData] = useState<any>(null);

  // Step 3 — Aadhaar Back
  const backInputRef = useRef<HTMLInputElement>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [backPreview, setBackPreview] = useState('');
  const [backData, setBackData] = useState<any>(null);

  // Step 4 — PAN Front
  const panInputRef = useRef<HTMLInputElement>(null);
  const [panFile, setPanFile] = useState<File | null>(null);
  const [panPreview, setPanPreview] = useState('');
  const [panData, setPanData] = useState<any>(null);

  // Step 5 — Driving License
  const [dlState, setDlState] = useState('');
  const [dlNumber, setDlNumber] = useState('');
  const [dlDob, setDlDob] = useState('');
  const [dlData, setDlData] = useState<any>(null);

  // Step 6 — RC Verification + Vehicle Category
  const [rcNumber, setRcNumber] = useState('');
  const [rcData, setRcData] = useState<any>(null);
  const [vehicleCategory, setVehicleCategory] = useState('');

  // Step 7 — Vehicle Photos
  const vehicleInputRef = useRef<HTMLInputElement>(null);
  const [vehicleImages, setVehicleImages] = useState<{ file: File; preview: string }[]>([]);
  const [vehicleUploaded, setVehicleUploaded] = useState(false); // true once URLs saved to Firestore

  const VEHICLE_MIN = 3;
  const VEHICLE_MAX = 6;


  // Step 8 — Selfie
  const selfieGalleryRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState('');
  const [selfieUploaded, setSelfieUploaded] = useState(false);
  const [selfieUrl, setSelfieUrl] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');

  // ── Resume from saved progress ────────────────────────────────────────────
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) { setResuming(false); return; }

    getDoc(doc(db, 'users', user.uid)).then(snap => {
      if (!snap.exists()) { setResuming(false); return; }
      const d = snap.data();
      const kd = extractKycData(d);
      const savedStep: number = d.kycStep || 1;

      if (kd.aadhaarName) {
        setDriverName(kd.aadhaarName);
        setFrontData({
          full_name:      kd.aadhaarName,
          dob:            kd.aadhaarDob    || '',
          gender:         kd.aadhaarGender || '',
          aadhaar_number: kd.aadhaarNumber || '',
        });
      }
      if (kd.aadhaarAddress) {
        setBackData({ address: { value: kd.aadhaarAddress } });
      }
      if (kd.panStatus) {
        setPanData({ name: kd.panName || '', pan_number: kd.panNumber || '', status: kd.panStatus });
      }
      if (kd.dlStatus) {
        setDlData({ name: kd.dlName || '', doe: kd.dlDoe || '', dl_number: kd.dlNumber || '', status: kd.dlStatus });
        if (kd.dlState) setDlState(kd.dlState);
      }
      if (kd.rcStatus) {
        setRcData({
          rc_number:         kd.rcNumber || '',
          owner_name:        kd.rcOwnerName || '',
          registration_date: kd.rcRegistrationDate || '',
          fit_up_to:         kd.rcFitnessExpiry || '',
          insurance_upto:    kd.rcInsuranceValidity || '',
          rc_status:         kd.rcStatus || '',
          maker_model:       kd.rcMakerModel || '',
          fuel_type:         kd.rcFuelType || '',
          status:            kd.rcVerifyStatus || 'verified',
        });
        if (kd.rcNumber) setRcNumber(kd.rcNumber);
      }
      if (d.vehicleCategory) setVehicleCategory(d.vehicleCategory);
      if (kd.vehiclePhotos?.length) {
        setVehicleUploaded(true);
      }
      if (kd.selfieUrl) {
        setSelfieUrl(kd.selfieUrl);
        setSelfiePreview(kd.selfieUrl);
        setSelfieUploaded(true);
      }

      if (savedStep > 1) setStep(Math.min(savedStep, STEPS.length));
      setResuming(false);
    }).catch(() => setResuming(false));
  }, []);

  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(''), 8000);
  };

  const isStepDone = () => {
    if (step === 1) return driverName.trim().length >= 2;
    if (step === 2) return !!frontData;
    if (step === 3) return !!backData;
    if (step === 4) return !!panData;
    if (step === 5) return !!dlData;
    if (step === 6) return !!rcData && !!vehicleCategory;
    if (step === 7) return vehicleUploaded;
    if (step === 8) return selfieUploaded;
    return false;
  };

  // ── Step 2: Aadhaar Front OCR ─────────────────────────────────────────────
  const handleFrontSelect = (file: File) => {
    setFrontFile(file);
    setFrontPreview(URL.createObjectURL(file));
    setFrontData(null);
  };

  const handleFrontOcr = async () => {
    if (!frontFile) return;
    setLoading(true); setError('');
    try {
      const base64 = await fileToBase64(frontFile);
      const res = await fetch('/api/kyc/aadhaar-ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      });
      const data = await res.json();
      if (!data.success || !data.data) {
        showError(data.message || 'Could not read Aadhaar front. Try a clearer image.');
        return;
      }

      const extracted = data.data;
      const docType: string = extracted.document_type || '';
      if (docType && !docType.includes('front')) {
        showError('This looks like the back side. Please upload the Aadhaar front image.');
        return;
      }
      if (!extracted.full_name) {
        showError('Name could not be detected. Please upload a clearer Aadhaar front image.');
        return;
      }
      if (!namesMatch(extracted.full_name, driverName)) {
        showError(`Name doesn't match. Aadhaar shows "${extracted.full_name}". Please register again with your correct name.`);
        setTimeout(() => {
          auth.signOut().then(() => navigate('/auth'));
        }, 5000);
        return;
      }

      const user = auth.currentUser;
      if (user) {
        // Save document image to Cloudinary for admin review
        const imageUrl = await uploadToCloudinary(frontFile!, `kyc/${user.uid}/aadhaar-front`);
        await saveProgress(user.uid, {
          kycStep:               3,
          'kycData.aadhaarName':   extracted.full_name,
          'kycData.aadhaarDob':    extracted.dob || '',
          'kycData.aadhaarGender': extracted.gender || '',
          'kycData.aadhaarNumber': extracted.aadhaar_number || '',
          'kycData.aadhaarFrontUrl': imageUrl,
        });
      }
      setFrontData(extracted);
    } catch (e: any) { showError(e?.message || 'Request failed. Please try again.'); }
    finally { setLoading(false); }
  };

  // ── Step 3: Aadhaar Back OCR ──────────────────────────────────────────────
  const handleBackSelect = (file: File) => {
    setBackFile(file);
    setBackPreview(URL.createObjectURL(file));
    setBackData(null);
  };

  const handleBackOcr = async () => {
    if (!backFile) return;
    setLoading(true); setError('');
    try {
      const base64 = await fileToBase64(backFile);
      const res = await fetch('/api/kyc/aadhaar-ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      });
      const data = await res.json();
      if (!data.success || !data.data) {
        showError(data.message || 'Could not read Aadhaar back. Try a clearer image.');
        return;
      }

      const extracted = data.data;
      const rawAddr = extracted.address;
      const addressStr = typeof rawAddr === 'string'
        ? rawAddr
        : rawAddr?.value
        ? rawAddr.value
        : [rawAddr?.house, rawAddr?.street, rawAddr?.locality, rawAddr?.district, rawAddr?.state, rawAddr?.pincode]
            .filter(Boolean).join(', ');

      const user = auth.currentUser;
      if (user) {
        const imageUrl = await uploadToCloudinary(backFile!, `kyc/${user.uid}/aadhaar-back`);
        await saveProgress(user.uid, {
          kycStep:                    4,
          'kycData.aadhaarVerified':  true,
          'kycData.aadhaarAddress':   addressStr || '',
          'kycData.aadhaarBackUrl':   imageUrl,
        });
      }
      setBackData(extracted);
    } catch (e: any) { showError(e?.message || 'Request failed. Please try again.'); }
    finally { setLoading(false); }
  };

  // ── Step 4: PAN Front OCR ─────────────────────────────────────────────────
  const handlePanSelect = (file: File) => {
    setPanFile(file);
    setPanPreview(URL.createObjectURL(file));
    setPanData(null);
  };

  const handlePanOcr = async () => {
    if (!panFile) return;
    setLoading(true); setError('');
    try {
      const base64 = await fileToBase64(panFile);
      const res = await fetch('/api/kyc/pan-ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      });
      const data = await res.json();
      if (!data.success || !data.data) {
        showError(data.message || 'Could not read PAN card. Try a clearer image.');
        return;
      }

      const extracted = data.data;
      const ocrName: string = extracted.name || '';
      const aadhaarName: string = frontData?.full_name || '';
      const matched = ocrName && aadhaarName && namesMatch(ocrName, aadhaarName);
      const status = matched ? 'verified' : 'pending_review';
      const result = { ...extracted, status };

      const user = auth.currentUser;
      if (user) {
        const imageUrl = await uploadToCloudinary(panFile!, `kyc/${user.uid}/pan-card`);
        await saveProgress(user.uid, {
          kycStep:                 5,
          'kycData.panVerified':   matched,
          'kycData.panStatus':     status,
          'kycData.panName':       ocrName,
          'kycData.panNumber':     extracted.pan_number || '',
          'kycData.panImageUrl':   imageUrl,
        });
      }
      setPanData(result);
    } catch (e: any) { showError(e?.message || 'Request failed. Please try again.'); }
    finally { setLoading(false); }
  };

  // ── Step 5: Driving License Verification ──────────────────────────────────
  const selectedState = DL_STATES.find(s => s.code === dlState);
  const dlPrefix = selectedState ? `${selectedState.code}-` : '';
  const fullDlNumber = dlPrefix + dlNumber.trim();

  // Use DOB from Aadhaar OCR automatically
  const aadhaarDob = frontData?.dob || dlDob || '';
  const isDlFormReady = dlState !== '' && dlNumber.trim().length >= 3 && aadhaarDob !== '';

  const handleDlVerify = async () => {
    if (!isDlFormReady) return;
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/kyc/driving-license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_number: fullDlNumber, dob: aadhaarDob }),
      });
      const data = await res.json();

      if (!data.success || !data.data) {
        showError(data.message || 'Could not verify Driving License. Please check the number and try again.');
        return;
      }

      const extracted = data.data;

      // Check expiry before anything else
      const doe: string = extracted.doe || '';
      if (doe) {
        const expiryDate = new Date(doe);
        expiryDate.setHours(23, 59, 59, 999); // valid through end of expiry day
        if (expiryDate < new Date()) {
          showError(`Your Driving License expired on ${doe}. An expired license cannot be accepted. Please renew your license and try again.`);
          return;
        }
      }

      const apiName: string = extracted.name || '';
      const aadhaarName: string = frontData?.full_name || '';
      const matched = apiName && aadhaarName && namesMatch(apiName, aadhaarName);
      const status = matched ? 'verified' : 'pending_review';

      const result = {
        name:      apiName,
        doe:       extracted.doe || '',
        dl_number: extracted.license_number || fullDlNumber,
        status,
      };

      const user = auth.currentUser;
      if (user) {
        await saveProgress(user.uid, {
          kycStep:               6,
          'kycData.dlVerified':  matched,
          'kycData.dlStatus':    status,
          'kycData.dlName':      apiName,
          'kycData.dlDoe':       extracted.doe || '',
          'kycData.dlNumber':    extracted.license_number || fullDlNumber,
          'kycData.dlState':     dlState,
        });
      }
      setDlData(result);
    } catch (e: any) { showError(e?.message || 'Request failed. Please try again.'); }
    finally { setLoading(false); }
  };

  // ── Step 6: RC Verification ───────────────────────────────────────────────
  const isRcFormReady = rcNumber.trim().length >= 6;

  const handleRcVerify = async () => {
    if (!isRcFormReady) return;
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/kyc/rc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_number: rcNumber.trim().toUpperCase() }),
      });
      const data = await res.json();

      if (!data.success || !data.data) {
        showError(data.message || 'Could not verify RC number. Please check and try again.');
        return;
      }

      const e = data.data;

      // 1. RC number must be present in response
      if (!e.rc_number) {
        showError('RC number not found in verification response. Please try again.');
        return;
      }

      // 2. RC status must be ACTIVE
      const rcStatus: string = (e.rc_status || '').toUpperCase();
      if (rcStatus && rcStatus !== 'ACTIVE') {
        showError(`RC status is "${e.rc_status}". Only vehicles with an Active RC are accepted.`);
        return;
      }

      // 3. Fitness expiry must not be in the past
      if (e.fit_up_to) {
        const fitnessExpiry = new Date(e.fit_up_to);
        fitnessExpiry.setHours(23, 59, 59, 999);
        if (fitnessExpiry < new Date()) {
          showError(`Vehicle fitness certificate expired on ${e.fit_up_to}. Please renew before registering.`);
          return;
        }
      }

      // 4. Insurance must not be expired
      if (e.insurance_upto) {
        const insuranceExpiry = new Date(e.insurance_upto);
        insuranceExpiry.setHours(23, 59, 59, 999);
        if (insuranceExpiry < new Date()) {
          showError(`Vehicle insurance expired on ${e.insurance_upto}. Please renew insurance before registering.`);
          return;
        }
      }

      // 5. Name match — compare RC owner name against Aadhaar name
      const aadhaarName: string = frontData?.full_name || '';
      const rcOwnerName: string = e.owner_name || '';
      const matched = rcOwnerName && aadhaarName && namesMatch(rcOwnerName, aadhaarName);
      const rcVerifyStatus = matched ? 'verified' : 'pending_review';

      // Save to Firestore
      const user = auth.currentUser;
      if (user) {
        await saveProgress(user.uid, {
          kycStep:                        7,
          'kycData.rcNumber':             e.rc_number,
          'kycData.rcOwnerName':          e.owner_name || '',
          'kycData.rcRegistrationDate':   e.registration_date || '',
          'kycData.rcFitnessExpiry':      e.fit_up_to || '',
          'kycData.rcInsuranceValidity':  e.insurance_upto || '',
          'kycData.rcStatus':             e.rc_status || '',
          'kycData.rcMakerModel':         e.maker_model || '',
          'kycData.rcFuelType':           e.fuel_type || '',
          'kycData.rcVerified':           matched,
          'kycData.rcVerifyStatus':       rcVerifyStatus,
        });
      }

      setRcData({ ...e, status: rcVerifyStatus });
    } catch (err: any) { showError(err?.message || 'Request failed. Please try again.'); }
    finally { setLoading(false); }
  };

  // ── Step 7: Vehicle Photos Upload ────────────────────────────────────────
  const handleVehicleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;

    const remaining = VEHICLE_MAX - vehicleImages.length;
    const toAdd = files.slice(0, remaining);

    const newEntries = toAdd.map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setVehicleImages(prev => [...prev, ...newEntries]);
    setVehicleUploaded(false);
  };

  const removeVehicleImage = (index: number) => {
    setVehicleImages(prev => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
    setVehicleUploaded(false);
  };

  const handleVehicleUpload = async () => {
    if (vehicleImages.length < VEHICLE_MIN) return;
    const user = auth.currentUser;
    if (!user) return;

    setLoading(true); setError('');
    try {
      const urls: string[] = [];
      for (let i = 0; i < vehicleImages.length; i++) {
        const { file } = vehicleImages[i];
        const url = await uploadToCloudinary(file, `kyc/${user.uid}/vehicle`);
        urls.push(url);
      }

      await saveProgress(user.uid, {
        kycStep:                  8,
        'kycData.vehiclePhotos':  urls,
      });

      setVehicleUploaded(true);
    } catch (err: any) {
      console.error('Vehicle upload error:', err);
      showError(err?.message || 'Upload failed. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 8: Selfie — Camera & Upload ──────────────────────────────────────
  const handleSelfieSelect = (file: File) => {
    if (selfiePreview && !selfiePreview.startsWith('http')) {
      URL.revokeObjectURL(selfiePreview);
    }
    setSelfieFile(file);
    setSelfiePreview(URL.createObjectURL(file));
    setSelfieUploaded(false);
    setSelfieUrl('');
  };

  const openCamera = async () => {
    setCameraError('');
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.error('Camera error:', err);
      setCameraError('Could not access camera. Please allow camera permission or upload from gallery.');
      setCameraOpen(false);
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Mirror the image (front camera is mirrored in preview)
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `selfie_${Date.now()}.jpg`, { type: 'image/jpeg' });
        handleSelfieSelect(file);
      }
      closeCamera();
    }, 'image/jpeg', 0.9);
  };

  const closeCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  };

  const handleSelfieUpload = async () => {
    if (!selfieFile) return;
    const user = auth.currentUser;
    if (!user) return;

    setLoading(true); setError('');
    try {
      const url = await uploadToCloudinary(selfieFile, `kyc/${user.uid}/selfie`);

      await saveProgress(user.uid, {
        kycStep:              9,
        'kycData.selfieUrl':  url,
        photoURL:             url, // also update profile photo
      });

      setSelfieUrl(url);
      setSelfieUploaded(true);
    } catch (err: any) {
      showError(err?.message || 'Upload failed. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Final completion ──────────────────────────────────────────────────────
  const handleComplete = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setLoading(true);
    try {
      // Determine if ALL docs are verified right now
      const hasPending =
        panData?.status === 'pending_review' ||
        dlData?.status === 'pending_review' ||
        rcData?.status === 'pending_review';

      console.log('[KYC] handleComplete — hasPending:', hasPending,
        'pan:', panData?.status, 'dl:', dlData?.status, 'rc:', rcData?.status);

      // Build list of pending doc names to display on PendingVerification screen
      const pendingDocNames: string[] = [];
      if (panData?.status === 'pending_review') pendingDocNames.push('PAN Card');
      if (dlData?.status === 'pending_review') pendingDocNames.push('Driving License');
      if (rcData?.status === 'pending_review') pendingDocNames.push('RC / Vehicle Registration');

      await saveProgress(user.uid, {
        name: driverName.trim(),
        kycCompleted: true,
        kycAllVerified: !hasPending,
        pendingDocNames: hasPending ? pendingDocNames : [],
        kycTimestamp: new Date().toISOString(),
      });

      console.log('[KYC] Firestore write done. kycAllVerified:', !hasPending);

      // Let onSnapshot in App.tsx detect the change and route accordingly
      // Small delay to ensure onSnapshot fires before React state update
      await new Promise(r => setTimeout(r, 500));
      onComplete();
    } catch {
      showError('Failed to complete registration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Reusable image upload card ─────────────────────────────────────────────
  const renderImageUploader = (
    inputRef: React.RefObject<HTMLInputElement>,
    preview: string,
    onSelect: (file: File) => void,
    label: string,
    icon: string
  ) => (
    <div>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={inputRef}
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) onSelect(file);
          e.target.value = '';
        }}
      />
      {!preview ? (
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full h-52 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex flex-col items-center justify-center gap-3 hover:border-primary hover:bg-primary/5 transition-all active:scale-[0.98] group"
        >
          <div className="size-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
            <span className="material-symbols-outlined text-slate-400 group-hover:text-primary text-4xl transition-colors">{icon}</span>
          </div>
          <div className="text-center space-y-0.5">
            <p className="text-sm font-black text-slate-700 dark:text-slate-300">{label}</p>
            <p className="text-[10px] text-slate-400 font-medium">Tap to capture or select from gallery</p>
          </div>
        </button>
      ) : (
        <div className="relative rounded-3xl overflow-hidden border-2 border-primary/20 shadow-md">
          <img src={preview} alt="Document" className="w-full object-contain max-h-56 bg-slate-100 dark:bg-slate-900" />
          <button
            onClick={() => inputRef.current?.click()}
            className="absolute top-3 right-3 bg-white dark:bg-slate-800 rounded-full p-2 shadow-lg active:scale-90 transition-transform"
          >
            <span className="material-symbols-outlined text-slate-600 dark:text-slate-300 text-xl">refresh</span>
          </button>
          <div className="absolute bottom-3 left-3 bg-primary/90 text-white text-[10px] font-black px-3 py-1 rounded-full flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">image</span>
            Image selected
          </div>
        </div>
      )}
    </div>
  );

  // Completion screen removed — App.tsx routing guard handles the redirect:
  // pending docs → PendingVerification screen, all verified → Dashboard

  // ── Loading screen while restoring progress ───────────────────────────────
  if (resuming) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-slate-50 dark:bg-slate-950">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-sm font-bold text-slate-400">Restoring your progress...</p>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 font-sans">

      {/* Header */}
      <header className="sticky top-0 z-20 bg-white dark:bg-slate-900 border-b dark:border-slate-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">Driver Registration</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Step {step} of {STEPS.length} — {STEPS[step - 1].title}
          </p>
        </div>
        <div className="size-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
          <span className="material-symbols-outlined filled">verified_user</span>
        </div>
      </header>

      {/* Step Stepper */}
      <div className="px-6 py-5 bg-white dark:bg-slate-900 shadow-sm">
        <div className="flex items-center gap-1 relative">
          <div className="absolute left-0 right-0 top-4 h-0.5 bg-slate-100 dark:bg-slate-800 z-0" />
          {STEPS.map(s => (
            <div key={s.id} className="relative z-10 flex flex-col items-center flex-1">
              <div className={`size-8 rounded-full flex items-center justify-center transition-all border-2 ${
                step > s.id
                  ? 'bg-primary border-primary text-white'
                  : step === s.id
                  ? 'bg-white dark:bg-slate-900 border-primary text-primary shadow-lg shadow-primary/20'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-100 dark:border-slate-800 text-slate-400'
              }`}>
                {step > s.id
                  ? <span className="material-symbols-outlined text-sm">check</span>
                  : <span className="text-xs font-black">{s.id}</span>
                }
              </div>
              <span className={`text-[9px] font-bold mt-1 text-center leading-tight ${step === s.id ? 'text-primary' : 'text-slate-400'}`}>
                {s.title.split(' ')[0]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 p-6 pb-36 space-y-5">

        {/* Step heading */}
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">{STEPS[step - 1].title}</h1>
          {STEPS[step - 1].subtitle && (
            <p className="text-xs text-slate-400 font-semibold mt-0.5">{STEPS[step - 1].subtitle}</p>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl px-4 py-3 flex items-start gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
            <span className="material-symbols-outlined text-red-500 text-xl flex-shrink-0">error</span>
            <p className="text-red-600 dark:text-red-400 text-sm font-medium">{error}</p>
          </div>
        )}

        {/* ── STEP 1: NAME ENTRY ────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl px-4 py-3 flex items-start gap-2">
              <span className="material-symbols-outlined text-amber-500 text-xl flex-shrink-0">warning</span>
              <p className="text-amber-700 dark:text-amber-300 text-xs font-medium leading-relaxed">
                Enter your name <strong>exactly</strong> as it appears on your Aadhaar card.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Full Name (as on Aadhaar)</label>
              <input
                value={driverName}
                onChange={e => setDriverName(e.target.value)}
                placeholder="Enter Your Full Name"
                className="w-full h-14 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl px-5 text-base font-bold focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        )}

        {/* ── STEP 2: AADHAAR FRONT OCR ─────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4">
            {frontData ? (
              <VerifiedCard items={[
                { label: 'Name',          value: frontData.full_name || '—' },
                { label: 'Date of Birth', value: frontData.dob || '—' },
                { label: 'Gender',        value: frontData.gender === 'M' ? 'Male' : frontData.gender === 'F' ? 'Female' : frontData.gender || '—' },
                { label: 'Aadhaar No.',   value: frontData.aadhaar_number ? `XXXX XXXX ${String(frontData.aadhaar_number).slice(-4)}` : '—' },
              ]} />
            ) : (
              <>
                <div className="bg-slate-100 dark:bg-slate-800/60 rounded-2xl px-4 py-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-500 text-xl">info</span>
                  <p className="text-slate-600 dark:text-slate-400 text-xs font-medium">
                    Upload the <strong>front side</strong> of your Aadhaar — the side with your photo, name and date of birth.
                  </p>
                </div>
                {renderImageUploader(frontInputRef, frontPreview, handleFrontSelect, 'Aadhaar Front', 'credit_card')}
                {frontPreview && (
                  <button
                    onClick={handleFrontOcr}
                    disabled={loading}
                    className="w-full h-14 bg-primary text-white font-black rounded-2xl disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                  >
                    {loading
                      ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing...</>
                      : <><span className="material-symbols-outlined text-xl">arrow_forward</span> Next</>
                    }
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* ── STEP 3: AADHAAR BACK OCR ──────────────────────────── */}
        {step === 3 && (
          <div className="space-y-4">
            {backData ? (
              (() => {
                const rawAddr = backData.address;
                const addressStr = typeof rawAddr === 'string'
                  ? rawAddr
                  : rawAddr?.value
                  ? rawAddr.value
                  : [rawAddr?.house, rawAddr?.street, rawAddr?.locality, rawAddr?.district, rawAddr?.state, rawAddr?.pincode]
                      .filter(Boolean).join(', ');
                return <VerifiedCard items={[{ label: 'Address', value: addressStr || 'Address extracted' }]} />;
              })()
            ) : (
              <>
                <div className="bg-slate-100 dark:bg-slate-800/60 rounded-2xl px-4 py-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-500 text-xl">info</span>
                  <p className="text-slate-600 dark:text-slate-400 text-xs font-medium">
                    Upload the <strong>back side</strong> of your Aadhaar — the side with your address and barcode.
                  </p>
                </div>
                {renderImageUploader(backInputRef, backPreview, handleBackSelect, 'Aadhaar Back', 'home_pin')}
                {backPreview && (
                  <button
                    onClick={handleBackOcr}
                    disabled={loading}
                    className="w-full h-14 bg-primary text-white font-black rounded-2xl disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                  >
                    {loading
                      ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing...</>
                      : <><span className="material-symbols-outlined text-xl">arrow_forward</span> Next</>
                    }
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* ── STEP 4: PAN CARD OCR ──────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-4">
            {panData ? (
              panData.status === 'verified' ? (
                <VerifiedCard items={[
                  { label: 'Name on PAN',   value: panData.name || '—' },
                  { label: 'PAN Number',    value: panData.pan_number || '—' },
                  { label: 'Date of Birth', value: panData.dob || '—' },
                  { label: 'Father\'s Name',value: panData.father_name || '—' },
                ]} />
              ) : (
                <PendingCard message="Your PAN card name doesn't match with aadhaar card. Our team will review your document within 24–48 hours. You can continue with the verification process." />
              )
            ) : (
              <>
                <div className="bg-slate-100 dark:bg-slate-800/60 rounded-2xl px-4 py-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-500 text-xl">info</span>
                  <p className="text-slate-600 dark:text-slate-400 text-xs font-medium">
                    Upload the <strong>front side</strong> of your PAN card.
                  </p>
                </div>
                {renderImageUploader(panInputRef, panPreview, handlePanSelect, 'PAN Card Front', 'badge')}
                {panPreview && (
                  <button
                    onClick={handlePanOcr}
                    disabled={loading}
                    className="w-full h-14 bg-primary text-white font-black rounded-2xl disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                  >
                    {loading
                      ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing...</>
                      : <><span className="material-symbols-outlined text-xl">arrow_forward</span> Next</>
                    }
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* ── STEP 5: DRIVING LICENSE ───────────────────────────── */}
        {step === 5 && (
          <div className="space-y-4">
            {dlData ? (
              dlData.status === 'verified' ? (
                <VerifiedCard items={[
                  { label: 'Name on DL',    value: dlData.name || '—' },
                  { label: 'DL Number',     value: dlData.dl_number || '—' },
                  { label: 'Valid Until',   value: dlData.doe || '—' },
                ]} />
              ) : (
                <PendingCard message="Your Driving License name doesn't match with aadhaar card. Our team will review your document within 24–48 hours. You can continue with the verification process." />
              )
            ) : (
              <>
                <div className="bg-slate-100 dark:bg-slate-800/60 rounded-2xl px-4 py-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-500 text-xl">info</span>
                  <p className="text-slate-600 dark:text-slate-400 text-xs font-medium">
                    Enter your DL issuing state and license number exactly as on your license.
                  </p>
                </div>

                {/* State Selector */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">DL Issuing State</label>
                  <div className="relative">
                    <select
                      value={dlState}
                      onChange={e => { setDlState(e.target.value); setDlNumber(''); }}
                      className="w-full h-14 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl px-5 text-base font-bold focus:outline-none focus:border-primary appearance-none"
                    >
                      <option value="">Select state...</option>
                      {DL_STATES.map(s => (
                        <option key={s.code} value={s.code}>{s.name}</option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
                  </div>
                </div>

                {/* DL Number with prefix */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">License Number</label>
                  <div className={`flex h-14 bg-white dark:bg-slate-800 border-2 rounded-2xl overflow-hidden transition-colors ${dlState ? 'border-slate-100 dark:border-slate-700 focus-within:border-primary' : 'border-slate-100 dark:border-slate-700 opacity-50'}`}>
                    {dlState && (
                      <div className="flex items-center px-4 bg-primary/10 border-r border-primary/20 shrink-0">
                        <span className="text-base font-black text-primary">{dlPrefix}</span>
                      </div>
                    )}
                    <input
                      value={dlNumber}
                      onChange={e => setDlNumber(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                      placeholder={dlState ? 'Enter license number' : 'Select state first'}
                      disabled={!dlState}
                      className="flex-1 px-4 text-base font-bold bg-transparent focus:outline-none disabled:cursor-not-allowed placeholder:text-slate-300"
                    />
                  </div>
                  {dlState && dlNumber && (
                    <p className="text-[10px] text-slate-400 font-medium ml-1">
                      Full number: <span className="font-black text-slate-600 dark:text-slate-300">{fullDlNumber}</span>
                    </p>
                  )}
                </div>

                <button
                  onClick={handleDlVerify}
                  disabled={!isDlFormReady || loading}
                  className="w-full h-14 bg-primary text-white font-black rounded-2xl disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                >
                  {loading
                    ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Verifying...</>
                    : <><span className="material-symbols-outlined text-xl">arrow_forward</span> Verify</>
                  }
                </button>
              </>
            )}
          </div>
        )}

        {/* ── STEP 6: RC VERIFICATION ───────────────────────────── */}
        {step === 6 && (
          <div className="space-y-4">
            {rcData ? (
              rcData.status === 'verified' ? (
                <VerifiedCard items={[
                  { label: 'RC Number',        value: rcData.rc_number || '—' },
                  { label: 'Owner Name',        value: rcData.owner_name || '—' },
                  { label: 'Vehicle',           value: [rcData.maker_model, rcData.fuel_type].filter(Boolean).join(' · ') || '—' },
                  { label: 'Registered On',     value: rcData.registration_date || '—' },
                  { label: 'Fitness Valid Till',value: rcData.fit_up_to || '—' },
                  { label: 'Insurance Valid Till',value: rcData.insurance_upto || '—' },
                  { label: 'RC Status',         value: rcData.rc_status || '—' },
                ]} />
              ) : (
                <PendingCard message="Your RC owner name doesn't match with Aadhaar card. Our team will review your document within 24–48 hours. You can continue with the verification process." />
              )
            ) : null}

            {/* Vehicle Category Selector — shown after RC is verified */}
            {rcData && (
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Your Vehicle Category</label>
                <p className="text-xs text-slate-500 font-medium">This determines which bookings you'll receive. Choose the category that best matches your vehicle.</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'bike', name: 'Two-Wheeler', icon: 'motorcycle', desc: 'Bike / Scooter' },
                    { id: 'tata-ace', name: 'Mini Truck', icon: 'local_shipping', desc: 'Tata Ace / similar' },
                    { id: 'bolero', name: 'Pickup Truck', icon: 'local_shipping', desc: 'Bolero / Dost' },
                    { id: 'tata-407', name: 'Medium Truck', icon: 'local_shipping', desc: 'Tata 407 / similar' },
                    { id: 'large-truck', name: 'Large Truck', icon: 'local_shipping', desc: 'Eicher / Canter' },
                    { id: 'car', name: 'Car', icon: 'directions_car', desc: 'Sedan / Hatchback / SUV' },
                  ].map(v => (
                    <button
                      key={v.id}
                      onClick={() => setVehicleCategory(v.id)}
                      className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all active:scale-95 ${
                        vehicleCategory === v.id
                          ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                          : 'border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800'
                      }`}
                    >
                      <span className={`material-symbols-outlined text-2xl ${vehicleCategory === v.id ? 'text-primary' : 'text-slate-400'}`}>{v.icon}</span>
                      <span className={`text-xs font-black ${vehicleCategory === v.id ? 'text-primary' : 'text-slate-700 dark:text-slate-200'}`}>{v.name}</span>
                      <span className="text-[9px] text-slate-400 font-medium">{v.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!rcData && (
              <>
                <div className="bg-slate-100 dark:bg-slate-800/60 rounded-2xl px-4 py-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-500 text-xl">info</span>
                  <p className="text-slate-600 dark:text-slate-400 text-xs font-medium">
                    Enter your vehicle's registration number exactly as printed on the RC book (e.g. <strong>DL1CAB1234</strong>).
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vehicle Registration Number</label>
                  <input
                    value={rcNumber}
                    onChange={e => setRcNumber(e.target.value.replace(/\s/g, '').toUpperCase())}
                    placeholder="e.g. DL1CAB1234"
                    maxLength={15}
                    className="w-full h-14 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl px-5 text-base font-black tracking-widest focus:outline-none focus:border-primary uppercase"
                  />
                </div>

                <button
                  onClick={handleRcVerify}
                  disabled={!isRcFormReady || loading}
                  className="w-full h-14 bg-primary text-white font-black rounded-2xl disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                >
                  {loading
                    ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Verifying...</>
                    : <><span className="material-symbols-outlined text-xl">arrow_forward</span> Verify RC</>
                  }
                </button>
              </>
            )}
          </div>
        )}

        {/* ── STEP 7: VEHICLE PHOTOS ────────────────────────────── */}
        {step === 7 && (
          <div className="space-y-4">
            {/* Uploaded success state */}
            {vehicleUploaded && (
              <VerifiedCard items={[
                { label: 'Photos Uploaded', value: `${vehicleImages.length} image${vehicleImages.length > 1 ? 's' : ''} saved successfully` },
              ]} />
            )}

            {/* Count badge + info */}
            <div className="flex items-center justify-between">
              <div className="bg-slate-100 dark:bg-slate-800/60 rounded-2xl px-4 py-3 flex items-center gap-2 flex-1">
                <span className="material-symbols-outlined text-slate-500 text-xl">info</span>
                <p className="text-slate-600 dark:text-slate-400 text-xs font-medium">
                  Add <strong>at least 3</strong> clear photos of your vehicle (front, back, side). Max 6 photos.
                </p>
              </div>
              <div className={`ml-3 shrink-0 size-12 rounded-2xl flex flex-col items-center justify-center font-black text-sm ${
                vehicleImages.length >= VEHICLE_MIN ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
              }`}>
                <span>{vehicleImages.length}</span>
                <span className="text-[8px] font-bold">/{VEHICLE_MAX}</span>
              </div>
            </div>

            {/* Hidden file input */}
            <input
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              ref={vehicleInputRef}
              className="hidden"
              onChange={handleVehicleFileChange}
            />

            {/* Photo grid */}
            {vehicleImages.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {vehicleImages.map((img, idx) => (
                  <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border-2 border-slate-100 dark:border-slate-700 shadow-sm">
                    <img src={img.preview} alt={`Vehicle ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeVehicleImage(idx)}
                      disabled={loading}
                      className="absolute top-1.5 right-1.5 size-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md border-2 border-white dark:border-slate-900 active:scale-90 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[13px]">close</span>
                    </button>
                    <div className="absolute bottom-1.5 left-1.5 bg-black/50 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md">
                      {idx + 1}
                    </div>
                  </div>
                ))}

                {/* Add more slot */}
                {vehicleImages.length < VEHICLE_MAX && (
                  <button
                    onClick={() => vehicleInputRef.current?.click()}
                    disabled={loading}
                    className="aspect-square rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-1 hover:border-primary hover:bg-primary/5 transition-all active:scale-95 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-slate-400 text-2xl">add_a_photo</span>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-tight">Add</span>
                  </button>
                )}
              </div>
            )}

            {/* Initial empty state — full-width add button */}
            {vehicleImages.length === 0 && (
              <button
                onClick={() => vehicleInputRef.current?.click()}
                className="w-full h-52 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex flex-col items-center justify-center gap-3 hover:border-primary hover:bg-primary/5 transition-all active:scale-[0.98] group"
              >
                <div className="size-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <span className="material-symbols-outlined text-slate-400 group-hover:text-primary text-4xl transition-colors">add_a_photo</span>
                </div>
                <div className="text-center space-y-0.5">
                  <p className="text-sm font-black text-slate-700 dark:text-slate-300">Add Vehicle Photos</p>
                  <p className="text-[10px] text-slate-400 font-medium">Tap to capture or select from gallery</p>
                </div>
              </button>
            )}

            {/* Progress indicator */}
            {vehicleImages.length > 0 && vehicleImages.length < VEHICLE_MIN && (
              <div className="flex items-center gap-2 px-1">
                <div className="flex gap-1 flex-1">
                  {Array.from({ length: VEHICLE_MIN }).map((_, i) => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < vehicleImages.length ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`} />
                  ))}
                </div>
                <span className="text-[10px] font-black text-amber-600">{VEHICLE_MIN - vehicleImages.length} more needed</span>
              </div>
            )}

            {/* Upload button */}
            {vehicleImages.length >= VEHICLE_MIN && !vehicleUploaded && (
              <button
                onClick={handleVehicleUpload}
                disabled={loading}
                className="w-full h-14 bg-primary text-white font-black rounded-2xl disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
              >
                {loading ? (
                  <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Uploading Images...</>
                ) : (
                  <><span className="material-symbols-outlined text-xl">cloud_upload</span> Upload {vehicleImages.length} Photos</>
                )}
              </button>
            )}
          </div>
        )}

        {/* ── STEP 8: SELFIE ────────────────────────────────────── */}
        {step === 8 && (
          <div className="space-y-4">
            {/* Hidden gallery input */}
            <input
              type="file"
              accept="image/*"
              ref={selfieGalleryRef}
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleSelfieSelect(f); e.target.value = ''; }}
            />

            <div className="bg-slate-100 dark:bg-slate-800/60 rounded-2xl px-4 py-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-500 text-xl">info</span>
              <p className="text-slate-600 dark:text-slate-400 text-xs font-medium">
                Take a clear selfie or upload a recent photo. Make sure your face is fully visible with good lighting.
              </p>
            </div>

            {cameraError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl px-4 py-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-red-500 text-xl">error</span>
                <p className="text-red-600 dark:text-red-400 text-xs font-medium">{cameraError}</p>
              </div>
            )}

            {/* ── Live camera view ── */}
            {cameraOpen && (
              <div className="flex flex-col items-center gap-4">
                <div className="relative w-56 h-56 rounded-full overflow-hidden border-4 border-primary/30 shadow-xl">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ transform: 'scaleX(-1)' }}
                  />
                </div>
                <div className="flex gap-3 w-full">
                  <button
                    onClick={closeCamera}
                    className="flex-1 h-14 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-black rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
                  >
                    <span className="material-symbols-outlined text-lg">close</span>
                    Cancel
                  </button>
                  <button
                    onClick={capturePhoto}
                    className="flex-[2] h-14 bg-primary text-white font-black rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-95 transition-transform"
                  >
                    <span className="material-symbols-outlined text-2xl">camera</span>
                    Capture
                  </button>
                </div>
              </div>
            )}

            {/* ── No image yet & camera not open — action buttons ── */}
            {!selfiePreview && !cameraOpen && (
              <div className="flex flex-col gap-3">
                <button
                  onClick={openCamera}
                  className="w-full h-16 bg-primary text-white font-black rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-primary/20 active:scale-[0.98] transition-transform"
                >
                  <span className="material-symbols-outlined text-2xl">photo_camera</span>
                  <span>Take Selfie</span>
                </button>
                <button
                  onClick={() => selfieGalleryRef.current?.click()}
                  className="w-full h-16 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-black rounded-2xl flex items-center justify-center gap-3 active:scale-[0.98] transition-transform"
                >
                  <span className="material-symbols-outlined text-2xl text-primary">photo_library</span>
                  <span>Upload from Gallery</span>
                </button>
              </div>
            )}

            {/* ── Preview state ── */}
            {selfiePreview && !cameraOpen && (
              <div className="space-y-4">
                <div className="relative mx-auto w-56 h-56">
                  <img
                    src={selfiePreview}
                    alt="Selfie preview"
                    className="w-full h-full object-cover rounded-full border-4 border-primary/30 shadow-xl"
                  />
                  {selfieUploaded && (
                    <div className="absolute bottom-2 right-2 size-10 bg-green-500 rounded-full flex items-center justify-center border-4 border-white dark:border-slate-900 shadow-lg">
                      <span className="material-symbols-outlined text-white text-lg">check</span>
                    </div>
                  )}
                </div>

                {selfieUploaded ? (
                  <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-2xl px-4 py-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-green-500 text-xl">check_circle</span>
                    <p className="text-green-700 dark:text-green-400 text-sm font-black">Photo uploaded successfully</p>
                  </div>
                ) : (
                  <button
                    onClick={handleSelfieUpload}
                    disabled={loading}
                    className="w-full h-14 bg-primary text-white font-black rounded-2xl disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                  >
                    {loading
                      ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Uploading...</>
                      : <><span className="material-symbols-outlined text-xl">cloud_upload</span> Upload Photo</>
                    }
                  </button>
                )}

                {/* Retake / Re-upload row */}
                <div className="flex gap-3">
                  <button
                    onClick={openCamera}
                    disabled={loading}
                    className="flex-1 h-12 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-center gap-2 font-black text-sm text-slate-700 dark:text-slate-200 active:scale-95 transition-transform disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-primary text-lg">photo_camera</span>
                    Retake
                  </button>
                  <button
                    onClick={() => selfieGalleryRef.current?.click()}
                    disabled={loading}
                    className="flex-1 h-12 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-center gap-2 font-black text-sm text-slate-700 dark:text-slate-200 active:scale-95 transition-transform disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-primary text-lg">photo_library</span>
                    Re-upload
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      {/* Footer CTA */}
      <footer className="fixed bottom-0 max-w-md w-full p-5 bg-white dark:bg-slate-900 border-t dark:border-slate-800 z-30">
        {isStepDone() && (
          step < STEPS.length ? (
            <button
              onClick={async () => {
                // Save vehicle category when leaving step 6
                if (step === 6 && vehicleCategory && auth.currentUser) {
                  await saveProgress(auth.currentUser.uid, { vehicleCategory });
                }
                setStep(s => s + 1);
              }}
              className="w-full h-16 bg-primary text-white font-black rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-primary/30 active:scale-[0.98] transition-transform"
            >
              <span>Next</span>
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          ) : (
            <button
              onClick={handleComplete}
              disabled={loading}
              className="w-full h-16 bg-accent text-white font-black rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-accent/30 disabled:opacity-60 active:scale-[0.98] transition-transform"
            >
              {loading
                ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
                : <><span className="material-symbols-outlined">verified</span> Complete Registration</>
              }
            </button>
          )
        )}
      </footer>
    </div>
  );
};

export default RegistrationFlow;
