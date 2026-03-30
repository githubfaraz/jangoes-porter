import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { db } from '../../src/firebase.ts';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { BookingStatus, Trip } from '../../types.ts';
import { Map, AdvancedMarker } from '@vis.gl/react-google-maps';

const Tracking: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const tripId = location.state?.tripId;
  const [trip, setTrip] = useState<Trip | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [tripCompleted, setTripCompleted] = useState(false);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [qcRejectionReason, setQcRejectionReason] = useState('');
  const [isSubmittingQc, setIsSubmittingQc] = useState(false);

  // Real driver info fetched from Firestore
  const [driverName, setDriverName] = useState('');
  const [driverPhoto, setDriverPhoto] = useState('');
  const [driverVehicle, setDriverVehicle] = useState('');
  const [driverRcNumber, setDriverRcNumber] = useState('');
  const [driverRating, setDriverRating] = useState<number>(0);
  const [driverPhone, setDriverPhone] = useState('');
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [notification, setNotification] = useState<{ title: string; message: string } | null>(null);
  const prevStatusRef = useRef<string>('');

  useEffect(() => {
    if (!tripId) return;

    const unsubscribe = onSnapshot(doc(db, 'trips', tripId), async (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Trip;
        setTrip(data);
        if (data.status === BookingStatus.COMPLETED) {
          setTripCompleted(true);
        }
        // Show notification on status change
        const prev = prevStatusRef.current;
        if (prev && data.status !== prev) {
          const notifs: Record<string, { title: string; message: string }> = {
            [BookingStatus.ACCEPTED]: { title: 'Driver Assigned', message: 'A driver has accepted your booking and is on the way to pickup.' },
            [BookingStatus.ARRIVED_AT_PICKUP]: { title: 'Driver Arrived', message: 'Driver has reached the pickup location.' },
            [BookingStatus.IN_TRANSIT]: { title: 'Parcel Picked Up', message: 'Your parcel is on the way to the destination.' },
            [BookingStatus.ARRIVED_AT_DESTINATION]: { title: 'At Destination', message: 'Driver has reached the drop-off location.' },
            [BookingStatus.DROPPING_OFF]: { title: 'Delivering', message: 'Driver is delivering your parcel to the receiver.' },
            // Exchange-specific
            [BookingStatus.ARRIVED_AT_RECEIVER]: { title: 'At Receiver', message: 'Driver has reached the receiver to collect Product B.' },
            [BookingStatus.PICKING_UP_PRODUCT_B]: { title: 'Collecting Product B', message: 'Driver is collecting Product B from the receiver.' },
            [BookingStatus.QC_PENDING]: { title: 'QC Submitted', message: 'Driver submitted quality check. Please review and approve.' },
            [BookingStatus.QC_APPROVED]: { title: 'QC Approved', message: 'You approved Product B. Driver is returning it to you.' },
            [BookingStatus.QC_REJECTED]: { title: 'QC Rejected', message: 'You rejected Product B. Driver will return your original item.' },
            [BookingStatus.RETURNING_PRODUCT_B]: { title: 'Returning Product B', message: 'Driver is on the way back with Product B.' },
            [BookingStatus.RETURNING_PRODUCT_A]: { title: 'Exchange Failed', message: 'Driver is returning your original item (Product A).' },
            [BookingStatus.ARRIVED_AT_ORIGIN_RETURN]: { title: 'Driver Arrived', message: 'Driver has arrived to hand over the item.' },
          };
          const n = notifs[data.status];
          if (n) {
            setNotification(n);
            setTimeout(() => setNotification(null), 5000);
          }
        }
        prevStatusRef.current = data.status;
        // Track driver live location
        if (data.driverLocation?.lat && data.driverLocation?.lng) {
          setDriverLocation({ lat: data.driverLocation.lat, lng: data.driverLocation.lng });
        }
        // Fetch real driver info when trip is accepted and we have a driverId
        if (data.driverId && !driverName) {
          try {
            const res = await fetch(`/api/driver-info/${data.driverId}`);
            const info = await res.json();
            if (info.found) {
              setDriverName(info.name);
              setDriverPhoto(info.photoURL || '');
              setDriverVehicle(info.vehicleModel || data.vehicleType || 'Vehicle');
              setDriverRcNumber(info.rcNumber || '');
              setDriverPhone(info.phoneNumber || '');
              if (info.rating > 0) setDriverRating(info.rating);
            }
          } catch (err) {
            console.error('Error fetching driver info:', err);
          }
        }
      }
    });

    return () => unsubscribe();
  }, [tripId]);

  const handleCancelOrder = async () => {
    if (!tripId) return;
    setIsCancelling(true);
    try {
      await updateDoc(doc(db, 'trips', tripId), {
        status: BookingStatus.CANCELLED,
        cancelReason,
        cancelledBy: 'customer',
        updatedAt: new Date().toISOString(),
      });
      setShowCancelModal(false);
      navigate('/home');
    } catch (err) {
      console.error('Cancel error:', err);
      alert('Failed to cancel. Please try again.');
    } finally {
      setIsCancelling(false);
    }
  };

  const cancelReasons = [
    "Expected shorter wait time",
    "Driver asked to cancel",
    "Incorrect pickup/drop location",
    "Booked another vehicle",
    "My plan changed"
  ];

  // Exchange completion screens
  if (trip?.status === BookingStatus.EXCHANGE_COMPLETED) {
    return (
      <div className="min-h-screen w-full bg-white flex flex-col items-center justify-center p-8 text-center">
        <div className="size-24 rounded-full bg-green-100 flex items-center justify-center text-green-600 mb-6">
          <span className="material-symbols-outlined text-5xl filled">swap_horiz</span>
        </div>
        <h2 className="text-3xl font-black mb-2">Exchange Successful!</h2>
        <p className="text-slate-500 mb-8">Product B has been delivered to you successfully.</p>
        <button onClick={() => navigate('/home')} className="w-full h-16 bg-primary text-white font-black rounded-2xl shadow-xl">GO HOME</button>
      </div>
    );
  }

  if (trip?.status === BookingStatus.EXCHANGE_FAILED) {
    return (
      <div className="min-h-screen w-full bg-white flex flex-col items-center justify-center p-8 text-center">
        <div className="size-24 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 mb-6">
          <span className="material-symbols-outlined text-5xl filled">assignment_return</span>
        </div>
        <h2 className="text-3xl font-black mb-2">Exchange Could Not Be Completed</h2>
        <p className="text-slate-500 mb-2">Your original item (Product A) has been safely returned to you.</p>
        <p className="text-xs text-slate-400 mb-8">Reason: {trip?.exchange?.failureReason?.replace(/_/g, ' ') || 'Unknown'}</p>
        <button onClick={() => navigate('/home')} className="w-full h-16 bg-primary text-white font-black rounded-2xl shadow-xl">GO HOME</button>
      </div>
    );
  }

  // QC Review screen — shown when driver submits QC for exchange
  if (trip?.status === BookingStatus.QC_PENDING && trip?.exchange?.qcChecklist) {
    const qc = trip.exchange.qcChecklist;
    return (
      <div className="min-h-screen w-full bg-white dark:bg-slate-950 flex flex-col">
        <header className="px-6 pt-14 pb-4 border-b dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-lg font-black">Quality Check Review</h2>
          <span className="material-symbols-outlined text-amber-500 text-2xl">rate_review</span>
        </header>
        <main className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-6">
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-4 flex items-center gap-3">
            <span className="material-symbols-outlined text-amber-500 text-xl animate-pulse">hourglass_top</span>
            <div>
              <p className="text-sm font-black text-amber-800">Driver submitted QC for Product B</p>
              <p className="text-xs text-amber-600">Review and approve or reject</p>
            </div>
          </div>

          {/* QC Photos */}
          {qc.photos?.length > 0 && (
            <div>
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">QC Photos</h4>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {qc.photos.map((url: string, i: number) => (
                  <img key={i} src={url} alt={`QC ${i + 1}`} className="w-40 h-40 rounded-2xl object-cover border shrink-0" />
                ))}
              </div>
            </div>
          )}

          {/* Product B Photos */}
          {trip.exchange.productB.images?.length > 0 && (
            <div>
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Product B Photos</h4>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {trip.exchange.productB.images.map((url: string, i: number) => (
                  <img key={i} src={url} alt={`Product B ${i + 1}`} className="w-40 h-40 rounded-2xl object-cover border shrink-0" />
                ))}
              </div>
            </div>
          )}

          {/* Remarks */}
          {qc.remarks && (
            <div>
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Driver's Remarks</h4>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
                <p className="text-sm text-slate-700 dark:text-slate-300">{qc.remarks}</p>
              </div>
            </div>
          )}

          {/* Rejection reason input */}
          <div>
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Rejection Reason (required if rejecting)</h4>
            <textarea value={qcRejectionReason} onChange={e => setQcRejectionReason(e.target.value)}
              placeholder="Enter reason if you want to reject..."
              rows={2} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:border-primary" />
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pb-8">
            <button
              onClick={async () => {
                if (!qcRejectionReason.trim()) { alert('Please enter a rejection reason'); return; }
                setIsSubmittingQc(true);
                try {
                  await updateDoc(doc(db, 'trips', tripId), {
                    status: BookingStatus.QC_REJECTED,
                    'exchange.qcDecision': 'rejected',
                    'exchange.qcDecisionAt': new Date().toISOString(),
                    'exchange.qcRejectionReason': qcRejectionReason.trim(),
                  });
                } catch (e) { console.error(e); alert('Failed to reject'); }
                finally { setIsSubmittingQc(false); }
              }}
              disabled={isSubmittingQc}
              className="flex-1 h-14 bg-red-500 text-white font-black rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span className="material-symbols-outlined">close</span>Reject
            </button>
            <button
              onClick={async () => {
                setIsSubmittingQc(true);
                try {
                  await updateDoc(doc(db, 'trips', tripId), {
                    status: BookingStatus.QC_APPROVED,
                    'exchange.qcDecision': 'approved',
                    'exchange.qcDecisionAt': new Date().toISOString(),
                  });
                } catch (e) { console.error(e); alert('Failed to approve'); }
                finally { setIsSubmittingQc(false); }
              }}
              disabled={isSubmittingQc}
              className="flex-[2] h-14 bg-green-600 text-white font-black rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg"
            >
              <span className="material-symbols-outlined">check</span>Approve Product B
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (tripCompleted) {
    return (
      <div className="min-h-screen w-full bg-white flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
        <div className="size-24 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-6">
          <span className="material-symbols-outlined text-5xl filled">verified</span>
        </div>
        <h2 className="text-3xl font-black mb-2">Package Delivered!</h2>
        <p className="text-slate-500 mb-8">Your package has been successfully delivered. How was your experience?</p>
        
        <div className="w-full bg-slate-50 rounded-3xl p-8 mb-8">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Rate the Rider & Service</p>
          <div className="flex justify-center gap-3 mb-6">
            {[1, 2, 3, 4, 5].map(i => (
              <button 
                key={i} 
                onClick={() => setRating(i)}
                className={`material-symbols-outlined text-4xl transition-all ${rating >= i ? 'text-amber-400 filled scale-110' : 'text-slate-300'}`}
              >
                star
              </button>
            ))}
          </div>
          <textarea
            placeholder="Any feedback? (optional)"
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-sm focus:ring-primary focus:border-primary"
            rows={3}
          ></textarea>
        </div>

        <button
          onClick={async () => {
            if (!tripId) { navigate('/home'); return; }
            setIsSubmittingRating(true);
            try {
              await updateDoc(doc(db, 'trips', tripId), {
                rating: rating || 0,
                feedback: feedback.trim(),
                ratedAt: new Date().toISOString(),
              });
            } catch (err) {
              console.error('Rating save error:', err);
            }
            setIsSubmittingRating(false);
            navigate('/home');
          }}
          disabled={isSubmittingRating}
          className="w-full h-16 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/30 disabled:opacity-50"
        >
          {isSubmittingRating ? 'Submitting...' : 'SUBMIT & GO HOME'}
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full flex flex-col bg-background-light dark:bg-background-dark overflow-hidden text-slate-900">
      {/* Status Notification Banner */}
      {notification && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[200] w-full max-w-md px-4 animate-in slide-in-from-top duration-500">
          <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-4">
            <div className="size-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined">notifications_active</span>
            </div>
            <div className="flex flex-col flex-1">
              <span className="text-xs font-black uppercase tracking-widest text-primary">{notification.title}</span>
              <p className="text-sm font-medium opacity-90">{notification.message}</p>
            </div>
            <button onClick={() => setNotification(null)} className="text-white/50 shrink-0">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>
      )}
      {/* Live Map Area */}
      <div className="h-[40%] w-full relative shrink-0">
        <Map
          mapId="jangoes-tracking-map"
          defaultCenter={{ lat: trip?.pickup?.lat ?? 28.6139, lng: trip?.pickup?.lng ?? 77.2090 }}
          defaultZoom={13}
          disableDefaultUI
          gestureHandling="none"
          style={{ width: '100%', height: '100%' }}
        >
          {trip?.pickup && (
            <AdvancedMarker position={{ lat: trip.pickup.lat, lng: trip.pickup.lng }}>
              <div className="flex flex-col items-center">
                <div className="bg-primary text-white text-[9px] font-black px-2 py-1 rounded-lg mb-1 shadow-lg">PICKUP</div>
                <span className="material-symbols-outlined text-primary text-3xl filled drop-shadow-lg">location_on</span>
              </div>
            </AdvancedMarker>
          )}
          {trip?.dropoff && (
            <AdvancedMarker position={{ lat: trip.dropoff.lat, lng: trip.dropoff.lng }}>
              <div className="flex flex-col items-center">
                <div className="bg-red-500 text-white text-[9px] font-black px-2 py-1 rounded-lg mb-1 shadow-lg">DROP</div>
                <span className="material-symbols-outlined text-red-500 text-3xl filled drop-shadow-lg">location_on</span>
              </div>
            </AdvancedMarker>
          )}
          {/* Driver live location marker */}
          {driverLocation && trip?.status !== BookingStatus.SEARCHING && (
            <AdvancedMarker position={driverLocation}>
              <div className="flex flex-col items-center animate-pulse">
                <div className="bg-green-500 text-white text-[9px] font-black px-2 py-1 rounded-lg mb-1 shadow-lg">DRIVER</div>
                <div className="size-8 bg-green-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                  <span className="material-symbols-outlined text-white text-lg filled">local_shipping</span>
                </div>
              </div>
            </AdvancedMarker>
          )}
        </Map>

        <div className="absolute top-0 left-0 w-full p-4 z-10 pt-12 flex justify-between items-center">
          <button onClick={() => navigate('/home')} className="w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center">
            <span className="material-symbols-outlined">close</span>
          </button>
          <div className="bg-white/90 px-4 py-2 rounded-full shadow-sm font-bold text-sm">
            {trip?.status === BookingStatus.SEARCHING && 'Searching for driver...'}
            {trip?.status === BookingStatus.ACCEPTED && 'Driver is on the way to pickup'}
            {trip?.status === BookingStatus.ARRIVED_AT_PICKUP && 'Driver arrived at pickup'}
            {trip?.status === BookingStatus.PICKING_UP && 'Picking up your parcel'}
            {trip?.status === BookingStatus.IN_TRANSIT && (trip?.serviceType === 'exchange' ? 'Heading to receiver location' : 'Parcel is on the way')}
            {trip?.status === BookingStatus.ARRIVED_AT_DESTINATION && 'Driver arrived at destination'}
            {trip?.status === BookingStatus.DROPPING_OFF && 'Delivering your parcel'}
            {trip?.status === BookingStatus.ARRIVED_AT_RECEIVER && 'Driver at receiver location'}
            {trip?.status === BookingStatus.PICKING_UP_PRODUCT_B && 'Collecting Product B'}
            {trip?.status === BookingStatus.QC_PENDING && 'Review Quality Check'}
            {trip?.status === BookingStatus.QC_APPROVED && 'QC Approved — returning'}
            {trip?.status === BookingStatus.QC_REJECTED && 'QC Rejected — returning original'}
            {trip?.status === BookingStatus.RETURNING_PRODUCT_B && 'Returning Product B to you'}
            {trip?.status === BookingStatus.RETURNING_PRODUCT_A && 'Returning Product A to you'}
            {trip?.status === BookingStatus.ARRIVED_AT_ORIGIN_RETURN && 'Driver arrived for handover'}
          </div>
          <div className="w-10"></div>
        </div>
      </div>

      <div className="flex-1 relative z-20 bg-white dark:bg-slate-900 rounded-t-[40px] -mt-8 shadow-2xl p-5 pb-10 overflow-y-auto no-scrollbar">
        <div className="w-full flex justify-center py-3">
          <div className="w-12 h-1.5 bg-slate-200 rounded-full"></div>
        </div>
        
        {trip?.status !== BookingStatus.SEARCHING ? (
          <>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4">
              <div className="flex items-center gap-4">
                {driverPhoto ? (
                  <div
                    className="size-14 rounded-full bg-cover bg-center border-2 border-white shadow-md shrink-0"
                    style={{ backgroundImage: `url('${driverPhoto}')` }}
                  />
                ) : (
                  <div className="size-14 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center border-2 border-white shadow-md shrink-0">
                    <span className="material-symbols-outlined text-slate-400 text-2xl">person</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg dark:text-white truncate">{driverName || 'Driver'}</h3>
                    {driverRating > 0 && (
                      <span className="flex items-center gap-0.5 bg-green-100 text-green-700 text-xs font-black px-2 py-0.5 rounded-full shrink-0">
                        <span className="material-symbols-outlined text-xs filled">star</span>
                        {driverRating}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300 font-semibold truncate">{driverVehicle}</p>
                  {driverRcNumber && (
                    <p className="text-xs text-slate-400 font-mono tracking-wider mt-0.5">{driverRcNumber}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => navigate('/chat', { state: { tripId } })}
                  className="flex-1 h-10 bg-white dark:bg-slate-700 rounded-xl flex items-center justify-center gap-2 text-slate-600 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-slate-600"
                >
                  <span className="material-symbols-outlined text-lg">chat</span>Chat
                </button>
                <a href={driverPhone ? `tel:+91${driverPhone}` : '#'} className="flex-1 h-10 bg-primary/10 rounded-xl flex items-center justify-center gap-2 text-primary text-xs font-bold">
                  <span className="material-symbols-outlined text-lg filled">call</span>Call
                </a>
              </div>
            </div>

            {/* Show appropriate OTP based on trip stage */}
            {(() => {
              const isExchange = trip?.serviceType === 'exchange';
              const isReturnStage = [BookingStatus.RETURNING_PRODUCT_B, BookingStatus.RETURNING_PRODUCT_A, BookingStatus.ARRIVED_AT_ORIGIN_RETURN].includes(trip?.status as BookingStatus);

              if (isExchange && isReturnStage) {
                return (
                  <div className="mt-6 bg-amber-50 dark:bg-amber-900/10 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-amber-600 tracking-widest mb-1">Return OTP</span>
                      <span className="text-2xl font-bold tracking-[0.2em] font-mono dark:text-white">{trip?.exchange?.returnOtp || '----'}</span>
                    </div>
                    <span className="material-symbols-outlined text-amber-500 text-3xl">shield</span>
                  </div>
                );
              }

              // Exchange: show handover OTP when driver is heading to or at receiver
              const isHandoverStage = [BookingStatus.IN_TRANSIT, BookingStatus.ARRIVED_AT_RECEIVER].includes(trip?.status as BookingStatus);
              if (isExchange && isHandoverStage) {
                return (
                  <div className="mt-6 bg-rose-50 dark:bg-rose-900/10 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-rose-600 tracking-widest mb-1">Handover OTP (share with receiver)</span>
                      <span className="text-2xl font-bold tracking-[0.2em] font-mono dark:text-white">{trip?.exchange?.productAHandoverOtp || '----'}</span>
                    </div>
                    <span className="material-symbols-outlined text-rose-500 text-3xl">swap_horiz</span>
                  </div>
                );
              }

              // Default: show pickup OTP
              return (
                <div className="mt-6 bg-blue-50 dark:bg-primary/10 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-primary tracking-widest mb-1">Pickup OTP</span>
                    <span className="text-2xl font-bold tracking-[0.2em] font-mono dark:text-white">{trip?.pickupPin || '----'}</span>
                  </div>
                  <span className="material-symbols-outlined text-primary text-3xl">shield</span>
                </div>
              );
            })()}
          </>
        ) : (
          <div className="py-10 flex flex-col items-center text-center gap-4">
            <div className="relative size-20">
              <div className="absolute inset-0 border-4 border-primary/10 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-3xl animate-pulse">search</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="font-black text-xl dark:text-white">Finding a Rider</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Assigning the nearest vehicle...</p>
            </div>
          </div>
        )}

        {/* Live Progress Timeline */}
        {(() => {
          const isExchangeTrip = trip?.serviceType === 'exchange';
          const s = trip?.status as BookingStatus;

          const exchangeDoneStatuses = (targets: BookingStatus[]) => targets.includes(s);

          const exchangeSteps = [
            { key: 'placed', label: 'Order Placed', sub: 'Exchange booking confirmed', icon: 'check_circle', done: true },
            { key: 'assigned', label: 'Driver Assigned', sub: driverName ? `${driverName} assigned` : 'Finding a driver', icon: 'person_pin', done: s !== BookingStatus.SEARCHING },
            { key: 'product_a', label: 'Product A Picked Up', sub: 'Driver collected your item', icon: 'inventory_2',
              done: exchangeDoneStatuses([BookingStatus.IN_TRANSIT, BookingStatus.ARRIVED_AT_RECEIVER, BookingStatus.PICKING_UP_PRODUCT_B, BookingStatus.QC_PENDING, BookingStatus.QC_APPROVED, BookingStatus.QC_REJECTED, BookingStatus.RETURNING_PRODUCT_B, BookingStatus.RETURNING_PRODUCT_A, BookingStatus.ARRIVED_AT_ORIGIN_RETURN, BookingStatus.EXCHANGE_COMPLETED, BookingStatus.EXCHANGE_FAILED]) },
            { key: 'at_receiver', label: 'At Receiver Location', sub: 'Driver at receiver for exchange', icon: 'location_on',
              done: exchangeDoneStatuses([BookingStatus.ARRIVED_AT_RECEIVER, BookingStatus.PICKING_UP_PRODUCT_B, BookingStatus.QC_PENDING, BookingStatus.QC_APPROVED, BookingStatus.QC_REJECTED, BookingStatus.RETURNING_PRODUCT_B, BookingStatus.RETURNING_PRODUCT_A, BookingStatus.ARRIVED_AT_ORIGIN_RETURN, BookingStatus.EXCHANGE_COMPLETED, BookingStatus.EXCHANGE_FAILED]) },
            { key: 'product_b', label: 'Product B Collected', sub: 'Return item collected', icon: 'package_2',
              done: exchangeDoneStatuses([BookingStatus.QC_PENDING, BookingStatus.QC_APPROVED, BookingStatus.RETURNING_PRODUCT_B, BookingStatus.ARRIVED_AT_ORIGIN_RETURN, BookingStatus.EXCHANGE_COMPLETED]) },
            ...(trip?.exchange?.qcRequired ? [{ key: 'qc', label: 'Quality Check',
              sub: trip?.exchange?.qcDecision === 'approved' ? 'Approved' : trip?.exchange?.qcDecision === 'rejected' ? 'Rejected' : 'Awaiting your review',
              icon: 'verified',
              done: exchangeDoneStatuses([BookingStatus.QC_APPROVED, BookingStatus.QC_REJECTED, BookingStatus.RETURNING_PRODUCT_B, BookingStatus.RETURNING_PRODUCT_A, BookingStatus.ARRIVED_AT_ORIGIN_RETURN, BookingStatus.EXCHANGE_COMPLETED, BookingStatus.EXCHANGE_FAILED]) }] : []),
            { key: 'returning', label: 'Returning to You', sub: trip?.exchange?.failureReason ? 'Returning Product A' : 'Returning Product B', icon: 'undo',
              done: exchangeDoneStatuses([BookingStatus.RETURNING_PRODUCT_B, BookingStatus.RETURNING_PRODUCT_A, BookingStatus.ARRIVED_AT_ORIGIN_RETURN, BookingStatus.EXCHANGE_COMPLETED, BookingStatus.EXCHANGE_FAILED]) },
            { key: 'done', label: 'Completed', sub: 'Exchange finished', icon: 'task_alt',
              done: exchangeDoneStatuses([BookingStatus.EXCHANGE_COMPLETED, BookingStatus.EXCHANGE_FAILED]) },
          ];

          const parcelSteps = [
            { key: 'placed', label: 'Order Placed', sub: 'Booking confirmed', icon: 'check_circle', done: true },
            { key: 'assigned', label: 'Driver Assigned', sub: driverName ? `${driverName} is assigned` : 'Finding a driver', icon: 'person_pin', done: s !== BookingStatus.SEARCHING },
            { key: 'at_pickup', label: 'Arrived at Pickup', sub: 'Driver reached pickup point', icon: 'location_on', done: [BookingStatus.ARRIVED_AT_PICKUP, BookingStatus.PICKING_UP, BookingStatus.IN_TRANSIT, BookingStatus.ARRIVED_AT_DESTINATION, BookingStatus.DROPPING_OFF].includes(s) },
            { key: 'picked_up', label: 'Parcel Picked Up', sub: 'On the way to destination', icon: 'inventory_2', done: [BookingStatus.IN_TRANSIT, BookingStatus.ARRIVED_AT_DESTINATION, BookingStatus.DROPPING_OFF].includes(s) },
            { key: 'at_dest', label: 'At Destination', sub: 'Driver reached drop location', icon: 'flag', done: [BookingStatus.ARRIVED_AT_DESTINATION, BookingStatus.DROPPING_OFF].includes(s) },
            { key: 'delivered', label: 'Delivered', sub: 'Parcel handed over', icon: 'verified', done: s === BookingStatus.COMPLETED },
          ];

          const steps = isExchangeTrip ? exchangeSteps : parcelSteps;
          const activeIdx = steps.findIndex(st => !st.done);
          return (
            <div className="mt-6 flex flex-col gap-4 relative pl-2">
              <div className="absolute left-[13px] top-3 bottom-3 w-[2px] bg-slate-100 dark:bg-slate-800"></div>
              {steps.map((s, i) => (
                <div key={s.key} className={`flex items-start gap-4 relative ${!s.done && i !== activeIdx ? 'opacity-40' : ''}`}>
                  <div className={`z-10 size-7 rounded-full flex items-center justify-center ring-4 ring-white dark:ring-slate-900 shrink-0 ${
                    s.done ? 'bg-green-500 text-white' :
                    i === activeIdx ? 'bg-primary text-white animate-pulse' :
                    'bg-slate-200 dark:bg-slate-800 text-slate-400'
                  }`}>
                    <span className="material-symbols-outlined text-sm">{s.done ? 'check' : s.icon}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-sm font-bold ${s.done || i === activeIdx ? 'dark:text-white' : 'text-slate-400'}`}>{s.label}</span>
                    <span className="text-xs text-slate-400">{s.sub}</span>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Simulation Button for Demo */}
        {!tripId && (
          <div className="mt-8">
            <button
              onClick={() => setTripCompleted(true)}
              className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold text-xs uppercase tracking-widest rounded-2xl"
            >
              Simulate Trip Completion (Demo)
            </button>
          </div>
        )}

        {/* Cancellation Trigger */}
        <div className="mt-4 pt-6 border-t dark:border-slate-800">
           <button 
            onClick={() => setShowCancelModal(true)}
            className="w-full py-4 text-red-500 font-bold text-sm uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-2xl transition-colors"
           >
             <span className="material-symbols-outlined">cancel</span>
             Cancel Ride
           </button>
        </div>
      </div>

      {/* Cancellation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div 
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-[40px] shadow-2xl p-8 animate-in slide-in-from-bottom duration-500"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-8"></div>
            <h3 className="text-2xl font-black mb-2 dark:text-white">Cancel Ride?</h3>
            <p className="text-sm text-slate-500 mb-8">Please let us know why you want to cancel. This helps us improve our service.</p>
            
            <div className="flex flex-col gap-3 mb-10">
              {cancelReasons.map((reason) => (
                <button 
                  key={reason}
                  onClick={() => setCancelReason(reason)}
                  className={`w-full p-4 rounded-2xl text-left text-sm font-bold transition-all border-2 ${
                    cancelReason === reason 
                    ? 'border-primary bg-primary/5 text-primary' 
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
                Go Back
              </button>
              <button
                onClick={handleCancelOrder}
                disabled={!cancelReason || isCancelling}
                className="flex-[2] h-16 bg-red-500 disabled:opacity-30 text-white font-black rounded-2xl text-xs uppercase tracking-widest shadow-xl shadow-red-500/20"
              >
                {isCancelling ? 'Cancelling...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tracking;
