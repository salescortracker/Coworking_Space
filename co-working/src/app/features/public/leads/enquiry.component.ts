import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { SHARED, addDaysIso, emailValidator, futureDateValidator, mobileValidator, todayIso } from '../../../shared';
import { Lead, LeadSource, SPACE_TYPE_LABELS, SpaceType } from '../../../core/models';
import { LocationService } from '../../../core/services/data/workspace-data.service';
import { AuthError, AuthService } from '../../../core/services/auth.service';
import { LeadCaptureService } from '../../../core/services/lead-capture.service';
import { ToastService } from '../../../core/services/ui.service';

type Mode = 'BOOK_NOW' | 'CALLBACK' | 'TOUR';

const COPY: Record<Mode, { title: string; subtitle: string; done: string; doneMsg: string }> = {
  BOOK_NOW: { title: 'Book Now', subtitle: 'Tell us what you need. No account required – we’ll confirm availability and call you back.', done: 'Your booking request has been submitted.', doneMsg: 'Our team will confirm availability and share payment details shortly.' },
  CALLBACK: { title: 'Request a callback', subtitle: 'Leave your number and a workspace expert will call you at your preferred time.', done: 'Callback requested', doneMsg: 'A workspace expert will call you at your preferred time.' },
  TOUR: { title: 'Schedule a tour', subtitle: 'See the space in person. Tours take about 20 minutes.', done: 'Your tour is confirmed', doneMsg: 'We’ve sent the details by SMS. See you soon!' },
};

/**
 * Public lead journeys (§5, flow 2): details → mobile OTP → lead created → confirmation.
 * One component serves Book Now, Request Callback and Schedule Tour (mode from route data).
 */
@Component({
  selector: 'app-enquiry',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="site-container">
      <div class="lead-shell">
        <section class="card">
          <div class="card-header">
            <div>
              <h1 class="text-xl fw-600">{{ copy().title }}</h1>
              <p class="text-muted mb-0 mt-1">{{ copy().subtitle }}</p>
            </div>
          </div>
          <div class="card-body">
            <div class="stepper mb-5">
              @for (s of steps; track s; let i = $index) {
                <span class="step" [class.active]="step() === i" [class.done]="step() > i"><span class="num">
                  @if (step() > i) {
                    <app-icon name="check" [size]="12" />
                  } @else {
                    {{ i + 1 }}
                  }
                </span>{{ s }}</span>
                @if (i < steps.length - 1) {
                  <span class="step-sep"></span>
                }
              }
            </div>

            @switch (step()) {
              @case (0) {
                <form [formGroup]="form" (ngSubmit)="sendOtp()" class="form-grid" novalidate>
                  <div class="field"><label class="label" for="en">Name <span class="req">*</span></label><input id="en" class="input" formControlName="name" autocomplete="name" /><app-field-error [control]="form.controls.name" label="Name" /></div>
                  <div class="field">
                    <label class="label" for="em">Mobile <span class="req">*</span></label>
                    <div class="input-group"><span class="addon">+91</span><input id="em" class="input" inputmode="numeric" maxlength="10" formControlName="mobile" autocomplete="tel-national" /></div>
                    <app-field-error [control]="form.controls.mobile" label="Mobile" />
                  </div>
                  @if (mode() === 'TOUR') {
                    <div class="field span-2"><label class="label" for="ee">Email <span class="req">*</span></label><input id="ee" class="input" type="email" formControlName="email" autocomplete="email" /><app-field-error [control]="form.controls.email" label="Email" /></div>
                  }
                  @if (mode() !== 'CALLBACK') {
                    <div class="field" [class.span-2]="mode() === 'TOUR'">
                      <label class="label" for="eloc">Location <span class="req">*</span></label>
                      <select id="eloc" class="select" formControlName="locationId">
                        @for (l of locations.active(); track l.id) {
                          <option [value]="l.id">{{ l.name }}, {{ l.city }}</option>
                        }
                      </select>
                    </div>
                  }
                  @if (mode() === 'BOOK_NOW') {
                    <div class="field">
                      <label class="label" for="etype">Booking type <span class="req">*</span></label>
                      <select id="etype" class="select" formControlName="type">
                        @for (t of types; track t) {
                          <option [value]="t">{{ labels[t] }}</option>
                        }
                      </select>
                    </div>
                  }
                  @if (mode() !== 'CALLBACK') {
                    <div class="field">
                      <label class="label" for="edate">{{ mode() === 'TOUR' ? 'Date' : 'Preferred date' }} <span class="req">*</span></label>
                      <input id="edate" class="input" type="date" [min]="today" [max]="maxDate" formControlName="date" />
                      <app-field-error [control]="form.controls.date" label="Date" />
                    </div>
                  }
                  @if (mode() === 'TOUR') {
                    <div class="field">
                      <label class="label" for="evis">Number of visitors <span class="req">*</span></label>
                      <input id="evis" class="input" type="number" min="1" max="10" formControlName="visitors" />
                      <app-field-error [control]="form.controls.visitors" label="Number of visitors" />
                    </div>
                    <div class="field span-2">
                      <span class="label">Available time slot <span class="req">*</span></span>
                      <app-time-slots [slots]="tourSlots()" [value]="form.controls.time.value" (pick)="form.controls.time.setValue($event)" label="Tour time slots" />
                    </div>
                  } @else {
                    <div class="field">
                      <label class="label" for="etime">Preferred time <span class="req">*</span></label>
                      <input id="etime" class="input" type="time" min="08:00" max="20:00" formControlName="time" />
                      <app-field-error [control]="form.controls.time" label="Preferred time" />
                    </div>
                  }
                  @if (mode() === 'BOOK_NOW') {
                    <div class="field">
                      <label class="label" for="eseats">Number of seats <span class="req">*</span></label>
                      <input id="eseats" class="input" type="number" min="1" max="50" formControlName="seats" />
                      <app-field-error [control]="form.controls.seats" label="Number of seats" />
                    </div>
                  }
                  @if (mode() === 'CALLBACK') {
                    <div class="field span-2">
                      <label class="label" for="ereq">Requirement <span class="req">*</span></label>
                      <textarea id="ereq" class="textarea" rows="3" formControlName="requirement" placeholder="e.g. Private office for 6 people in Hyderabad from next month"></textarea>
                      <app-field-error [control]="form.controls.requirement" label="Requirement" />
                    </div>
                  }
                  <div class="span-all form-actions" style="border-top: 0; margin-top: 0; padding-top: 0">
                    <button type="submit" class="btn btn-primary btn-lg" [disabled]="form.invalid || busy()" [appBusy]="busy()" busyText="Sending code…">
            Continue to verify mobile
          </button>
                  </div>
                </form>
              }
              @case (1) {
                <div class="stack" style="max-width: 420px; margin: 0 auto; text-align: center">
                  <p>Enter the 6-digit code sent to <strong>{{ auth.otpDestination() }}</strong></p>
                  @if (otpError()) {
                    <div class="alert alert-danger text-left"><app-icon name="alert" /><div class="alert-body">{{ otpError() }}</div></div>
                  }
                  <app-otp-input [formControl]="otp" [invalid]="!!otpError()" (completed)="verify()" />
                  <div class="row-between text-sm">
                    <span class="field-hint">@if (demoOtp()) {Demo code: <code>{{ demoOtp() }}</code>}</span>
                    @if (resendIn() > 0) {
                      <span class="text-muted">Resend in {{ resendIn() }}s</span>
                    } @else {
                      <button type="button" class="btn btn-link text-sm" (click)="sendOtp()">Resend code</button>
                    }
                  </div>
                  <div class="row-sm">
                    <button type="button" class="btn btn-secondary" (click)="step.set(0)">Edit details</button>
                    <button type="button" class="btn btn-primary flex-1" [disabled]="otp.value.length !== 6 || busy()" (click)="verify()" [appBusy]="busy()" busyText="Verifying…">
            Verify & submit
          </button>
                  </div>
                </div>
              }
              @case (2) {
                <app-success-state [title]="copy().done" [message]="copy().doneMsg">
                  <dl details class="kv" style="max-width: 420px; margin: 8px auto 0; text-align: left; padding: 12px 16px; background: var(--surface-alt); border: 1px solid var(--border); border-radius: 8px">
                    <dt>Reference</dt><dd class="mono">{{ lead()?.id }}</dd>
                    <dt>Name</dt><dd>{{ lead()?.name }}</dd>
                    <dt>Location</dt><dd>{{ locations.name(lead()?.locationId) }}</dd>
                    @if (lead()?.preferredDate) {
                      <dt>Date</dt><dd>{{ lead()?.preferredDate | date: 'EEE, d MMM y' }}</dd>
                    }
                    @if (lead()?.preferredTime) {
                      <dt>Time</dt><dd>{{ lead()?.preferredTime | time12 }}</dd>
                    }
                  </dl>
                  <a class="btn btn-primary" routerLink="/">Back to home</a>
                  <a class="btn btn-secondary" routerLink="/register">Create an account</a>
                </app-success-state>
              }
            }
          </div>
        </section>
        <aside class="stack">
          <section class="card card-body">
            <h2 class="section-title">What happens next?</h2>
            <ol class="stack-sm" style="padding-left: 18px; margin: 0">
              <li>We verify your mobile number with a one-time code.</li>
              <li>Your request reaches the centre team instantly.</li>
              <li>{{ mode() === 'TOUR' ? 'You get an SMS confirmation for your tour.' : 'We call you to confirm details and pricing.' }}</li>
            </ol>
          </section>
          <section class="card card-body">
            <h2 class="section-title">Other ways to reach us</h2>
            <div class="stack-sm">
              @if (mode() !== 'BOOK_NOW') {
                <a routerLink="/book-now" class="btn btn-secondary btn-block">Book Now</a>
              }
              @if (mode() !== 'CALLBACK') {
                <a routerLink="/request-callback" class="btn btn-secondary btn-block">Request a callback</a>
              }
              @if (mode() !== 'TOUR') {
                <a routerLink="/schedule-tour" class="btn btn-secondary btn-block">Schedule a tour</a>
              }
              <a href="tel:+914045671000" class="btn btn-ghost btn-block"><app-icon name="phone" [size]="16" /> +91 40 4567 1000</a>
            </div>
          </section>
        </aside>
      </div>
    </div>
  `,
})
export class EnquiryComponent implements OnInit, OnDestroy {
  readonly qLocation = input<string>(undefined, { alias: 'location' });
  readonly qType = input<string>(undefined, { alias: 'type' });
  private readonly route = inject(ActivatedRoute);
  protected readonly locations = inject(LocationService);
  protected readonly auth = inject(AuthService);
  private readonly capture = inject(LeadCaptureService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly mode = signal<Mode>((this.route.snapshot.data['mode'] as Mode) ?? 'BOOK_NOW');
  protected readonly copy = computed(() => COPY[this.mode()]);
  protected readonly steps = ['Your details', 'Verify mobile', 'Confirmation'];
  protected readonly labels = SPACE_TYPE_LABELS;
  protected readonly types = Object.keys(SPACE_TYPE_LABELS) as SpaceType[];
  protected readonly today = todayIso();
  protected readonly maxDate = addDaysIso(todayIso(), 90);
  protected readonly demoOtp = this.auth.devOtp;
  protected readonly step = signal(0);
  protected readonly busy = signal(false);
  protected readonly otpError = signal('');
  protected readonly resendIn = signal(0);
  protected readonly lead = signal<Lead | null>(null);
  private timer?: ReturnType<typeof setInterval>;
  protected readonly otp = new FormControl('', { nonNullable: true });

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    mobile: ['', [Validators.required, mobileValidator]],
    email: [''],
    locationId: ['', Validators.required],
    type: ['HOT_DESK' as SpaceType],
    date: [addDaysIso(todayIso(), 1), [Validators.required, futureDateValidator]],
    time: ['11:00', [Validators.required, Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)]],
    seats: [1, [Validators.required, Validators.min(1), Validators.max(50)]],
    visitors: [1, [Validators.required, Validators.min(1), Validators.max(10)]],
    requirement: [''],
  });

  protected readonly tourSlots = computed(() => ['10:00', '10:30', '11:00', '11:30', '12:00', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'].map((t) => ({ time: t, available: true })));

  ngOnInit(): void {
    const m = this.mode();
    if (m === 'TOUR') this.form.controls.email.setValidators([Validators.required, emailValidator]);
    if (m === 'CALLBACK') {
      this.form.controls.requirement.setValidators([Validators.required, Validators.minLength(5)]);
      this.form.controls.date.clearValidators();
    }
    this.form.updateValueAndValidity();
    this.form.patchValue({ locationId: this.qLocation() ?? this.locations.active()[0]?.id ?? '', type: (this.qType() as SpaceType) || 'HOT_DESK', time: m === 'TOUR' ? '' : '11:00' });
    Object.values(this.form.controls).forEach((c) => c.updateValueAndValidity());
  }

  protected sendOtp(): void {
    if (this.form.invalid) return this.form.markAllAsTouched();
    if (this.busy()) return; // ignore repeat clicks while running
    this.busy.set(true);
    this.auth.sendOtp(this.form.controls.mobile.value, 'ENQUIRY').subscribe(({ sentTo }) => {
      this.busy.set(false);
      this.auth.otpDestination.set(sentTo);
      this.otp.setValue('');
      this.otpError.set('');
      this.step.set(1);
      this.toast.info('Verification code sent', `Check SMS on ${sentTo}.`);
      clearInterval(this.timer);
      this.resendIn.set(30);
      this.timer = setInterval(() => this.resendIn.update((s) => Math.max(0, s - 1)), 1000);
    });
  }

  protected verify(): void {
    if (this.otp.value.length !== 6 || this.busy()) return;
    if (this.busy()) return; // ignore repeat clicks while running
    this.busy.set(true);
    this.auth.verifyOtp(this.otp.value).subscribe({
      next: () => {
        const v = this.form.getRawValue();
        const m = this.mode();
        const source: LeadSource = m === 'BOOK_NOW' ? 'BOOK_NOW' : m === 'CALLBACK' ? 'CALLBACK' : 'TOUR';
        const requirement = m === 'CALLBACK' ? v.requirement : m === 'TOUR' ? `Tour for ${v.visitors} visitor(s)` : `${SPACE_TYPE_LABELS[v.type]} for ${v.seats} seat(s)`;
        this.capture.submitEnquiry(source, {
          name: v.name.trim(),
          mobile: v.mobile,
          email: v.email || undefined,
          locationId: v.locationId,
          requirement,
          spaceType: m === 'BOOK_NOW' ? SPACE_TYPE_LABELS[v.type] : undefined,
          seats: m === 'BOOK_NOW' ? v.seats : undefined,
          preferredDate: m === 'CALLBACK' ? undefined : v.date,
          preferredTime: v.time,
          visitors: m === 'TOUR' ? v.visitors : undefined,
        }).subscribe({
          next: (l) => {
            this.lead.set(l);
            this.busy.set(false);
            this.step.set(2);
          },
          error: (e: AuthError) => {
            this.busy.set(false);
            this.otpError.set(e.message);
          },
        });
      },
      error: (e: AuthError) => {
        this.busy.set(false);
        this.otpError.set(e.message);
        this.otp.setValue('');
      },
    });
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }
}
