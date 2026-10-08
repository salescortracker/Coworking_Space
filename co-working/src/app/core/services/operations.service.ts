import { Injectable, inject } from '@angular/core';
import { AccessLog, Attachment, Comment, Ticket, TicketPriority, TimelineEntry, Visitor } from '../models';
import { AccessCredentialService, AccessLogService, TicketService, VisitorService } from './data/operations-data.service';
import { MemberService, UserService } from './data/people-data.service';
import { SubscriptionService } from './data/membership-data.service';
import { LocationService } from './data/workspace-data.service';
import { NotificationCenterService } from './notification.service';
import { AuthService } from './auth.service';
import { accessStateFor } from './member-account.service';
import { SettingsService } from './settings.service';
import { IntegrationService } from './integration.service';

export interface ScanResult {
  valid: boolean;
  kind: 'MEMBER' | 'VISITOR' | 'STAFF' | 'UNKNOWN';
  name: string;
  checks: { label: string; ok: boolean }[];
  reason?: string;
  visitor?: Visitor;
  log?: AccessLog;
}

function passCode(seed: string): string {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `OFV-${h.toString(36).toUpperCase().slice(0, 6).padEnd(6, 'X')}`;
}

/**
 * Operational workflows: visitor passes (flow 10), QR access validation (flow 9)
 * and support tickets with 24-hour auto-escalation (flow 11).
 */
@Injectable({ providedIn: 'root' })
export class OperationsService {
  private readonly visitors = inject(VisitorService);
  private readonly creds = inject(AccessCredentialService);
  private readonly logs = inject(AccessLogService);
  private readonly tickets = inject(TicketService);
  private readonly members = inject(MemberService);
  private readonly users = inject(UserService);
  private readonly subs = inject(SubscriptionService);
  private readonly locations = inject(LocationService);
  private readonly notify = inject(NotificationCenterService);
  private readonly auth = inject(AuthService);
  private readonly settings = inject(SettingsService);
  private readonly integrations = inject(IntegrationService);

  // ---------------- Visitors ----------------
  createVisitor(data: Omit<Visitor, 'id' | 'status' | 'passCode' | 'photoCaptured' | 'hostNotified' | 'createdAt' | 'notifiedVia'>): Visitor {
    const created = this.visitors.createSync({ ...data, status: 'EXPECTED', passCode: '', photoCaptured: false, hostNotified: false, createdAt: new Date().toISOString(), notifiedVia: ['SMS', 'EMAIL'] });
    const v = this.visitors.updateSync(created.id, { passCode: passCode(created.id + Date.now()) });
    const sub = this.subs.forMember(data.hostMemberId);
    if (sub) this.subs.updateSync(sub.id, { guestPassesUsed: Math.min(sub.guestPassesTotal, sub.guestPassesUsed + 1) });
    this.notify.dispatch({
      event: 'Visitor Pass Issued',
      audience: 'STAFF',
      category: 'VISITOR',
      title: 'Visitor expected',
      message: `${v.name} is visiting ${this.members.fullName(v.hostMemberId)} on ${v.visitDate} at ${v.visitTime}.`,
      link: '/admin/front-desk',
      recipient: v.mobile,
      locationId: v.locationId,
      channels: ['SMS', 'EMAIL'],
    });
    return v;
  }

  cancelVisitor(id: string): Visitor {
    return this.visitors.updateSync(id, { status: 'CANCELLED' });
  }

  checkIn(id: string, photoCaptured: boolean): Visitor {
    const v = this.visitors.updateSync(id, { status: 'CHECKED_IN', checkInAt: new Date().toISOString(), photoCaptured, hostNotified: true });
    this.logs.createSync({ person: v.name, personType: 'VISITOR', personId: v.id, locationId: v.locationId, door: 'Reception', at: new Date().toISOString(), direction: 'IN', status: 'GRANTED' });
    this.notify.dispatch({
      event: 'Visitor Arrival',
      audience: 'MEMBER',
      memberId: v.hostMemberId,
      category: 'VISITOR',
      title: 'Your visitor has arrived',
      message: `${v.name}${v.company ? ' from ' + v.company : ''} has checked in at the ${this.locations.shortName(v.locationId)} reception.`,
      link: `/member/visitors/${v.id}`,
      locationId: v.locationId,
      channels: ['PUSH', 'SMS'],
    });
    return v;
  }

  checkOut(id: string): Visitor {
    const v = this.visitors.updateSync(id, { status: 'CHECKED_OUT', checkOutAt: new Date().toISOString() });
    this.logs.createSync({ person: v.name, personType: 'VISITOR', personId: v.id, locationId: v.locationId, door: 'Reception', at: new Date().toISOString(), direction: 'OUT', status: 'GRANTED' });
    return v;
  }

  /** Marks visitor passes from past days as expired (QR expires after the visit). */
  expirePasses(): number {
    const today = new Date().toLocaleDateString('en-CA');
    const stale = this.visitors.items().filter((v) => v.visitDate < today && (v.status === 'EXPECTED' || v.status === 'CHECKED_IN'));
    stale.forEach((v) => this.visitors.updateSync(v.id, { status: v.status === 'CHECKED_IN' ? 'CHECKED_OUT' : 'EXPIRED', checkOutAt: v.checkOutAt ?? v.checkInAt }));
    return stale.length;
  }

  // ---------------- Access / QR ----------------
  /** Flow 9: validate QR → active plan? within plan hours? valid QR? → open door / deny → log. */
  scan(code: string, locationId: string, door = 'Main Entrance', direction: 'IN' | 'OUT' = 'IN'): ScanResult {
    const c = code.trim().toUpperCase();
    const visitor = this.visitors.items().find((v) => v.passCode.toUpperCase() === c);
    if (visitor) {
      const today = new Date().toLocaleDateString('en-CA');
      const checks = [
        { label: 'Valid visitor pass', ok: true },
        { label: 'Visit scheduled for today', ok: visitor.visitDate === today },
        { label: 'Pass not expired or cancelled', ok: !['EXPIRED', 'CANCELLED', 'CHECKED_OUT'].includes(visitor.status) },
        { label: 'Correct location', ok: visitor.locationId === locationId },
      ];
      const valid = checks.every((x) => x.ok);
      return { valid, kind: 'VISITOR', name: visitor.name, checks, visitor, reason: valid ? undefined : checks.find((x) => !x.ok)?.label };
    }
    const cred = this.creds.items().find((x) => x.code.toUpperCase() === c);
    if (!cred) {
      const log = this.logs.createSync({ person: 'Unknown', personType: 'VISITOR', personId: '-', locationId, door, at: new Date().toISOString(), direction, status: 'DENIED', reason: 'Invalid / unknown QR' });
      return { valid: false, kind: 'UNKNOWN', name: 'Unknown QR', checks: [{ label: 'Valid QR', ok: false }], reason: 'This QR code is not recognised.', log };
    }
    const hour = new Date().getHours();
    const within = cred.accessHours.startsWith('24') || (hour >= 8 && hour < 21);
    let planOk = true;
    if (cred.holderType === 'MEMBER') {
      const st = accessStateFor(this.subs.forMember(cred.holderId));
      planOk = st === 'ACTIVE' || st === 'OVERDUE';
    }
    const controller = this.integrations.isAvailable('ACCESS_CONTROL') ? this.integrations.activeLabel('ACCESS_CONTROL') : null;
    const checks = [
      { label: 'Valid QR', ok: cred.status === 'ACTIVE' },
      { label: 'Active plan', ok: planOk },
      { label: `Within plan hours (${cred.accessHours})`, ok: within },
      { label: controller ? `Door controller online (${controller})` : 'Door controller online (no access provider active)', ok: !!controller },
    ];
    const valid = checks.every((x) => x.ok);
    const reason = valid
      ? undefined
      : !checks[0].ok
        ? `Credential ${cred.status.toLowerCase()}${cred.revokedReason ? ': ' + cred.revokedReason : ''}`
        : !planOk
          ? 'Plan expired, paused or overdue beyond grace'
          : !within
            ? 'Outside plan access hours'
            : 'Door controller offline – check Configuration / Integrations';
    const log = this.logs.createSync({ person: cred.holderName, personType: cred.holderType, personId: cred.holderId, locationId, door, at: new Date().toISOString(), direction, status: valid ? 'GRANTED' : 'DENIED', reason });
    return { valid, kind: cred.holderType, name: cred.holderName, checks, reason, log };
  }

  revoke(credentialId: string, reason: string): void {
    this.creds.updateSync(credentialId, { status: 'REVOKED', revokedReason: reason });
  }

  reissue(credentialId: string): void {
    const c = this.creds.find(credentialId);
    if (!c) return;
    const d = new Date();
    d.setDate(d.getDate() + 30);
    this.creds.updateSync(credentialId, { status: 'ACTIVE', revokedReason: undefined, code: `${c.code.slice(0, 4)}${Math.random().toString(36).slice(2, 8).toUpperCase()}`, issuedAt: new Date().toISOString(), validUntil: d.toLocaleDateString('en-CA') });
  }

  // ---------------- Support tickets ----------------
  hoursOpen(t: Ticket): number {
    return (Date.now() - new Date(t.createdAt).getTime()) / 3600000;
  }

  /** Remaining hours before the 24h auto-escalation (negative when overdue). */
  slaRemaining(t: Ticket): number {
    return this.settings.settings().ticketEscalationHours - this.hoursOpen(t);
  }

  createTicket(data: { memberId: string; locationId: string; category: string; subject: string; description: string; priority: TicketPriority; attachments: Attachment[] }): Ticket {
    const now = new Date().toISOString();
    const t = this.tickets.createSync({
      ...data,
      status: 'OPEN',
      createdAt: now,
      updatedAt: now,
      escalated: false,
      comments: [],
      timeline: [{ id: `T-${Date.now()}`, title: 'Ticket created', description: `Raised by ${this.members.fullName(data.memberId)}`, at: now, tone: 'info', icon: 'plus' }],
    });
    this.notify.dispatch({ event: 'Ticket Update', audience: 'STAFF', category: 'SUPPORT', title: 'New support ticket', message: `${t.id} · ${t.subject} (${t.priority.toLowerCase()} priority)`, link: `/admin/support/${t.id}`, locationId: t.locationId, channels: ['EMAIL', 'PUSH'] });
    return t;
  }

  assign(id: string, userId: string): Ticket {
    const t = this.tickets.find(id)!;
    const name = this.users.name(userId);
    const updated = this.tickets.updateSync(id, {
      assignedTo: userId,
      status: t.status === 'OPEN' ? 'IN_PROGRESS' : t.status,
      updatedAt: new Date().toISOString(),
      timeline: [...t.timeline, this.entry('Assigned', `Assigned to ${name}`, 'primary', 'user'), ...(t.status === 'OPEN' ? [this.entry('In progress', 'Work started', 'warning', 'clock')] : [])],
    });
    this.notifyMember(updated, `Your ticket ${t.id} has been assigned to ${name}.`);
    return updated;
  }

  setStatus(id: string, status: Ticket['status']): Ticket {
    const t = this.tickets.find(id)!;
    const updated = this.tickets.updateSync(id, {
      status,
      updatedAt: new Date().toISOString(),
      resolvedAt: status === 'RESOLVED' ? new Date().toISOString() : undefined,
      timeline: [...t.timeline, this.entry(status === 'RESOLVED' ? 'Resolved' : status === 'IN_PROGRESS' ? 'In progress' : 'Reopened', undefined, status === 'RESOLVED' ? 'success' : 'warning', status === 'RESOLVED' ? 'check' : 'clock')],
    });
    this.notifyMember(updated, `Your ticket ${t.id} is now ${status.replace('_', ' ').toLowerCase()}.`);
    return updated;
  }

  comment(id: string, text: string, attachments: Attachment[] = []): Ticket {
    const t = this.tickets.find(id)!;
    const u = this.auth.user();
    const c: Comment = { id: `C-${Date.now()}`, author: u?.name ?? 'User', authorRole: u?.role === 'MEMBER' ? 'Member' : 'Staff', text, at: new Date().toISOString() };
    const updated = this.tickets.updateSync(id, {
      comments: [...t.comments, c],
      attachments: [...t.attachments, ...attachments],
      updatedAt: c.at,
      timeline: [...t.timeline, this.entry('Comment added', text.length > 60 ? text.slice(0, 60) + '…' : text, 'neutral', 'message', c.author)],
    });
    if (u?.role !== 'MEMBER') this.notifyMember(updated, `New reply on ${t.id}: ${text.slice(0, 80)}`);
    return updated;
  }

  escalate(id: string, to = 'Location Manager', auto = false): Ticket {
    const t = this.tickets.find(id)!;
    const updated = this.tickets.updateSync(id, {
      escalated: true,
      escalatedTo: to,
      priority: t.priority === 'LOW' || t.priority === 'MEDIUM' ? 'HIGH' : t.priority,
      updatedAt: new Date().toISOString(),
      timeline: [...t.timeline, this.entry(auto ? 'Escalated automatically' : 'Escalated', auto ? `Unresolved for more than ${this.settings.settings().ticketEscalationHours} hours. Escalated to ${to}.` : `Escalated to ${to}`, 'danger', 'alert')],
    });
    this.notify.dispatch({ event: 'Ticket Escalated', audience: 'STAFF', category: 'SUPPORT', title: 'Ticket escalated', message: `${t.id} · ${t.subject} escalated to ${to}.`, link: `/admin/support/${t.id}`, locationId: t.locationId, channels: ['EMAIL', 'PUSH'] });
    return updated;
  }

  /** Flow 11: unresolved after 24 hours → automatic escalation to manager/admin. */
  autoEscalate(): number {
    const due = this.tickets.items().filter((t) => t.status !== 'RESOLVED' && !t.escalated && this.slaRemaining(t) <= 0);
    due.forEach((t) => this.escalate(t.id, 'Location Manager', true));
    return due.length;
  }

  private entry(title: string, description: string | undefined, tone: TimelineEntry['tone'], icon: string, actor?: string): TimelineEntry {
    return { id: `T-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, title, description, at: new Date().toISOString(), tone, icon, actor: actor ?? this.auth.user()?.name };
  }

  private notifyMember(t: Ticket, message: string): void {
    this.notify.dispatch({ event: 'Ticket Update', audience: 'MEMBER', memberId: t.memberId, category: 'SUPPORT', title: `Ticket ${t.id} updated`, message, link: `/member/support/${t.id}`, locationId: t.locationId, channels: ['EMAIL', 'PUSH'] });
  }
}
