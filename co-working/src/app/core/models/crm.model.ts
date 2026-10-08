import { Comment, ID, ISODate, ISODateTime, TimelineEntry } from './common.model';

export type LeadStatus = 'NEW' | 'CONTACTED' | 'TOUR_SCHEDULED' | 'TOUR_DONE' | 'CONVERTED' | 'LOST';
export type LeadSource = 'BOOK_NOW' | 'CALLBACK' | 'TOUR' | 'WEBSITE' | 'WALK_IN' | 'REFERRAL' | 'PARTNER';

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  TOUR_SCHEDULED: 'Tour Scheduled',
  TOUR_DONE: 'Tour Done',
  CONVERTED: 'Converted',
  LOST: 'Lost',
};

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  BOOK_NOW: 'Book Now',
  CALLBACK: 'Request Callback',
  TOUR: 'Schedule Tour',
  WEBSITE: 'Website',
  WALK_IN: 'Walk-in',
  REFERRAL: 'Referral',
  PARTNER: 'Partner',
};

export interface Lead {
  id: ID;
  name: string;
  mobile: string;
  email?: string;
  source: LeadSource;
  locationId: ID;
  requirement: string;
  spaceType?: string;
  seats?: number;
  preferredDate?: ISODate;
  preferredTime?: string;
  visitors?: number;
  status: LeadStatus;
  ownerId?: ID;
  followUpDate?: ISODate;
  mobileVerified: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  notes: Comment[];
  comments: Comment[];
  activities: TimelineEntry[];
  lostReason?: string;
  memberId?: ID;
}

/* ---------------- Community / content ---------------- */
export interface Post {
  id: ID;
  authorName: string;
  authorRole: string;
  authorMemberId?: ID;
  type: 'POST' | 'ANNOUNCEMENT';
  content: string;
  at: ISODateTime;
  likes: number;
  likedBy: ID[];
  comments: Comment[];
  locationId?: ID;
  status: 'PUBLISHED' | 'HIDDEN';
  pinned?: boolean;
}

export interface CommunityEvent {
  id: ID;
  title: string;
  category: string;
  date: ISODate;
  startTime: string;
  endTime: string;
  locationId: ID;
  venue: string;
  description: string;
  capacity: number;
  attendees: ID[];
  isPublic: boolean;
  status: 'PUBLISHED' | 'DRAFT' | 'CANCELLED';
  host: string;
  /** Photo catalogue seed or uploaded image URL. */
  imageSeed: number | string;
}

export interface Perk {
  id: ID;
  partner: string;
  category: string;
  offer: string;
  description: string;
  discount: string;
  code: string;
  expiry: ISODate;
  terms: string;
  status: 'ACTIVE' | 'INACTIVE';
  redemptions: number;
}

export interface BlogPost {
  id: ID;
  title: string;
  excerpt: string;
  body: string[];
  author: string;
  category: string;
  publishedAt: ISODate;
  readMinutes: number;
  status: 'PUBLISHED' | 'DRAFT';
  imageSeed: number | string;
}

export interface GalleryItem {
  id: ID;
  title: string;
  locationId: ID;
  category: 'Workspace' | 'Meeting Rooms' | 'Events' | 'Amenities';
  seed: number | string;
  status: 'PUBLISHED' | 'HIDDEN';
}

export interface HomepageContent {
  heroTitle: string;
  heroSubtitle: string;
  stats: { label: string; value: string }[];
  testimonials: { quote: string; name: string; role: string }[];
  features: { title: string; description: string; icon: string }[];
  announcement: string;
  showAnnouncement: boolean;
}
