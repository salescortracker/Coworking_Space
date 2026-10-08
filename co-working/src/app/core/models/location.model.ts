import { ID, ISODate, SpaceType } from './common.model';

export type LocationStatus = 'ACTIVE' | 'INACTIVE' | 'COMING_SOON';

export interface OpeningHours {
  weekdays: string;
  saturday: string;
  sunday: string;
}

export interface Review {
  id: ID;
  author: string;
  rating: number;
  text: string;
  date: ISODate;
}

export interface Location {
  id: ID;
  name: string;
  city: string;
  state: string;
  address: string;
  pincode: string;
  latitude: number;
  longitude: number;
  openingHours: OpeningHours;
  amenities: string[];
  /** Built-in photo catalogue seeds, or URLs of images uploaded to the API (/uploads/images/...). */
  photos: (number | string)[];
  status: LocationStatus;
  description: string;
  rating: number;
  reviewCount: number;
  reviews: Review[];
  transport: string[];
  spaceTypes: SpaceType[];
  startingPrice: number;
  totalSeats: number;
  phone: string;
  email: string;
  /** Distance from the city centre, used for sorting search results. */
  distanceKm: number;
}

export type ResourceStatus = 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE';
export type PriceUnit = 'hour' | 'day' | 'month';

export interface Resource {
  id: ID;
  name: string;
  code: string;
  type: Exclude<SpaceType, 'DAY_PASS'>;
  locationId: ID;
  floor: string;
  capacity: number;
  price: number;
  priceUnit: PriceUnit;
  amenities: string[];
  photos: (number | string)[];
  availability: string;
  cancellationRule: string;
  status: ResourceStatus;
  /** Floor-map geometry (percent of map canvas). */
  map: { x: number; y: number; w: number; h: number };
  /** Blocked on the floor map, e.g. reserved for staff. */
  blocked?: boolean;
}

export const AMENITIES = [
  'High-speed Wi-Fi',
  'Power Backup',
  'Air Conditioning',
  'Coffee & Tea',
  'Printing',
  'Lockers',
  'Parking',
  'Phone Booths',
  'Projector',
  'Whiteboard',
  'Video Conferencing',
  'Pantry',
  'Reception',
  '24x7 Access',
  'Lounge',
  'Shower',
  'Bike Parking',
  'Wheelchair Access',
];
