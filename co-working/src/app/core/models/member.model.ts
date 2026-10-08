import { ID, ISODate, ISODateTime } from './common.model';

export type MemberStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE' | 'PENDING';

export interface Member {
  id: ID;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  companyId?: ID;
  designation: string;
  locationId: ID;
  status: MemberStatus;
  joinDate: ISODate;
  directoryVisible: boolean;
  bio: string;
  skills: string[];
  /** Converted from a CRM lead, if any. */
  leadId?: ID;
  photo?: string;
  /** Referral credit balance usable at checkout. */
  referralCredit?: number;
  profileCompleted?: boolean;
  createdAt: ISODateTime;
}

export interface Company {
  id: ID;
  name: string;
  gstin: string;
  billingAddress: string;
  state: string;
  industry: string;
  size: string;
  website: string;
  locationId: ID;
  primaryContactId?: ID;
}

export interface MemberActivity {
  id: ID;
  memberId: ID;
  at: ISODateTime;
  title: string;
  description: string;
  module: string;
}
