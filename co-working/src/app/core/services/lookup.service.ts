import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';

export interface StateOption {
  code: string;
  name: string;
}

/** Dropdown reference data from the API (POST /api/Lookup/*). */
@Injectable({ providedIn: 'root' })
export class LookupService {
  private readonly api = inject(ApiService);
  readonly states = signal<StateOption[]>([]);
  readonly stateNames = computed(() => this.states().map((s) => s.name));

  async load(): Promise<void> {
    if (this.states().length) return;
    try {
      this.states.set(await firstValueFrom(this.api.post<StateOption[]>('Lookup/GetStates', {}, { spinner: 'none' })));
    } catch {
      /* dropdown stays empty until the next load */
    }
  }
}
