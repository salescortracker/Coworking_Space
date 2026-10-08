# Officera backend – implementation summary

## 1. Files created

**Database (`officera_API/Database`)**
- `01_Schema.sql`: 42 tables in 13 SQL schemas (auth, workspace, people, membership, booking, finance, operations, notify, crm, community, content, config, audit), with keys, foreign keys, unique and check constraints.
- `02_SeedData.sql`: reference data only (permissions, 5 roles and the role matrix, GST states, business rules, notification templates, homepage copy) plus the Super Admin.
- `README.md`: how to create the database and re-scaffold.

**DataAccessLayer**
- `Entities/*.cs`: 43 scaffolded entities.
- `Data/OfficeraContext.cs`: scaffolded, with all DbSets.
- `Data/OfficeraContext.Partial.cs`: makes EF always send column values that have SQL defaults (otherwise `AutoRenew = false` would be saved as `true`).

**Shared (`officera.Shared/Common`)**
- `ApiResponse` (now with `StatusCode` and helpers)
- `Pagination` (`PagedRequest`, `PagedResult`, `IdRequest`)
- `Constants` (roles, claims, statuses, OTP purposes, file categories, integration categories)
- `AppExceptions`, `JsonHelper` (UTC dates), `DateTimeHelper`, `ValidationHelper`, `FileHelper`, `IdHelper`, `ExpressionHelper`, `ClaimsHelper`
- `AuditHelper` (SaveChanges interceptor that fills `CreatedBy` / `CreatedDate` / `ModifiedBy` / `ModifiedDate` from the JWT)
- `AppOptions` (Jwt, Otp, FileStorage, loginURL and Cors options)

**BusinessAccessLayer**
- `DTOs/`: Common, Workspace, People, Membership, Finance, Operations, Engagement, Config, Auth and Dashboard DTOs.
- `Interfaces/`: `ICurrentUserService`, `ICrudService` and the 30 module interfaces, plus `IAuthService`, `IOtpService`, `IPasswordService`, `IJwtTokenService`, `ISettingsService`, `IHomepageContentService`, `ILookupService`, `IDashboardService`, `IIdSequenceService`, `IFileStorageService`, `INotificationService`, `IEmailService`, `ISmsService`, `IPaymentGatewayService` and `ICalendarService`.
- `Services/`:
  - `CrudServiceBase` (shared Get / GetById / Save / Update / Delete logic: scoping, permissions, ownership, validation)
  - Workspace, People, Membership, Finance, Operations, Notification, Engagement, Configuration, Security and Infrastructure services
  - `DashboardService`, `IdSequenceService`

**API (`officera_API`)**
- `Controllers/CrudControllerBase.cs`, `ModuleControllers.cs`, `AuthController.cs`, `SystemControllers.cs`
- `Infrastructure/CurrentUserService.cs`, `ExceptionHandlingMiddleware.cs`, `ServiceRegistration.cs`
- `wwwroot/uploads/{images,documents,profiles,attachments}` (created at start-up)

**Tests (`officera.TestCases`)**
- `Infrastructure/OfficeraApiFactory.cs`
- `AuthenticationTests.cs`, `CrudAndBusinessRuleTests.cs`, `FileUploadTests.cs`
- `UnitTest1.cs` (now holds the helper unit tests)

**Angular (`co-working/src`)**
- `environments/environment.ts`, `environments/environment.prod.ts`
- `core/services/`: `api.service`, `api-collection` (replaces `mock-collection`), `client-store.service` (replaces `mock-db.service`), `session.store`, `write-queue.service`, `id-pool.service`, `data-bootstrap.service`, `lookup.service`, `api-error-bus`
- `core/interceptors/auth.interceptor.ts`
- `core/config/integration-catalog.ts` (the provider field schema, moved out of mock data), `core/config/ui-constants.ts`

## 2. Files modified

**Backend**
- All 5 `.csproj` files: EF Core 8.0.31 (base, SqlServer, Design), JwtBearer, Serilog, project references, user-secrets. The API no longer references the test project.
- `Program.cs`, `appsettings.json` (your connection string and `loginURL` are unchanged; added Jwt with an empty key, Cors, Otp, FileStorage and Serilog), `appsettings.Development.json`.
- Repositories and UnitOfWork: **not changed**.

**Angular, data and logic only**
- `app.config.ts`, `angular.json` (production file replacement), all `core/services/data/*` services, `auth.service`, `settings.service`, `integration.service`, `booking-engine.service`, `checkout.service`, `report.service`, `notification.service`, `lead-capture.service`, `search.service`, `location-context.service`, `ui.service`, and the `core/models` types (photos can be an uploaded URL; `Attachment.url`; `User.lockedUntil`).
- Components changed only where needed:
  - The file-upload component now uploads to the API.
  - The workspace image can show uploaded images.
  - Forms that used hardcoded `LOC-001` / `Telangana` defaults or hardcoded state lists now use lookups.
  - The enquiry and contact forms submit to the API.
  - The demo OTP hint is shown only in development.
  - Uploads were wired into the location, resource, gallery, blog, profile and complete-profile screens.

**Text changed because it was false or invented** (please review):
- Demo-accounts panel on login: hidden; credentials are no longer shipped in the app.
- KPI trends: "+4.2%" and "+8.4%" are now calculated.
- "5 centres" and "Centres in Hyderabad, Bangalore and Chennai" now come from the locations data.
- "Trusted by 400+ companies" became "Trusted by companies across our centres", and the section is hidden while there are no testimonials.
- The footer GSTIN, phone and e-mail now come from Settings.
- "Mock build for UI review" is removed.
- The "GST (18%)" labels show the rate from Settings.
- The checkout promo hint comes from active promotions, and the UPI field is no longer pre-filled.
- The admin help text and the Settings › Demo controls text were made accurate.

**Deleted**
- `core/mock-data/*` (all seed generators, demo users and passwords)
- `core/services/mock-collection.ts`, `core/services/mock-db.service.ts`

## 3. Errors fixed
- CS1061 `Set`, `SaveChangesAsync` and `Database` on `OfficeraContext`: the context did not inherit `DbContext`. It is now the scaffolded `DbContext`.
- CS1061 `UseSqlServer`: the `Microsoft.EntityFrameworkCore.SqlServer` package was missing.
- CS0006 missing `officera.DataAccessLayer.dll`: a knock-on effect of the DAL build failure.
- The API was referencing the test project (wrong direction). That reference is removed and the tests now reference the API.

**Result:** `dotnet build officera_API.slnx` gives 0 errors and 0 warnings, and `ng build` succeeds.

## 4. APIs created (all POST, about 175 endpoints)
- `Location`, `Resource`, `Plan`, `Event`, `BlogPost`, `Gallery`: Get, GetById, Save, Update, Delete. Get and GetById are public, limited to active or published rows.
- `Member`, `Company`, `User`, `Role` (+ GetPermissions), `Promotion`, `Subscription`, `CreditTransaction`, `Booking` (+ GetOccupancy), `Payment` (+ GetGateway), `Invoice`, `Refund`, `CreditNote`, `Visitor`, `AccessCredential`, `AccessLog`, `Support` (tickets), `Notification`, `NotificationTemplate`, `NotificationLog`, `AuditLog`, `Lead` (+ anonymous Capture), `Post`, `Perk`: Get, GetById, Save, Update, Delete.
- `Integration`: CRUD + Test.
- `Auth`: Login, LoginWithOtp, SendOtp, VerifyOtp, Register, ResetPassword, ChangePassword, Me, Logout, CreateMemberLogin, Unlock.
- `Configuration`: Get, Update.
- `Homepage`: Get, Update.
- `Lookup`: GetStates.
- `Dashboard`: GetSummary.
- `Ids`: Reserve.
- `File`: Upload.
- Every Get supports search, filters, sorting and paging (`pageSize = 0` returns all rows you may see) and returns `{items, totalCount, pageNumber, pageSize, totalPages}` inside the common `ApiResponse`.

## 5. Database tables / entities
Locations, LocationReviews, Resources, Companies, Members, Users, UserLocations, Roles, Permissions, RolePermissions, OtpRequests, Leads, Plans, Subscriptions, CreditTransactions, Promotions, Bookings, Payments, Invoices, InvoiceLines, Refunds, CreditNotes, Visitors, AccessCredentials, AccessLogs, Tickets, Notifications, NotificationTemplates, NotificationLogs, Posts, Events, Perks, BlogPosts, GalleryItems, HomepageContent, OrgSettings, Integrations, IntegrationSecrets, States, UploadedFiles, IdSequences, AuditLogs.

## 6. Authentication
- JWT (HS256) signed with `Jwt:Key`, which is stored in .NET user-secrets on this machine and never in a file. The API refuses to start without it.
- The token carries user id, name, e-mail, role and member id. On every request the API re-reads role, locations, permissions and account status from the database, so deactivations and role changes take effect immediately. Nothing the browser sends about the user is trusted.
- Permission matrix enforced on the server:
  - Location managers and front desk staff only see their centres.
  - Members only see their own records and can only change the fields their flows need. For example, they cannot change role or status, can only spend referral credit, and their QR status is recalculated from their subscription.
- Passwords use ASP.NET Identity PBKDF2. The "plain text" in section 16 was read as a typo. No hashes or passwords are ever returned.
- Lockout after the configured number of failed sign-ins.
- Rate limits: 20 per minute on auth endpoints and 5 per minute on OTP.
- OTPs are random, stored as hashes, expire, and can be used once. In Development, when no SMS or e-mail provider is active, the code is returned to the screen ("Demo code") so the flows can be tested.
- Staff-created member logins get a random temporary password that is sent only by e-mail or SMS. Without a provider, the member uses Forgot password.
- Super Admin: `admin@officera.in` with the password from your build notes (only the hash is stored). **Change it after the first sign-in.**

## 7. File uploads
- `POST /api/File/Upload` (multipart, field `files`, plus `category` = images | documents | profiles | attachments).
- Checks: extension allow-list, size limits (5 MB images, 2 MB profile photos, 10 MB PDFs), file signature ("magic bytes"), random stored names, path-traversal protection.
- Metadata is stored in `config.UploadedFiles`. Files are served from `/uploads/...` with `nosniff` and a restrictive content-security policy, and the app builds image URLs from `environment.baseurl`.

## 8. Swagger
Run `dotnet run --launch-profile https` in `officera_API/officera_API`, then open `https://localhost:7232/swagger`. It loads (HTTP 200) and lists all endpoints. Authorize takes `Bearer {token}`. Checked: login, then a protected call with the token returns 200, and the same call without a token returns 401.

## 9. Tests
`dotnet test officera.TestCases`: **56 tests, all passing.** They run the real pipeline (controller → service → UnitOfWork/repository → OfficeraContext) on the EF in-memory provider, so `officera_Dev` is never touched.

What they cover:
- **Sign-in:** valid, invalid and empty credentials.
- **Tokens and access:** no token, tampered JWT, expired JWT, deactivated user, member forbidden from admin APIs, member attempting to make themselves admin, member seeing only their own data.
- **CRUD:** create, get, update and delete round trip; duplicate (409); required fields (400); unknown id (404); search, filter and paging.
- **Business rules:** double-booking blocked, end time before start time, booking on behalf of another member, occupancy feed without personal data, invoice numbers issued by the server in sequence, invoice totals must add up, audit user and IP taken from the token, dashboard counts and staff-only access, settings permissions, integration secrets encrypted and never returned.
- **Uploads:** valid image, multiple files, wrong extension, renamed file with the wrong signature, oversized file, missing file, unknown category, upload without sign-in.
- **Helper unit tests.**

## Checked in the browser against the live API
- Sign-in with session restore
- Admin dashboard
- Creating a location, resource and member (with login) from the existing screens
- Password reset by OTP
- Member subscription purchase: payment, GST invoice `OFC/26-27/00001`, subscription, credits and QR access all saved
- Booking wizard up to checkout

No console errors throughout. The QA records were then deleted, so `officera_Dev` holds only the seed data.

## 10. Needs your decision
1. **Payment gateway is still simulated.** Checkout keeps the "Demo: payment gateway result" switch. Razorpay order creation exists on the server; wiring Razorpay's checkout script and payment verification into the checkout screen is the next step.
2. **Business flows still run in the browser.** Bookings, checkout and subscription changes are calculated in the browser and saved through the API, with ownership and double-booking enforced by the server. A member can still alter amounts or statuses on their own records. Moving these flows fully to the server is a larger follow-up.
3. **Existing mobile validator bug.** The Angular validator strips a leading "91", so valid numbers like 9123456780 are rejected. I left it alone (you said not to change validations); the API accepts them. Shall I fix it?
4. **Not wired yet:** Google sign-in (it shows a "not available yet" message and only appears if a Google OAuth integration is active), real calendar sync, S3/Azure storage (files are stored on the server), and scheduled jobs such as reminders, retries and auto-escalation (still triggered by buttons, as in the mockup).
5. **Legal text placeholders:** the Terms and Privacy pages still say "(Summary for the mockup.)".
6. **Template controller:** `WeatherForecastController` from the original template is still in the API. I left it in place; it can be deleted.
