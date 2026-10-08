import { Injectable, computed, inject } from '@angular/core';
import { AppNotification, NotificationCategory, NotificationChannel } from '../models';
import { AuthService } from './auth.service';
import { NotificationDataService, NotificationLogService, NotificationTemplateService } from './data/operations-data.service';
import { MemberService, UserService } from './data/people-data.service';
import { IntegrationService } from './integration.service';

export interface DispatchOptions {
  event: string;
  audience: 'MEMBER' | 'STAFF';
  userId?: string;
  /** Resolved to the member's login user when userId is not given. */
  memberId?: string;
  category: NotificationCategory;
  title: string;
  message: string;
  link?: string;
  recipient?: string;
  locationId?: string;
  channels?: NotificationChannel[];
}

/**
 * Central notification service (flow 15): every business event goes through `dispatch`,
 * which creates the in-app notification and one delivery log per channel using the
 * matching active template.
 */
@Injectable({ providedIn: 'root' })
export class NotificationCenterService {
  private readonly data = inject(NotificationDataService);
  private readonly logs = inject(NotificationLogService);
  private readonly templates = inject(NotificationTemplateService);
  private readonly auth = inject(AuthService);
  private readonly users = inject(UserService);
  private readonly members = inject(MemberService);
  private readonly integrations = inject(IntegrationService);

  /** Notifications visible to the signed-in user, newest first. */
  readonly mine = computed<AppNotification[]>(() => {
    const u = this.auth.user();
    if (!u) return [];
    const audience = u.role === 'MEMBER' ? 'MEMBER' : 'STAFF';
    return this.data
      .items()
      .filter((n) => n.audience === audience && (!n.userId || n.userId === u.id))
      .sort((a, b) => b.at.localeCompare(a.at));
  });

  readonly unreadCount = computed(() => this.mine().filter((n) => !n.read).length);

  markRead(id: string): void {
    this.data.updateSync(id, { read: true });
  }

  markUnread(id: string): void {
    this.data.updateSync(id, { read: false });
  }

  markAllRead(): void {
    this.mine()
      .filter((n) => !n.read)
      .forEach((n) => this.data.updateSync(n.id, { read: true }));
  }

  dispatch(opts: DispatchOptions): void {
    const channels = opts.channels ?? ['EMAIL', 'PUSH'];
    const userId = opts.userId ?? (opts.memberId ? this.users.items().find((u) => u.memberId === opts.memberId)?.id : undefined);
    if (opts.audience === 'MEMBER' && opts.memberId && !userId) {
      // Member has no login yet: only log the outbound delivery.
      this.logDelivery(opts, channels);
      return;
    }
    this.data.createSync({
      audience: opts.audience,
      userId,
      category: opts.category,
      title: opts.title,
      message: opts.message,
      at: new Date().toISOString(),
      read: false,
      link: opts.link,
    });
    this.logDelivery(opts, channels);
  }

  private logDelivery(opts: DispatchOptions, channels: NotificationChannel[]): void {
    for (const channel of channels) {
      const tpl = this.templates.items().find((t) => t.event.startsWith(opts.event) && t.channel === channel && t.status === 'ACTIVE');
      const category = channel === 'EMAIL' ? 'EMAIL' : channel === 'SMS' ? 'SMS' : 'PUSH';
      const provider = this.integrations.isAvailable(category) ? this.integrations.activeLabel(category) : null;
      this.logs.createSync({
        event: opts.event,
        templateName: tpl?.name ?? `${opts.event} – ${channel}`,
        channel,
        recipient: opts.recipient ?? this.recipientFor(opts, channel),
        at: new Date().toISOString(),
        // Delivered only when the channel has an active, working provider in Configuration / Integrations.
        status: provider && (tpl || channel === 'PUSH') ? 'DELIVERED' : 'QUEUED',
        provider: provider ?? 'No active provider',
        locationId: opts.locationId ?? '',
      });
    }
  }

  /** Real recipient for a channel: the member's e-mail / mobile, the signed-in device for push. */
  private recipientFor(opts: DispatchOptions, channel: NotificationChannel): string {
    const member = this.members.find(opts.memberId);
    if (channel === 'PUSH') return opts.userId ?? (opts.audience === 'STAFF' ? 'staff (all)' : 'member device');
    if (!member) return opts.audience === 'STAFF' ? 'staff (all)' : '—';
    return channel === 'SMS' ? member.mobile : member.email;
  }
}