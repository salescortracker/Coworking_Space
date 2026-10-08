import { Directive, input } from '@angular/core';

/**
 * Button loading state, reusable on any button or link:
 *
 *   <button class="btn btn-primary" [disabled]="form.invalid || saving()" [appBusy]="saving()" busyText="Saving…">Save</button>
 *
 * While busy it shows the shared spinner with the busy text (CSS in styles/components.css),
 * swallows further clicks so the action cannot be submitted twice, and exposes aria-busy.
 * The original label is restored automatically when the operation finishes.
 */
@Directive({
  selector: 'button[appBusy], a[appBusy]',
  host: {
    '[class.is-busy]': 'appBusy()',
    '[attr.data-busy-text]': 'busyText()',
    '[attr.aria-busy]': 'appBusy() ? "true" : null',
    '[attr.aria-disabled]': 'appBusy() ? "true" : null',
    '(click)': 'guard($event)',
  },
})
export class BusyButtonDirective {
  readonly appBusy = input(false);
  readonly busyText = input('Processing…');

  protected guard(e: Event): void {
    if (this.appBusy()) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }
}
