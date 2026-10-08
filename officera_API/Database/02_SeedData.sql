/* =====================================================================================
   Officera – reference / system data required for the application to run.

   This is NOT demo data. It contains only:
     - the permission catalogue and the five system roles used by the frontend route guards,
     - Indian states with GST state codes (dropdowns),
     - the business-rule defaults from the FRD (Settings > Business rules),
     - the notification templates the notification centre dispatches,
     - the homepage hero copy,
     - the Super Admin login.

   Super Admin: admin@officera.in (credential documented in co-working/docs/OFFICERA-BUILD-NOTES.md).
   The password is stored as an ASP.NET Core Identity PBKDF2 hash, never as plain text.
   CHANGE THE PASSWORD after the first sign-in (Profile > Change password).

   Safe to re-run: every insert checks for an existing row first.
   ===================================================================================== */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET XACT_ABORT ON;
BEGIN TRANSACTION;

/* ---------------- Permissions ---------------- */
DECLARE @modules TABLE (ModuleKey NVARCHAR(40), Module NVARCHAR(100), Actions NVARCHAR(100), SortOrder INT);
INSERT INTO @modules VALUES
 (N'dashboard', N'Dashboard', N'view', 1),
 (N'locations', N'Locations', N'view,create,edit,delete', 2),
 (N'resources', N'Resources & Floor Maps', N'view,create,edit,delete', 3),
 (N'plans', N'Plans & Promotions', N'view,create,edit,delete', 4),
 (N'subscriptions', N'Subscriptions & Credits', N'view,edit', 5),
 (N'bookings', N'Bookings', N'view,create,edit,delete', 6),
 (N'members', N'Members & Companies', N'view,create,edit,delete', 7),
 (N'visitors', N'Visitors', N'view,create,edit', 8),
 (N'frontdesk', N'Front Desk', N'view,edit', 9),
 (N'payments', N'Payments', N'view,create,export', 10),
 (N'invoices', N'Invoices & Credit Notes', N'view,create,edit,export', 11),
 (N'refunds', N'Refunds', N'view,approve', 12),
 (N'dues', N'Outstanding Dues', N'view,edit', 13),
 (N'accounting', N'Accounting Export', N'view,export', 14),
 (N'access', N'Access Control', N'view,create,edit', 15),
 (N'support', N'Support Tickets', N'view,create,edit', 16),
 (N'community', N'Community', N'view,create,edit,delete', 17),
 (N'leads', N'Leads', N'view,create,edit,delete', 18),
 (N'content', N'Marketing Content', N'view,create,edit,delete', 19),
 (N'notifications', N'Notifications', N'view,edit', 20),
 (N'reports', N'Reports', N'view,export', 21),
 (N'users', N'Users, Roles & Permissions', N'view,create,edit,delete', 22),
 (N'audit', N'Audit Logs', N'view,export', 23),
 (N'settings', N'Settings', N'view,edit', 24),
 (N'integrations', N'Configuration / Integrations', N'view,create,edit,delete', 25);

DECLARE @actionLabels TABLE (Action NVARCHAR(20), Label NVARCHAR(20));
INSERT INTO @actionLabels VALUES (N'view', N'View'), (N'create', N'Create'), (N'edit', N'Edit'), (N'delete', N'Delete'), (N'approve', N'Approve'), (N'export', N'Export');

INSERT INTO auth.Permissions (PermissionKey, Module, ModuleKey, Action, Label, SortOrder)
SELECT m.ModuleKey + N'.' + a.value, m.Module, m.ModuleKey, a.value, l.Label + N' ' + m.Module, m.SortOrder * 10 + a.ordinal
FROM @modules m
CROSS APPLY STRING_SPLIT(m.Actions, N',', 1) a
JOIN @actionLabels l ON l.Action = a.value
WHERE NOT EXISTS (SELECT 1 FROM auth.Permissions p WHERE p.PermissionKey = m.ModuleKey + N'.' + a.value);

/* ---------------- Roles ---------------- */
MERGE auth.Roles AS t
USING (VALUES
 (N'ROL-1', N'SUPER_ADMIN', N'Super Admin', N'Unrestricted access across all locations and modules.'),
 (N'ROL-2', N'LOCATION_MANAGER', N'Location Manager', N'Runs assigned centres: resources, bookings, members, visitors, tickets and leads.'),
 (N'ROL-3', N'FRONT_DESK', N'Front Desk', N'Visitor check-in/out, today''s bookings, member verification and support.'),
 (N'ROL-4', N'FINANCE', N'Finance', N'Payments, invoices, refunds, credit notes, dues and accounting exports.'),
 (N'ROL-5', N'MEMBER', N'Member', N'Member portal access. Data access is limited to the member''s own records.')
) AS s (Id, RoleKey, Name, Description)
ON t.RoleKey = s.RoleKey
WHEN NOT MATCHED THEN INSERT (Id, RoleKey, Name, Description, IsSystem, CreatedBy) VALUES (s.Id, s.RoleKey, s.Name, s.Description, 1, N'SYSTEM');

/* ---------------- Role permissions (matches the original role matrix) ---------------- */
DECLARE @rp TABLE (RoleId NVARCHAR(32), ModuleKey NVARCHAR(40), Actions NVARCHAR(100));
INSERT INTO @rp VALUES
 /* Location Manager */
 (N'ROL-2', N'dashboard', NULL), (N'ROL-2', N'resources', NULL), (N'ROL-2', N'bookings', NULL), (N'ROL-2', N'members', NULL),
 (N'ROL-2', N'visitors', NULL), (N'ROL-2', N'frontdesk', NULL), (N'ROL-2', N'support', NULL), (N'ROL-2', N'community', NULL), (N'ROL-2', N'leads', NULL),
 (N'ROL-2', N'locations', N'view,edit'), (N'ROL-2', N'plans', N'view,edit'), (N'ROL-2', N'subscriptions', N'view,edit'), (N'ROL-2', N'access', N'view,edit'), (N'ROL-2', N'notifications', N'view,edit'),
 (N'ROL-2', N'reports', N'view,export'),
 (N'ROL-2', N'payments', N'view'), (N'ROL-2', N'invoices', N'view'), (N'ROL-2', N'dues', N'view'),
 /* Front Desk */
 (N'ROL-3', N'dashboard', NULL), (N'ROL-3', N'frontdesk', NULL), (N'ROL-3', N'visitors', NULL),
 (N'ROL-3', N'bookings', N'view'), (N'ROL-3', N'members', N'view'), (N'ROL-3', N'access', N'view'),
 (N'ROL-3', N'support', N'view,create,edit'),
 /* Finance */
 (N'ROL-4', N'dashboard', NULL), (N'ROL-4', N'payments', NULL), (N'ROL-4', N'invoices', NULL), (N'ROL-4', N'refunds', NULL), (N'ROL-4', N'dues', NULL), (N'ROL-4', N'accounting', NULL),
 (N'ROL-4', N'reports', N'view,export');

INSERT INTO auth.RolePermissions (RoleId, PermissionKey)
SELECT DISTINCT r.RoleId, p.PermissionKey
FROM @rp r
JOIN auth.Permissions p ON p.ModuleKey = r.ModuleKey
WHERE (r.Actions IS NULL OR p.Action IN (SELECT value FROM STRING_SPLIT(r.Actions, N',')))
  AND NOT EXISTS (SELECT 1 FROM auth.RolePermissions x WHERE x.RoleId = r.RoleId AND x.PermissionKey = p.PermissionKey);

/* Super Admin holds every permission. */
INSERT INTO auth.RolePermissions (RoleId, PermissionKey)
SELECT N'ROL-1', p.PermissionKey FROM auth.Permissions p
WHERE NOT EXISTS (SELECT 1 FROM auth.RolePermissions x WHERE x.RoleId = N'ROL-1' AND x.PermissionKey = p.PermissionKey);

/* ---------------- States (GST state codes) ---------------- */
MERGE config.States AS t
USING (VALUES
 (N'01', N'Jammu and Kashmir'), (N'02', N'Himachal Pradesh'), (N'03', N'Punjab'), (N'04', N'Chandigarh'), (N'05', N'Uttarakhand'),
 (N'06', N'Haryana'), (N'07', N'Delhi'), (N'08', N'Rajasthan'), (N'09', N'Uttar Pradesh'), (N'10', N'Bihar'),
 (N'11', N'Sikkim'), (N'12', N'Arunachal Pradesh'), (N'13', N'Nagaland'), (N'14', N'Manipur'), (N'15', N'Mizoram'),
 (N'16', N'Tripura'), (N'17', N'Meghalaya'), (N'18', N'Assam'), (N'19', N'West Bengal'), (N'20', N'Jharkhand'),
 (N'21', N'Odisha'), (N'22', N'Chhattisgarh'), (N'23', N'Madhya Pradesh'), (N'24', N'Gujarat'), (N'26', N'Dadra and Nagar Haveli and Daman and Diu'),
 (N'27', N'Maharashtra'), (N'29', N'Karnataka'), (N'30', N'Goa'), (N'31', N'Lakshadweep'), (N'32', N'Kerala'),
 (N'33', N'Tamil Nadu'), (N'34', N'Puducherry'), (N'35', N'Andaman and Nicobar Islands'), (N'36', N'Telangana'), (N'37', N'Andhra Pradesh'),
 (N'38', N'Ladakh')
) AS s (StateCode, Name)
ON t.StateCode = s.StateCode
WHEN NOT MATCHED THEN INSERT (StateCode, Name, SortOrder) VALUES (s.StateCode, s.Name, 0);

/* ---------------- Organisation settings: FRD business rules. Supplier/GST details are left blank for the Super Admin to enter. ---------------- */
IF NOT EXISTS (SELECT 1 FROM config.OrgSettings WHERE Id = 1)
INSERT INTO config.OrgSettings (Id, GstRate, SlotLockMinutes, FreeCancellationHours, TicketEscalationHours, PaymentRetryDays, GracePeriodDays,
                                BookingReminderMinutes, RenewalReminderDays, MaxLoginAttempts, LockoutMinutes, Currency, Timezone, CreatedBy)
VALUES (1, 18, 10, 2, 24, N'1,3,7', 5, 60, 7, 5, 15, N'INR', N'Asia/Kolkata', N'SYSTEM');

/* ---------------- Notification templates used by the notification centre ---------------- */
MERGE notify.NotificationTemplates AS t
USING (VALUES
 (N'TPL-01', N'Booking Confirmed – Email', N'Booking Confirmed', N'EMAIL', N'Your booking {{bookingId}} is confirmed', N'Hi {{name}}, your booking for {{resource}} on {{date}} at {{time}} is confirmed.', N'ACTIVE'),
 (N'TPL-02', N'Booking Confirmed – Push', N'Booking Confirmed', N'PUSH', N'Booking confirmed', N'{{resource}} · {{date}} {{time}}', N'ACTIVE'),
 (N'TPL-03', N'Booking Reminder – SMS', N'Booking Reminder (1 hour)', N'SMS', N'', N'Reminder: {{resource}} at {{location}} starts at {{time}}. – Officera', N'ACTIVE'),
 (N'TPL-04', N'Renewal Reminder – Email', N'Renewal Reminder (7 days)', N'EMAIL', N'Your {{plan}} renews on {{date}}', N'Hi {{name}}, your membership renews in 7 days. Amount: {{amount}}.', N'ACTIVE'),
 (N'TPL-05', N'Payment Success – Email', N'Payment Success', N'EMAIL', N'Payment received – {{invoiceNumber}}', N'We received {{amount}}. Your GST invoice is attached.', N'ACTIVE'),
 (N'TPL-06', N'Payment Failure – SMS', N'Payment Failure', N'SMS', N'', N'Payment of {{amount}} failed. Retry from your Officera portal to avoid suspension.', N'ACTIVE'),
 (N'TPL-07', N'Visitor Arrival – Push', N'Visitor Arrival', N'PUSH', N'Your visitor has arrived', N'{{visitor}} is at the {{location}} reception.', N'ACTIVE'),
 (N'TPL-08', N'Visitor Pass – SMS', N'Visitor Pass Issued', N'SMS', N'', N'You are invited to Officera {{location}} on {{date}}. Show pass {{passCode}} at reception.', N'ACTIVE'),
 (N'TPL-09', N'Ticket Update – Email', N'Ticket Update', N'EMAIL', N'Update on ticket {{ticketId}}', N'Your ticket is now {{status}}.', N'ACTIVE'),
 (N'TPL-10', N'Tour Confirmation – SMS', N'Tour Confirmation', N'SMS', N'', N'Your tour at Officera {{location}} is confirmed for {{date}} {{time}}.', N'ACTIVE'),
 (N'TPL-11', N'OTP – SMS', N'OTP Verification', N'SMS', N'', N'{{otp}} is your Officera verification code. Valid for 10 minutes.', N'ACTIVE'),
 (N'TPL-12', N'Welcome – Email', N'Member Welcome', N'EMAIL', N'Welcome to Officera, {{name}}', N'Your account is ready. Complete your profile to get started.', N'INACTIVE')
) AS s (Id, Name, EventName, Channel, Subject, Message, Status)
ON t.Id = s.Id
WHEN NOT MATCHED THEN INSERT (Id, Name, EventName, Channel, Subject, Message, Status, CreatedBy) VALUES (s.Id, s.Name, s.EventName, s.Channel, s.Subject, s.Message, s.Status, N'SYSTEM');

/* ---------------- Homepage copy (editable in Marketing Content). Stats / testimonials are left empty: add real ones from the console. ---------------- */
IF NOT EXISTS (SELECT 1 FROM content.HomepageContent WHERE Id = 1)
INSERT INTO content.HomepageContent (Id, HeroTitle, HeroSubtitle, StatsJson, TestimonialsJson, FeaturesJson, Announcement, ShowAnnouncement, CreatedBy)
VALUES (1,
 N'Find Your Perfect Workspace',
 N'Hot desks, dedicated desks, private offices and meeting rooms. Book by the hour or join as a member.',
 N'[]',
 N'[]',
 N'[{"title":"Book in seconds","description":"Real-time availability with instant confirmation for desks and rooms.","icon":"calendar"},{"title":"Flexible memberships","description":"Day passes to private offices. Upgrade, pause or cancel any time.","icon":"layers"},{"title":"Smart access","description":"QR-based entry for members and guests. No cards to lose.","icon":"qr"},{"title":"GST-ready billing","description":"Automatic GST invoices, credits and payment history in one place.","icon":"receipt"}]',
 N'', 0, N'SYSTEM');

/* ---------------- Super Admin ---------------- */
IF NOT EXISTS (SELECT 1 FROM auth.Users WHERE Email = N'admin@officera.in')
INSERT INTO auth.Users (Id, Name, Email, Mobile, RoleKey, Status, PasswordHash, CreatedBy)
VALUES (N'USR-0001', N'Super Admin', N'admin@officera.in', N'', N'SUPER_ADMIN', N'ACTIVE',
        N'AQAAAAIAAYagAAAAEOOHlScdXsPibplfDo4FE5zfbVD6nZ27rFDuVr1tP/5/qGum25S75SFCCBkUENSqDA==', N'SYSTEM');

COMMIT TRANSACTION;
