// Shared settlement + payment helpers.
//
// Business rules (confirmed with client, 2026-06-11 — not in the fares PDF):
//  • Jangoes commission is a flat 20% of the trip fare; the driver earns 80%.
//  • CASH trips: the driver keeps the cash collected from the customer and
//    therefore OWES Jangoes its 20% commission.
//  • ONLINE trips (wallet / UPI): Jangoes holds the money and OWES the driver
//    their 80% earning.
//  • The settlement balance nets these two: positive => driver pays Jangoes,
//    negative => Jangoes pays the driver. Admin records the settlement to clear it.
//
// The fares PDF (§6) defines payment as "Cash or Online". This app stores
// 'cash' | 'wallet' | 'upi'; wallet + upi both belong to the "online" family.

import { Trip } from '../types.ts';

/** Flat Jangoes commission rate. Change here to re-rate future settlements. */
export const COMMISSION_RATE = 0.20;

const round2 = (n: number): number => Math.round((n || 0) * 100) / 100;

/** Driver-facing label for a stored payment method. Defaults to Cash. */
export function paymentLabel(method?: string): string {
  switch (method) {
    case 'wallet': return 'Jangoes Wallet';
    case 'upi':    return 'Online (UPI)';
    case 'online': return 'Online';
    case 'cash':   return 'Cash';
    default:       return 'Cash';
  }
}

/** Material Symbols icon for a payment method. */
export function paymentIcon(method?: string): string {
  switch (method) {
    case 'wallet': return 'account_balance_wallet';
    case 'upi':    return 'qr_code_2';
    case 'online': return 'credit_card';
    default:       return 'payments';
  }
}

/** True when the driver physically collected cash (cash is also the default). */
export function isCashPayment(method?: string): boolean {
  return !method || method === 'cash';
}

/** Jangoes commission on a fare. */
export function commissionFor(fare: number): number {
  return round2((fare || 0) * COMMISSION_RATE);
}

/** Driver's take-home on a fare (fare minus commission). */
export function driverEarningFor(fare: number): number {
  return round2((fare || 0) - commissionFor(fare));
}

export interface SettlementSummary {
  /** Gross cash the driver received from customers. */
  cashCollected: number;
  /** Commission the driver owes Jangoes on those cash trips. */
  cashCommission: number;
  /** Gross fare paid online (wallet/upi). */
  onlineCollected: number;
  /** Driver earnings Jangoes owes on online trips. */
  onlineEarnings: number;
  /** Net balance: >0 driver owes Jangoes, <0 Jangoes owes driver. */
  net: number;
  tripCount: number;
  tripIds: string[];
}

/** Net a set of completed trips into a single driver↔Jangoes balance. */
export function summarizeSettlement(trips: (Trip & { id: string })[]): SettlementSummary {
  let cashCollected = 0, cashCommission = 0, onlineCollected = 0, onlineEarnings = 0;
  const tripIds: string[] = [];
  for (const t of trips) {
    const fare = t.fare || 0;
    tripIds.push(t.id);
    if (isCashPayment(t.paymentMethod)) {
      cashCollected += fare;
      cashCommission += commissionFor(fare);
    } else {
      onlineCollected += fare;
      onlineEarnings += driverEarningFor(fare);
    }
  }
  return {
    cashCollected: round2(cashCollected),
    cashCommission: round2(cashCommission),
    onlineCollected: round2(onlineCollected),
    onlineEarnings: round2(onlineEarnings),
    net: round2(cashCommission - onlineEarnings),
    tripCount: trips.length,
    tripIds,
  };
}
