import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { AuthService } from './auth.service';
import { LocationService, ResourceService } from './data/workspace-data.service';
import { MemberService, CompanyService } from './data/people-data.service';
import { BookingService, InvoiceService } from './data/transaction-data.service';
import { TicketService } from './data/operations-data.service';
import { LeadService } from './data/engagement-data.service';

export interface SearchHit {
  id: string;
  title: string;
  subtitle: string;
  link: string;
  icon: string;
}

export interface SearchGroup {
  category: string;
  hits: SearchHit[];
}

/** Global console search across the main entities, respecting location scope and permissions. */
@Injectable({ providedIn: 'root' })
export class GlobalSearchService {
  private readonly auth = inject(AuthService);
  private readonly members = inject(MemberService);
  private readonly companies = inject(CompanyService);
  private readonly bookings = inject(BookingService);
  private readonly locations = inject(LocationService);
  private readonly resources = inject(ResourceService);
  private readonly leads = inject(LeadService);
  private readonly tickets = inject(TicketService);
  private readonly invoices = inject(InvoiceService);

  search(term: string, limit = 5): Observable<SearchGroup[]> {
    // Searches the records already loaded from the API for this user (location scope and permissions applied).
    return of(this.searchSync(term, limit));
  }

  searchSync(term: string, limit = 5): SearchGroup[] {
    const q = term.trim().toLowerCase();
    if (q.length < 2) return [];
    const has = (...parts: (string | undefined | number)[]) => parts.some((p) => p !== undefined && String(p).toLowerCase().includes(q));
    const groups: SearchGroup[] = [];
    const add = (category: string, permission: string, hits: SearchHit[]) => {
      if (hits.length && this.auth.can(permission)) groups.push({ category, hits: hits.slice(0, limit) });
    };

    add(
      'Members',
      'members.view',
      this.members
        .scoped()
        .filter((m) => has(m.firstName + ' ' + m.lastName, m.email, m.mobile, m.id, this.companies.name(m.companyId)))
        .map((m) => ({ id: m.id, title: `${m.firstName} ${m.lastName}`, subtitle: `${m.id} · ${this.companies.find(m.companyId)?.name ?? 'Individual'}`, link: `/admin/members/${m.id}`, icon: 'user' })),
    );
    add(
      'Bookings',
      'bookings.view',
      this.bookings
        .scoped()
        .filter((b) => has(b.id, this.members.fullName(b.memberId), this.resources.name(b.resourceId)))
        .map((b) => ({ id: b.id, title: `${b.id} · ${this.resources.name(b.resourceId)}`, subtitle: `${this.members.fullName(b.memberId)} · ${b.date} ${b.startTime}`, link: `/admin/bookings/${b.id}`, icon: 'calendar' })),
    );
    add(
      'Locations',
      'locations.view',
      this.locations
        .scoped()
        .filter((l) => has(l.name, l.city, l.address, l.id))
        .map((l) => ({ id: l.id, title: l.name, subtitle: `${l.city} · ${l.address}`, link: `/admin/locations/${l.id}`, icon: 'building' })),
    );
    add(
      'Resources',
      'resources.view',
      this.resources
        .scoped()
        .filter((r) => has(r.name, r.code, r.id))
        .map((r) => ({ id: r.id, title: `${r.name} (${r.code})`, subtitle: this.locations.name(r.locationId), link: `/admin/resources/${r.id}`, icon: 'layers' })),
    );
    add(
      'Leads',
      'leads.view',
      this.leads
        .scoped()
        .filter((l) => has(l.name, l.mobile, l.email, l.id))
        .map((l) => ({ id: l.id, title: l.name, subtitle: `${l.id} · ${l.requirement}`, link: `/admin/leads/${l.id}`, icon: 'target' })),
    );
    add(
      'Tickets',
      'support.view',
      this.tickets
        .scoped()
        .filter((t) => has(t.id, t.subject, t.category))
        .map((t) => ({ id: t.id, title: `${t.id} · ${t.subject}`, subtitle: `${t.category} · ${t.status.replace('_', ' ').toLowerCase()}`, link: `/admin/support/${t.id}`, icon: 'support' })),
    );
    add(
      'Invoices',
      'invoices.view',
      this.invoices
        .scoped()
        .filter((i) => has(i.number, i.id, i.customerName, i.companyName))
        .map((i) => ({ id: i.id, title: i.number, subtitle: `${i.companyName ?? i.customerName} · ₹${i.total.toLocaleString('en-IN')}`, link: `/admin/finance/invoices/${i.id}`, icon: 'receipt' })),
    );
    return groups;
  }
}
