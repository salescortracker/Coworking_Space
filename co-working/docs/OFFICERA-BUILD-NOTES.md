# Officera – UI / Mockup Build Notes

Angular 22 (standalone components, signals, zoneless). No new npm dependencies were added.

## Run it

```bash
npm start
```

Open http://localhost:4200. Sign in from the **Demo accounts** panel on `/login` (credentials live only in `core/mock-data/users.ts` and are read by the mock `AuthService`):

| Role | Email | Password | Lands on |
|---|---|---|---|
| Super Admin | admin@officera.in | Admin@123 | /admin/dashboard |
| Location Manager (Hyderabad only) | manager.hyd@officera.in | Manager@123 | /admin/dashboard |
| Front Desk | frontdesk@officera.in | Desk@123 | /admin/dashboard (front desk view) |
| Finance | finance@officera.in | Finance@123 | /admin/dashboard (finance view) |
| Member (Aarav Mehta) | member@officera.in | Member@123 | /member/dashboard |

Every OTP in the mock is **123456**. Demo controls (latency, simulate API errors, reset data) are in **Administration → Settings → Demo controls**.

## What changed in the existing project

- Replaced the Angular placeholder in `app.html` / `app.ts`; updated `app.spec.ts` (old test expected the placeholder heading).
- `app.config.ts`: router input binding + scroll restoration, `provideHttpClient(withFetch())`, location-matcher provider.
- `app.routes.server.ts`: `RenderMode.Prerender` → `RenderMode.Client` (mock session/data live in the browser; parameterised routes cannot prerender without params).
- `index.html`: title, meta, Inter font. `styles.css` now imports `src/styles/*.css`.
- `angular.json`, `package.json`, `server.ts`, `tsconfig*` untouched. Original files backed up in `Desktop\Cospace\co-working-original-backup`.

## Architecture

```
src/app/
  core/
    models/          interfaces only (no data)
    mock-data/       seed generators (centralised mock data)
    services/
      data/          one service per entity, all extending MockCollection
                     (list / listScoped / get / create / update / remove → Observables)
      *.service.ts   business flows: auth, booking engine (availability, 10-min lock),
                     checkout (payments + GST invoices), member account (subscribe/upgrade/
                     pause/cancel/retries/access), operations (visitors, QR scan, tickets,
                     24h escalation), lead capture, notifications, reports, global search,
                     location context (multi-location)
    guards/          authGuard, memberGuard, staffGuard, roleGuard (permission matrix), guestGuard
  shared/            reusable UI (data table, pagination, modal, drawer, toast, confirm,
                     stat/chart cards, charts, QR, floor map, calendar, timeline, plan/
                     booking/workspace cards, invoice, OTP input, file upload, date/time pickers)
  layouts/           public, auth, member, admin shells
  features/          public/*, auth/*, member/*, admin/* — every module lazy-loaded
```

**Swapping to the ASP.NET Core API:** re-implement the `MockCollection` methods (or each data service) with `HttpClient`; method signatures stay the same so components do not change. `MockDbService` can then be deleted.

**Multi-location:** `LocationContextService` holds the selection (All / city / centre) and every data service exposes `scoped()`, so no component filters by location itself. Location managers only see their assigned centres.

## Branding

`src/index.html` now loads the Officera mark as `favicon.svg` (modern browsers), `favicon.ico` (16/32/48 px fallback), `apple-touch-icon.png`, and `site.webmanifest` (192/512 px icons, theme colour `#3140b0`), plus Open Graph tags. The icons are generated from the same geometry as the in-app logo. `OfficeraTitleStrategy` appends "· Officera" to every page title.

## Configuration / Integrations (Super Admin)

Route `/admin/integrations` (lazy-loaded, `roles: SUPER_ADMIN` + `integrations.*` permissions). Each service category lists its providers. For each provider the Super Admin can add or edit it, enable or disable it, set it as the active provider (one per category), test the connection, and view status and test history.

| Category | Providers | Drives in Officera |
|---|---|---|
| Email / SMTP | Custom SMTP, Amazon SES, SendGrid | Notification delivery logs |
| SMS | MSG91, Twilio, Gupshup | OTP, reminders, alerts |
| WhatsApp | Meta Cloud API, Gupshup, Twilio | Passes, confirmations |
| Push | Firebase FCM, OneSignal | Notification delivery logs |
| Payment gateway | Razorpay, Cashfree, PayU, Stripe | Checkout shows "Secured by …" |
| Google Calendar / Outlook Calendar | Google Calendar API, Microsoft Graph | Booking "Add to Calendar" menu |
| Access control / Doors | Matrix COSEC, HID, ZKTeco, generic API | QR scan adds a "door controller online" check |
| Cloud storage | Amazon S3, Azure Blob, Google Cloud Storage | Every file upload shows where files are stored |
| Google Sign-In / OAuth | Google, Microsoft | "Continue with Google" appears only when Google Sign-In is active |
| Accounting | Tally Prime, Zoho Books, QuickBooks | Accounting Export "Sync now" |
| Maps, GST e-invoicing, webhooks (Slack/Teams/custom) | see catalogue | Identified as needed for maps, IRN/GSTIN and alerts |

**Secrets:** fields of type `secret` are sent once to `IntegrationService.storeSecret()`. In production this posts to the API vault. The browser keeps only `{ isSet, hint: '••••1234', vaultRef }`, never the value. I verified this in the browser: after saving a provider, the secret text does not appear anywhere in localStorage. The provider catalogue (`core/mock-data/integrations.ts`) contains field schemas only, no credentials. Connection tests are mocked. The real call belongs server-side (`POST /api/integrations/{id}/test`).

## Global loading spinner

Before this change there was no global spinner, only the inline `.spinner` CSS class, the skeleton `app-loading-state`, and page-level loading flags. Those stay as the local loaders. The global layer adds:

| Piece | File | What it does |
|---|---|---|
| `SpinnerService` | `core/services/spinner.service.ts` | `show()` returns a ticket, `hide(ticket)` releases it (safe to call twice), and `isLoading` / `isBlocking` are signals. Uses reference counting, so concurrent work keeps it up until the last job finishes. Helpers: `track(obs$)`, `run(async)`, `after(ms, fn)`; all release on success, error or unsubscribe. Has a 150 ms show delay (tiny ops never flash), a 300 ms minimum visible time (no flicker) and a 30 s watchdog. |
| `spinnerInterceptor` | `core/interceptors/spinner.interceptor.ts` | Registered in `app.config.ts`. GET/HEAD use the thin top bar; POST/PUT/PATCH/DELETE use the blocking overlay. Opt out per request with `SKIP_SPINNER`; set mode or text with `SPINNER_MODE` / `SPINNER_MESSAGE` (HttpContext). |
| `<app-global-spinner>` | `shared/components/spinner/global-spinner.component.ts` | Rendered once in `app.html`. Shows the top progress bar for route loads and reads, and a centred, semi-transparent, blurred overlay with a message for blocking work. Fades in and out, blocks clicks, responsive, honours reduced motion, sets `aria-busy`. |
| `appBusy` directive | `shared/components/spinner/busy-button.directive.ts` | `<button [appBusy]="saving()" busyText="Saving…">` swaps the label for a spinner plus text and swallows clicks while busy. Components also return early if already busy, so synchronous double clicks can't submit twice. |

Wired in: the mock API layer (`MockDbService`: reads use the bar; create/update/delete show "Saving…", "Saving changes…" or "Deleting…"), route navigation, sign in / OTP / Google / register / password ("Signing in…", "Verifying code…"…), sign out ("Signing out…"), payment ("Processing payment…"), integration tests ("Testing Razorpay…"), visitor pass, payment status and accounting sync. When the ASP.NET Core APIs replace the mock layer, `HttpClient` calls get the same behaviour through the interceptor with no component changes.

Verified in the browser: tiny ops show nothing, and the overlay appears after 150 ms. It clears on success and on simulated API errors. Concurrent reads and writes keep a single overlay. Rapid navigation never leaves it stuck. Triple-clicking Pay creates exactly one payment. Logout shows "Signing out…" and lands on `/login`. It works for Super Admin, Location Manager, Front Desk, Finance and member. The 375 px layout has no overflow, and there are no console errors.

## Light / Dark theme

The project had no theme system, but almost every colour already came from `src/styles/tokens.css`. So dark mode is a set of token overrides, with no per-component styles.

| Piece | File | What it does |
|---|---|---|
| `ThemeService` | `core/services/theme.service.ts` | `setLightTheme()`, `setDarkTheme()`, `toggleTheme()`, `getCurrentTheme()`, plus `theme` / `isDark` signals. Puts `light-theme` / `dark-theme` and `data-theme` on `<html>`, updates the mobile browser colour, and saves `officera-theme = light|dark` in localStorage. |
| No-flash startup | `src/index.html` (inline script in `<head>`) | Reads `officera-theme` and sets the class before the first paint. Defaults to light. |
| Tokens | `src/styles/tokens.css` | `:root` keeps the original Officera values (light). `html.dark-theme` overrides background, surface/card, text, secondary text, borders, primary, semantic colours, input, table head, hover, sidebar, header, modal, shadows, spinner backdrop, floor-map and chart colours. It is screen-only, so printed invoices and reports stay on white paper. |
| `<app-theme-toggle>` | `layouts/shell/shell-parts.component.ts` | One shared component in the existing admin and member topbars, the public site header and the sign-in header. Shows ☀ Light or 🌙 Dark (icon plus text, icon only below 1024 px). It is a keyboard-accessible `role="switch"` with `aria-checked`, an accessible label and a tooltip ("Switch to Dark Mode" / "Switch to Light Mode"). |

Hardcoded colours in the global CSS were replaced with tokens that keep their light values: alerts, skeleton, switch, select arrow, floor map, availability grid, map placeholder, invoice, rating, spinner backdrop and logo. White text on brand fills uses `--primary-solid` so it stays readable in dark mode, while links and accents use a lighter `--primary`. A colour transition (220 ms) runs only while switching themes, never on load. Workspace illustrations are dimmed slightly in dark mode. QR codes stay black-on-white so they still scan. "Reset data" keeps the theme, because its key is outside the `officera:` data prefix.

Verified: an automated scan of 56 routes (25 admin, 15 member, 16 public/auth) in dark mode found no light backgrounds and no dark-on-dark text. Dropdowns, notifications, help modal, integration drawer, confirm dialog, toast and spinner overlay are themed. The theme persists through refresh, navigation and logout/login. Light-mode colours are identical to before. There is no overflow at 320 px, 375 px or 768 px, and there are no console errors.

## Workspace photos

Every image in the app went through one component, `<app-workspace-image [seed]>`, which used to draw a generated SVG illustration. It now shows a real photograph. The mock data is unchanged: locations, resources, events, blog posts and gallery items still carry a numeric photo seed. The new catalogue `core/config/workspace-photos.ts` maps each seed to a photo and its alt text:

| Seeds | Used for |
|---|---|
| 5 / 3 / 2 | Homepage hero, sign-in panel, About page |
| X1–X5 (X = location 1–5) | Open floor and hot desks (also the location card cover), dedicated desks, private office, meeting room, lounge or café |
| 61–67 | Events: networking breakfast, workshop, board games, demo day, yoga, tech talk, design roundtable |
| 71–75 | Blog: desk types, hybrid teams, GST invoices, podcast studio, offsite |
| 80–91 | Gallery: open workspace, boardroom, community event, pantry, focus zone, huddle room, founders meetup, phone booths, private cabin, terrace, demo day, reception |

- **Photos:** 51 distinct free-licence photographs from the Unsplash CDN. I picked each one by eye and excluded illustrations, AI renders, home-office setups and branded offices. No two images repeat on the same page.
- **Performance:** the CDN serves WebP/AVIF at 400, 800, 1200 or 1600 px through `srcset`/`sizes`, so small thumbnails download the 400 px file. Images are `loading="lazy"` with `decoding="async"`, except the homepage hero and the first location photo, which load eagerly with high priority.
- **Layout:** the image fills the same box as before (`object-fit: cover`), so card heights, the gallery grid and aspect ratios are unchanged.
- **Alt text:** every image has descriptive alt text. Location galleries prefix the centre name, e.g. "Officera HITEC City – Meeting room with a long table and city views".
- **No broken images:** if a photo ever fails to load, the component falls back to the previous illustration with the same alt text.
- **Production:** swap `photoUrl()` for the API/CDN URL stored on each record.

## Verification done

- `ng build` (production) passes. One budget **warning**: initial bundle 588 kB raw vs the 500 kB warning budget (error budget 1 MB). Mostly global CSS and the shared data layer.
- `ng test`: 12/12 passing (includes spinner reference counting, error/unsubscribe release, interceptor concurrency, and theme toggle/persistence/startup).
- Route crawl with zero console errors: 68 console routes, 23 member routes, 15 public routes.
- Role navigation: Location Manager sees only Hyderabad centres and no Administration/Content; Finance sees only Finance, Reports, Notifications and is redirected from Administration; Front Desk sees Front Desk, Bookings, Members, Access, Support.
- No horizontal overflow at 375 px and 320 px on all key pages; sidebar becomes a drawer below 1024 px; member portal gets bottom navigation on mobile; tables collapse to cards.
- End-to-end in the browser: booking wizard → slot lock → checkout → GST invoice; front-desk check-in (scan → verify → photo → notify host → check-in); public Book Now → OTP → lead → admin conversion → member + subscription.

## Flow-by-flow check against your 17 diagrams

| # | Flow | Status | Where |
|---|---|---|---|
| 1 | Overall system | ✅ | All three experiences connected |
| 2 | Public website | ✅ | `/`, `/search` (filters, sort, list/map), `/locations/:id`, Book Now / Callback / Tour → OTP → lead |
| 3 | Lead management | ✅ with note | New → (assigned via owner) → Contacted → Tour Scheduled → Tour Done → Converted / Lost; Convert opens Create Member → Membership → Subscription → Member login (temp password shown) |
| 4 | Registration & login | ✅ | Register → OTP (retry on wrong code) → account → complete profile (photo, company, GST) → dashboard; password / OTP / Google mock; 5 failures → 15-min lock |
| 5 | Member dashboard structure | ✅ | Every sidebar item in your tree |
| 6 | Membership plan | ✅ | Admin create/publish plan → member views, subscribes, pays → subscription active → credits + QR activated |
| 7 | Main booking | ✅ | Location → type → date → time → availability (unavailable shown) → resource on floor map → 10-min lock → credits first → ₹0 or balance → confirm → notification + calendar (.ics) + booking QR; payment failure or lock expiry releases slot → retry |
| 8 | Payment & invoice | ✅ with note | Success → payment → GST invoice → PDF (print) → email → accounting export; failure → retry. Retries day 1/3/7 → grace → suspend → revoke are simulated with a "Record failed retry" button (no background scheduler in a mockup) |
| 9 | Access control | ✅ | Member QR; scan validates valid QR / active plan / plan hours → open or deny → logged; pause/expiry/overdue-beyond-grace revoke; payment restores |
| 10 | Visitor management | ✅ | Add visitor → QR pass → SMS/email log → front desk scan → photo → notify host → check-in → check-out → pass expired |
| 11 | Support tickets | ✅ with note | Create (category, description, photo) → Open → assign → In Progress → Resolved; 24h SLA indicator; auto-escalation runs when the ticket dashboard opens and via "Run 24h escalation check" (no background job) |
| 12 | Admin hierarchy | ✅ | All modules in the sidebar |
| 13 | Admin roles | ✅ with note | Four roles with editable permission matrix. Finance currently sees all 9 reports, not only financial ones |
| 14 | Dashboard / reporting | ✅ | 8 KPI cards, 6 charts, 4 tables, date + location filters; 9 reports each with date, location, search, cards, chart, table, CSV, PDF |
| 15 | Notifications | ✅ with note | Central `NotificationCenterService.dispatch` → in-app + email/SMS/push logs via templates. 1-hour booking and 7-day renewal reminders exist as templates and seeded notifications but are not fired by a timer |
| 16 | End-to-end business flow | ✅ | Verified public → lead → member → subscription → booking → payment → invoice → access |
| 17 | Module development order | ✅ | Built in your six-phase order |

## Gaps and deliberate mock behaviour

- Time-based jobs (booking reminders, renewal reminders, recurring retries, 24h escalation, applying scheduled downgrades at cycle end) are triggered by buttons/page loads, not schedulers; these belong to the backend.
- Payment gateway, OTP, Google sign-in, QR codes and PDF generation are visual mocks (PDF uses the browser's Save as PDF).
- The search "map view" is a styled placeholder, not a real map.
- Data persists in the browser's localStorage; use Settings → Demo controls → Reset data to start fresh (dates regenerate relative to today).
- Initial bundle is ~88 kB over the 500 kB warning budget (see above).
