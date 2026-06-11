// App-level overlay shown to drivers on every screen.
//
// Subscribes (only while the driver is online + KYC clear) to trips with
// status SEARCHING that match the driver's vehicle category and are within
// MAX_RADIUS_KM of the driver's current GPS location. When a match arrives,
// renders a fixed-position popup with Accept / Decline. Accepting transitions
// the trip to ACCEPTED and navigates to /active-trip; Declining just adds the
// trip ID to a session-scoped exclusion set so it stops being matched here.
//
// Mounted once at App.tsx (when the user is a verified driver), so the popup
// fires regardless of which route the driver is on. Previously this lived in
// Dashboard.tsx and only fired while /dashboard was visible.

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../src/firebase.ts';
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore';
import { BookingStatus, Trip } from '../../types.ts';
import { extractKycData } from '../../services/kycHelper.ts';
import { useDriverOnline } from '../../src/driverOnline.ts';
import { paymentLabel, paymentIcon, isCashPayment } from '../../src/settlement.ts';

const MAX_RADIUS_KM = 5;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

function getPendingDocs(kd: any): string[] {
  const out: string[] = [];
  if (kd?.panStatus === 'pending_review') out.push('PAN Card');
  if (kd?.dlStatus === 'pending_review') out.push('Driving License');
  if (kd?.rcVerifyStatus === 'pending_review') out.push('RC / Vehicle Registration');
  return out;
}

const TripRequestOverlay: React.FC = () => {
  const navigate = useNavigate();
  const [isOnline] = useDriverOnline();

  const [vehicleCategory, setVehicleCategory] = useState('');
  const [pendingDocs, setPendingDocs] = useState<string[]>([]);
  const [isDriverDisabled, setIsDriverDisabled] = useState(false);
  const [driverLat, setDriverLat] = useState<number | null>(null);
  const [driverLng, setDriverLng] = useState<number | null>(null);

  const [showRequest, setShowRequest] = useState(false);
  const [currentRequest, setCurrentRequest] = useState<(Trip & { id: string }) | null>(null);
  const declinedTripsRef = useRef<Set<string>>(new Set());
  const geoWatchRef = useRef<number | null>(null);

  // Refs mirror the latest values so the trip listener stays subscribed across
  // GPS/KYC updates instead of tearing down on every coord tick. Without these,
  // the listener would re-subscribe every ~10s (GPS) and on each KYC snapshot,
  // creating small windows where new SEARCHING trips weren't matched on screens
  // other than /dashboard.
  const vehicleCategoryRef = useRef(vehicleCategory);
  const pendingDocsCountRef = useRef(pendingDocs.length);
  const isDriverDisabledRef = useRef(isDriverDisabled);
  const driverLatRef = useRef<number | null>(driverLat);
  const driverLngRef = useRef<number | null>(driverLng);
  useEffect(() => { vehicleCategoryRef.current = vehicleCategory; }, [vehicleCategory]);
  useEffect(() => { pendingDocsCountRef.current = pendingDocs.length; }, [pendingDocs]);
  useEffect(() => { isDriverDisabledRef.current = isDriverDisabled; }, [isDriverDisabled]);
  useEffect(() => { driverLatRef.current = driverLat; }, [driverLat]);
  useEffect(() => { driverLngRef.current = driverLng; }, [driverLng]);

  // ── KYC + vehicle-category listener ───────────────────────────────────────
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      setVehicleCategory(d.vehicleCategory || '');
      setIsDriverDisabled(d.disabled === true);
      const kd = extractKycData(d);
      setPendingDocs(getPendingDocs(kd));
    });
    return () => unsubscribe();
  }, []);

  // ── GPS while online ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOnline || !('geolocation' in navigator)) {
      if (geoWatchRef.current !== null) {
        navigator.geolocation.clearWatch(geoWatchRef.current);
        geoWatchRef.current = null;
      }
      return;
    }
    geoWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setDriverLat(pos.coords.latitude);
        setDriverLng(pos.coords.longitude);
      },
      (err) => console.warn('[TripRequestOverlay] geolocation error:', err.message),
      { enableHighAccuracy: true, maximumAge: 10000 },
    );
    return () => {
      if (geoWatchRef.current !== null) {
        navigator.geolocation.clearWatch(geoWatchRef.current);
        geoWatchRef.current = null;
      }
    };
  }, [isOnline]);

  // ── Trip listener ─────────────────────────────────────────────────────────
  // Depends ONLY on isOnline so the snapshot stays subscribed across GPS
  // ticks and KYC updates. Other inputs (vehicle category, distance, etc.)
  // are read from refs on each snapshot fire.
  useEffect(() => {
    if (!isOnline) {
      setShowRequest(false);
      setCurrentRequest(null);
      return;
    }
    const q = query(collection(db, 'trips'), where('status', '==', BookingStatus.SEARCHING));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (pendingDocsCountRef.current > 0 || isDriverDisabledRef.current) {
        setShowRequest(false);
        setCurrentRequest(null);
        return;
      }
      if (snapshot.empty) {
        setShowRequest(false);
        setCurrentRequest(null);
        return;
      }
      const lat = driverLatRef.current;
      const lng = driverLngRef.current;
      const vCat = vehicleCategoryRef.current;
      const match = snapshot.docs.find(d => {
        if (declinedTripsRef.current.has(d.id)) return false;
        const data = d.data();
        const tripVehicleId = data.vehicleId || '';
        if (vCat && tripVehicleId !== vCat) return false;
        if (lat !== null && lng !== null && data.pickup?.lat && data.pickup?.lng) {
          const distKm = haversineKm(lat, lng, data.pickup.lat, data.pickup.lng);
          if (distKm > MAX_RADIUS_KM) return false;
        }
        return true;
      });
      if (match) {
        setCurrentRequest({ ...(match.data() as Trip), id: match.id });
        setShowRequest(true);
      } else {
        setShowRequest(false);
        setCurrentRequest(null);
      }
    });
    return () => unsubscribe();
  }, [isOnline]);

  // If status changes server-side (another driver accepted), drop the popup.
  useEffect(() => {
    if (!currentRequest?.id) return;
    const unsub = onSnapshot(doc(db, 'trips', currentRequest.id), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (data.status !== BookingStatus.SEARCHING) {
        setShowRequest(false);
        setCurrentRequest(null);
      }
    });
    return () => unsub();
  }, [currentRequest?.id]);

  const handleAccept = async () => {
    if (!currentRequest || !auth.currentUser) return;
    try {
      await updateDoc(doc(db, 'trips', currentRequest.id), {
        status: BookingStatus.ACCEPTED,
        driverId: auth.currentUser.uid,
        acceptedAt: new Date().toISOString(),
      });
      setShowRequest(false);
      navigate('/active-trip', { state: { tripId: currentRequest.id } });
    } catch (error: any) {
      console.error('[TripRequestOverlay] accept error:', error?.code, error?.message);
      alert('Failed to accept trip: ' + (error?.message || 'Unknown error'));
    }
  };

  const handleDecline = () => {
    if (currentRequest?.id) declinedTripsRef.current.add(currentRequest.id);
    setShowRequest(false);
    setCurrentRequest(null);
  };

  if (!showRequest || !currentRequest) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[40px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col">
        <div className="bg-primary p-8 text-white relative">
          <div className="flex justify-between items-start mb-6">
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80">
                {currentRequest.serviceType === 'exchange' ? 'Exchange Request' : 'New Pickup Request'}
              </span>
              {currentRequest.serviceType === 'exchange' && (
                <span className="text-[9px] font-black bg-rose-500 text-white px-2 py-0.5 rounded-full mt-1 inline-block">ROUNDTRIP EXCHANGE</span>
              )}
              <h3 className="text-4xl font-black tracking-tight mt-1">₹{currentRequest.fare || '450.00'}</h3>
            </div>
            <div className="size-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/20 animate-bounce">
              <span className="material-symbols-outlined text-3xl">local_shipping</span>
            </div>
          </div>
          <div className="flex gap-6">
            <div className="flex flex-col">
              <span className="text-[9px] font-black opacity-70 uppercase tracking-widest">Vehicle</span>
              <span className="text-sm font-black">{currentRequest.vehicleType || 'Mini Truck'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-black opacity-70 uppercase tracking-widest">Sender</span>
              <span className="text-sm font-black">{currentRequest.senderName || 'Customer'}</span>
            </div>
          </div>

          {/* Payment mode — tells the driver whether to collect cash on delivery */}
          <div className="mt-5 flex items-center gap-2 bg-white/15 border border-white/20 rounded-2xl px-4 py-3 backdrop-blur-md">
            <span className="material-symbols-outlined text-xl">{paymentIcon(currentRequest.paymentMethod)}</span>
            <div className="flex flex-col">
              <span className="text-[9px] font-black opacity-70 uppercase tracking-widest">Payment Mode</span>
              <span className="text-sm font-black">{paymentLabel(currentRequest.paymentMethod)}</span>
            </div>
            <span className="ml-auto text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-white/20">
              {isCashPayment(currentRequest.paymentMethod) ? 'Collect Cash' : 'Prepaid'}
            </span>
          </div>
        </div>

        <div className="p-8 flex flex-col gap-8">
          <div className="flex flex-col gap-6 relative">
            <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-slate-100 dark:bg-slate-800 border-l border-dashed"></div>
            <div className="flex items-start gap-4">
              <div className="size-4 rounded-full bg-accent mt-1 relative z-10 border-4 border-white dark:border-slate-900 shadow-sm"></div>
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pickup</span>
                <span className="text-sm font-black text-slate-900 dark:text-white">{currentRequest.pickup?.address || 'Pickup'}</span>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="size-4 rounded-full bg-red-500 mt-1 relative z-10 border-4 border-white dark:border-slate-900 shadow-sm"></div>
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Dropoff</span>
                <span className="text-sm font-black text-slate-900 dark:text-white">{currentRequest.dropoff?.address || 'Dropoff'}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleDecline}
              className="flex-1 h-16 bg-slate-50 dark:bg-slate-800 text-slate-500 font-black rounded-2xl text-[10px] uppercase tracking-widest active:scale-95 transition-all"
            >
              Decline
            </button>
            <button
              onClick={handleAccept}
              className="flex-[2] h-16 bg-primary text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-primary/30 active:scale-95 transition-all"
            >
              Accept Request
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TripRequestOverlay;
