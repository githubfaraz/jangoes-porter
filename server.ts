import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import FormData from "form-data";
import crypto from "crypto";
import dotenv from "dotenv";
import admin from "firebase-admin";

dotenv.config();

// Initialize Firebase Admin for custom token generation
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// In-memory store for OTPs (for demo purposes)
// In production, use Redis or a database with TTL
const otpStore = new Map<string, { otp: string; expires: number }>();

// API routes
app.post("/api/auth/send-otp", async (req, res) => {
  const { mobile } = req.body;
  console.log(`[AUTH] Request to send-otp for: ${mobile}`);

  if (!mobile || !/^\d{10}$/.test(mobile)) {
    console.warn(`[AUTH] Invalid mobile number: ${mobile}`);
    return res.status(400).json({ error: "Invalid mobile number" });
  }

  // Generate a random 4-digit OTP
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  const expires = Date.now() + 3 * 60 * 1000; // 3 minutes

  otpStore.set(mobile, { otp, expires });

  // SMS API configuration from environment variables
  const smsUkey = (process.env.SMS_UKEY || "").replace(/^"(.*)"$/, '$1').trim();
  const smsSender = (process.env.SMS_SENDER || "").replace(/^"(.*)"$/, '$1').trim();
  const smsTemplateId = (process.env.SMS_TEMPLATE_ID || "").replace(/^"(.*)"$/, '$1').trim();
  const smsDltTemplateId = (process.env.SMS_DLT_TEMPLATE_ID || "").replace(/^"(.*)"$/, '$1').trim();
  const smsCreditType = (process.env.SMS_CREDIT_TYPE || "7").replace(/^"(.*)"$/, '$1').trim();

  console.log(`[AUTH] SMS Config Debug:`);
  console.log(` - UKEY: ${smsUkey ? smsUkey.slice(0, 4) + '...' + smsUkey.slice(-4) : 'MISSING'}`);
  console.log(` - Sender: "${smsSender}"`);
  console.log(` - TemplateID: "${smsTemplateId}"`);
  console.log(` - DLT TemplateID: "${smsDltTemplateId}"`);
  console.log(` - CreditType: "${smsCreditType}"`);

  // Fallback to demo mode if any critical credential is missing
  if (!smsUkey || !smsSender || !smsTemplateId || smsUkey === "" || smsSender === "" || smsTemplateId === "") {
    console.log(`[DEMO MODE] Missing or incomplete SMS credentials. OTP for ${mobile}: ${otp}`);
    return res.json({ success: true, demo: true, otp });
  }

  try {
    const payload = {
      filetype: 1,
      language: 0,
      credittype: Number(smsCreditType) || 2,
      senderid: smsSender,
      templateid: Number(smsTemplateId),
      ukey: smsUkey,
      isrefno: true,
      dlttemplateid: Number(smsDltTemplateId),
      msisdnlist: [
        {
          phoneno: mobile,
          arg1: otp,
        }
      ],
    };

    const apiUrl = "https://api.voicensms.in/SMSAPI/webresources/CreateSMSCampaignPost";
    const method = "POST";

    console.log(`[SMS] Sending request:`);
    console.log(` - URL: ${apiUrl}`);
    console.log(` - Method: ${method}`);
    console.log(` - Payload:`, JSON.stringify(payload, null, 2));

    // Call voicensms.in API with a 10s timeout
    const response = await axios.post(apiUrl, payload, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log("SMS API Response:", JSON.stringify(response.data, null, 2));
    
    // Success Response: { "status":"success", ... } or { "status":"Success", ... }
    if (response.data && (response.data.status === "success" || response.data.status === "Success")) {
      res.json({ success: true });
    } else {
      console.error("SMS API Error Response:", JSON.stringify(response.data, null, 2));
      // The error might be in 'value' or 'error' or 'message' or 'desc'
      const errorMessage = response.data?.value || response.data?.error || response.data?.message || response.data?.desc || "Failed to send SMS via provider";
      res.status(500).json({ error: errorMessage });
    }
  } catch (error: any) {
    console.error("SMS API Error:", error.message);
    res.status(500).json({ error: "Failed to send SMS" });
  }
});

app.post("/api/auth/verify-otp", async (req, res) => {
  const { mobile, otp } = req.body;

  const stored = otpStore.get(mobile);

  if (!stored) {
    return res.status(400).json({ error: "No OTP sent to this number" });
  }

  if (Date.now() > stored.expires) {
    otpStore.delete(mobile);
    return res.status(400).json({ error: "OTP expired" });
  }

  if (stored.otp === otp) {
    otpStore.delete(mobile);
    // Use phone number as stable UID so the same user always gets the same Firestore document
    const uid = `phone_${mobile}`;
    const firebaseToken = await admin.auth().createCustomToken(uid);
    return res.json({ success: true, token: firebaseToken });
  }

  res.status(400).json({ error: "Invalid OTP" });
});

// ─── Google Maps Distance Matrix Proxy ───────────────────────────────────────
app.post('/api/distance-matrix', async (req, res) => {
  const { origin, destination } = req.body;
  if (!origin?.lat || !origin?.lng || !destination?.lat || !destination?.lng) {
    return res.status(400).json({ error: 'origin and destination lat/lng required' });
  }
  try {
    const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY;
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json`
      + `?origins=${origin.lat},${origin.lng}`
      + `&destinations=${destination.lat},${destination.lng}`
      + `&mode=driving&region=in&departure_time=now&key=${apiKey}`;
    const r = await axios.get(url, { timeout: 8000 });
    res.json(r.data);
  } catch (err: any) {
    console.error('[DistanceMatrix]', err.message);
    res.status(500).json({ error: 'Distance Matrix API failed' });
  }
});
// ─────────────────────────────────────────────────────────────────────────────

// ─── Driver Info Endpoint (for customer tracking screen) ─────────────────────
app.get('/api/driver-info/:driverId', async (req, res) => {
  try {
    const { driverId } = req.params;
    const snap = await admin.firestore().collection('users').doc(driverId).get();
    if (!snap.exists) return res.json({ found: false });

    const d = snap.data()!;
    // Extract kycData from both flat and nested formats
    const kd: Record<string, any> = {};
    for (const [key, value] of Object.entries(d)) {
      if (key.startsWith('kycData.')) kd[key.slice(8)] = value;
    }
    if (d.kycData && typeof d.kycData === 'object') Object.assign(kd, d.kycData);

    // Calculate average rating
    const tripsSnap = await admin.firestore().collection('trips')
      .where('driverId', '==', driverId)
      .where('status', '==', 'COMPLETED')
      .get();
    let totalRating = 0, ratedCount = 0;
    tripsSnap.docs.forEach(t => {
      const r = t.data().rating;
      if (r && r > 0) { totalRating += r; ratedCount++; }
    });
    const avgRating = ratedCount > 0 ? Math.round(totalRating / ratedCount * 10) / 10 : 0;

    res.json({
      found: true,
      name: d.name || 'Driver',
      photoURL: d.photoURL || kd.selfieUrl || '',
      phoneNumber: d.phoneNumber || driverId.replace('phone_', ''),
      vehicleModel: kd.rcMakerModel || '',
      rcNumber: kd.rcNumber || '',
      vehicleCategory: d.vehicleCategory || '',
      rating: avgRating,
      totalTrips: tripsSnap.size,
    });
  } catch (err: any) {
    console.error('[DriverInfo]', err.message);
    res.json({ found: false });
  }
});

// ─── Wallet Deduction Endpoint ───────────────────────────────────────────────
app.post('/api/deduct-fare', async (req, res) => {
  const { customerId, amount, tripId, description } = req.body;
  if (!customerId || !amount || !tripId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const customerRef = admin.firestore().collection('users').doc(customerId);
    const customerSnap = await customerRef.get();
    const currentBalance = customerSnap.data()?.walletBalance ?? 0;

    // Only deduct if wallet has sufficient balance
    if (currentBalance < amount) {
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }

    await customerRef.update({
      walletBalance: admin.firestore.FieldValue.increment(-amount),
    });
    await admin.firestore().collection('users').doc(customerId).collection('transactions').add({
      amount,
      type: 'debit',
      description: description || 'Trip fare',
      tripId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error('[DeductFare]', err.message);
    res.status(500).json({ error: 'Deduction failed' });
  }
});

// ─── Driver Availability Endpoint ────────────────────────────────────────────
app.get('/api/driver-availability', async (_req, res) => {
  try {
    const snap = await admin.firestore().collection('users')
      .where('role', '==', 'DRIVER')
      .where('kycCompleted', '==', true)
      .get();
    const counts: Record<string, number> = {};
    snap.docs.forEach(d => {
      const data = d.data();
      if (data.disabled) return; // skip deactivated drivers
      const cat = data.vehicleCategory;
      if (cat) counts[cat] = (counts[cat] || 0) + 1;
    });
    res.json({ counts });
  } catch (err: any) {
    console.error('[DriverAvailability]', err.message);
    res.json({ counts: {} });
  }
});

// ─── Fare Validation Endpoint ────────────────────────────────────────────────
app.post('/api/validate-fare', async (req, res) => {
  const { origin, destination, vehicleId, clientFare } = req.body;
  if (!origin?.lat || !destination?.lat || !vehicleId || clientFare == null) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY;
    const dmUrl = `https://maps.googleapis.com/maps/api/distancematrix/json`
      + `?origins=${origin.lat},${origin.lng}&destinations=${destination.lat},${destination.lng}`
      + `&mode=driving&region=in&departure_time=now&key=${apiKey}`;
    const dmRes = await axios.get(dmUrl, { timeout: 8000 });
    const el = dmRes.data?.rows?.[0]?.elements?.[0];
    if (!el || el.status !== 'OK') {
      return res.json({ valid: true, reason: 'distance_api_failed' }); // graceful pass
    }

    const distanceKm = el.distance.value / 1000;
    const durationMins = Math.ceil((el.duration_in_traffic?.value || el.duration.value) / 60);

    // Load rates from Firestore
    let rates: Record<string, any> = {};
    try {
      const ratesDoc = await admin.firestore().doc('config/vehicleRates').get();
      if (ratesDoc.exists) rates = ratesDoc.data()?.rates || {};
    } catch { /* use empty, will fall through to default calc */ }

    const rate = rates[vehicleId];
    if (!rate?.baseFare) {
      return res.json({ valid: true, reason: 'rate_not_found' }); // graceful pass
    }

    // Calculate server-side fare
    const billableKm = Math.max(0, distanceKm - (rate.includedKm || 4));
    const baseFare = rate.baseFare || 0;
    const distanceCharge = Math.round(billableKm * (rate.perKmRate || 0));
    const timeCharge = Math.round(durationMins * (rate.perMinuteRate || 0));
    const tripFare = Math.max(baseFare + distanceCharge + timeCharge, rate.minFare || 0);
    const gst = Math.round(tripFare * (rate.gstPercent || 5) / 100);
    const serverFare = tripFare + gst;

    const diff = serverFare > 0 ? Math.abs(clientFare - serverFare) / serverFare : 0;
    const valid = diff <= 0.10;

    res.json({ valid, serverFare, clientFare, difference: Math.round(diff * 100) });
  } catch (err: any) {
    console.error('[FareValidation]', err.message);
    res.json({ valid: true, reason: 'validation_error' }); // graceful pass on error
  }
});

// ─── Surepass KYC Proxy Routes ───────────────────────────────────────────────
const SUREPASS_BASE = process.env.SUREPASS_BASE_URL || 'https://sandbox.surepass.io';

function surepassHeaders() {
  return {
    Authorization: `Bearer ${process.env.SUREPASS_API_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

function surepassError(err: any, res: any, fallback: string) {
  // No response = network/connection error (can't reach Surepass)
  if (!err.response) {
    console.error(`[KYC] Network error — could not reach Surepass: ${err.message} (code: ${err.code})`);
    return res.status(503).json({ success: false, message: `Could not reach verification service: ${err.message}` });
  }
  const status = err.response.status;
  const data = err.response.data;
  const message = data?.message || data?.detail || data?.error?.reason || fallback;
  console.error(`[KYC] Surepass ${status}:`, JSON.stringify(data));
  res.status(status).json({ success: false, message });
}

// Aadhaar OTP — Step 1: generate OTP
app.post('/api/kyc/aadhaar-otp', async (req, res) => {
  const { id_number } = req.body;
  const token = process.env.SUREPASS_API_TOKEN;
  console.log(`[KYC] Aadhaar OTP → id=${id_number?.slice(0,4)}XXXXXXXX, token=${token ? 'SET' : 'MISSING'}`);
  try {
    const r = await axios.post(
      `${SUREPASS_BASE}/api/v1/aadhaar-v2/generate-otp`,
      { id_number },
      { headers: surepassHeaders(), timeout: 15000 }
    );
    console.log(`[KYC] Aadhaar OTP response:`, JSON.stringify(r.data));
    res.json(r.data);
  } catch (err) { surepassError(err, res, 'Failed to send Aadhaar OTP'); }
});

// Aadhaar OTP — Step 2: verify OTP
app.post('/api/kyc/aadhaar-verify', async (req, res) => {
  const { client_id, otp } = req.body;
  try {
    const r = await axios.post(
      `${SUREPASS_BASE}/api/v1/aadhaar-v2/submit-otp`,
      { client_id, otp },
      { headers: surepassHeaders(), timeout: 15000 }
    );
    res.json(r.data);
  } catch (err) { surepassError(err, res, 'Aadhaar OTP verification failed'); }
});

// PAN Comprehensive verification
app.post('/api/kyc/pan', async (req, res) => {
  const { id_number } = req.body;
  try {
    const r = await axios.post(
      `${SUREPASS_BASE}/api/v1/pan/pan-comprehensive`,
      { id_number },
      { headers: surepassHeaders(), timeout: 15000 }
    );
    res.json(r.data);
  } catch (err) { surepassError(err, res, 'PAN verification failed'); }
});

// Driving License verification
app.post('/api/kyc/driving-license', async (req, res) => {
  const { id_number, dob } = req.body;
  try {
    const DL_BASE = process.env.SUREPASS_OCR_BASE_URL || 'https://kyc-api.surepass.app';
    const r = await axios.post(
      `${DL_BASE}/api/v1/driving-license/driving-license`,
      { id_number, dob },
      { headers: surepassHeaders(), timeout: 15000 }
    );
    res.json(r.data);
  } catch (err) { surepassError(err, res, 'Driving License verification failed'); }
});

// RC (Vehicle Registration) verification
app.post('/api/kyc/rc', async (req, res) => {
  const { id_number } = req.body;
  try {
    const RC_BASE = process.env.SUREPASS_OCR_BASE_URL || 'https://kyc-api.surepass.app';
    const r = await axios.post(
      `${RC_BASE}/api/v1/rc/rc-lite`,
      { id_number },
      { headers: surepassHeaders(), timeout: 15000 }
    );
    res.json(r.data);
  } catch (err) { surepassError(err, res, 'RC verification failed'); }
});

// Face match — selfie vs Aadhaar photo
// Aadhaar OCR — front or back image upload → Surepass OCR
// Client sends: { image: base64string }
// Surepass expects: multipart/form-data with 'file' field
app.post('/api/kyc/aadhaar-ocr', async (req, res) => {
  const { image } = req.body;
  if (!image) return res.status(400).json({ success: false, message: 'Image is required' });
  try {
    const OCR_BASE = process.env.SUREPASS_OCR_BASE_URL || 'https://kyc-api.surepass.app';
    const buffer = Buffer.from(image, 'base64');
    const form = new FormData();
    form.append('file', buffer, { filename: 'aadhaar.jpg', contentType: 'image/jpeg' });
    const r = await axios.post(
      `${OCR_BASE}/api/v1/ocr/aadhaar`,
      form,
      { headers: { ...form.getHeaders(), Authorization: `Bearer ${process.env.SUREPASS_API_TOKEN}` }, timeout: 30000 }
    );
    const fields = r.data?.data?.ocr_fields?.[0] || {};
    res.json({
      success: true,
      data: {
        document_type: fields.document_type || '',
        full_name: fields.full_name?.value || '',
        gender: fields.gender?.value || '',
        dob: fields.dob?.value || '',
        aadhaar_number: fields.aadhaar_number?.value || '',
        address: fields.address?.value || fields.address || null,
        raw: fields,
      },
    });
  } catch (err) { surepassError(err, res, 'Aadhaar OCR failed'); }
});

// PAN Card OCR
app.post('/api/kyc/pan-ocr', async (req, res) => {
  const { image } = req.body;
  if (!image) return res.status(400).json({ success: false, message: 'Image is required' });
  try {
    const OCR_BASE = process.env.SUREPASS_OCR_BASE_URL || 'https://kyc-api.surepass.app';
    const buffer = Buffer.from(image, 'base64');
    const form = new FormData();
    form.append('file', buffer, { filename: 'pan.jpg', contentType: 'image/jpeg' });
    const r = await axios.post(
      `${OCR_BASE}/api/v1/ocr/pan`,
      form,
      { headers: { ...form.getHeaders(), Authorization: `Bearer ${process.env.SUREPASS_API_TOKEN}` }, timeout: 30000 }
    );
    const fields = r.data?.data?.ocr_fields?.[0] || {};
    res.json({
      success: true,
      data: {
        name: fields.name?.value || fields.full_name?.value || '',
        pan_number: fields.pan_number?.value || fields.pan?.value || '',
        dob: fields.dob?.value || '',
        father_name: fields.father_name?.value || '',
        raw: fields,
      },
    });
  } catch (err) { surepassError(err, res, 'PAN OCR failed'); }
});

app.post('/api/kyc/face-match', async (req, res) => {
  const { selfie_base64, aadhaar_photo } = req.body;
  try {
    let file2 = aadhaar_photo;
    // If aadhaar_photo is a URL, download it and convert to base64
    if (typeof aadhaar_photo === 'string' && aadhaar_photo.startsWith('http')) {
      const photoRes = await axios.get(aadhaar_photo, {
        responseType: 'arraybuffer',
        headers: { Authorization: `Bearer ${process.env.SUREPASS_API_TOKEN}` },
        timeout: 10000,
      });
      file2 = Buffer.from(photoRes.data).toString('base64');
    }
    const r = await axios.post(
      `${SUREPASS_BASE}/api/v1/face/face-match`,
      { file1: selfie_base64, file2 },
      { headers: surepassHeaders(), timeout: 30000 }
    );
    res.json(r.data);
  } catch (err) { surepassError(err, res, 'Face match failed'); }
});
// ─────────────────────────────────────────────────────────────────────────────

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    // Redirect /admin to /admin.html for convenience
    app.get("/admin", (req, res) => res.redirect("/admin.html"));
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve static files from dist
    app.use(express.static("dist"));
    // Admin panel routes
    app.get("/admin", (req, res) => {
      res.sendFile("dist/admin.html", { root: "." });
    });
    app.get("/admin.html", (req, res) => {
      res.sendFile("dist/admin.html", { root: "." });
    });
    // All other routes → main app
    app.get("*", (req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
