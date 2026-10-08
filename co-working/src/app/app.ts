import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';
import { ApiErrorBus } from './core/services/api-error-bus';
import { ToastService } from './core/services/ui.service';
import { ConfirmHostComponent, ToastHostComponent } from './shared/components/overlay/overlay.component';
import { GlobalSpinnerComponent } from './shared/components/spinner/global-spinner.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastHostComponent, ConfirmHostComponent, GlobalSpinnerComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  constructor() {
    inject(ThemeService); // applies the saved light/dark theme at startup
    const toast = inject(ToastService);
    inject(ApiErrorBus).errors$.subscribe((e) => toast.error(e.title, e.message));
  }
}
