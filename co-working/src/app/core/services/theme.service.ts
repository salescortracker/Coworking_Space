import { DOCUMENT, Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type Theme = 'light' | 'dark';

/** localStorage key; also read by the inline script in index.html so the saved theme is applied before first paint. */
export const THEME_STORAGE_KEY = 'officera-theme';
/** Browser UI colour (mobile address bar) per theme. */
const THEME_COLOR: Record<Theme, string> = { light: '#3140b0', dark: '#0e121c' };
/** Matches the colour transition in tokens.css (html.theme-switching). */
const SWITCH_MS = 260;

/**
 * Application-wide light/dark theme.
 * The theme is a class on <html> (`light-theme` / `dark-theme`); every colour in the app comes from the
 * design tokens in styles/tokens.css, so all modules follow it with no per-component styles.
 * The choice is a device preference: it survives refresh, navigation, logout/login and browser restarts.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly doc = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly current = signal<Theme>(this.readSaved());
  private switchTimer?: ReturnType<typeof setTimeout>;

  readonly theme = this.current.asReadonly();
  readonly isDark = computed(() => this.current() === 'dark');

  constructor() {
    this.apply(this.current(), false);
  }

  getCurrentTheme(): Theme {
    return this.current();
  }

  setLightTheme(): void {
    this.set('light');
  }

  setDarkTheme(): void {
    this.set('dark');
  }

  toggleTheme(): void {
    this.set(this.isDark() ? 'light' : 'dark');
  }

  private set(theme: Theme): void {
    if (theme === this.current()) return;
    this.current.set(theme);
    this.save(theme);
    this.apply(theme, true);
  }

  private apply(theme: Theme, animate: boolean): void {
    const html = this.doc.documentElement;
    if (animate && this.isBrowser) {
      // Animate colours only for a user-initiated switch, never on first paint.
      html.classList.add('theme-switching');
      clearTimeout(this.switchTimer);
      this.switchTimer = setTimeout(() => html.classList.remove('theme-switching'), SWITCH_MS);
    }
    html.classList.toggle('dark-theme', theme === 'dark');
    html.classList.toggle('light-theme', theme === 'light');
    html.setAttribute('data-theme', theme);
    this.doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
  }

  private readSaved(): Theme {
    if (!this.isBrowser) return 'light';
    try {
      return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light'; // storage blocked (private mode etc.) → default theme
    }
  }

  private save(theme: Theme): void {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* preference just won't persist */
    }
  }
}
