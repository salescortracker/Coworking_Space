import { TestBed } from '@angular/core/testing';
import { THEME_STORAGE_KEY, ThemeService } from './theme.service';

describe('ThemeService', () => {
  const html = document.documentElement;

  beforeAll(() => {
    // The unit-test DOM has no Web Storage; use a small in-memory stand-in.
    if (!globalThis.localStorage) {
      const store = new Map<string, string>();
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: {
          getItem: (k: string) => store.get(k) ?? null,
          setItem: (k: string, v: string) => store.set(k, String(v)),
          removeItem: (k: string) => store.delete(k),
          clear: () => store.clear(),
        },
      });
    }
  });

  beforeEach(() => {
    localStorage.removeItem(THEME_STORAGE_KEY);
    html.classList.remove('dark-theme', 'light-theme');
    TestBed.resetTestingModule();
  });

  it('defaults to light when nothing is saved', () => {
    const theme = TestBed.inject(ThemeService);
    expect(theme.getCurrentTheme()).toBe('light');
    expect(html.classList.contains('light-theme')).toBe(true);
    expect(html.classList.contains('dark-theme')).toBe(false);
  });

  it('toggles, applies the class and persists the choice', () => {
    const theme = TestBed.inject(ThemeService);
    theme.toggleTheme();
    expect(theme.getCurrentTheme()).toBe('dark');
    expect(theme.isDark()).toBe(true);
    expect(html.classList.contains('dark-theme')).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    theme.setLightTheme();
    expect(html.classList.contains('dark-theme')).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('restores the saved theme on startup', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    const theme = TestBed.inject(ThemeService);
    expect(theme.getCurrentTheme()).toBe('dark');
    expect(html.getAttribute('data-theme')).toBe('dark');
  });
});
