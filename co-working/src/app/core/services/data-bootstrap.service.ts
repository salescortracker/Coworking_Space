import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { COLLECTIONS } from './api-collection';
import { CompanyService, MemberService, RoleService, UserService } from './data/people-data.service';
import { LocationService, ResourceService } from './data/workspace-data.service';
import { CreditTransactionService, PlanService, PromotionService, SubscriptionService } from './data/membership-data.service';
import { BookingService, CreditNoteService, InvoiceService, PaymentService, RefundService } from './data/transaction-data.service';
import {
  AccessCredentialService,
  AccessLogService,
  AuditLogService,
  NotificationDataService,
  NotificationLogService,
  NotificationTemplateService,
  TicketService,
  VisitorService,
} from './data/operations-data.service';
import { BlogService, EventService, GalleryService, HomepageContentService, LeadService, PerkService, PostService } from './data/engagement-data.service';
import { IntegrationService } from './integration.service';
import { SettingsService } from './settings.service';
import { IdPoolService } from './id-pool.service';

/** Prefixes a signed-in user may create records with (ids are reserved in advance). */
const PREFIXES = ['LOC', 'RES', 'MEM', 'COM', 'USR', 'PLN', 'PRM', 'SUB', 'CRT', 'BKG', 'PAY', 'INV', 'RFD', 'CN', 'VIS', 'ACR', 'LOG', 'TKT', 'AUD', 'NTF', 'TPL', 'NLG', 'LEAD', 'PST', 'EVT', 'PRK', 'BLG', 'GAL', 'INT'];

/**
 * Loads the data every screen reads from the Officera API: the public catalogue for visitors, and every module
 * the signed-in user may see after sign-in. Runs before the first screen renders and again after sign-in/out.
 */
@Injectable({ providedIn: 'root' })
export class DataBootstrapService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly ids = inject(IdPoolService);
  private readonly settings = inject(SettingsService);
  private readonly homepage = inject(HomepageContentService);

  // Public catalogue
  private readonly locations = inject(LocationService);
  private readonly resources = inject(ResourceService);
  private readonly plans = inject(PlanService);
  private readonly events = inject(EventService);
  private readonly blog = inject(BlogService);
  private readonly gallery = inject(GalleryService);
  private readonly integrations = inject(IntegrationService);
  private readonly bookings = inject(BookingService);

  // Signed-in modules
  private readonly members = inject(MemberService);
  private readonly companies = inject(CompanyService);
  private readonly users = inject(UserService);
  private readonly roles = inject(RoleService);
  private readonly promotions = inject(PromotionService);
  private readonly subscriptions = inject(SubscriptionService);
  private readonly credits = inject(CreditTransactionService);
  private readonly payments = inject(PaymentService);
  private readonly invoices = inject(InvoiceService);
  private readonly refunds = inject(RefundService);
  private readonly creditNotes = inject(CreditNoteService);
  private readonly visitors = inject(VisitorService);
  private readonly accessCredentials = inject(AccessCredentialService);
  private readonly accessLogs = inject(AccessLogService);
  private readonly tickets = inject(TicketService);
  private readonly notifications = inject(NotificationDataService);
  private readonly templates = inject(NotificationTemplateService);
  private readonly notificationLogs = inject(NotificationLogService);
  private readonly auditLogs = inject(AuditLogService);
  private readonly leads = inject(LeadService);
  private readonly posts = inject(PostService);
  private readonly perks = inject(PerkService);

  /** Public website data (no sign-in). */
  async loadPublic(): Promise<void> {
    if (!this.isBrowser) return;
    await Promise.all([
      this.settings.load(),
      this.homepage.load(),
      this.locations.load(),
      this.resources.load(),
      this.plans.load(),
      this.events.load(),
      this.blog.load(),
      this.gallery.load(),
      this.integrations.load(),
      this.bookings.loadOccupancy(),
    ]);
  }

  /** Everything the signed-in user may see, based on their role and permissions. */
  async loadForUser(role: string, permissions: Set<string>): Promise<void> {
    if (!this.isBrowser) return;
    const staff = role !== 'MEMBER';
    const can = (p: string) => role === 'SUPER_ADMIN' || permissions.has(p);
    const jobs: Promise<void>[] = [
      this.settings.load(),
      this.homepage.load(),
      this.locations.load(),
      this.resources.load(),
      this.plans.load(),
      this.events.load(),
      this.blog.load(),
      this.gallery.load(),
      this.integrations.load(),
      this.bookings.load(),
      this.members.load(),
      this.companies.load(),
      this.users.load(),
      this.promotions.load(),
      this.subscriptions.load(),
      this.credits.load(),
      this.payments.load(),
      this.invoices.load(),
      this.refunds.load(),
      this.creditNotes.load(),
      this.visitors.load(),
      this.accessCredentials.load(),
      this.accessLogs.load(),
      this.tickets.load(),
      this.notifications.load(),
      this.templates.load(),
      this.posts.load(),
      this.perks.load(),
    ];
    if (staff) {
      jobs.push(this.roles.load(), this.leads.load(), this.notificationLogs.load());
      if (can('audit.view')) jobs.push(this.auditLogs.load());
    }
    await Promise.all(jobs);
    this.ids.warmUp(PREFIXES);
  }

  /** Clears every signed-in collection (sign-out / session expiry). */
  clear(): void {
    COLLECTIONS.forEach((c) => c.reset());
    this.ids.clear();
  }
}
