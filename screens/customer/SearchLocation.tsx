import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Map, AdvancedMarker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { auth, db } from '../../src/firebase.ts';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface AddressDetails {
  title: string;
  address: string;
  building: string;
  name: string;
  mobile: string;
  type: 'Home' | 'Shop' | 'Other' | null;
}

type ViewState = 'route_summary' | 'search_selection' | 'map_picker' | 'details_form';

const SearchLocation: React.FC = () => {
  const navigate = useNavigate();
  const routeLocation = useLocation();
  const serviceType = (routeLocation.state as any)?.serviceType || 'parcels';
  
  // Navigation State
  const [view, setView] = useState<ViewState>('route_summary');
  const [activeEditing, setActiveEditing] = useState<'pickup' | 'drop'>('pickup');

  // Address State
  const [pickup, setPickup] = useState<AddressDetails | null>(() => {
    const saved = localStorage.getItem('JANGOES_LAST_PICKUP');
    return saved ? JSON.parse(saved) : null;
  });
  const [drop, setDrop] = useState<AddressDetails | null>(null);

  // Form Temp State
  const [tempAddress, setTempAddress] = useState<Partial<AddressDetails>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [userLoc, setUserLoc] = useState<{lat: number, lng: number} | null>(null);
  const [useMyInfo, setUseMyInfo] = useState(false);
  const [userProfile, setUserProfile] = useState<{ name: string; phoneNumber: string; defaultBuilding: string } | null>(null);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [modalBuilding, setModalBuilding] = useState('');
  const [isSavingBuilding, setIsSavingBuilding] = useState(false);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.warn("Geolocation failed", err)
      );
    }
  }, []);

  // Fetch logged-in user's profile for autofill
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      if (snap.exists()) {
        const d = snap.data();
        setUserProfile({ name: d.name || '', phoneNumber: d.phoneNumber || '', defaultBuilding: d.defaultBuilding || '' });
      }
    });
  }, []);

  // Reset checkbox whenever the details form opens
  useEffect(() => {
    if (view === 'details_form') setUseMyInfo(false);
  }, [view]);

  const placesLib = useMapsLibrary('places');
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const [mapCenter, setMapCenter] = useState<google.maps.LatLngLiteral>({ lat: 28.6139, lng: 77.2090 }); // Default: New Delhi
  const [mapAddress, setMapAddress] = useState('Locating...');

  useEffect(() => {
    if (!placesLib) return;
    autocompleteService.current = new placesLib.AutocompleteService();
    geocoderRef.current = new google.maps.Geocoder();
  }, [placesLib]);

  // Set initial map center from user location
  useEffect(() => {
    if (userLoc) setMapCenter({ lat: userLoc.lat, lng: userLoc.lng });
  }, [userLoc]);

  // Places Autocomplete search (also handles lat,lng input)
  useEffect(() => {
    if (searchQuery.length < 3 || !autocompleteService.current) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(() => {
      // Detect lat,lng format  e.g. "28.6139, 77.2090" or "28.6139,77.209"
      const latLngMatch = searchQuery.trim().match(/^(-?\d{1,3}\.?\d*)\s*,\s*(-?\d{1,3}\.?\d*)$/);
      if (latLngMatch) {
        const lat = parseFloat(latLngMatch[1]);
        const lng = parseFloat(latLngMatch[2]);
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && geocoderRef.current) {
          setIsSearching(true);
          geocoderRef.current.geocode({ location: { lat, lng } }, (results, status) => {
            setIsSearching(false);
            if (status === 'OK' && results?.[0]) {
              const full = results[0].formatted_address;
              const title = results[0].address_components?.[0]?.long_name || full.split(',')[0];
              setSearchResults([{ id: 'latlng', title, address: full, lat, lng }]);
            } else {
              setSearchResults([]);
            }
          });
        }
        return;
      }

      // Normal Places Autocomplete
      setIsSearching(true);
      autocompleteService.current!.getPlacePredictions(
        { input: searchQuery, componentRestrictions: { country: 'in' }, ...(userLoc && { location: new google.maps.LatLng(userLoc.lat, userLoc.lng), radius: 50000 }) },
        (predictions, status) => {
          setIsSearching(false);
          if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
            setSearchResults(predictions.map(p => ({ id: p.place_id, title: p.structured_formatting.main_text, address: p.structured_formatting.secondary_text, placeId: p.place_id })));
          } else {
            setSearchResults([]);
          }
        }
      );
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, userLoc]);

  // Shared reverse geocoder
  const reverseGeocode = useCallback((lat: number, lng: number, onResult?: (title: string, address: string) => void) => {
    if (!geocoderRef.current) return;
    geocoderRef.current.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results?.[0]) {
        const full = results[0].formatted_address;
        const title = results[0].address_components?.[0]?.long_name || full.split(',')[0];
        setMapAddress(full);
        onResult?.(title, full);
      }
    });
  }, []);

  // Reverse geocode when map picker opens
  useEffect(() => {
    if (view === 'map_picker') {
      reverseGeocode(mapCenter.lat, mapCenter.lng);
    }
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reverse geocode map center on drag
  const handleMapCenterChanged = useCallback((lat: number, lng: number) => {
    setMapCenter({ lat, lng });
    reverseGeocode(lat, lng);
  }, [reverseGeocode]);

  // Use Current Location handler
  const handleUseCurrentLocation = useCallback(() => {
    const doGeocode = (lat: number, lng: number) => {
      reverseGeocode(lat, lng, (title, address) => {
        setTempAddress({ title, address, lat, lng, name: '', mobile: '', type: null } as any);
        setView('details_form');
      });
    };

    if (userLoc) {
      doGeocode(userLoc.lat, userLoc.lng);
    } else {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords;
          setUserLoc({ lat, lng });
          doGeocode(lat, lng);
        },
        () => alert('Unable to get your location. Please enable location access.')
      );
    }
  }, [userLoc, reverseGeocode]);

  const handleOpenSearch = (type: 'pickup' | 'drop') => {
    setActiveEditing(type);
    setSearchQuery('');
    setView('search_selection');
  };

  const handleSelectPlace = (place: any) => {
    // lat,lng result — coordinates already known, no extra geocode needed
    if (place.lat !== undefined && place.lng !== undefined && !place.placeId) {
      setTempAddress({ title: place.title, address: place.address, lat: place.lat, lng: place.lng, name: '', mobile: '', type: null } as any);
      setView('details_form');
    } else if (place.placeId && geocoderRef.current) {
      // Normal Places result — geocode to get coordinates
      geocoderRef.current.geocode({ placeId: place.placeId }, (results, status) => {
        if (status === 'OK' && results?.[0]) {
          const loc = results[0].geometry.location;
          setTempAddress({ title: place.title, address: place.address, lat: loc.lat(), lng: loc.lng(), name: '', mobile: '', type: null } as any);
        } else {
          setTempAddress({ title: place.title, address: place.address, name: '', mobile: '', type: null });
        }
        setView('details_form');
      });
    } else {
      // From map picker — use mapCenter coordinates
      setTempAddress({ title: place.title || mapAddress, address: place.address || mapAddress, lat: mapCenter.lat, lng: mapCenter.lng, name: '', mobile: '', type: null } as any);
      setView('details_form');
    }
  };

  const handleSaveBuilding = async () => {
    const user = auth.currentUser;
    if (!user || !modalBuilding.trim()) return;
    setIsSavingBuilding(true);
    try {
      await setDoc(doc(db, 'users', user.uid), { defaultBuilding: modalBuilding.trim() }, { merge: true });
      const updated = { ...(userProfile ?? { name: '', phoneNumber: '' }), defaultBuilding: modalBuilding.trim() };
      setUserProfile(updated);
      setTempAddress(prev => ({ ...prev, building: modalBuilding.trim() }));
      setShowAddressModal(false);
      setModalBuilding('');
    } finally {
      setIsSavingBuilding(false);
    }
  };

  const handleConfirmDetails = () => {
    const finalAddress = tempAddress as AddressDetails;
    if (activeEditing === 'pickup') {
      setPickup(finalAddress);
      localStorage.setItem('JANGOES_LAST_PICKUP', JSON.stringify(finalAddress));
    } else {
      setDrop(finalAddress);
    }
    setView('route_summary');
  };

  // --- RENDERING SUB-VIEWS ---

  const renderRouteSummary = () => (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950 animate-in fade-in duration-300">
      <header className="px-6 pt-14 pb-6 border-b dark:border-slate-800">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate('/home')} className="p-1 -ml-1">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="text-xl font-black">Setup Route</h1>
        </div>

        <div className="relative flex flex-col gap-4">
          <div className="absolute left-[20px] top-[32px] bottom-[32px] w-0.5 border-l-2 border-dashed border-slate-200 dark:border-slate-800"></div>
          
          {/* Pickup Button */}
          <button 
            onClick={() => handleOpenSearch('pickup')}
            className="flex items-center gap-4 text-left group"
          >
            <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center ring-4 ring-white dark:ring-slate-950 shrink-0 z-10">
              <div className="size-2.5 rounded-full bg-primary"></div>
            </div>
            <div className={`flex-1 min-w-0 border-b dark:border-slate-800 pb-4 ${!pickup ? 'text-slate-400 font-medium' : ''}`}>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Pickup</p>
              <h3 className="text-sm font-bold truncate">
                {pickup ? pickup.title : 'Where is your PickUp?'}
              </h3>
              {pickup && <p className="text-[10px] truncate text-slate-500">{pickup.address}</p>}
            </div>
          </button>

          {/* Drop Button */}
          <button 
            onClick={() => handleOpenSearch('drop')}
            className="flex items-center gap-4 text-left group"
          >
            <div className="size-10 rounded-full bg-red-500/10 flex items-center justify-center ring-4 ring-white dark:ring-slate-950 shrink-0 z-10">
              <div className="size-2.5 rounded-full bg-red-500"></div>
            </div>
            <div className={`flex-1 min-w-0 ${!drop ? 'text-slate-400 font-medium' : ''}`}>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Drop</p>
              <h3 className="text-sm font-bold truncate">
                {drop ? drop.title : 'Where is your Drop?'}
              </h3>
              {drop && <p className="text-[10px] truncate text-slate-500">{drop.address}</p>}
            </div>
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 flex flex-col items-center justify-center text-center gap-4 opacity-40">
        <span className="material-symbols-outlined text-6xl">distance</span>
        <p className="text-sm font-medium">Add locations to see fare estimates</p>
      </main>

      <footer className="p-6 bg-white dark:bg-slate-900 border-t dark:border-slate-800">
        <button 
          disabled={!pickup || !drop}
          onClick={() => {
            const nextRoute = serviceType === 'exchange' ? '/exchange-details' : '/parcel-details';
            navigate(nextRoute, { state: { pickup, drop, serviceType } });
          }}
          className="w-full h-16 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/30 flex items-center justify-center gap-3 disabled:opacity-30 transition-all active:scale-[0.98]"
        >
          <span>Confirm And Proceed</span>
          <span className="material-symbols-outlined">arrow_forward</span>
        </button>
      </footer>
    </div>
  );

  const renderSearchSelection = () => (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950 animate-in slide-in-from-right duration-300">
      <header className="px-6 pt-14 pb-4 shadow-sm z-10">
        <div className="flex items-center gap-3 h-14 bg-slate-50 dark:bg-slate-900 rounded-xl px-4 border border-slate-100 dark:border-slate-800">
          <button onClick={() => setView('route_summary')} className="p-1">
            <span className="material-symbols-outlined text-slate-400">arrow_back</span>
          </button>
          <div className={`size-2.5 rounded-full ${activeEditing === 'pickup' ? 'bg-primary' : 'bg-red-500'}`}></div>
          <input 
            autoFocus
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-bold p-0"
            placeholder={`Where is your ${activeEditing === 'pickup' ? 'PickUp' : 'Drop'}?`}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <span className="material-symbols-outlined text-primary text-lg">mic</span>
        </div>
      </header>

      {/* Current Location + Map buttons — between search bar and results */}
      <div className="grid grid-cols-2 border-b dark:border-slate-800">
        <button
          onClick={handleUseCurrentLocation}
          className="flex items-center justify-center gap-2 h-12 text-primary font-black text-xs uppercase tracking-widest"
        >
          <span className="material-symbols-outlined text-lg">my_location</span>
          Current Location
        </button>
        <button
          onClick={() => setView('map_picker')}
          className="flex items-center justify-center gap-2 h-12 text-primary font-black text-xs uppercase tracking-widest border-l dark:border-slate-800"
        >
          <span className="material-symbols-outlined text-lg">map</span>
          Choose on Map
        </button>
      </div>

      <main className="flex-1 overflow-y-auto no-scrollbar p-6">
        {searchResults.length > 0 ? (
          <div className="flex flex-col gap-1">
            {searchResults.map((res) => (
              <button
                key={res.id}
                onClick={() => handleSelectPlace(res)}
                className="flex items-start gap-4 py-4 border-b dark:border-slate-800 text-left"
              >
                <span className="material-symbols-outlined text-slate-300">location_on</span>
                <div className="flex flex-col truncate">
                  <span className="text-sm font-bold truncate">{res.title}</span>
                  <span className="text-[10px] text-slate-400 truncate">{res.address}</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            <button className="flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <span className="material-symbols-outlined text-slate-400 filled">favorite</span>
                <span className="text-sm font-bold">Saved Addresses</span>
              </div>
              <span className="material-symbols-outlined text-slate-300">chevron_right</span>
            </button>

            <div className="flex flex-col gap-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recent {activeEditing}s</h3>
              <div className="flex flex-col gap-6">
                <button
                  onClick={() => handleSelectPlace({ title: 'Home', address: 'Tayyab Masjid Rd, Block C, Jamia Nagar...' })}
                  className="flex items-start gap-4 text-left"
                >
                  <span className="material-symbols-outlined text-slate-400 filled">favorite</span>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold">Home</span>
                    <p className="text-[10px] text-slate-400 line-clamp-1">Tayyab Masjid Rd, Block C, Jamia Nagar, Okhla, New Delhi...</p>
                    <p className="text-[10px] text-slate-300 mt-1">Faraz Khan • 9718253371</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );

  const renderMapPicker = () => (
    <div className="flex flex-col h-full bg-slate-100 dark:bg-slate-950 animate-in fade-in duration-300 relative">
      {/* Real Google Map */}
      <div className="h-[58%] w-full relative shrink-0">
        <Map
          mapId="jangoes-map-picker"
          defaultCenter={mapCenter}
          defaultZoom={15}
          disableDefaultUI
          gestureHandling="greedy"
          onCenterChanged={(e) => handleMapCenterChanged(e.detail.center.lat, e.detail.center.lng)}
          style={{ width: '100%', height: '100%' }}
        />
        {/* Fixed center pin */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full flex flex-col items-center pointer-events-none z-10">
          <span className="material-symbols-outlined text-primary text-5xl filled drop-shadow-2xl" style={{ fontSize: 48 }}>location_on</span>
        </div>
        {/* Back button */}
        <header className="absolute top-14 left-6 z-10">
          <button onClick={() => setView('search_selection')} className="size-11 bg-white rounded-xl shadow-xl flex items-center justify-center">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
        </header>
      </div>

      <div className="flex-1 p-6 bg-white dark:bg-slate-900 rounded-t-[40px] -mt-8 z-20 shadow-2xl flex flex-col">
        <div className="w-full flex justify-center pb-6">
          <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
        </div>
        <div className="flex items-start gap-4 mb-8">
          <div className={`size-3 rounded-full mt-1.5 shrink-0 ${activeEditing === 'pickup' ? 'bg-primary' : 'bg-red-500'}`}></div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
              {activeEditing === 'pickup' ? 'Pickup' : 'Drop'} Location
            </span>
            <p className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2">{mapAddress}</p>
          </div>
          <button onClick={() => setView('search_selection')} className="ml-auto text-primary font-black text-xs uppercase tracking-widest border border-primary/20 px-4 py-1.5 rounded-lg shrink-0">
            Search
          </button>
        </div>
        <button
          onClick={() => handleSelectPlace({ title: mapAddress.split(',')[0], address: mapAddress })}
          className="w-full h-16 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/30 mt-auto"
        >
          Confirm Location
        </button>
      </div>
    </div>
  );

  const renderDetailsForm = () => (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950 animate-in slide-in-from-bottom duration-500">
      <header className="px-6 pt-14 pb-4 border-b dark:border-slate-800 flex items-center justify-between">
        <button onClick={() => setView('search_selection')} className="p-1">
          <span className="material-symbols-outlined">close</span>
        </button>
        <h2 className="text-lg font-black">{activeEditing === 'pickup' ? 'Pickup' : 'Drop'} Details</h2>
        <div className="size-6"></div>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-6">
        <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border dark:border-slate-800">
          <div className={`size-3 rounded-full ${activeEditing === 'pickup' ? 'bg-primary' : 'bg-red-500'}`}></div>
          <div className="flex flex-col truncate">
            <span className="text-sm font-bold truncate">{tempAddress.title}</span>
            <p className="text-[10px] text-slate-400 truncate">{tempAddress.address}</p>
          </div>
          <button onClick={() => setView('search_selection')} className="ml-auto text-primary font-black text-[10px] uppercase tracking-widest">Change</button>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <input
              className={`w-full h-14 border rounded-xl px-5 text-sm font-bold transition-all ${useMyInfo ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 cursor-not-allowed text-slate-500 dark:text-slate-400' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:ring-primary/20 focus:border-primary'}`}
              placeholder="House / Apartment / Shop (optional)"
              value={tempAddress.building || ''}
              onChange={e => !useMyInfo && setTempAddress({...tempAddress, building: e.target.value})}
              readOnly={useMyInfo}
            />
          </div>

          <div className="flex flex-col gap-1.5 relative">
            <label className="absolute -top-2 left-4 bg-white dark:bg-slate-950 px-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">{activeEditing === 'pickup' ? "Sender's" : "Receiver's"} Name</label>
            <div className={`flex items-center h-14 border rounded-xl px-5 transition-all ${useMyInfo ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}>
              <input
                className={`flex-1 bg-transparent border-none text-sm font-bold p-0 focus:ring-0 ${useMyInfo ? 'cursor-not-allowed text-slate-500 dark:text-slate-400' : ''}`}
                value={tempAddress.name || ''}
                onChange={e => !useMyInfo && setTempAddress({...tempAddress, name: e.target.value})}
                readOnly={useMyInfo}
              />
              <span className="material-symbols-outlined text-primary text-lg">contact_page</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 relative">
            <label className="absolute -top-2 left-4 bg-white dark:bg-slate-950 px-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">{activeEditing === 'pickup' ? "Sender's" : "Receiver's"} Mobile Number</label>
            <input
              className={`w-full h-14 border rounded-xl px-5 text-sm font-bold transition-all ${useMyInfo ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 cursor-not-allowed text-slate-500 dark:text-slate-400' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:ring-primary/20 focus:border-primary'}`}
              value={tempAddress.mobile || ''}
              onChange={e => !useMyInfo && setTempAddress({...tempAddress, mobile: e.target.value})}
              readOnly={useMyInfo}
            />
          </div>

          {activeEditing === 'pickup' && (
            <div className="flex items-center gap-3 py-2">
              <input
                type="checkbox"
                checked={useMyInfo}
                onChange={e => {
                  const checked = e.target.checked;
                  setUseMyInfo(checked);
                  if (checked && userProfile) {
                    setTempAddress(prev => ({ ...prev, name: userProfile.name, mobile: userProfile.phoneNumber, building: userProfile.defaultBuilding }));
                  } else {
                    setTempAddress(prev => ({ ...prev, name: '', mobile: '', building: '' }));
                  }
                }}
                className="rounded text-primary size-5 focus:ring-primary cursor-pointer"
              />
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Use My Details</span>
                {useMyInfo && userProfile && !userProfile.defaultBuilding && (
                  <span className="text-xs text-red-500 font-semibold">
                    No default address saved. Please{' '}
                    <button
                      type="button"
                      onClick={() => { setModalBuilding(''); setShowAddressModal(true); }}
                      className="underline font-black text-red-600"
                    >
                      update your profile
                    </button>
                    .
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="pt-4">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-4">Save as (optional):</h3>
          <div className="flex gap-4">
             {[
               { id: 'Home', icon: 'home' },
               { id: 'Shop', icon: 'storefront' },
               { id: 'Other', icon: 'favorite' }
             ].map((type) => (
               <button 
                key={type.id}
                onClick={() => setTempAddress({...tempAddress, type: tempAddress.type === type.id ? null : type.id as any})}
                className={`flex-1 flex items-center justify-center gap-2 h-12 rounded-xl border transition-all ${
                  tempAddress.type === type.id 
                  ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' 
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500'
                }`}
               >
                 <span className={`material-symbols-outlined text-lg ${tempAddress.type === type.id ? 'filled' : ''}`}>{type.icon}</span>
                 <span className="text-xs font-black uppercase tracking-widest">{type.id}</span>
               </button>
             ))}
          </div>
        </div>
      </main>

      <footer className="p-6 border-t dark:border-slate-800">
        <button 
          onClick={handleConfirmDetails}
          className="w-full h-16 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/30 active:scale-95 transition-all"
        >
          Confirm And Proceed
        </button>
      </footer>
    </div>
  );

  return (
    <div className="relative h-screen w-full flex flex-col bg-slate-50 dark:bg-slate-950 font-sans overflow-hidden">
      {view === 'route_summary' && renderRouteSummary()}
      {view === 'search_selection' && renderSearchSelection()}
      {view === 'map_picker' && renderMapPicker()}
      {view === 'details_form' && renderDetailsForm()}

      {/* Default Address Modal */}
      {showAddressModal && (
        <div className="absolute inset-0 z-[200] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl p-6 flex flex-col gap-5 animate-in slide-in-from-bottom duration-300 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 dark:text-white">Set Default Address</h3>
              <button
                onClick={() => setShowAddressModal(false)}
                className="size-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <span className="material-symbols-outlined text-slate-500">close</span>
              </button>
            </div>
            <p className="text-xs text-slate-500 -mt-2">This will be saved to your profile and auto-filled every time you book a pickup.</p>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">House / Flat / Building No.</label>
              <input
                autoFocus
                type="text"
                value={modalBuilding}
                onChange={e => setModalBuilding(e.target.value)}
                placeholder="e.g. Flat 4B, Tower C, Green Park"
                className="w-full h-14 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-5 text-sm font-bold focus:ring-primary/20 focus:border-primary transition-all"
                onKeyDown={e => e.key === 'Enter' && !isSavingBuilding && modalBuilding.trim() && handleSaveBuilding()}
              />
            </div>
            <button
              onClick={handleSaveBuilding}
              disabled={!modalBuilding.trim() || isSavingBuilding}
              className="w-full h-14 bg-primary text-white font-black rounded-2xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-40 active:scale-95 transition-all"
            >
              {isSavingBuilding
                ? <span className="material-symbols-outlined animate-spin text-lg">sync</span>
                : <><span className="material-symbols-outlined text-lg">save</span><span>Save Address</span></>
              }
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchLocation;