import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FieldErrorComponent } from '../forms/form-controls.component';
import { IconComponent } from '../icon/icon.component';
import { BusyButtonDirective } from '../spinner/busy-button.directive';
import { matchValidator, passwordValidator } from '../../utils/validators';
import { AuthError, AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/ui.service';

/** Change-password form used by member and staff profiles. */
@Component({
  selector: 'app-change-password',
  imports: [ReactiveFormsModule, FieldErrorComponent, IconComponent, BusyButtonDirective],
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="stack" style="max-width: 460px">
      @if (error()) {
        <div class="alert alert-danger" role="alert"><app-icon name="alert" /><div class="alert-body">{{ error() }}</div></div>
      }
      <div class="field">
        <label class="label" for="cp-cur">Current password <span class="req">*</span></label>
        <input id="cp-cur" class="input" type="password" formControlName="current" autocomplete="current-password" />
        <app-field-error [control]="form.controls.current" label="Current password" />
      </div>
      <div class="field">
        <label class="label" for="cp-new">New password <span class="req">*</span></label>
        <input id="cp-new" class="input" type="password" formControlName="password" autocomplete="new-password" />
        <app-field-error [control]="form.controls.password" label="New password" />
      </div>
      <div class="field">
        <label class="label" for="cp-conf">Confirm new password <span class="req">*</span></label>
        <input id="cp-conf" class="input" type="password" formControlName="confirmPassword" autocomplete="new-password" />
        <app-field-error [control]="form.controls.confirmPassword" label="Confirm password" [groupErrors]="form.errors?.['mismatch'] ? { mismatch: true } : null" />
      </div>
      <div>
        <button type="submit" class="btn btn-primary" [disabled]="form.invalid || busy()" [appBusy]="busy()" busyText="Updating…">
            Update password
          </button>
      </div>
    </form>
  `,
})
export class ChangePasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly form = this.fb.nonNullable.group(
    { current: ['', Validators.required], password: ['', [Validators.required, passwordValidator]], confirmPassword: ['', Validators.required] },
    { validators: matchValidator('password', 'confirmPassword') },
  );

  protected submit(): void {
    if (this.form.invalid) return this.form.markAllAsTouched();
    if (this.busy()) return; // ignore repeat clicks while running
    this.busy.set(true);
    this.error.set('');
    this.auth.changePassword(this.form.controls.current.value, this.form.controls.password.value).subscribe({
      next: () => {
        this.busy.set(false);
        this.form.reset();
        this.toast.success('Password updated', 'Use your new password next time you sign in.');
      },
      error: (e: AuthError) => {
        this.busy.set(false);
        this.error.set(e.message);
      },
    });
  }
}
