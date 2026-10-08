import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { SHARED, mobileValidator } from '../../../shared';
import { ChangePasswordComponent } from '../../../shared/components/domain/change-password.component';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/data/people-data.service';
import { LocationService } from '../../../core/services/data/workspace-data.service';
import { ToastService } from '../../../core/services/ui.service';
import { ROLE_LABELS } from '../../../core/models';

@Component({
  selector: 'app-staff-profile',
  imports: [...SHARED, ChangePasswordComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page-narrow">
      <app-page-header title="My Profile" subtitle="Your staff account details and security." [breadcrumbs]="[{ label: 'My Profile' }]" />
      <app-tabs [tabs]="tabs" [(value)]="active" label="Profile sections" />
      <div class="mt-5">
        @if (active() === 'profile') {
          <section class="card card-body">
            <div class="row mb-5">
              <app-avatar [name]="auth.user()?.name ?? ''" [size]="64" />
              <div>
                <div class="text-lg fw-600">{{ auth.user()?.name }}</div>
                <div class="text-muted">{{ roleLabel() }} · {{ locationsLabel() }}</div>
              </div>
            </div>
            <form [formGroup]="form" (ngSubmit)="save()" class="form-grid" novalidate>
              <div class="field">
                <label class="label" for="sp-n">Full name <span class="req">*</span></label>
                <input id="sp-n" class="input" formControlName="name" />
                <app-field-error [control]="form.controls.name" label="Full name" />
              </div>
              <div class="field">
                <label class="label" for="sp-e">Email</label>
                <input id="sp-e" class="input" [value]="auth.user()?.email" readonly />
              </div>
              <div class="field">
                <label class="label" for="sp-m">Mobile <span class="req">*</span></label>
                <input id="sp-m" class="input" formControlName="mobile" maxlength="10" />
                <app-field-error [control]="form.controls.mobile" label="Mobile" />
              </div>
              <div class="field">
                <label class="label">Role</label>
                <input class="input" [value]="roleLabel()" readonly />
              </div>
              <div class="span-all form-actions">
                <button type="submit" class="btn btn-primary" [disabled]="form.invalid || form.pristine">Save</button>
              </div>
            </form>
          </section>
        } @else {
          <section class="card card-body">
            <h2 class="form-section-title mb-4">Change password</h2>
            <app-change-password />
          </section>
        }
      </div>
    </div>
  `,
})
export class StaffProfileComponent implements OnInit {
  readonly tab = input<string>();
  protected readonly auth = inject(AuthService);
  private readonly users = inject(UserService);
  private readonly locations = inject(LocationService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  protected readonly active = signal('profile');
  protected readonly tabs = [
    { id: 'profile', label: 'Profile', icon: 'user' },
    { id: 'security', label: 'Security', icon: 'lock' },
  ];
  protected readonly roleLabel = computed(() => (this.auth.role() ? ROLE_LABELS[this.auth.role()!] : ''));
  protected readonly locationsLabel = computed(() => {
    const ids = this.auth.user()?.locationIds ?? [];
    return ids.length ? ids.map((i) => this.locations.shortName(i)).join(', ') : 'All locations';
  });
  protected readonly form = this.fb.nonNullable.group({
    name: [this.auth.user()?.name ?? '', Validators.required],
    mobile: [this.auth.user()?.mobile ?? '', [Validators.required, mobileValidator]],
  });

  ngOnInit(): void {
    if (this.tab() === 'security') this.active.set('security');
  }

  protected save(): void {
    const u = this.auth.user();
    if (!u || this.form.invalid) return;
    this.users.updateSync(u.id, this.form.getRawValue());
    this.form.markAsPristine();
    this.toast.success('Profile updated');
  }
}
