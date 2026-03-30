import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../src/firebase.ts';
import { doc, updateDoc } from 'firebase/firestore';
import { uploadToCloudinary } from '../../services/cloudinaryUpload.ts';
import { BookingStatus, Trip } from '../../types.ts';

interface Props {
  trip: Trip;
  tripId: string;
  customerName: string;
  customerPhoto: string;
}

const ExchangeTrip: React.FC<Props> = ({ trip, tripId, customerName, customerPhoto }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [pickupPinInput, setPickupPinInput] = useState('');
  const [productAImage, setProductAImage] = useState<string | null>(null);
  const [productBImage, setProductBImage] = useState<string | null>(null);
  const [handoverOtpInput, setHandoverOtpInput] = useState('');
  const [returnOtpInput, setReturnOtpInput] = useState('');
  const [qcRemarks, setQcRemarks] = useState('');
  const [qcPhotos, setQcPhotos] = useState<string[]>([]);
  const [qcChecked, setQcChecked] = useState<Record<number, boolean>>({});
  const [productBAvailable, setProductBAvailable] = useState<boolean | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const qcInputRef = useRef<HTMLInputElement>(null);

  const status = trip.status;
  const exchange = trip.exchange;

  const update = async (s: BookingStatus, extra: any = {}) => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'trips', tripId), { status: s, ...extra, updatedAt: new Date().toISOString() });

      // Deduct wallet on exchange completion (both success and failure — driver did the work)
      if ((s === BookingStatus.EXCHANGE_COMPLETED || s === BookingStatus.EXCHANGE_FAILED) && trip.customerId && (trip as any).paymentMethod === 'wallet') {
        try {
          await fetch('/api/deduct-fare', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customerId: trip.customerId,
              amount: trip.fare || 0,
              tripId,
              description: `Exchange trip — ${trip.pickup?.address?.split(',')[0] || 'Origin'} ↔ ${trip.dropoff?.address?.split(',')[0] || 'Destination'}`,
            }),
          });
        } catch (err) { console.error('Wallet deduction error:', err); }
      }
    } catch (e: any) { console.error('Update error:', e); alert('Action failed: ' + (e?.message || 'Please try again.')); }
    finally { setLoading(false); }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, setImage: (url: string) => void, folder: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const url = await uploadToCloudinary(file, `trips/${tripId}/${folder}`);
      setImage(url);
    } catch { alert('Image upload failed.'); }
    finally { setLoading(false); e.target.value = ''; }
  };

  const handleQcPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const url = await uploadToCloudinary(file, `trips/${tripId}/qc`);
      setQcPhotos(prev => [...prev, url]);
    } catch { alert('Upload failed.'); }
    finally { setLoading(false); e.target.value = ''; }
  };

  // Completion screens
  if (status === BookingStatus.EXCHANGE_COMPLETED) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 text-center">
        <div className="size-24 rounded-full bg-green-100 flex items-center justify-center text-green-600 mb-6">
          <span className="material-symbols-outlined text-5xl filled">check_circle</span>
        </div>
        <h2 className="text-3xl font-black mb-2">Exchange Complete!</h2>
        <p className="text-slate-500 mb-2">Products exchanged successfully.</p>
        <div className="w-full bg-slate-50 rounded-3xl p-6 mb-8">
          <div className="flex justify-between mb-2"><span className="text-slate-400 font-bold text-xs uppercase">Earnings</span><span className="font-black text-xl">₹{trip.fare?.toFixed(2)}</span></div>
        </div>
        <button onClick={() => navigate('/dashboard')} className="w-full h-16 bg-primary text-white font-black rounded-2xl shadow-xl">BACK TO DASHBOARD</button>
      </div>
    );
  }

  if (status === BookingStatus.EXCHANGE_FAILED) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 text-center">
        <div className="size-24 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 mb-6">
          <span className="material-symbols-outlined text-5xl filled">assignment_return</span>
        </div>
        <h2 className="text-3xl font-black mb-2">Exchange Failed</h2>
        <p className="text-slate-500 mb-2">Product A has been safely returned to the requestor.</p>
        <p className="text-xs text-slate-400 mb-8">Reason: {exchange?.failureReason?.replace(/_/g, ' ') || 'Unknown'}</p>
        <div className="w-full bg-slate-50 rounded-3xl p-6 mb-8">
          <div className="flex justify-between"><span className="text-slate-400 font-bold text-xs uppercase">Earnings</span><span className="font-black text-xl">₹{trip.fare?.toFixed(2)}</span></div>
        </div>
        <button onClick={() => navigate('/dashboard')} className="w-full h-16 bg-primary text-white font-black rounded-2xl shadow-xl">BACK TO DASHBOARD</button>
      </div>
    );
  }

  const renderStep = () => {
    // ── LEG 1: Pick up Product A from Location Y ──
    if (status === BookingStatus.ACCEPTED) {
      return (
        <div className="flex flex-col gap-4">
          <div className="bg-rose-50 dark:bg-rose-900/20 rounded-2xl p-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-rose-500">swap_horiz</span>
            <span className="text-xs font-black text-rose-600 uppercase tracking-widest">Exchange Trip — Leg 1 of 3</span>
          </div>
          <div className="flex items-start gap-4">
            <div className="size-3 rounded-full bg-primary mt-1.5 shrink-0 ring-4 ring-primary/10"></div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Go to Pickup (Location Y)</span>
              <span className="text-sm font-bold dark:text-white">{trip.pickup?.address}</span>
            </div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
            <p className="text-[10px] font-black text-blue-600 uppercase mb-1">Product A to collect</p>
            <p className="text-sm font-medium">{exchange?.productA?.description || 'Item'}</p>
            {exchange?.productA?.referencePhotos?.length > 0 && (
              <div className="flex gap-2 mt-2 overflow-x-auto">
                {exchange.productA.referencePhotos.map((url: string, i: number) => (
                  <img key={i} src={url} className="size-16 rounded-lg object-cover border shrink-0" alt="" />
                ))}
              </div>
            )}
          </div>
          <button onClick={() => update(BookingStatus.ARRIVED_AT_PICKUP)} disabled={loading}
            className="w-full h-14 bg-primary text-white font-black rounded-2xl shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">
            <span className="material-symbols-outlined">location_on</span>I HAVE REACHED PICKUP
          </button>
        </div>
      );
    }

    if (status === BookingStatus.ARRIVED_AT_PICKUP || status === BookingStatus.PICKING_UP) {
      return (
        <div className="flex flex-col gap-4">
          <div className="p-3 bg-green-50 rounded-2xl text-center">
            <p className="text-xs font-bold text-green-600 uppercase tracking-widest">Arrived at Pickup — Collect Product A</p>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Enter Pickup PIN</label>
            <input type="text" maxLength={4} value={pickupPinInput} onChange={e => setPickupPinInput(e.target.value)}
              className="w-full h-14 bg-white border-2 border-slate-100 rounded-2xl px-5 text-center text-2xl font-black tracking-[0.5em] focus:border-primary" placeholder="----" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Photo of Product A (mandatory)</label>
            <input ref={imageInputRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={e => handleImageUpload(e, setProductAImage, 'product-a')} />
            {productAImage ? (
              <div className="relative rounded-2xl overflow-hidden border-2 border-slate-100 h-40">
                <img src={productAImage} className="w-full h-full object-cover" alt="Product A" />
              </div>
            ) : (
              <button onClick={() => imageInputRef.current?.click()} disabled={loading}
                className="w-full h-32 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-400">
                <span className="material-symbols-outlined text-3xl">add_a_photo</span>
                <span className="text-xs font-bold">Take photo of Product A</span>
              </button>
            )}
          </div>
          <button onClick={() => {
            if (pickupPinInput !== trip.pickupPin) { alert('Invalid PIN'); return; }
            if (!productAImage) { alert('Please capture Product A photo'); return; }
            update(BookingStatus.IN_TRANSIT, { 'exchange.productA.images': [productAImage] });
          }} disabled={loading}
            className="w-full h-16 bg-primary text-white font-black rounded-2xl shadow-xl flex items-center justify-center gap-2 disabled:opacity-50">
            <span className="material-symbols-outlined">play_arrow</span>PROCEED TO RECEIVER
          </button>
        </div>
      );
    }

    // ── LEG 2: At Location X ──
    if (status === BookingStatus.IN_TRANSIT) {
      return (
        <div className="flex flex-col gap-4">
          <div className="bg-rose-50 dark:bg-rose-900/20 rounded-2xl p-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-rose-500">swap_horiz</span>
            <span className="text-xs font-black text-rose-600 uppercase tracking-widest">Exchange Trip — Leg 2 of 3</span>
          </div>
          <div className="flex items-start gap-4">
            <div className="size-3 rounded-full bg-red-500 mt-1.5 shrink-0 ring-4 ring-red-500/10"></div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Receiver Location (Location X)</span>
              <span className="text-sm font-bold dark:text-white">{trip.dropoff?.address}</span>
            </div>
          </div>
          <div className="bg-green-50 rounded-xl p-3">
            <p className="text-[10px] font-black text-green-600 uppercase mb-1">Product B to collect</p>
            <p className="text-sm font-medium">{exchange?.productB?.description || 'Item'}</p>
            {exchange?.productB?.referencePhotos?.length > 0 && (
              <div className="flex gap-2 mt-2 overflow-x-auto">
                {exchange.productB.referencePhotos.map((url: string, i: number) => (
                  <img key={i} src={url} className="size-16 rounded-lg object-cover border shrink-0" alt="" />
                ))}
              </div>
            )}
          </div>
          <button onClick={() => update(BookingStatus.ARRIVED_AT_RECEIVER)} disabled={loading}
            className="w-full h-14 bg-primary text-white font-black rounded-2xl shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">
            <span className="material-symbols-outlined">location_on</span>I HAVE REACHED RECEIVER
          </button>
        </div>
      );
    }

    if (status === BookingStatus.ARRIVED_AT_RECEIVER) {
      return (
        <div className="flex flex-col gap-4">
          <div className="p-3 bg-green-50 rounded-2xl text-center">
            <p className="text-xs font-bold text-green-600 uppercase tracking-widest">At Receiver Location</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-[10px] font-black text-blue-600 uppercase mb-1">Hand over Product A to receiver</p>
            <p className="text-sm font-medium">{exchange?.productA?.description || 'Item'}</p>
          </div>
          <p className="text-sm text-slate-600 font-medium text-center">Is Product B available for collection?</p>
          <div className="flex gap-3">
            <button onClick={() => { setProductBAvailable(true); update(BookingStatus.PICKING_UP_PRODUCT_B); }} disabled={loading}
              className="flex-1 h-14 bg-green-600 text-white font-black rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50">
              <span className="material-symbols-outlined">check</span>Yes, Available
            </button>
            <button onClick={() => { setProductBAvailable(false); update(BookingStatus.RETURNING_PRODUCT_A, { 'exchange.failureReason': 'product_b_unavailable' }); }} disabled={loading}
              className="flex-1 h-14 bg-red-500 text-white font-black rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50">
              <span className="material-symbols-outlined">close</span>Not Available
            </button>
          </div>
        </div>
      );
    }

    if (status === BookingStatus.PICKING_UP_PRODUCT_B) {
      return (
        <div className="flex flex-col gap-4">
          <div className="p-3 bg-green-50 rounded-2xl text-center">
            <p className="text-xs font-bold text-green-600 uppercase tracking-widest">Collecting Product B</p>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Photo of Product B</label>
            <input ref={imageInputRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={e => handleImageUpload(e, setProductBImage, 'product-b')} />
            {productBImage ? (
              <div className="relative rounded-2xl overflow-hidden border-2 border-slate-100 h-40">
                <img src={productBImage} className="w-full h-full object-cover" alt="Product B" />
              </div>
            ) : (
              <button onClick={() => imageInputRef.current?.click()} disabled={loading}
                className="w-full h-32 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-400">
                <span className="material-symbols-outlined text-3xl">add_a_photo</span>
                <span className="text-xs font-bold">Take photo of Product B</span>
              </button>
            )}
          </div>
          {exchange?.qcRequired ? (
            <>
              {/* QC Checklist — driver must check all items */}
              {(exchange as any).qcItems?.length > 0 && (
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-amber-600 uppercase tracking-widest ml-1">QC Checklist — Verify Each Item</label>
                  <div className="flex flex-col gap-2">
                    {((exchange as any).qcItems as string[]).map((item: string, i: number) => (
                      <button key={i} onClick={() => setQcChecked(prev => ({ ...prev, [i]: !prev[i] }))}
                        className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-left ${
                          qcChecked[i]
                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                        }`}>
                        <div className={`size-7 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                          qcChecked[i] ? 'bg-green-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-300'
                        }`}>
                          <span className="material-symbols-outlined text-lg">{qcChecked[i] ? 'check' : 'check_box_outline_blank'}</span>
                        </div>
                        <span className={`text-sm font-medium ${qcChecked[i] ? 'text-green-700 dark:text-green-300 line-through' : 'text-slate-700 dark:text-slate-200'}`}>{item}</span>
                      </button>
                    ))}
                  </div>
                  {(() => {
                    const total = ((exchange as any).qcItems as string[]).length;
                    const checked = Object.values(qcChecked).filter(Boolean).length;
                    return (
                      <div className="flex items-center justify-between px-1 mt-1">
                        <span className="text-[10px] font-bold text-slate-400">{checked} of {total} verified</span>
                        <div className="flex gap-1">
                          {Array.from({ length: total }).map((_, i) => (
                            <div key={i} className={`h-1.5 w-6 rounded-full transition-colors ${qcChecked[i] ? 'bg-green-500' : 'bg-slate-200'}`} />
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">QC Remarks (optional)</label>
                <textarea value={qcRemarks} onChange={e => setQcRemarks(e.target.value)} rows={2} placeholder="Any additional observations..."
                  className="w-full bg-white border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm focus:border-primary" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">QC Photos (optional)</label>
                <input ref={qcInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleQcPhotoUpload} />
                <div className="flex gap-2 flex-wrap">
                  {qcPhotos.map((url, i) => <img key={i} src={url} className="size-16 rounded-xl object-cover border" alt="" />)}
                  <button onClick={() => qcInputRef.current?.click()} disabled={loading}
                    className="size-16 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-slate-300">
                    <span className="material-symbols-outlined">add</span>
                  </button>
                </div>
              </div>
              <button onClick={() => {
                if (!productBImage) { alert('Please capture Product B photo'); return; }
                // Verify all QC checklist items are checked
                const qcItemsList = (exchange as any).qcItems || [];
                const allChecked = qcItemsList.length === 0 || qcItemsList.every((_: string, i: number) => qcChecked[i]);
                if (!allChecked) { alert('Please verify all QC checklist items before submitting.'); return; }
                const checkedItems = qcItemsList.map((label: string, i: number) => ({ label, passed: !!qcChecked[i] }));
                update(BookingStatus.QC_PENDING, {
                  'exchange.productB.images': [productBImage],
                  'exchange.qcChecklist': { items: checkedItems, remarks: qcRemarks, photos: qcPhotos, submittedAt: new Date().toISOString() },
                });
              }} disabled={loading}
                className="w-full h-14 bg-amber-500 text-white font-black rounded-2xl shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">
                <span className="material-symbols-outlined">send</span>SUBMIT FOR QC REVIEW
              </button>
            </>
          ) : (
            <button onClick={() => {
              if (!productBImage) { alert('Please capture Product B photo'); return; }
              update(BookingStatus.RETURNING_PRODUCT_B, { 'exchange.productB.images': [productBImage] });
            }} disabled={loading}
              className="w-full h-14 bg-primary text-white font-black rounded-2xl shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">
              <span className="material-symbols-outlined">play_arrow</span>PRODUCT B COLLECTED — RETURN
            </button>
          )}
        </div>
      );
    }

    // QC waiting
    if (status === BookingStatus.QC_PENDING) {
      return (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="relative size-20">
            <div className="absolute inset-0 border-4 border-amber-500/10 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="material-symbols-outlined text-amber-500 text-3xl">hourglass_top</span>
            </div>
          </div>
          <h3 className="font-black text-lg">Waiting for QC Approval</h3>
          <p className="text-xs text-slate-400 text-center max-w-xs">The requestor is reviewing your QC submission. Please wait...</p>
        </div>
      );
    }

    if (status === BookingStatus.QC_APPROVED) {
      return (
        <div className="flex flex-col gap-4">
          <div className="p-4 bg-green-50 rounded-2xl text-center">
            <span className="material-symbols-outlined text-green-500 text-3xl filled">check_circle</span>
            <p className="text-sm font-black text-green-600 mt-2">QC Approved by Requestor</p>
          </div>
          <button onClick={() => update(BookingStatus.RETURNING_PRODUCT_B)} disabled={loading}
            className="w-full h-14 bg-primary text-white font-black rounded-2xl shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">
            <span className="material-symbols-outlined">play_arrow</span>START RETURN TRIP WITH PRODUCT B
          </button>
        </div>
      );
    }

    if (status === BookingStatus.QC_REJECTED) {
      return (
        <div className="flex flex-col gap-4">
          <div className="p-4 bg-red-50 rounded-2xl text-center">
            <span className="material-symbols-outlined text-red-500 text-3xl filled">cancel</span>
            <p className="text-sm font-black text-red-600 mt-2">QC Rejected by Requestor</p>
            {exchange?.qcRejectionReason && <p className="text-xs text-red-400 mt-1">{exchange.qcRejectionReason}</p>}
          </div>
          <p className="text-xs text-slate-500 text-center">Product B cannot be accepted. You must return Product A to the requestor safely.</p>
          <button onClick={() => update(BookingStatus.RETURNING_PRODUCT_A, { 'exchange.failureReason': 'qc_rejected' })} disabled={loading}
            className="w-full h-14 bg-amber-500 text-white font-black rounded-2xl shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">
            <span className="material-symbols-outlined">assignment_return</span>RETURN PRODUCT A TO REQUESTOR
          </button>
        </div>
      );
    }

    // ── LEG 3: Return trip ──
    if (status === BookingStatus.RETURNING_PRODUCT_B) {
      return (
        <div className="flex flex-col gap-4">
          <div className="bg-rose-50 dark:bg-rose-900/20 rounded-2xl p-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-rose-500">swap_horiz</span>
            <span className="text-xs font-black text-rose-600 uppercase tracking-widest">Exchange Trip — Leg 3 (Success)</span>
          </div>
          <div className="flex items-start gap-4">
            <div className="size-3 rounded-full bg-green-500 mt-1.5 shrink-0 ring-4 ring-green-500/10"></div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Returning Product B to Requestor</span>
              <span className="text-sm font-bold dark:text-white">{trip.pickup?.address}</span>
            </div>
          </div>
          <button onClick={() => update(BookingStatus.ARRIVED_AT_ORIGIN_RETURN)} disabled={loading}
            className="w-full h-14 bg-primary text-white font-black rounded-2xl shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">
            <span className="material-symbols-outlined">location_on</span>ARRIVED AT REQUESTOR
          </button>
        </div>
      );
    }

    if (status === BookingStatus.RETURNING_PRODUCT_A) {
      return (
        <div className="flex flex-col gap-4">
          <div className="bg-amber-50 rounded-2xl p-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-500">assignment_return</span>
            <span className="text-xs font-black text-amber-600 uppercase tracking-widest">Returning Product A (Exchange Failed)</span>
          </div>
          <div className="flex items-start gap-4">
            <div className="size-3 rounded-full bg-amber-500 mt-1.5 shrink-0 ring-4 ring-amber-500/10"></div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Return to Requestor Location</span>
              <span className="text-sm font-bold dark:text-white">{trip.pickup?.address}</span>
            </div>
          </div>
          <button onClick={() => update(BookingStatus.ARRIVED_AT_ORIGIN_RETURN)} disabled={loading}
            className="w-full h-14 bg-amber-500 text-white font-black rounded-2xl shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">
            <span className="material-symbols-outlined">location_on</span>ARRIVED AT REQUESTOR
          </button>
        </div>
      );
    }

    if (status === BookingStatus.ARRIVED_AT_ORIGIN_RETURN) {
      const isSuccess = !exchange?.failureReason;
      return (
        <div className="flex flex-col gap-4">
          <div className="p-3 bg-green-50 rounded-2xl text-center">
            <p className="text-xs font-bold text-green-600 uppercase tracking-widest">Arrived at Requestor Location</p>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              Enter Return OTP
            </label>
            <input type="text" maxLength={4} value={returnOtpInput} onChange={e => setReturnOtpInput(e.target.value)}
              className="w-full h-14 bg-white border-2 border-slate-100 rounded-2xl px-5 text-center text-2xl font-black tracking-[0.5em] focus:border-primary" placeholder="----" />
          </div>
          <button onClick={() => {
            if (returnOtpInput !== exchange?.returnOtp) { alert('Invalid OTP'); return; }
            update(isSuccess ? BookingStatus.EXCHANGE_COMPLETED : BookingStatus.EXCHANGE_FAILED);
          }} disabled={loading}
            className={`w-full h-16 text-white font-black rounded-2xl shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 ${isSuccess ? 'bg-green-600' : 'bg-amber-500'}`}>
            <span className="material-symbols-outlined">verified</span>
            {isSuccess ? 'COMPLETE EXCHANGE' : 'CONFIRM PRODUCT A RETURNED'}
          </button>
        </div>
      );
    }

    return <p className="text-center text-slate-400 py-8">Loading exchange status...</p>;
  };

  return (
    <div className="relative h-screen w-full flex flex-col bg-background-light dark:bg-background-dark overflow-hidden">
      {/* Map placeholder */}
      <div className="h-[35%] w-full relative shrink-0 bg-slate-100 dark:bg-slate-800">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <span className="material-symbols-outlined text-5xl">swap_horiz</span>
            <span className="text-xs font-black uppercase tracking-widest">Exchange Trip</span>
          </div>
        </div>
        <div className="absolute top-0 left-0 w-full p-4 z-10 pt-12 flex justify-between">
          <div className="bg-rose-500 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2">
            <span className="material-symbols-outlined animate-pulse">swap_horiz</span>
            <span className="text-sm font-bold">Exchange Trip</span>
          </div>
          <button onClick={() => navigate('/chat', { state: { tripId } })}
            className="size-11 bg-white rounded-xl shadow-md flex items-center justify-center text-primary">
            <span className="material-symbols-outlined">chat</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 relative z-20 bg-white dark:bg-slate-900 rounded-t-[40px] -mt-8 shadow-2xl p-6 pb-12 overflow-y-auto no-scrollbar">
        <div className="w-full flex justify-center pb-4">
          <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
        </div>

        <div className="flex flex-col gap-6">
          {/* Customer info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {customerPhoto ? (
                <div className="size-12 rounded-full bg-cover bg-center border-2 border-slate-100" style={{ backgroundImage: `url('${customerPhoto}')` }} />
              ) : (
                <div className="size-12 rounded-full bg-slate-200 flex items-center justify-center border-2 border-slate-100">
                  <span className="material-symbols-outlined text-slate-400 text-xl">person</span>
                </div>
              )}
              <div>
                <h3 className="font-bold text-base dark:text-white">{customerName || trip.senderName || 'Customer'}</h3>
                <p className="text-xs text-slate-500">{trip.vehicleType} — Exchange</p>
              </div>
            </div>
          </div>

          {/* Current step */}
          <div className="bg-slate-50 dark:bg-slate-800 rounded-3xl p-6">
            {renderStep()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExchangeTrip;
