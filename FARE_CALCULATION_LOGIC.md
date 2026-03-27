# Jangoes Porter — Fare Calculation Logic
### New Delhi, India | Effective 2025

---

## Overview

Every fare on Jangoes Porter is calculated in real-time at the moment of booking. The price the customer sees is not a fixed number — it is computed dynamically based on **actual road distance**, **vehicle type**, **parcel weight**, and **time of day**. This ensures fair pricing for both the customer and the driver.

---

## Step-by-Step Fare Calculation

### STEP 1 — Measure the Real Road Distance

> We do **not** use straight-line (as-the-crow-flies) distance because roads in Delhi are never straight.

We use the **Google Maps Distance Matrix API** to fetch the actual driving route distance between the pickup and drop-off points.

**Example:**
- Straight-line distance between Lajpat Nagar and Connaught Place = 6.2 km
- Actual road distance via Google Maps = 8.7 km *(via Mathura Road → Ring Road)*
- We always use **8.7 km** for pricing — the real route the driver will take.

If the Google Maps API is temporarily unavailable, we fall back to a **Haversine formula × 1.4 correction factor** (the average road-to-straight-line ratio in Delhi).

---

### STEP 2 — Apply Vehicle-wise Base Rate

Each vehicle has a **base fare** that covers the first **4 kilometres** of the trip. This is a flat charge that accounts for fuel, driver time, and vehicle operating cost at the start of every booking.

| Vehicle | What It Carries | Base Fare (first 4 km) | Per km After 4 km | Minimum Fare |
|---|---|---|---|---|
| 🏍️ Bike | Documents, small parcels up to 20 kg | ₹60 | ₹8 / km | ₹60 |
| 🛻 Tata Ace (Mini Truck) | Household goods, boxes up to 750 kg | ₹220 | ₹22 / km | ₹220 |
| 🚐 Bolero Pickup | Furniture, appliances up to 1.5 ton | ₹380 | ₹28 / km | ₹380 |
| 🚛 Tata 407 | Heavy cargo up to 2.5 ton | ₹580 | ₹38 / km | ₹580 |
| 🚚 Large Truck (14 ft) | Industrial loads up to 4 ton | ₹900 | ₹55 / km | ₹900 |

**Distance Charge Formula:**
```
Distance Charge = (Total Road Distance − 4 km) × Per-km Rate

Example (Tata Ace, 8.7 km trip):
= (8.7 − 4) × ₹22
= 4.7 × ₹22
= ₹103.40 → rounded to ₹103
```

---

### STEP 3 — Add Weight Surcharge (if applicable)

Each vehicle includes a **free weight allowance**. If the customer's parcel exceeds this, a small per-kg surcharge is added.

| Vehicle | Free Weight Included | Extra Charge |
|---|---|---|
| Bike | 15 kg | ₹5 per extra kg |
| Tata Ace | 500 kg | ₹6 per extra kg |
| Bolero Pickup | 1,000 kg | ₹6 per extra kg |
| Tata 407 | 2,000 kg | ₹6 per extra kg |
| Large Truck | 3,000 kg | ₹6 per extra kg |

**Example:**
> Customer ships 650 kg via Tata Ace (free limit: 500 kg)
> Extra = 150 kg × ₹6 = **₹900 weight surcharge**

---

### STEP 4 — Apply Time-of-Day Surcharge

Demand and operational cost vary throughout the day. We apply a surcharge during two periods:

| Period | Time Window | Extra Charge |
|---|---|---|
| 🌙 Night Surcharge | 10:00 PM – 6:00 AM | +25% on Base + Distance |
| ⏰ Peak Hour Surcharge | 8–11 AM and 6–9 PM | +20% on Base + Distance |

> Outside these windows — no surcharge applies.

**Example (Night booking, Tata Ace, 8 km trip):**
```
Base + Distance = ₹220 + ₹88 = ₹308
Night Surcharge = ₹308 × 25% = ₹77
```

---

### STEP 5 — Add Waiting Charges (if driver waits)

Each vehicle gets a **free waiting window** after arriving at pickup. If the customer takes longer, a per-minute charge is applied:

| Vehicle | Free Waiting | Charge After |
|---|---|---|
| Bike | 10 minutes | ₹2 / minute |
| Tata Ace | 15 minutes | ₹4 / minute |
| Bolero / Tata 407 | 15 minutes | ₹5–6 / minute |
| Large Truck | 20 minutes | ₹8 / minute |

> Waiting charges are added at the end of the trip, not during booking.

---

### STEP 6 — Add Toll Charges (if route includes a toll)

If the driver's route passes through a toll road (e.g., NH-48, DND Flyway, Kundli–Manesar Expressway), the **actual toll amount** is added to the fare. This is passed through at cost — no markup.

---

### STEP 7 — Apply Minimum Fare Floor

Even if all the above calculations result in a very low number (e.g., a 1 km trip), the customer is always charged at least the **minimum fare** for that vehicle. This protects driver viability for very short trips.

---

### STEP 8 — Add GST @ 5%

As required by Indian tax law, **5% GST** is applied on the total fare.

- SAC Code: **9965** (Goods Transport by Road)
- GST is shown as a separate line item on the fare breakdown screen so the customer always sees it clearly.

---

## Complete Fare Formula

```
Fare = Base Fare
     + Distance Charge  [(Road KM − 4) × Per-km Rate]
     + Weight Surcharge [(Extra KG) × ₹6]
     + Time Surcharge   [Base+Distance × 20% or 25%]
     + Waiting Charge   [(Wait Mins − Free Mins) × Per-min Rate]
     + Toll Charges     [Actual toll, if applicable]
─────────────────────────────────────────────────────
     Subtotal           [Minimum Fare applied if below floor]
     + GST 5%
─────────────────────────────────────────────────────
     = TOTAL FARE shown to customer
```

---

## End-to-End Example

**Scenario:** Customer books a Tata Ace at 9:00 AM (peak hour) from Saket to Rohini.

| Component | Calculation | Amount |
|---|---|---|
| Road Distance (Google Maps) | 28.4 km | — |
| Base Fare | Flat (first 4 km) | ₹220 |
| Distance Charge | (28.4 − 4) × ₹22 = 24.4 × ₹22 | ₹537 |
| Weight Surcharge | 400 kg parcel, within 500 kg free limit | ₹0 |
| Peak Hour Surcharge | (₹220 + ₹537) × 20% = ₹757 × 20% | ₹151 |
| Waiting Charge | Driver waited 12 mins (within 15 min free) | ₹0 |
| Toll | DND not on route | ₹0 |
| **Subtotal** | | **₹908** |
| GST @ 5% | ₹908 × 5% | ₹45 |
| **Total Fare** | | **₹953** |

---

## What the Customer Sees

When selecting a vehicle, the customer sees a **live fare breakdown** on screen:

```
┌─────────────────────────────────────────┐
│  Tata Ace (Mini Truck)       28.4 km    │
├─────────────────────────────────────────┤
│  Base fare                        ₹220  │
│  Distance charge                  ₹537  │
│  Peak Hour +20%                   ₹151  │
│  GST (5%)                          ₹45  │
├─────────────────────────────────────────┤
│  TOTAL                            ₹953  │
└─────────────────────────────────────────┘
```

The breakdown is recalculated **every time the customer changes their vehicle selection**, so they always see the correct price before confirming.

---

## Key Principles

1. **Transparency** — Every charge is itemised. The customer always knows what they are paying for.
2. **Real distance** — Google Maps road distance is used, never straight-line distance.
3. **Time-aware** — Prices automatically adjust for night and peak hours without any manual intervention.
4. **Weight-sensitive** — Heavier loads cost more, lighter loads are not overcharged.
5. **GST-compliant** — All fares are GST-inclusive and properly broken out.
6. **Driver-fair** — Minimum fares and waiting charges ensure the driver is never operating at a loss on any booking.

---

*Document prepared for Jangoes Porter client presentation — March 2026*
