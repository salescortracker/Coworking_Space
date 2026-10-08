import { Injectable, inject, signal } from '@angular/core';
import { AuditLog } from '../models';
import { AuditLogService } from './data/operations-data.service';
import { AuthService } from './auth.service';
import { ROLE_LABELS } from '../models';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
}

/** App-wide toast notifications. Rendered once by <app-toast-host>. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private seq = 0;

  show(type: ToastType, title: string, message?: string, timeout = 4500): void {
    const id = ++this.seq;
    this.toasts.update((t) => [...t.slice(-3), { id, type, title, message }]);
    if (typeof window !== 'undefined') setTimeout(() => this.dismiss(id), timeout);
  }

  success(title: string, message?: string): void {
    this.show('success', title, message);
  }
  error(title: string, message?: string): void {
    this.show('error', title, message, 6500);
  }
  warning(title: string, message?: string): void {
    this.show('warning', title, message);
  }
  info(title: string, message?: string): void {
    this.show('info', title, message);
  }

  dismiss(id: number): void {
    this.toasts.update((t) => t.filter((x) => x.id !== id));
  }
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  tone?: 'danger' | 'primary' | 'warning';
  /** Ask for a reason / note before confirming. */
  input?: { label: string; placeholder?: string; required?: boolean };
}

export interface ConfirmRequest extends ConfirmOptions {
  resolve: (result: { confirmed: boolean; value: string }) => void;
}

/** Promise-based confirmation dialog. Rendered once by <app-confirm-host>. */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly current = signal<ConfirmRequest | null>(null);

  confirm(options: ConfirmOptions): Promise<boolean> {
    return this.open(options).then((r) => r.confirmed);
  }

  /** Confirmation that also collects text (e.g. cancellation reason). Resolves null when cancelled. */
  prompt(options: ConfirmOptions): Promise<string | null> {
    return this.open({ ...options, input: options.input ?? { label: 'Reason' } }).then((r) => (r.confirmed ? r.value : null));
  }

  private open(options: ConfirmOptions): Promise<{ confirmed: boolean; value: string }> {
    return new Promise((resolve) => {
      this.current.set({
        ...options,
        resolve: (result) => {
          this.current.set(null);
          resolve(result);
        },
      });
    });
  }
}

/** Records operator actions into the audit log. */
@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly logs = inject(AuditLogService);
  private readonly auth = inject(AuthService);

  record(action: AuditLog['action'], module: string, entity: string, entityId: string, description: string): void {
    const u = this.auth.user();
    this.logs.createSync({
      user: u?.name ?? 'System',
      role: u ? ROLE_LABELS[u.role] : 'System',
      action,
      module,
      entity,
      entityId,
      at: new Date().toISOString(),
      // IP address, device, user and role are recorded by the API from the request; these are placeholders.
      ip: '',
      device: typeof navigator !== 'undefined' ? this.device(navigator.userAgent) : 'Server',
      description,
    });
  }

  private device(ua: string): string {
    const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
    const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : 'Linux';
    return `${browser} / ${os}`;
  }
}
