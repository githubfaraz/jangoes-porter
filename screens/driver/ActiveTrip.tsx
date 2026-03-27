import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { db } from '../../src/firebase.ts';
import { doc, onSnapshot, updateDoc, getDoc } from 'firebase/firestore';
import { uploadToCloudinary } from '../../services/cloudinaryUpload.ts';
import { BookingStatus, Trip } from '../../types.ts';
import ExchangeTrip from './ExchangeTrip.tsx';

enum TripStep {
  EN_ROUTE_TO_PICKUP,
  ARRIVED_AT_PICKUP,
  PICKING_UP,
  IN_TRANSIT,
  ARRIVED_AT_DESTINATION,
  DROPPING_OFF,
  COMPLETED
}

const ActiveTrip: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const tripId = location.state?.tripId;
  const [trip, setTrip] = useState<Trip | null>(null);
  const [step, setStep] = useState<TripStep>(TripStep.EN_ROUTE_TO_PICKUP);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [pickupPinInput, setPickupPinInput] = useState('');
  const [dropoffOtpInput, setDropoffOtpInput] = useState('');
  const [parcelImage, setParcelImage] = useState<string | null>(null);
  const [isUploadingParcel, setIsUploadingParcel] = useState(false);
  const [showNotification, setShowNotification] = useState<{title: string, message: string} | null>(null);
  const parcelInputRef = useRef<HTMLInputElement>(null);

  // Real customer info
  const [customerName, setCustomerName] = useState('');
  const [customerPhoto, setCustomerPhoto] = useState('');
  const locationWatchRef = useRef<number | null>(null);

  // ── Driver GPS location tracking — updates Firestore every 10 seconds ──
  useEffect(() => {
    if (!tripId || step === TripStep.COMPLETED) return;

    let lastUpdate = 0;
    const UPDATE_INTERVAL = 10000; // 10 seconds

    if ('geolocation' in navigator) {
      locationWatchRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const now = Date.now();
          if (now - lastUpdate < UPDATE_INTERVAL) return;
          lastUpdate = now;
          updateDoc(doc(db, 'trips', tripId), {
            driverLocation: {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              updatedAt: new Date().toISOString(),
            },
          }).catch(() => {});
        },
        (err) => console.warn('Geolocation error:', err.message),
        { enableHighAccuracy: true, maximumAge: 5000 }
      );
    }

    return () => {
      if (locationWatchRef.current !== null) {
        navigator.geolocation.clearWatch(locationWatchRef.current);
        locationWatchRef.current = null;
      }
    };
  }, [tripId, step]);

  useEffect(() => {
    if (!tripId) return;

    const unsubscribe = onSnapshot(doc(db, 'trips', tripId), async (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Trip;
        setTrip(data);

        // Sync step with status
        if (data.status === BookingStatus.ACCEPTED) setStep(TripStep.EN_ROUTE_TO_PICKUP);
        if (data.status === BookingStatus.ARRIVED_AT_PICKUP) setStep(TripStep.ARRIVED_AT_PICKUP);
        if (data.status === BookingStatus.PICKING_UP) setStep(TripStep.PICKING_UP);
        if (data.status === BookingStatus.IN_TRANSIT) setStep(TripStep.IN_TRANSIT);
        if (data.status === BookingStatus.ARRIVED_AT_DESTINATION) setStep(TripStep.ARRIVED_AT_DESTINATION);
        if (data.status === BookingStatus.DROPPING_OFF) setStep(TripStep.DROPPING_OFF);
        if (data.status === BookingStatus.COMPLETED) setStep(TripStep.COMPLETED);

        // Fetch real customer info
        if (data.customerId && !customerName) {
          try {
            const custDoc = await getDoc(doc(db, 'users', data.customerId));
            if (custDoc.exists()) {
              const cd = custDoc.data();
              setCustomerName(cd.name || data.senderName || 'Customer');
              setCustomerPhoto(cd.photoURL || '');
            }
          } catch (err) {
            console.error('Error fetching customer info:', err);
            setCustomerName(data.senderName || 'Customer');
          }
        }
      }
    });

    return () => unsubscribe();
  }, [tripId]);

  const updateTripStatus = async (status: BookingStatus, extraData: any = {}) => {
    if (!tripId) return;
    try {
      await updateDoc(doc(db, 'trips', tripId), {
        status,
        ...extraData,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Update Trip Error:", error);
    }
  };

  const handleCancelTrip = async () => {
    await updateTripStatus(BookingStatus.CANCELLED, { cancelReason });
    setShowCancelModal(false);
    navigate('/dashboard');
  };

  const sendNotification = (title: string, message: string) => {
    setShowNotification({ title, message });
    setTimeout(() => setShowNotification(null), 5000);
  };

  const handleArrivedAtPickup = () => {
    updateTripStatus(BookingStatus.ARRIVED_AT_PICKUP);
    sendNotification("Arrived", "Rider has reached your location for pickup.");
  };

  const handleStartPickup = () => {
    updateTripStatus(BookingStatus.PICKING_UP);
  };

  const handleCaptureParcel = () => {
    parcelInputRef.current?.click();
  };

  const handleParcelFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingParcel(true);
    try {
      // Show local preview immediately
      const localUrl = URL.createObjectURL(file);
      setParcelImage(localUrl);
      // Upload to Cloudinary
      const downloadUrl = await uploadToCloudinary(file, `trips/${tripId}`);
      setParcelImage(downloadUrl);
    } catch (err) {
      console.error('Parcel upload error:', err);
      alert('Failed to upload parcel image. Please try again.');
      setParcelImage(null);
    } finally {
      setIsUploadingParcel(false);
    }
  };

  const handleStartTrip = () => {
    if (!parcelImage) {
      alert("Please capture parcel image first");
      return;
    }
    if (isUploadingParcel) {
      alert("Please wait for the image to finish uploading");
      return;
    }
    if (pickupPinInput !== trip?.pickupPin) {
      alert("Invalid PIN.");
      return;
    }
    updateTripStatus(BookingStatus.IN_TRANSIT, { parcelImageUrl: parcelImage });
    sendNotification("Trip Started", `Your package is on the way! OTP for receiver: ${trip?.dropoffOtp}`);
  };

  const handleArrivedAtDestination = () => {
    updateTripStatus(BookingStatus.ARRIVED_AT_DESTINATION);
    sendNotification("Arrived", "Rider has reached the destination location.");
  };

  const handleStartDropoff = () => {
    updateTripStatus(BookingStatus.DROPPING_OFF);
  };

  const handleCompleteTrip = () => {
    if (dropoffOtpInput === trip?.dropoffOtp) {
      updateTripStatus(BookingStatus.COMPLETED);
    } else {
      alert("Invalid OTP.");
    }
  };

  const handleResendOtp = () => {
    sendNotification("OTP Sent", "New OTP has been sent to the receiver.");
  };

  const cancelReasons = [
    "Vehicle breakdown",
    "Customer unreachable",
    "Customer requested cancellation",
    "Incorrect pickup information",
    "Emergency/Health issue"
  ];

  // Render exchange flow for exchange trips
  if (trip?.serviceType === 'exchange' && tripId) {
    return <ExchangeTrip trip={trip} tripId={tripId} customerName={customerName} customerPhoto={customerPhoto} />;
  }

  if (step === TripStep.COMPLETED) {
    return (
      <div className="min-h-screen w-full bg-white flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
        <div className="size-24 rounded-full bg-green-100 flex items-center justify-center text-green-600 mb-6">
          <span className="material-symbols-outlined text-5xl filled">check_circle</span>
        </div>
        <h2 className="text-3xl font-black mb-2">Trip Completed!</h2>
        <p className="text-slate-500 mb-8">You've successfully delivered the parcel. Great job!</p>
        
        <div className="w-full bg-slate-50 rounded-3xl p-6 mb-8">
          <div className="flex justify-between mb-4">
            <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Earnings</span>
            <span className="font-black text-xl">₹{trip?.fare?.toFixed(2) || '0.00'}</span>
          </div>
          <div className="h-px bg-slate-200 w-full mb-4"></div>
          <div className="flex flex-col gap-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Rate the Customer</p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map(i => (
                <span key={i} className="material-symbols-outlined text-amber-400 text-3xl cursor-pointer">star</span>
              ))}
            </div>
          </div>
        </div>

        <button 
          onClick={() => navigate('/dashboard')}
          className="w-full h-16 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/30"
        >
          BACK TO DASHBOARD
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full flex flex-col bg-background-light dark:bg-background-dark overflow-hidden">
      {/* Minimized Map Area */}
      <div className="h-[40%] w-full relative shrink-0">
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center" 
          style={{ backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuDajtMWJVnhHkGW9y4qP_DD3YC75y6FEzU_xMJVW_PpTk6IsC56AOoJyrSUb8ORsk-atSASVC3ul6TtQglhiQ_3lufaivhFZipFWdXicuDhKOiQeXW2spaPc9gX7XKQqQ7YNiOm5u3MZV6uPTKocJNNXyUh9jP8ieB4FjOvMP4Mnd6pHsYwNr-_hXMQTaZ0uCCJ3UmkmI2aWYjrJlx6ryeeGZvlnL_JuTzeAoMWkyM8_trZBT-p0OX3pyHgHHpwKITdkYnyc6z05w')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-transparent"></div>
        
        <div className="absolute top-0 left-0 w-full p-4 z-10 pt-12 flex justify-between">
          <div className="bg-primary text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2">
            <span className="material-symbols-outlined animate-pulse">navigation</span>
            <span className="text-sm font-bold">
              {step < TripStep.IN_TRANSIT ? `En route to Pickup` : `En route to Dropoff`}
            </span>
          </div>
          <button 
            onClick={() => navigate('/chat', { state: { tripId } })}
            className="size-11 bg-white rounded-xl shadow-md flex items-center justify-center text-primary"
          >
            <span className="material-symbols-outlined">chat</span>
          </button>
        </div>

        {/* Proximity Indicator (Simulated) */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
          <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-xl flex items-center gap-2 border border-white">
            <div className="size-2 rounded-full bg-green-500 animate-ping"></div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">GPS Active • 10m Accuracy</span>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 relative z-20 bg-white dark:bg-slate-900 rounded-t-[40px] -mt-8 shadow-2xl p-6 pb-12 overflow-y-auto no-scrollbar">
        <div className="w-full flex justify-center pb-6">
          <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
        </div>

        <div className="flex flex-col gap-6">
          {/* Customer Info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {customerPhoto ? (
                <div
                  className="size-14 rounded-full bg-cover bg-center border-2 border-slate-100"
                  style={{ backgroundImage: `url('${customerPhoto}')` }}
                />
              ) : (
                <div className="size-14 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center border-2 border-slate-100">
                  <span className="material-symbols-outlined text-slate-400 text-2xl">person</span>
                </div>
              )}
              <div className="flex flex-col">
                <h3 className="font-bold text-lg leading-tight dark:text-white">{customerName || trip?.senderName || 'Customer'}</h3>
                <p className="text-xs text-slate-500">{trip?.vehicleType || 'Parcel Delivery'}</p>
              </div>
            </div>
            <button className="size-12 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined filled">call</span>
            </button>
          </div>

          {/* Trip Progress Steps */}
          <div className="bg-slate-50 dark:bg-slate-800 rounded-3xl p-6 flex flex-col gap-6">
            {step === TripStep.EN_ROUTE_TO_PICKUP && (
              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-4">
                  <div className="size-3 rounded-full bg-primary mt-1.5 shrink-0 ring-4 ring-primary/10"></div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Pickup Location</span>
                    <span className="text-sm font-bold dark:text-white">{trip?.pickup?.address || 'Loading...'}</span>
                  </div>
                </div>
                <button 
                  onClick={handleArrivedAtPickup}
                  className="w-full h-14 bg-primary text-white font-black rounded-2xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined">location_on</span>
                  I HAVE REACHED PICKUP
                </button>
              </div>
            )}

            {step === TripStep.ARRIVED_AT_PICKUP && (
              <div className="flex flex-col gap-4">
                <div className="p-4 bg-green-50 dark:bg-green-900/10 rounded-2xl border border-green-100 dark:border-green-900/20 text-center">
                  <p className="text-xs font-bold text-green-600 uppercase tracking-widest">Arrived at Pickup</p>
                </div>
                <button 
                  onClick={handleStartPickup}
                  className="w-full h-14 bg-primary text-white font-black rounded-2xl shadow-lg shadow-primary/20"
                >
                  START PICKUP PROCESS
                </button>
              </div>
            )}

            {step === TripStep.PICKING_UP && (
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Enter Pickup PIN ({trip?.pickupPin})</label>
                  <input 
                    type="text"
                    maxLength={4}
                    value={pickupPinInput}
                    onChange={(e) => setPickupPinInput(e.target.value)}
                    className="w-full h-14 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-2xl px-5 text-center text-2xl font-black tracking-[0.5em] focus:border-primary transition-all"
                    placeholder="----"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Parcel Image</label>
                  <input
                    ref={parcelInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleParcelFileChange}
                  />
                  {parcelImage ? (
                    <div className="relative rounded-2xl overflow-hidden border-2 border-slate-100 h-40">
                      <img src={parcelImage} className="w-full h-full object-cover" alt="Parcel" />
                      {isUploadingParcel && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <span className="material-symbols-outlined text-white text-3xl animate-spin">sync</span>
                        </div>
                      )}
                      <button
                        onClick={() => { setParcelImage(null); if (parcelInputRef.current) parcelInputRef.current.value = ''; }}
                        className="absolute top-2 right-2 size-8 bg-black/50 text-white rounded-full flex items-center justify-center backdrop-blur-md"
                      >
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleCaptureParcel}
                      className="w-full h-40 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:bg-slate-100 transition-all"
                    >
                      <span className="material-symbols-outlined text-4xl">add_a_photo</span>
                      <span className="text-xs font-bold uppercase tracking-widest">Click Parcel Image</span>
                    </button>
                  )}
                </div>

                <button 
                  onClick={handleStartTrip}
                  className="w-full h-16 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/30 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined">play_arrow</span>
                  START TRIP
                </button>
              </div>
            )}

            {step === TripStep.IN_TRANSIT && (
              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-4">
                  <div className="size-3 rounded-full bg-red-500 mt-1.5 shrink-0 ring-4 ring-red-500/10"></div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Dropoff Location</span>
                    <span className="text-sm font-bold dark:text-white">{trip?.dropoff?.address || 'Loading...'}</span>
                  </div>
                </div>
                <button 
                  onClick={handleArrivedAtDestination}
                  className="w-full h-14 bg-primary text-white font-black rounded-2xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined">location_on</span>
                  I HAVE REACHED DESTINATION
                </button>
              </div>
            )}

            {step === TripStep.ARRIVED_AT_DESTINATION && (
              <div className="flex flex-col gap-4">
                <div className="p-4 bg-green-50 dark:bg-green-900/10 rounded-2xl border border-green-100 dark:border-green-900/20 text-center">
                  <p className="text-xs font-bold text-green-600 uppercase tracking-widest">Arrived at Destination</p>
                </div>
                <button 
                  onClick={handleStartDropoff}
                  className="w-full h-14 bg-primary text-white font-black rounded-2xl shadow-lg shadow-primary/20"
                >
                  START DROPOFF PROCESS
                </button>
              </div>
            )}

            {step === TripStep.DROPPING_OFF && (
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Enter Receiver OTP ({trip?.dropoffOtp})</label>
                  <input 
                    type="text"
                    maxLength={4}
                    value={dropoffOtpInput}
                    onChange={(e) => setDropoffOtpInput(e.target.value)}
                    className="w-full h-14 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-2xl px-5 text-center text-2xl font-black tracking-[0.5em] focus:border-primary transition-all"
                    placeholder="----"
                  />
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={handleResendOtp}
                    className="flex-1 h-14 bg-slate-100 dark:bg-slate-800 text-slate-500 font-black rounded-2xl text-[10px] uppercase tracking-widest"
                  >
                    Resend OTP
                  </button>
                  <button 
                    onClick={handleCompleteTrip}
                    className="flex-[2] h-14 bg-primary text-white font-black rounded-2xl shadow-lg shadow-primary/20"
                  >
                    COMPLETE TRIP
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Cancellation Option */}
          {step < TripStep.IN_TRANSIT && (
            <div className="flex items-center justify-center gap-4">
              <button 
                onClick={() => setShowCancelModal(true)}
                className="text-xs font-black text-slate-400 uppercase tracking-widest py-2 hover:text-red-500 transition-colors"
              >
                Cancel / Report Issue
              </button>
            </div>
          )}
        </div>
      </div>

      {/* In-App Notification Overlay */}
      {showNotification && (
        <div className="fixed top-14 left-4 right-4 z-[200] animate-in slide-in-from-top duration-500">
          <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-4">
            <div className="size-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined">notifications_active</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-black uppercase tracking-widest text-primary">{showNotification.title}</span>
              <p className="text-sm font-medium opacity-90">{showNotification.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div 
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-[40px] shadow-2xl p-8 animate-in slide-in-from-bottom duration-500"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-8"></div>
            <h3 className="text-2xl font-black mb-2 dark:text-white">Cancel Trip?</h3>
            <p className="text-sm text-slate-500 mb-8">Cancelling an active trip might affect your performance rating. Please select a valid reason.</p>
            
            <div className="flex flex-col gap-3 mb-10">
              {cancelReasons.map((reason) => (
                <button 
                  key={reason}
                  onClick={() => setCancelReason(reason)}
                  className={`w-full p-4 rounded-2xl text-left text-sm font-bold transition-all border-2 ${
                    cancelReason === reason 
                    ? 'border-red-500 bg-red-50 dark:bg-red-950/20 text-red-600' 
                    : 'border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setShowCancelModal(false)}
                className="flex-1 h-16 bg-slate-100 dark:bg-slate-800 text-slate-500 font-black rounded-2xl text-xs uppercase tracking-widest"
              >
                No, Back
              </button>
              <button 
                onClick={handleCancelTrip}
                disabled={!cancelReason}
                className="flex-[2] h-16 bg-red-500 disabled:opacity-30 text-white font-black rounded-2xl text-xs uppercase tracking-widest shadow-xl shadow-red-500/20"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActiveTrip;
