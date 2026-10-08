import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

export const APP_NAME = 'Officera';
export const APP_TAGLINE = 'Smart Workspaces. Simple Management.';

/** Ensures every browser tab shows Officera branding, even for routes without a title. */
@Injectable({ providedIn: 'root' })
export class OfficeraTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const t = this.buildTitle(snapshot);
    if (!t) this.title.setTitle(`${APP_NAME} – ${APP_TAGLINE}`);
    else this.title.setTitle(t.includes(APP_NAME) ? t : `${t} · ${APP_NAME}`);
  }
}
