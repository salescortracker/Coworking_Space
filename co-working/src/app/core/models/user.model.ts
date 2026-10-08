import { ID, ISODateTime } from './common.model';

export type Role = 'SUPER_ADMIN' | 'LOCATION_MANAGER' | 'FRONT_DESK' | 'FINANCE' | 'MEMBER';

export const STAFF_ROLES: Role[] = ['SUPER_ADMIN', 'LOCATION_MANAGER', 'FRONT_DESK', 'FINANCE'];

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  LOCATION_MANAGER: 'Location Manager',
  FRONT_DESK: 'Front Desk',
  FINANCE: 'Finance',
  MEMBER: 'Member',
};

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED' | 'INVITED';

/** A login identity: staff user or member account. */
export interface User {
  id: ID;
  name: string;
  email: string;
  mobile: string;
  role: Role;
  /** Locations this user may operate. Empty means all locations. */
  locationIds: ID[];
  status: UserStatus;
  memberId?: ID;
  lastLogin?: ISODateTime;
  createdAt: ISODateTime;
  /** Set by the API while the account is locked after failed sign-ins. */
  lockedUntil?: ISODateTime;
}

/** Quick sign-in entry (not used: credentials are never shipped with the frontend). */
export interface DemoAccount {
  userId: ID;
  email: string;
  password: string;
  role: Role;
  label: string;
  description: string;
}

export interface Permission {
  key: string;
  module: string;
  action: 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'export';
  label: string;
}

export interface RoleDefinition {
  id: ID;
  key: Role;
  name: string;
  description: string;
  permissions: string[];
  system: boolean;
}
