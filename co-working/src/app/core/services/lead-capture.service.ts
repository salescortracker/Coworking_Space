import { Injectable, inject } from '@angular/core';
import { Observable, defer, tap } from 'rxjs';
import { ApiService } from './api.service';
import { Lead, LeadSource, LeadStatus, TimelineEntry } from '../models';
import { LeadService } from './data/engagement-data.service';
import { LocationService } from './data/workspace-data.service';
import { UserService } from './data/people-data.service';
import { NotificationCenterService } from './notification.service';
import { AuthService } from './auth.service';

export interface EnquiryInput {
  name: string;
  mobile: string;
  email?: string;
  locationId: string;
  requirement: string;
  spaceType?: string;
  seats?: number;
  preferredDate?: string;
  preferredTime?: string;
  visitors?: number;
}

/**
 * Public enquiries → CRM leads (flow 2 / 3). Every Book Now, callback, tour and contact
 * submission becomes a trackable lead after mobile OTP verification.
 */
@Injectable({ providedIn: 'root' })
export class LeadCaptureService {
  private readonly leads = inject(LeadService);
  private readonly locations = inject(LocationService);
  private readonly users = inject(UserService);
  private readonly notify = inject(NotificationCenterService);
  private readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);

  /**
   * Website enquiry (Book Now / Callback / Tour / Contact) sent to POST /api/Lead/Capture. The API checks the
   * mobile OTP verification, creates the lead and notifies the team.
   */
  submitEnquiry(source: LeadSource, data: EnquiryInput): Observable<Lead> {
    return defer(() =>
      this.api
        .post<Lead>('Lead/Capture', { ...data, source, verificationId: this.auth.takeVerificationId() ?? '' }, { spinner: 'blocking', message: 'Sending…' })
        .pipe(tap((lead) => (this.auth.isStaff() ? this.leads.load() : undefined))),
    );
  }

  /** Lead entered by staff in the console (walk-in, referral, partner). */
  capture(source: LeadSource, data: EnquiryInput): Lead {
    const now = new Date().toISOString();
    const label = { BOOK_NOW: 'Book Now', CALLBACK: 'Request Callback', TOUR: 'Schedule Tour', WEBSITE: 'Contact form', WALK_IN: 'Walk-in', REFERRAL: 'Referral', PARTNER: 'Partner' }[source];
    const lead = this.leads.createSync({
      ...data,
      source,
      status: source === 'TOUR' ? 'TOUR_SCHEDULED' : 'NEW',
      mobileVerified: true,
      createdAt: now,
      updatedAt: now,
      followUpDate: data.preferredDate,
      notes: [],
      comments: [],
      activities: [
        { id: `LA-${Date.now()}`, title: 'Lead created', description: `Submitted via ${label} · mobile verified by OTP`, at: now, tone: 'info', icon: 'plus' },
        ...(source === 'TOUR' ? [{ id: `LA-${Date.now()}-t`, title: 'Tour scheduled', description: `${data.preferredDate} at ${data.preferredTime} for ${data.visitors ?? 1} visitor(s)`, at: now, tone: 'warning' as const, icon: 'calendar' }] : []),
      ],
    });
    this.notify.dispatch({ event: 'New Lead', audience: 'STAFF', category: 'SYSTEM', title: `New lead · ${label}`, message: `${data.name} – ${data.requirement} at ${this.locations.shortName(data.locationId)}`, link: `/admin/leads/${lead.id}`, locationId: data.locationId, channels: ['EMAIL', 'PUSH'] });
    if (source === 'TOUR') this.notify.dispatch({ event: 'Tour Confirmation', audience: 'STAFF', category: 'SYSTEM', title: 'Tour confirmation sent', message: `Tour for ${data.name} on ${data.preferredDate} ${data.preferredTime} confirmed by SMS.`, locationId: data.locationId, recipient: data.mobile, channels: ['SMS'] });
    return lead;
  }

  private entry(title: string, description?: string, tone: TimelineEntry['tone'] = 'primary', icon = 'activity'): TimelineEntry {
    return { id: `LA-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, title, description, at: new Date().toISOString(), tone, icon, actor: this.auth.user()?.name };
  }

  setStatus(id: string, status: LeadStatus, reason?: string): Lead {
    const l = this.leads.find(id)!;
    const titles: Record<LeadStatus, string> = { NEW: 'Reopened', CONTACTED: 'Contacted', TOUR_SCHEDULED: 'Tour scheduled', TOUR_DONE: 'Tour completed', CONVERTED: 'Converted', LOST: 'Marked lost' };
    return this.leads.updateSync(id, { status, lostReason: status === 'LOST' ? reason : l.lostReason, updatedAt: new Date().toISOString(), activities: [...l.activities, this.entry(titles[status], reason, status === 'LOST' ? 'danger' : status === 'CONVERTED' || status === 'TOUR_DONE' ? 'success' : 'primary', status === 'LOST' ? 'x' : 'flag')] });
  }

  assign(id: string, ownerId: string): Lead {
    const l = this.leads.find(id)!;
    return this.leads.updateSync(id, { ownerId, updatedAt: new Date().toISOString(), activities: [...l.activities, this.entry('Lead assigned', `Owner: ${this.users.name(ownerId)}`, 'primary', 'user')] });
  }

  followUp(id: string, date: string): Lead {
    const l = this.leads.find(id)!;
    return this.leads.updateSync(id, { followUpDate: date, updatedAt: new Date().toISOString(), activities: [...l.activities, this.entry('Follow-up set', date, 'warning', 'calendar')] });
  }

  addNote(id: string, text: string, kind: 'notes' | 'comments'): Lead {
    const l = this.leads.find(id)!;
    const c = { id: `LN-${Date.now()}`, author: this.auth.user()?.name ?? 'Staff', text, at: new Date().toISOString() };
    return this.leads.updateSync(id, { [kind]: [...l[kind], c], updatedAt: c.at, activities: [...l.activities, this.entry(kind === 'notes' ? 'Note added' : 'Comment added', text.slice(0, 80), 'neutral', 'message')] });
  }
}
