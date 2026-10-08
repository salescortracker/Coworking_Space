import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { TitleStrategy, provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { OfficeraTitleStrategy } from './core/config/title.strategy';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { spinnerInterceptor } from './core/interceptors/spinner.interceptor';
import { authInterceptor } from './core/interceptors/auth.interceptor';

import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { LOCATION_MATCHER } from './core/services/location-matcher.token';
import { LocationContextService } from './core/services/location-context.service';
import { AuthService } from './core/services/auth.service';
import { LookupService } from './core/services/lookup.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
    ),
    provideClientHydration(),
    // Officera API (environment.apiUrl): JWT on every API call, global spinner for every request.
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, spinnerInterceptor])),
    // Restore the session and load the data the first screen needs before routing starts.
    provideAppInitializer(() => Promise.all([inject(AuthService).restore(), inject(LookupService).load()]).then(() => undefined)),
    { provide: LOCATION_MATCHER, useFactory: () => inject(LocationContextService).matcher },
    { provide: TitleStrategy, useClass: OfficeraTitleStrategy },
  ],
};
