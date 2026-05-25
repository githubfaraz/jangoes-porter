import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Map, AdvancedMarker } from '@vis.gl/react-google-maps';

// Public receiver-side tracking page. Mounted at /rd/:tripId — no auth.
// Polls /api/public-trip/:tripId every 8s for live status + driver location.
// Intentionally minimal: status banner, driver card, map with markers.

type PublicTrip = {
  tripId: string;
  status: string;
  serviceType: string;
  pickup: { address: string; lat: number; lng: number } | null;
  dropoff: { address: string; lat: number; lng: number } | null;
  vehicleType: string;
  senderName: string;
  receiverName: string;
  driverLocation: { lat: number; lng: number; ts?: number } | null;
  driver: { name: string; photoURL: string; rcNumber: string; vehicleCategory: string } | null;
  createdAt: string | null;
};

const POLL_MS = 8000;

const STATUS_COPY: Record<string, { title: string; sub: string; pillColor: string }> = {
  SEARCHING:               { title: 'Looking for a driver',    sub: 'Sender just booked your delivery', pillColor: 'bg-slate-100 text-slate-600' },
  ACCEPTED:                { title: 'Driver assigned',         sub: 'On the way to pick up the package', pillColor: 'bg-blue-100 text-blue-700' },
  ARRIVED_AT_PICKUP:       { title: 'Driver at pickup',        sub: 'Collecting from sender now',        pillColor: 'bg-amber-100 text-amber-700' },
  PICKING_UP:              { title: 'Picking up',              sub: 'Package being loaded',              pillColor: 'bg-amber-100 text-amber-700' },
  IN_TRANSIT:              { title: 'On the way to you',       sub: 'Driver is heading to your location', pillColor: 'bg-primary/10 text-primary' },
  ARRIVED_AT_DESTINATION:  { title: 'Driver has arrived',      sub: 'Please share the OTP from the sender', pillColor: 'bg-green-100 text-green-700' },
  DROPPING_OFF:            { title: 'Handing over',            sub: 'Final delivery in progress',        pillColor: 'bg-green-100 text-green-700' },
  COMPLETED:               { title: 'Delivered',               sub: 'Trip completed',                    pillColor: 'bg-green-100 text-green-700' },
  CANCELLED:               { title: 'Trip cancelled',          sub: 'This delivery was cancelled',       pillColor: 'bg-red-100 text-red-700' },
};

function statusCopy(status: string) {
  return STATUS_COPY[status] || { title: status.replace(/_/g, ' '), sub: '', pillColor: 'bg-slate-100 text-slate-600' };
}

function vehicleCategoryLabel(s: string): string {
  const key = (s || '').toLowerCase();
  if (key.includes('bike') || key.includes('2 wheeler')) return '2 Wheeler';
  if (key.includes('tata-ace') || key.includes('mini')) return 'Mini Truck';
  if (key.includes('bolero') || key.includes('pickup')) return 'Pickup Truck';
  if (key.includes('tata-407') || key.includes('medium')) return 'Medium Truck';
  if (key.includes('large')) return 'Large Truck';
  if (key.includes('car') || key.includes('4 wheeler')) return '4 Wheeler';
  return s || 'Vehicle';
}

const RecipientTracking: React.FC = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const [trip, setTrip] = useState<PublicTrip | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!tripId) {
      setError('Invalid tracking link.');
      setLoading(false);
      return;
    }
    let cancelled = false;

    const fetchTrip = async () => {
      try {
        const r = await fetch(`/api/public-trip/${encodeURIComponent(tripId)}`);
        if (!r.ok) {
          if (cancelled) return;
          setError(r.status === 404 ? 'Trip not found.' : 'Could not load tracking.');
          setLoading(false);
          return;
        }
        const data: PublicTrip = await r.json();
        if (cancelled) return;
        setTrip(data);
        setError('');
        setLoading(false);
        // Stop polling on terminal status.
        if (data.status === 'COMPLETED' || data.status === 'CANCELLED'
          || data.status === 'EXCHANGE_COMPLETED' || data.status === 'EXCHANGE_FAILED') {
          if (timerRef.current) clearInterval(timerRef.current);
        }
      } catch {
        if (cancelled) return;
        setError('Network error. Retrying…');
        setLoading(false);
      }
    };

    fetchTrip();
    timerRef.current = setInterval(fetchTrip, POLL_MS);
    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [tripId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-primary text-4xl animate-spin">sync</span>
          <p className="text-sm font-medium text-slate-500">Loading tracking…</p>
        </div>
      </div>
    );
  }

  if (error && !trip) {
    return (
      <div className="flex items-center justify-center h-screen bg-white p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="material-symbols-outlined text-red-500 text-4xl">error</span>
          <p className="text-base font-bold">{error}</p>
          <p className="text-xs text-slate-400">Ask the sender for a fresh link.</p>
        </div>
      </div>
    );
  }

  if (!trip) return null;

  const copy = statusCopy(trip.status);
  const mapCenter = trip.driverLocation
    ? { lat: trip.driverLocation.lat, lng: trip.driverLocation.lng }
    : trip.dropoff
      ? { lat: trip.dropoff.lat, lng: trip.dropoff.lng }
      : trip.pickup
        ? { lat: trip.pickup.lat, lng: trip.pickup.lng }
        : { lat: 28.6139, lng: 77.2090 };

  return (
    <div className="flex flex-col h-screen bg-background-light dark:bg-background-dark font-sans">
      <header className="bg-white dark:bg-surface-dark px-5 pt-12 pb-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-primary">local_shipping</span>
          <span className="font-black text-base tracking-tight">JANGOES.COM</span>
          <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-slate-400">
            CRN{trip.tripId.slice(0, 10).toUpperCase()}
          </span>
        </div>
        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${copy.pillColor}`}>
          <span className="size-1.5 rounded-full bg-current"></span>
          {copy.title}
        </div>
        {copy.sub && <p className="text-xs text-slate-500 mt-2">{copy.sub}</p>}
      </header>

      <div className="relative flex-1 min-h-0">
        <Map
          mapId="jangoes-recipient-map"
          defaultCenter={mapCenter}
          center={mapCenter}
          defaultZoom={14}
          disableDefaultUI
          gestureHandling="greedy"
          style={{ width: '100%', height: '100%' }}
        >
          {trip.pickup && (
            <AdvancedMarker position={{ lat: trip.pickup.lat, lng: trip.pickup.lng }}>
              <div className="size-6 bg-primary rounded-full ring-4 ring-white shadow-md"></div>
            </AdvancedMarker>
          )}
          {trip.dropoff && (
            <AdvancedMarker position={{ lat: trip.dropoff.lat, lng: trip.dropoff.lng }}>
              <div className="size-6 bg-red-500 rounded-full ring-4 ring-white shadow-md"></div>
            </AdvancedMarker>
          )}
          {trip.driverLocation && (
            <AdvancedMarker position={{ lat: trip.driverLocation.lat, lng: trip.driverLocation.lng }}>
              <div className="flex items-center justify-center size-10 bg-white rounded-full shadow-xl border-2 border-primary">
                <span className="material-symbols-outlined text-primary text-lg">two_wheeler</span>
              </div>
            </AdvancedMarker>
          )}
        </Map>
      </div>

      <div className="bg-white dark:bg-surface-dark shadow-[0_-4px_16px_rgba(0,0,0,0.05)] p-5 space-y-4">
        {trip.driver && (
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
              {trip.driver.photoURL
                ? <img src={trip.driver.photoURL} alt="" className="w-full h-full object-cover" />
                : <span className="material-symbols-outlined text-slate-400">person</span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black truncate">{trip.driver.rcNumber || vehicleCategoryLabel(trip.vehicleType)}</p>
              <p className="text-xs text-slate-500 truncate">
                {vehicleCategoryLabel(trip.vehicleType)} · {trip.driver.name}
              </p>
            </div>
          </div>
        )}

        <div className="relative">
          <div className="absolute left-[7px] top-3 bottom-3 w-px border-l-2 border-dashed border-slate-200"></div>
          {trip.pickup && (
            <div className="flex items-start gap-3 mb-3">
              <div className="size-4 rounded-full bg-primary ring-2 ring-white mt-1 shrink-0 z-10"></div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pickup</p>
                <p className="text-xs font-medium truncate">{trip.senderName ? `${trip.senderName} · ` : ''}{trip.pickup.address}</p>
              </div>
            </div>
          )}
          {trip.dropoff && (
            <div className="flex items-start gap-3">
              <div className="size-4 rounded-full bg-red-500 ring-2 ring-white mt-1 shrink-0 z-10"></div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Drop</p>
                <p className="text-xs font-medium truncate">{trip.receiverName ? `${trip.receiverName} · ` : ''}{trip.dropoff.address}</p>
              </div>
            </div>
          )}
        </div>

        <p className="text-[10px] text-center text-slate-400">
          You're viewing a live tracking link for a Jangoes delivery.
        </p>
      </div>
    </div>
  );
};

export default RecipientTracking;
