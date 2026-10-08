import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { SHARED, emailValidator, gstinValidator, mobileValidator } from '../../../shared';
import { ChangePasswordComponent } from '../../../shared/components/domain/change-password.component';
import { MemberAccountService } from '../../../core/services/member-account.service';
import { CompanyService, MemberService, UserService } from '../../../core/services/data/people-data.service';
import { LocationService } from '../../../core/services/data/workspace-data.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/ui.service';
import { LookupService } from '../../../core/services/lookup.service';


/** Member profile: personal info, company & billing, security. */
@Component({
  selector: 'app-member-profile',
  imports: [...SHARED, ChangePasswordComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page-narrow">
      <app-page-header title="My Profile" subtitle="Keep your details and billing information up to date." [breadcrumbs]="[{ label: 'Dashboard', link: '/member/dashboard' }, { label: 'My Profile' }]" />
      <app-tabs [tabs]="tabs" [(value)]="active" label="Profile sections" />
      <div class="mt-5">
        @switch (active()) {
          @case ('personal') {
            <section class="card">
              <div class="card-header">
                <h2 class="card-title">Personal information</h2>
                @if (!editing()) {
                  <button type="button" class="btn btn-secondary btn-sm" (click)="editing.set(true)"><app-icon name="edit" [size]="14" /> Edit</button>
                }
              </div>
              <form class="card-body" [formGroup]="personal" (ngSubmit)="savePersonal()" novalidate>
                <div class="row mb-5">
                  <app-avatar [name]="acct.member() ? acct.member()!.firstName + ' ' + acct.member()!.lastName : 'Member'" [size]="72" />
                  <div class="flex-1">
                    <div class="label mb-2">Profile photo</div>
                    @if (editing()) {
                      <app-file-upload accept="image/*" category="profiles" [multiple]="false" hint="Square JPG or PNG, up to 2 MB" (filesChange)="photo.set($event[0]?.url ?? null)" />
                    } @else {
                      <span class="text-sm text-muted">{{ acct.member()?.photo ?? 'Using your initials' }}</span>
                    }
                  </div>
                </div>
                <div class="form-grid">
                  <div class="field">
                    <label class="label" for="pf">First name <span class="req">*</span></label>
                    <input id="pf" class="input" formControlName="firstName" [readonly]="!editing()" />
                    <app-field-error [control]="personal.controls.firstName" label="First name" />
                  </div>
                  <div class="field">
                    <label class="label" for="pl">Last name <span class="req">*</span></label>
                    <input id="pl" class="input" formControlName="lastName" [readonly]="!editing()" />
                    <app-field-error [control]="personal.controls.lastName" label="Last name" />
                  </div>
                  <div class="field">
                    <label class="label" for="pe">Email <span class="req">*</span></label>
                    <input id="pe" class="input" type="email" formControlName="email" [readonly]="!editing()" />
                    <app-field-error [control]="personal.controls.email" label="Email" />
                  </div>
                  <div class="field">
                    <label class="label" for="pm">Mobile <span class="req">*</span></label>
                    <input id="pm" class="input" formControlName="mobile" maxlength="10" [readonly]="!editing()" />
                    <app-field-error [control]="personal.controls.mobile" label="Mobile" />
                  </div>
                  <div class="field">
                    <label class="label" for="pd">Designation</label>
                    <input id="pd" class="input" formControlName="designation" [readonly]="!editing()" />
                  </div>
                  <div class="field">
                    <label class="label" for="ploc">Home location</label>
                    <select id="ploc" class="select" formControlName="locationId">
                      @for (l of locations.active(); track l.id) {
                        <option [value]="l.id">{{ l.name }}</option>
                      }
                    </select>
                  </div>
                  <div class="field span-2">
                    <label class="label" for="pb">Short bio</label>
                    <textarea id="pb" class="textarea" rows="3" formControlName="bio" [readonly]="!editing()"></textarea>
                  </div>
                  <div class="field span-2">
                    <label class="switch">
                      <input type="checkbox" formControlName="directoryVisible" />
                      <span class="track"></span>
                      <span>Show my profile in the member directory</span>
                    </label>
                  </div>
                </div>
                @if (editing()) {
                  <div class="form-actions">
                    <button type="button" class="btn btn-secondary" (click)="cancel()">Cancel</button>
                    <button type="submit" class="btn btn-primary" [disabled]="personal.invalid">Save</button>
                  </div>
                }
              </form>
            </section>
          }
          @case ('company') {
            <section class="card">
              <div class="card-header"><h2 class="card-title">Company & billing</h2></div>
              <form class="card-body" [formGroup]="company" (ngSubmit)="saveCompany()" novalidate>
                <p class="text-sm text-muted">These details appear on your GST invoices. Add your GSTIN to claim input tax credit.</p>
                <div class="form-grid">
                  <div class="field span-2">
                    <label class="label" for="cn">Company name <span class="req">*</span></label>
                    <input id="cn" class="input" formControlName="name" />
                    <app-field-error [control]="company.controls.name" label="Company name" />
                  </div>
                  <div class="field">
                    <label class="label" for="cg">GST number</label>
                    <input id="cg" class="input" formControlName="gstin" style="text-transform: uppercase" />
                    <app-field-error [control]="company.controls.gstin" label="GST number" />
                  </div>
                  <div class="field">
                    <label class="label" for="cs">State <span class="req">*</span></label>
                    <select id="cs" class="select" formControlName="state">
                      @for (s of states; track s) {
                        <option [value]="s">{{ s }}</option>
                      }
                    </select>
                  </div>
                  <div class="field span-2">
                    <label class="label" for="ca">Billing address <span class="req">*</span></label>
                    <textarea id="ca" class="textarea" rows="2" formControlName="billingAddress"></textarea>
                    <app-field-error [control]="company.controls.billingAddress" label="Billing address" />
                  </div>
                </div>
                <div class="form-actions"><button type="submit" class="btn btn-primary" [disabled]="company.invalid || company.pristine">Save company details</button></div>
              </form>
            </section>
          }
          @case ('security') {
            <section class="card card-body">
              <h2 class="form-section-title mb-4">Change password</h2>
              <app-change-password />
            </section>
          }
        }
      </div>
    </div>
  `,
})
export class MemberProfileComponent implements OnInit {
  readonly tab = input<string>();
  protected readonly acct = inject(MemberAccountService);
  private readonly members = inject(MemberService);
  private readonly companies = inject(CompanyService);
  private readonly users = inject(UserService);
  protected readonly locations = inject(LocationService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  private readonly lookup = inject(LookupService);
  /** States from POST /api/Lookup/GetStates. */
  protected get states(): string[] {
    return this.lookup.stateNames();
  }
  protected readonly active = signal('personal');
  protected readonly editing = signal(false);
  protected readonly tabs = [
    { id: 'personal', label: 'Personal', icon: 'user' },
    { id: 'company', label: 'Company', icon: 'briefcase' },
    { id: 'security', label: 'Security', icon: 'lock' },
  ];

  protected readonly personal = this.fb.nonNullable.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    email: ['', [Validators.required, emailValidator]],
    mobile: ['', [Validators.required, mobileValidator]],
    designation: [''],
    locationId: [''],
    bio: ['', Validators.maxLength(280)],
    directoryVisible: [false],
  });
  protected readonly company = this.fb.nonNullable.group({
    name: ['', Validators.required],
    gstin: ['', gstinValidator],
    state: ['', Validators.required],
    billingAddress: ['', Validators.required],
  });

  constructor() {
    effect(() => {
      if (this.editing()) this.personal.enable();
      else this.personal.disable();
    });
    effect(() => {
      const m = this.acct.member();
      const c = this.acct.company();
      untracked(() => {
        if (m && !this.editing()) this.personal.patchValue(m);
        if (c && this.company.pristine) this.company.patchValue(c);
      });
    });
  }

  ngOnInit(): void {
    const t = this.tab();
    if (t === 'security' || t === 'company') this.active.set(t);
  }

  /** Profile photo uploaded in this edit (POST /api/File/Upload). */
  protected readonly photo = signal<string | null>(null);

  protected cancel(): void {
    this.editing.set(false);
    const m = this.acct.member();
    if (m) this.personal.patchValue(m);
  }

  protected savePersonal(): void {
    const m = this.acct.member();
    if (!m || this.personal.invalid) return this.personal.markAllAsTouched();
    const v = this.personal.getRawValue();
    const photo = this.photo();
    this.members.update(m.id, photo ? { ...v, photo } : v).subscribe(() => {
      this.photo.set(null);
      const u = this.auth.user();
      if (u) this.users.updateSync(u.id, { name: `${v.firstName} ${v.lastName}`, email: v.email, mobile: v.mobile });
      this.editing.set(false);
      this.toast.success('Profile saved');
    });
  }

  protected saveCompany(): void {
    const m = this.acct.member();
    if (!m || this.company.invalid) return this.company.markAllAsTouched();
    const v = { ...this.company.getRawValue(), gstin: this.company.controls.gstin.value.toUpperCase() };
    const c = this.acct.company();
    if (c) this.companies.updateSync(c.id, v);
    else {
      const created = this.companies.createSync({ ...v, industry: '', size: '1–10', website: '', locationId: m.locationId, primaryContactId: m.id });
      this.members.updateSync(m.id, { companyId: created.id });
    }
    this.company.markAsPristine();
    this.toast.success('Company details saved', 'Future invoices will use these details.');
  }
}

/** My Company: company overview and teammates at Officera. */
@Component({
  selector: 'app-member-company',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="My Company" subtitle="Your organisation’s details and teammates on Officera." [breadcrumbs]="[{ label: 'Dashboard', link: '/member/dashboard' }, { label: 'My Company' }]">
        <a class="btn btn-secondary" routerLink="/member/profile" [queryParams]="{ tab: 'company' }"><app-icon name="edit" [size]="16" /> Edit billing details</a>
      </app-page-header>
      @if (acct.company(); as c) {
        <div class="split">
          <section class="card">
            <div class="card-header">
              <div class="row-sm">
                <app-avatar [name]="c.name" [size]="40" />
                <div>
                  <h2 class="card-title">{{ c.name }}</h2>
                  <div class="card-subtitle">{{ c.industry || 'Industry not set' }} · {{ c.size }} employees</div>
                </div>
              </div>
            </div>
            <div class="card-body">
              <div class="kv-grid">
                <div class="kv-item"><div class="k">GSTIN</div><div class="v mono">{{ c.gstin || 'Not provided' }}</div></div>
                <div class="kv-item"><div class="k">State</div><div class="v">{{ c.state }}</div></div>
                <div class="kv-item"><div class="k">Home centre</div><div class="v">{{ locations.name(c.locationId) }}</div></div>
                <div class="kv-item"><div class="k">Website</div><div class="v">{{ c.website || '—' }}</div></div>
              </div>
              <div class="kv-item mt-4"><div class="k">Billing address</div><div class="v">{{ c.billingAddress }}</div></div>
            </div>
          </section>
          <section class="card">
            <div class="card-header"><h2 class="card-title">Teammates</h2><span class="badge badge-neutral no-dot">{{ teammates().length }}</span></div>
            <ul class="list-plain card-body" style="padding-top: 4px; padding-bottom: 4px">
              @for (m of teammates(); track m.id) {
                <li class="list-row">
                  <div class="row-sm min-0">
                    <app-avatar [name]="m.firstName + ' ' + m.lastName" [size]="32" />
                    <div class="min-0">
                      <div class="fw-500 truncate">{{ m.firstName }} {{ m.lastName }}</div>
                      <div class="text-xs text-muted truncate">{{ m.designation }}</div>
                    </div>
                  </div>
                  <app-status-badge [status]="m.status" />
                </li>
              }
            </ul>
          </section>
        </div>
      } @else {
        <div class="card">
          <app-empty-state icon="briefcase" title="No company linked" message="Add your company and GST details to get GST-compliant invoices in your company’s name.">
            <a class="btn btn-primary" routerLink="/member/profile" [queryParams]="{ tab: 'company' }">Add company details</a>
          </app-empty-state>
        </div>
      }
    </div>
  `,
})
export class MemberCompanyComponent {
  protected readonly acct = inject(MemberAccountService);
  private readonly members = inject(MemberService);
  protected readonly locations = inject(LocationService);
  protected readonly teammates = computed(() => {
    const c = this.acct.company();
    return c ? this.members.items().filter((m) => m.companyId === c.id) : [];
  });
}
