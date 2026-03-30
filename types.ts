
export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  DRIVER = 'DRIVER',
}

export enum BookingStatus {
  SEARCHING = 'SEARCHING',
  ACCEPTED = 'ACCEPTED',
  ARRIVED_AT_PICKUP = 'ARRIVED_AT_PICKUP',
  PICKING_UP = 'PICKING_UP',
  IN_TRANSIT = 'IN_TRANSIT',
  ARRIVED_AT_DESTINATION = 'ARRIVED_AT_DESTINATION',
  DROPPING_OFF = 'DROPPING_OFF',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  // Exchange-specific statuses
  ARRIVED_AT_RECEIVER = 'ARRIVED_AT_RECEIVER',
  PICKING_UP_PRODUCT_B = 'PICKING_UP_PRODUCT_B',
  QC_PENDING = 'QC_PENDING',
  QC_APPROVED = 'QC_APPROVED',
  QC_REJECTED = 'QC_REJECTED',
  RETURNING_PRODUCT_A = 'RETURNING_PRODUCT_A',
  RETURNING_PRODUCT_B = 'RETURNING_PRODUCT_B',
  ARRIVED_AT_ORIGIN_RETURN = 'ARRIVED_AT_ORIGIN_RETURN',
  EXCHANGE_COMPLETED = 'EXCHANGE_COMPLETED',
  EXCHANGE_FAILED = 'EXCHANGE_FAILED',
}

export interface User {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  avatar: string;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  icon: string;
  image: string;
}

export interface Trip {
  id?: string;
  customerId: string;
  driverId?: string;
  pickup: {
    address: string;
    lat: number;
    lng: number;
  };
  dropoff: {
    address: string;
    lat: number;
    lng: number;
  };
  status: BookingStatus;
  fare: number;
  createdAt: any;
  acceptedAt?: string;
  updatedAt?: string;
  vehicleType: string;
  pickupPin: string;
  dropoffOtp: string;
  parcelImageUrl?: string;
  senderName: string;
  senderPhone?: string;
  receiverName: string;
  receiverPhone: string;
  driverLocation?: {
    lat: number;
    lng: number;
    updatedAt?: string;
  };
  rating?: number;
  feedback?: string;
  ratedAt?: string;
  cancelReason?: string;
  cancelledBy?: string;
  receiverRating?: number;
  receiverFeedback?: string;
  receiverRatedAt?: string;
  // V2 fare fields
  fareVersion?: number;
  estimatedTripFare?: number;
  estimatedTotal?: number;
  durationMins?: number;
  arrivedAtPickupAt?: string;
  tripStartedAt?: string;
  arrivedAtDestinationAt?: string;
  completedAt?: string;
  finalFare?: {
    tripFare: number;
    loadingWaitMins: number;
    loadingWaitCharge: number;
    unloadingWaitMins: number;
    unloadingWaitCharge: number;
    taxable: number;
    gst: number;
    total: number;
  };
  paymentMethod?: 'cash' | 'online';
  paymentConfirmed?: boolean;
  serverValidatedFare?: number;
  // Service type discriminator
  serviceType?: 'parcel' | 'reverse-parcel' | 'exchange';
  // Exchange-specific fields
  exchange?: {
    productA: {
      description: string;
      category?: string;
      images: string[];
    };
    productB: {
      description: string;
      category?: string;
      images: string[];
    };
    qcRequired: boolean;
    qcChecklist?: {
      items: Array<{ label: string; passed: boolean }>;
      remarks: string;
      photos: string[];
      submittedAt?: string;
    };
    qcDecision?: 'approved' | 'rejected';
    qcDecisionAt?: string;
    qcRejectionReason?: string;
    failureReason?: 'qc_rejected' | 'product_b_unavailable' | 'receiver_refused' | 'pickup_failed';
    returnOtp?: string;
    productBPickupOtp?: string;
    productAHandoverOtp?: string;
  };
}
