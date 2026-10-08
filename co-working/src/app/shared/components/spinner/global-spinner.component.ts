import { ChangeDetectionStrategy, Component, DestroyRef, PLATFORM_ID, effect, inject, linkedSignal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';
import { SpinnerService } from '../../../core/services/spinner.service';

/**
 * Single application-wide loading UI, rendered once in app.html:
 *  - top progress bar for background work (route/page loads, reads)
 *  - centred spinner on an overlay for blocking work (saves, payments, login…)
 * Route navigation is tracked here so every module (public, member, all admin roles) gets it.
 */
@Component({
  selector: 'app-global-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gs-bar" [class.visible]="spinner.barVisible()" aria-hidden="true"><span></span></div>
    <div
      class="gs-overlay"
      [class.visible]="spinner.overlayVisible()"
      role="status"
      aria-live="polite"
      [attr.aria-hidden]="!spinner.overlayVisible()"
    >
      <div class="gs-panel">
        <span class="gs-ring" aria-hidden="true"></span>
        <span class="gs-text">{{ label() }}</span>
      </div>
    </div>
  `,
})
export class GlobalSpinnerComponent {
  protected readonly spinner = inject(SpinnerService);
  /** Keeps the last message while the overlay fades out, so the text doesn't flip to the default mid-fade. */
  protected readonly label = linkedSignal<string, string>({
    source: () => (this.spinner.isBlocking() ? this.spinner.message() || 'Please wait…' : ''),
    computation: (next, prev) => next || prev?.value || 'Please wait…',
  });

  constructor() {
    const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
    let navTicket: number | null = null;
    const sub = inject(Router).events.subscribe((e) => {
      if (e instanceof NavigationStart) {
        if (navTicket === null) navTicket = this.spinner.show({ mode: 'background' });
      } else if (e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError) {
        // Always release on every terminal navigation event, so navigation can never leave it stuck.
        if (navTicket !== null) this.spinner.hide(navTicket);
        navTicket = null;
      }
    });
    inject(DestroyRef).onDestroy(() => sub.unsubscribe());

    // Mark the document busy for assistive tech while a blocking operation runs.
    effect(() => {
      const busy = this.spinner.overlayVisible();
      if (!isBrowser) return;
      if (busy) document.body.setAttribute('aria-busy', 'true');
      else document.body.removeAttribute('aria-busy');
    });
  }
}
