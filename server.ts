import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import FormData from "form-data";
import crypto from "crypto";
import dotenv from "dotenv";
import admin from "firebase-admin";
import nodemailer from "nodemailer";

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

// ─── Send Delivery OTP to Receiver ──────────────────────────────────────────
app.post('/api/send-delivery-otp', async (req, res) => {
  const { receiverPhone, otp } = req.body;
  if (!receiverPhone || !otp) return res.status(400).json({ error: 'Missing fields' });

  // Clean phone number
  const phone = receiverPhone.replace(/[^0-9]/g, '').slice(-10);
  if (phone.length !== 10) return res.json({ success: true, demo: true });

  const smsUkey = (process.env.SMS_UKEY || "").replace(/^"(.*)"$/, '$1').trim();
  const smsSender = (process.env.SMS_SENDER || "").replace(/^"(.*)"$/, '$1').trim();
  const smsTemplateId = (process.env.SMS_TEMPLATE_ID || "").replace(/^"(.*)"$/, '$1').trim();
  const smsDltTemplateId = (process.env.SMS_DLT_TEMPLATE_ID || "").replace(/^"(.*)"$/, '$1').trim();
  const smsCreditType = (process.env.SMS_CREDIT_TYPE || "7").replace(/^"(.*)"$/, '$1').trim();

  if (!smsUkey || !smsSender || !smsTemplateId) {
    console.log(`[DEMO] Delivery OTP for ${phone}: ${otp}`);
    return res.json({ success: true, demo: true, otp });
  }

  try {
    // Use the same template-based POST API as auth OTP (DLT compliant)
    const payload = {
      filetype: 1,
      language: 0,
      credittype: Number(smsCreditType) || 2,
      senderid: smsSender,
      templateid: Number(smsTemplateId),
      ukey: smsUkey,
      isrefno: true,
      dlttemplateid: Number(smsDltTemplateId),
      msisdnlist: [{ phoneno: phone, arg1: otp }],
    };

    const smsRes = await axios.post(
      "https://api.voicensms.in/SMSAPI/webresources/CreateSMSCampaignPost",
      payload,
      { timeout: 10000, headers: { 'Content-Type': 'application/json' } }
    );

    console.log(`[SMS] Delivery OTP sent to ${phone}:`, JSON.stringify(smsRes.data));
    if (smsRes.data?.status === 'success' || smsRes.data?.status === 'Success') {
      res.json({ success: true });
    } else {
      console.error('[SMS] Delivery OTP API error:', JSON.stringify(smsRes.data));
      res.json({ success: true, demo: true, otp });
    }
  } catch (err: any) {
    console.error('[SMS] Delivery OTP failed:', err.message);
    console.log(`[DEMO] Delivery OTP for ${phone}: ${otp}`);
    res.json({ success: true, demo: true, otp });
  }
});

// ─── Public Receiver Tracking Endpoint ───────────────────────────────────────
// Backs the /rd/:tripId page. Returns a sanitized projection of the trip so
// an unauthenticated receiver (link recipient) can see status, driver, and
// route info — without exposing phones, OTPs, fare, or customer identifiers.
app.get('/api/public-trip/:tripId', async (req, res) => {
  try {
    const { tripId } = req.params;
    const snap = await admin.firestore().collection('trips').doc(tripId).get();
    if (!snap.exists) return res.status(404).json({ error: 'not_found' });
    const t: any = snap.data();

    let driver: any = null;
    if (t.driverId) {
      try {
        const dSnap = await admin.firestore().collection('users').doc(t.driverId).get();
        if (dSnap.exists) {
          const d: any = dSnap.data();
          const kd: any = (d.kycData && typeof d.kycData === 'object') ? d.kycData : {};
          driver = {
            name: d.name || 'Driver',
            photoURL: d.photoURL || kd.selfieUrl || '',
            rcNumber: kd.rcNumber || '',
            vehicleCategory: d.vehicleCategory || '',
          };
        }
      } catch { /* driver fetch is best-effort */ }
    }

    res.json({
      tripId,
      status: t.status,
      serviceType: t.serviceType || 'parcel',
      pickup: t.pickup ? { address: t.pickup.address, lat: t.pickup.lat, lng: t.pickup.lng } : null,
      dropoff: t.dropoff ? { address: t.dropoff.address, lat: t.dropoff.lat, lng: t.dropoff.lng } : null,
      vehicleType: t.vehicleType || '',
      senderName: t.senderName || '',
      receiverName: t.receiverName || '',
      driverLocation: t.driverLocation || null,
      driver,
      createdAt: t.createdAt?.toDate?.()?.toISOString?.() || t.createdAt || null,
    });
  } catch (err: any) {
    console.error('[PublicTrip]', err.message);
    res.status(500).json({ error: 'fetch_failed' });
  }
});

// Bare-URL alias: WhatsApp shares jangoes.com/rd/<tripId> (no hash). Redirect
// to the HashRouter route. Registered ABOVE Vite middleware so it wins.
app.get('/rd/:tripId', (req, res) => {
  res.redirect(302, `/#/rd/${encodeURIComponent(req.params.tripId)}`);
});

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
// ─── Mail Invoice Endpoint ───────────────────────────────────────────────────
// Renders an HTML invoice for a given trip and emails it to the recipient via
// SMTP. Requires the following env vars (provision before going live):
//   SMTP_HOST       e.g. smtp.gmail.com
//   SMTP_PORT       e.g. 465 (SSL) or 587 (STARTTLS)
//   SMTP_USER       e.g. invoices@yourdomain.com  (or your Gmail address)
//   SMTP_PASS       Gmail "App Password" or provider API key
//   SMTP_FROM       e.g. "Jangoes Porter <invoices@yourdomain.com>"  (defaults to SMTP_USER)
// When any of HOST/USER/PASS is missing the endpoint returns 503 with a
// human-readable error so the client can show a useful toast.
app.post('/api/email-invoice', async (req, res) => {
  const { tripId, recipientEmail } = req.body;
  if (!tripId || !recipientEmail) {
    return res.status(400).json({ error: 'Missing tripId or recipientEmail' });
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;
  if (!host || !user || !pass) {
    return res.status(503).json({
      error: 'email_not_configured',
      message: 'Server email is not configured yet. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env.',
    });
  }

  try {
    const snap = await admin.firestore().collection('trips').doc(tripId).get();
    if (!snap.exists) return res.status(404).json({ error: 'Trip not found' });
    const trip: any = snap.data();

    const crn = `CRN${tripId.slice(0, 10).toUpperCase()}`;
    const total = Number(trip.fare ?? 0);
    const f = trip.finalFare;
    const tripFare = Number(f?.tripFare ?? trip.estimatedTotal ?? total);
    const taxable = Number(f?.taxable ?? tripFare);
    const gst = Number(f?.gst ?? 0);
    const couponDiscount = Number(trip.couponDiscount ?? 0);
    const couponLine = couponDiscount > 0
      ? `<tr><td>Coupon discount${trip.couponCode ? ` (${trip.couponCode})` : ''}</td><td style="text-align:right;color:#16a34a">−₹${couponDiscount.toFixed(2)}</td></tr>`
      : '';
    const rounding = +(total - taxable - gst + couponDiscount).toFixed(2);
    const roundingLine = rounding !== 0
      ? `<tr><td>Rounding</td><td style="text-align:right">₹${rounding.toFixed(2)}</td></tr>`
      : '';
    const paymentLabel = trip.paymentMethod === 'cash' ? 'Cash'
      : trip.paymentMethod === 'online' ? 'Online'
      : 'Wallet';

    const html = `
      <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
        <h1 style="margin:0 0 4px;font-size:22px">Jangoes Porter — Invoice</h1>
        <p style="margin:0 0 24px;color:#64748b;font-size:13px">${crn} · ${new Date(trip.createdAt?.toDate?.() || trip.createdAt || Date.now()).toLocaleString('en-IN')}</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
          <tr><td style="padding:6px 0;color:#64748b">Pickup</td><td style="padding:6px 0;text-align:right">${trip.pickup?.address || '—'}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Drop</td><td style="padding:6px 0;text-align:right">${trip.dropoff?.address || '—'}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Vehicle</td><td style="padding:6px 0;text-align:right">${trip.vehicleType || '—'}</td></tr>
        </table>
        <h3 style="margin:0 0 8px;font-size:15px">Fare details</h3>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:4px 0">Trip Fare</td><td style="padding:4px 0;text-align:right">₹${tripFare.toFixed(2)}</td></tr>
          ${couponLine}
          <tr><td style="padding:4px 0;border-top:1px solid #e2e8f0">Fare Without Tax</td><td style="padding:4px 0;text-align:right;border-top:1px solid #e2e8f0">₹${taxable.toFixed(2)}</td></tr>
          <tr><td style="padding:4px 0">IGST Tax (5%)</td><td style="padding:4px 0;text-align:right">₹${gst.toFixed(2)}</td></tr>
          ${roundingLine}
          <tr><td style="padding:8px 0;font-weight:700;border-top:1px solid #e2e8f0">Total Order Fare</td><td style="padding:8px 0;text-align:right;font-weight:700;border-top:1px solid #e2e8f0">₹${total.toFixed(2)}</td></tr>
        </table>
        <h3 style="margin:20px 0 8px;font-size:15px">Payment</h3>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:4px 0">${paymentLabel}</td><td style="padding:4px 0;text-align:right">₹${total.toFixed(2)}</td></tr>
        </table>
        <p style="margin-top:24px;color:#94a3b8;font-size:11px">Thanks for booking with Jangoes Porter.</p>
      </div>`;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    await transporter.sendMail({
      from,
      to: recipientEmail,
      subject: `Jangoes Porter — Invoice ${crn}`,
      html,
    });
    res.json({ success: true });
  } catch (err: any) {
    console.error('[EmailInvoice]', err.message);
    res.status(500).json({ error: 'send_failed', message: err.message });
  }
});

// ─── Coupon Validation Endpoint ──────────────────────────────────────────────
// Reads coupons/{CODE} (uppercase) from Firestore. Validates window, usage
// limit, min-order. Does NOT increment usedCount — that happens on trip
// creation (see /api/redeem-coupon below) so a customer who validates but
// doesn't book doesn't burn a slot.
//
// Coupon doc shape (created manually in Firebase console for now):
//   { code: 'SAVE100', discountType: 'flat' | 'percent', discountValue: 100,
//     validFrom?: ISO string, validUntil?: ISO string,
//     usageLimit?: number, usedCount?: number,
//     minOrderAmount?: number }
app.post('/api/validate-coupon', async (req, res) => {
  const { code, orderAmount } = req.body;
  if (!code) return res.status(400).json({ valid: false, reason: 'Missing code' });

  try {
    const id = String(code).toUpperCase().trim();
    const snap = await admin.firestore().collection('coupons').doc(id).get();
    if (!snap.exists) return res.json({ valid: false, reason: 'Invalid coupon code' });

    const c: any = snap.data();
    // Backwards-compat: coupons created before the active-flag rollout are
    // missing the field — treat absent === active. Only an explicit `false`
    // disables the coupon.
    if (c.active === false) {
      return res.json({ valid: false, reason: 'Coupon is currently inactive' });
    }
    const now = Date.now();
    if (c.validFrom && now < new Date(c.validFrom).getTime()) {
      return res.json({ valid: false, reason: 'Coupon not yet active' });
    }
    if (c.validUntil && now > new Date(c.validUntil).getTime()) {
      return res.json({ valid: false, reason: 'Coupon expired' });
    }
    if (c.usageLimit != null && (c.usedCount ?? 0) >= c.usageLimit) {
      return res.json({ valid: false, reason: 'Coupon usage limit reached' });
    }
    const amount = Number(orderAmount ?? 0);
    if (c.minOrderAmount != null && amount < c.minOrderAmount) {
      return res.json({ valid: false, reason: `Minimum order ₹${c.minOrderAmount} required` });
    }

    let discount = 0;
    if (c.discountType === 'flat') {
      discount = Number(c.discountValue) || 0;
    } else if (c.discountType === 'percent') {
      discount = Math.round((amount * (Number(c.discountValue) || 0)) / 100 * 100) / 100;
    } else {
      return res.json({ valid: false, reason: 'Coupon misconfigured' });
    }
    // Cap discount at the order amount so total never goes negative.
    discount = Math.min(discount, amount);

    res.json({ valid: true, code: id, discount, discountType: c.discountType });
  } catch (err: any) {
    console.error('[ValidateCoupon]', err.message);
    res.status(500).json({ valid: false, reason: 'Validation error' });
  }
});

// Increments coupons/{CODE}.usedCount atomically, idempotently per trip.
// Client passes `tripId`; we create coupons/{CODE}/redemptions/{tripId} inside
// a Firestore transaction — if the doc already exists, we no-op. This makes
// double-tap on Confirm Booking (and any retry) safe.
//
// Back-compat: callers that don't pass a tripId still get the old "increment
// once per call" behavior. New OrderSummary.tsx always passes one.
app.post('/api/redeem-coupon', async (req, res) => {
  const { code, tripId } = req.body;
  if (!code) return res.status(400).json({ error: 'Missing code' });
  try {
    const id = String(code).toUpperCase().trim();
    const couponRef = admin.firestore().collection('coupons').doc(id);

    if (!tripId) {
      await couponRef.update({ usedCount: admin.firestore.FieldValue.increment(1) });
      return res.json({ success: true, idempotent: false });
    }

    const redemptionRef = couponRef.collection('redemptions').doc(String(tripId));
    const result = await admin.firestore().runTransaction(async (tx) => {
      const existing = await tx.get(redemptionRef);
      if (existing.exists) return { applied: false };
      tx.set(redemptionRef, { tripId, redeemedAt: admin.firestore.FieldValue.serverTimestamp() });
      tx.update(couponRef, { usedCount: admin.firestore.FieldValue.increment(1) });
      return { applied: true };
    });
    res.json({ success: true, applied: result.applied });
  } catch (err: any) {
    console.error('[RedeemCoupon]', err.message);
    res.status(500).json({ error: 'increment_failed' });
  }
});

app.get('/api/driver-availability', async (_req, res) => {
  try {
    // `roles` is the durable list of roles the user has registered for; `role`
    // is the active view, which flips when the user toggles between Driver and
    // Customer. Use the array so a driver who's currently viewing as Customer
    // still gets counted.
    const snap = await admin.firestore().collection('users')
      .where('roles', 'array-contains', 'DRIVER')
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
    // Return 503 (not an empty `counts`) so the client can distinguish a
    // backend/network failure from a genuine "0 drivers in every category".
    res.status(503).json({ error: 'availability_unavailable', message: err.message });
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
