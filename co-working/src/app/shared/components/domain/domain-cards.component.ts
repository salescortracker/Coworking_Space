import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../icon/icon.component';
import { StatusBadgeComponent } from '../basics/basics.component';
import { WorkspaceImageComponent } from '../visuals/visuals.component';
import { InrPipe, HumanizePipe, Time12Pipe } from '../../pipes/format.pipes';
import { Booking, Invoice, Location, Plan, SPACE_TYPE_LABELS, SpaceType } from '../../../core/models';
import { LocationService, ResourceService } from '../../../core/services/data/workspace-data.service';
import { SettingsService } from '../../../core/services/settings.service';

const CYCLE_UNIT: Record<Plan['billingCycle'], string> = { DAILY: 'day', MONTHLY: 'month', QUARTERLY: 'quarter', YEARLY: 'year' };

/** Membership plan card (member plans page, public membership page, checkout). */
@Component({
  selector: 'app-plan-card',
  imports: [IconComponent, InrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card plan-card" [class.featured]="plan().popular" [class.selected]="current()">
      @if (plan().popular) {
        <span class="ribbon">MOST POPULAR</span>
      }
      <div class="row-between">
        <h3 class="plan-name">{{ plan().name }}</h3>
        @if (current()) {
          <span class="badge badge-success">Current plan</span>
        }
      </div>
      <p class="plan-desc">{{ plan().description }}</p>
      <div>
        <span class="price-lg">{{ plan().price | inr }}</span>
        <span class="price-unit"> / {{ cycle() }} + GST</span>
      </div>
      <div class="plan-stats">
        <div><strong>{{ plan().roomHours }}</strong><span>Room hrs</span></div>
        <div><strong>{{ plan().guestPasses }}</strong><span>Guest passes</span></div>
        <div><strong>{{ plan().credits | inr }}</strong><span>Credits</span></div>
      </div>
      <ul class="check-list">
        @for (b of plan().benefits; track b) {
          <li><app-icon name="check" [size]="16" />{{ b }}</li>
        }
        <li><app-icon name="clock" [size]="16" />Access: {{ plan().accessHours }}</li>
        @if (plan().securityDeposit) {
          <li><app-icon name="shield" [size]="16" />Refundable deposit {{ plan().securityDeposit | inr }}</li>
        }
      </ul>
      <button type="button" class="btn btn-block" [class.btn-primary]="!current()" [class.btn-secondary]="current()" [disabled]="current() || disabled()" (click)="choose.emit(plan())">
        {{ current() ? 'Your current plan' : cta() }}
      </button>
    </article>
  `,
})
export class PlanCardComponent {
  readonly plan = input.required<Plan>();
  readonly current = input(false);
  readonly disabled = input(false);
  readonly cta = input('Subscribe');
  readonly choose = output<Plan>();
  protected readonly cycle = computed(() => CYCLE_UNIT[this.plan().billingCycle]);
}

/** Compact booking row/card used on dashboards and lists. */
@Component({
  selector: 'app-booking-card',
  imports: [DatePipe, RouterLink, StatusBadgeComponent, Time12Pipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="booking-card" [routerLink]="link()">
      <span class="date-block">
        <span class="m">{{ booking().date | date: 'MMM' }}</span>
        <span class="d">{{ booking().date | date: 'd' }}</span>
      </span>
      <span class="flex-1 min-0">
        <span class="d-block fw-600 truncate text-primary-ink">{{ resourceName() }}</span>
        <span class="d-block text-sm text-muted truncate">
          <app-icon name="clock" [size]="12" /> {{ booking().startTime | time12 }} – {{ booking().endTime | time12 }} · {{ locationName() }}
        </span>
      </span>
      <app-status-badge [status]="booking().status" />
    </a>
  `,
  styles: `a.booking-card { color: inherit; text-decoration: none; border-bottom: 1px solid var(--border); } a.booking-card:hover { background: var(--surface-alt); } :host:last-child a.booking-card { border-bottom: 0; } .text-primary-ink { color: var(--text); }`,
})
export class BookingCardComponent {
  private readonly resources = inject(ResourceService);
  private readonly locations = inject(LocationService);
  readonly booking = input.required<Booking>();
  readonly link = input<string | unknown[]>('');
  protected readonly resourceName = computed(() => this.resources.name(this.booking().resourceId));
  protected readonly locationName = computed(() => this.locations.shortName(this.booking().locationId));
}

/** Public/member workspace card (search results, location lists). */
@Component({
  selector: 'app-workspace-card',
  imports: [RouterLink, IconComponent, WorkspaceImageComponent, InrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card ws-card" [class.list-mode]="layout() === 'list'">
      <app-workspace-image [seed]="location().photos[0]" [place]="location().name" sizes="(max-width: 767px) 100vw, 400px" />
      <div class="flex-1" style="display: flex; flex-direction: column; min-width: 0">
        <div class="ws-card-body">
          <div class="row-between row-start">
            <a class="ws-card-title" [routerLink]="['/locations', location().id]">{{ location().name }}</a>
            <span class="rating"><app-icon name="star" [size]="14" /> {{ location().rating }}</span>
          </div>
          <div class="ws-card-meta">
            <span><app-icon name="map-pin" [size]="14" /> {{ location().city }} · {{ location().distanceKm }} km</span>
            <span><app-icon name="users" [size]="14" /> Up to {{ capacity() }} seats</span>
          </div>
          <div class="tag-list">
            @for (a of location().amenities.slice(0, 4); track a) {
              <span class="tag">{{ a }}</span>
            }
            @if (location().amenities.length > 4) {
              <span class="tag">+{{ location().amenities.length - 4 }}</span>
            }
          </div>
          <div class="text-sm" [class.text-success]="available()" [class.text-danger]="!available()">
            <span class="avail">● {{ available() ? 'Available on your date' : 'Limited availability' }}</span>
          </div>
        </div>
        <div class="ws-card-foot">
          <div>
            <span class="text-xs text-muted">{{ typeLabel() }} from</span>
            <div><span class="price">{{ price() | inr }}</span> <span class="price-unit">/ {{ unit() }}</span></div>
          </div>
          <div class="btn-group">
            <a class="btn btn-secondary btn-sm" [routerLink]="['/locations', location().id]">View Details</a>
            <a class="btn btn-primary btn-sm" routerLink="/book-now" [queryParams]="{ location: location().id, type: type() ?? '' }">Book Now</a>
          </div>
        </div>
      </div>
    </article>
  `,
})
export class WorkspaceCardComponent {
  readonly location = input.required<Location>();
  readonly type = input<SpaceType | null>(null);
  readonly price = input(0);
  readonly unit = input('day');
  readonly capacity = input(1);
  readonly available = input(true);
  readonly layout = input<'grid' | 'list'>('grid');
  protected readonly typeLabel = computed(() => (this.type() ? SPACE_TYPE_LABELS[this.type()!] : 'Workspace'));
}

/** GST-compliant invoice document (view / print / PDF). */
@Component({
  selector: 'app-invoice-view',
  imports: [DatePipe, InrPipe, HumanizePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="invoice" aria-label="Tax invoice">
      <header class="invoice-head">
        <div>
          <div class="row-sm mb-2">
            <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#3140b0" /><rect x="7" y="7" width="8" height="8" rx="1.5" fill="#fff" /><rect x="17" y="7" width="8" height="8" rx="1.5" fill="#fff" opacity="0.65" /><rect x="7" y="17" width="8" height="8" rx="1.5" fill="#fff" opacity="0.65" /><circle cx="21" cy="21" r="4" fill="#fff" /></svg>
            <strong style="letter-spacing: 0.12em">OFFICERA</strong>
          </div>
          <div class="fw-600">{{ supplier().legalName }}</div>
          <div class="text-muted" style="max-width: 300px">{{ supplier().address }}</div>
          <div>GSTIN: <strong class="mono">{{ supplier().gstin }}</strong> · PAN: {{ supplier().pan }}</div>
          <div class="text-muted">State: {{ supplier().state }} ({{ supplier().stateCode }})</div>
        </div>
        <div class="text-right">
          <h2>TAX INVOICE</h2>
          <div class="mt-2">Invoice No: <strong class="mono">{{ invoice().number }}</strong></div>
          <div>Invoice Date: <strong>{{ invoice().date | date: 'd MMM y' }}</strong></div>
          <div>Due Date: {{ invoice().dueDate | date: 'd MMM y' }}</div>
          <div class="mt-3"><span class="stamp uppercase {{ invoice().status }}">{{ invoice().status | humanize }}</span></div>
        </div>
      </header>
      <section class="invoice-parties">
        <div>
          <h4>Bill to</h4>
          <div class="fw-600">{{ invoice().companyName ?? invoice().customerName }}</div>
          @if (invoice().companyName) {
            <div>Attn: {{ invoice().customerName }}</div>
          }
          <div class="text-muted">{{ invoice().billingAddress || '—' }}</div>
          <div>GSTIN: <span class="mono">{{ invoice().customerGstin ?? 'Unregistered' }}</span></div>
        </div>
        <div>
          <h4>Supply details</h4>
          <div>Place of supply: <strong>{{ invoice().placeOfSupply }}</strong></div>
          <div>Supply type: {{ invoice().intraState ? 'Intra-state (CGST + SGST)' : 'Inter-state (IGST)' }}</div>
          <div>Centre: {{ locationName() }}</div>
          <div>Reverse charge: No</div>
        </div>
      </section>
      <div style="overflow-x: auto">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Description</th>
              <th>SAC/HSN</th>
              <th class="num">Qty</th>
              <th class="num hide-sm">Rate</th>
              <th class="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            @for (l of invoice().lines; track $index) {
              <tr>
                <td>{{ $index + 1 }}</td>
                <td>{{ l.description }}</td>
                <td class="mono">{{ l.sac || '—' }}</td>
                <td class="num">{{ l.qty }}</td>
                <td class="num hide-sm">{{ l.rate | inr: true }}</td>
                <td class="num">{{ l.amount | inr: true }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <div class="invoice-totals">
        <div class="line"><span>Taxable value (Subtotal)</span><span class="tabular">{{ invoice().subtotal | inr: true }}</span></div>
        @if (invoice().intraState) {
          <div class="line"><span>CGST &#64; {{ rate() / 2 }}%</span><span class="tabular">{{ invoice().cgst | inr: true }}</span></div>
          <div class="line"><span>SGST &#64; {{ rate() / 2 }}%</span><span class="tabular">{{ invoice().sgst | inr: true }}</span></div>
          <div class="line text-muted"><span>IGST</span><span class="tabular">{{ 0 | inr: true }}</span></div>
        } @else {
          <div class="line text-muted"><span>CGST</span><span class="tabular">{{ 0 | inr: true }}</span></div>
          <div class="line text-muted"><span>SGST</span><span class="tabular">{{ 0 | inr: true }}</span></div>
          <div class="line"><span>IGST &#64; {{ rate() }}%</span><span class="tabular">{{ invoice().igst | inr: true }}</span></div>
        }
        <div class="line"><span>Total tax</span><span class="tabular">{{ invoice().tax | inr: true }}</span></div>
        <div class="line grand"><span>Total</span><span class="tabular">{{ invoice().total | inr: true }}</span></div>
        <div class="line"><span>Amount paid</span><span class="tabular">{{ invoice().amountPaid | inr: true }}</span></div>
        <div class="line fw-600"><span>Balance due</span><span class="tabular">{{ invoice().total - invoice().amountPaid | inr: true }}</span></div>
      </div>
      <footer class="invoice-foot">
        <span>Payment status: <strong>{{ invoice().status | humanize }}</strong>{{ invoice().paymentId ? ' · Ref ' + invoice().paymentId : '' }}</span>
        <span>This is a computer-generated invoice and does not require a signature.</span>
      </footer>
    </article>
  `,
  styles: `:host { display: block; } .uppercase { text-transform: uppercase; }`,
})
export class InvoiceViewComponent {
  private readonly settings = inject(SettingsService);
  private readonly locations = inject(LocationService);
  readonly invoice = input.required<Invoice>();
  protected readonly supplier = computed(() => this.settings.settings().supplier);
  protected readonly rate = computed(() => this.settings.settings().gstRate);
  protected readonly locationName = computed(() => this.locations.name(this.invoice().locationId));
}
