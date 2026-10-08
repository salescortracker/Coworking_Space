import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface ApiErrorNotice {
  title: string;
  message: string;
}

/**
 * Background save failures (records saved after the screen already updated) are published here and shown as
 * toasts by the app shell. Kept dependency-free so the data layer does not import UI services.
 */
@Injectable({ providedIn: 'root' })
export class ApiErrorBus {
  readonly errors$ = new Subject<ApiErrorNotice>();

  publish(title: string, message: string): void {
    this.errors$.next({ title, message });
  }
}
