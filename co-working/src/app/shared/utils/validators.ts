import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

/** Indian 10-digit mobile starting 6-9. */
export const mobileValidator: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
  const v = (c.value ?? '').toString().replace(/\s|-/g, '').replace(/^\+?91/, '');
  if (!v) return null;
  return /^[6-9]\d{9}$/.test(v) ? null : { mobile: true };
};

/** Strict-ish email (Angular's built-in accepts "a@b"). */
export const emailValidator: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
  const v = (c.value ?? '').toString().trim();
  if (!v) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? null : { email: true };
};

/** 8+ chars with upper, lower, number and symbol. */
export const passwordValidator: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
  const v = (c.value ?? '').toString();
  if (!v) return null;
  const ok = v.length >= 8 && /[A-Z]/.test(v) && /[a-z]/.test(v) && /\d/.test(v) && /[^A-Za-z0-9]/.test(v);
  return ok ? null : { password: true };
};

export function matchValidator(field: string, confirmField: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const a = group.get(field)?.value;
    const b = group.get(confirmField)?.value;
    if (!b) return null;
    return a === b ? null : { mismatch: true };
  };
}

/** GSTIN: 2-digit state code + PAN + entity + Z + checksum char. */
export const gstinValidator: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
  const v = (c.value ?? '').toString().trim().toUpperCase();
  if (!v) return null;
  return /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v) ? null : { gstin: true };
};

export const pincodeValidator: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
  const v = (c.value ?? '').toString().trim();
  if (!v) return null;
  return /^[1-9]\d{5}$/.test(v) ? null : { pincode: true };
};

/** Date must be today or later. */
export const futureDateValidator: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
  const v = c.value as string;
  if (!v) return null;
  const today = new Date().toLocaleDateString('en-CA');
  return v >= today ? null : { pastDate: true };
};

export const timeValidator: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
  const v = (c.value ?? '').toString();
  if (!v) return null;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? null : { time: true };
};

export function timeRangeValidator(start: string, end: string): ValidatorFn {
  return (g: AbstractControl): ValidationErrors | null => {
    const s = g.get(start)?.value;
    const e = g.get(end)?.value;
    if (!s || !e) return null;
    return e > s ? null : { timeRange: true };
  };
}

export const positiveNumber: ValidatorFn[] = [Validators.min(0), Validators.pattern(/^\d+(\.\d{1,2})?$/)];

/** Human-readable messages for validation errors, shared by <app-field-error>. */
export function errorMessage(errors: ValidationErrors | null | undefined, label = 'This field'): string {
  if (!errors) return '';
  if (errors['required']) return `${label} is required.`;
  if (errors['email']) return 'Enter a valid email address.';
  if (errors['mobile']) return 'Enter a valid 10-digit mobile number.';
  if (errors['password']) return 'Use 8+ characters with upper and lower case letters, a number and a symbol.';
  if (errors['mismatch']) return 'Passwords do not match.';
  if (errors['minlength']) return `${label} must be at least ${errors['minlength'].requiredLength} characters.`;
  if (errors['maxlength']) return `${label} must be at most ${errors['maxlength'].requiredLength} characters.`;
  if (errors['min']) return `${label} must be at least ${errors['min'].min}.`;
  if (errors['max']) return `${label} must be at most ${errors['max'].max}.`;
  if (errors['pattern']) return `Enter a valid ${label.toLowerCase()}.`;
  if (errors['gstin']) return 'Enter a valid 15-character GSTIN (e.g. 36AABCN1234A1Z5).';
  if (errors['pincode']) return 'Enter a valid 6-digit pincode.';
  if (errors['pastDate']) return 'Choose today or a future date.';
  if (errors['time']) return 'Enter a valid time.';
  if (errors['timeRange']) return 'End time must be after start time.';
  if (errors['requiredTrue']) return 'You must accept to continue.';
  if (errors['server']) return errors['server'];
  return `${label} is invalid.`;
}
