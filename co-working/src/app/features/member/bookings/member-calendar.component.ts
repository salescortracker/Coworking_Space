import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SHARED, createLoader } from '../../../shared';
import { CalendarComponent, CalendarEvent } from '../../../shared/components/domain/calendar.component';
import { BookingService } from '../../../core/services/data/transaction-data.service';
import { ResourceService } from '../../../core/services/data/workspace-data.service';
import { EventService } from '../../../core/services/data/engagement-data.service';
import { MemberAccountService } from '../../../core/services/member-account.service';

@Component({
  selector: 'app-member-calendar',
  imports: [...SHARED, CalendarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Calendar" subtitle="Your bookings and the community events you’re attending." [breadcrumbs]="[{ label: 'Dashboard', link: '/member/dashboard' }, { label: 'Calendar' }]">
        <a class="btn btn-primary" routerLink="/member/bookings/new"><app-icon name="plus" [size]="16" /> New booking</a>
      </app-page-header>
      <section class="card card-body">
        @if (loader.status() === 'loading') {
          <app-loading-state variant="detail" />
        } @else if (loader.status() === 'error') {
          <app-error-state (retry)="loader.load()" />
        } @else {
          <app-calendar [events]="events()" (eventClick)="open($event)" />
          <div class="fm-legend mt-4">
            <span><span class="fm-swatch" style="background: var(--primary-50); border-color: var(--primary)"></span>Confirmed</span>
            <span><span class="fm-swatch" style="background: var(--warning-50); border-color: var(--warning)"></span>Pending</span>
            <span><span class="fm-swatch" style="background: var(--info-50); border-color: var(--info)"></span>Completed / Event</span>
            <span><span class="fm-swatch" style="background: var(--neutral-50); border-color: var(--text-disabled)"></span>Cancelled</span>
          </div>
        }
      </section>
    </div>
  `,
})
export class MemberCalendarComponent {
  private readonly bookings = inject(BookingService);
  private readonly resources = inject(ResourceService);
  private readonly eventsSvc = inject(EventService);
  private readonly acct = inject(MemberAccountService);
  private readonly router = inject(Router);
  protected readonly loader = createLoader(() => this.bookings.list());

  protected readonly events = computed<CalendarEvent[]>(() => {
    const mid = this.acct.memberId();
    const bookings = this.bookings.forMember(mid).map((b) => ({ id: b.id, date: b.date, start: b.startTime, end: b.endTime, title: this.resources.name(b.resourceId), status: b.status }));
    const evs = this.eventsSvc
      .items()
      .filter((e) => mid && e.attendees.includes(mid) && e.status === 'PUBLISHED')
      .map((e) => ({ id: e.id, date: e.date, start: e.startTime, end: e.endTime, title: `Event: ${e.title}`, status: 'COMPLETED' }));
    return [...bookings, ...evs];
  });

  protected open(e: CalendarEvent): void {
    if (e.id.startsWith('EVT')) this.router.navigate(['/member/events'], { queryParams: { id: e.id } });
    else this.router.navigate(['/member/bookings', e.id]);
  }
}
