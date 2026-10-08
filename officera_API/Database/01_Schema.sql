/* =====================================================================================
   Officera – database schema (database-first, no EF Core migrations).

   Run against the database named in appsettings.json (ConnectionStrings:DefaultConnection):
       sqlcmd -S "(localdb)\MSSQLLocalDB" -E -d officera_Dev -i 01_Schema.sql
   then scaffold the entities (see README.md in this folder).

   Tables are grouped into SQL schemas by module:
       auth        users, roles, permissions, OTP requests
       workspace   locations, location reviews, resources
       people      companies, members
       membership  plans, subscriptions, credit transactions, promotions
       booking     bookings
       finance     payments, invoices, invoice lines, refunds, credit notes
       operations  visitors, access credentials, access logs, tickets
       notify      notifications, notification templates, notification logs
       crm         leads
       community   posts, events, perks
       content     blog posts, gallery items, homepage content
       config      organisation settings, integrations, integration secrets, states, uploaded files
       audit       audit logs

   Ids are the business codes the frontend uses (e.g. LOC-0001, MEM-1001).
   Every business table carries CreatedBy / CreatedDate / ModifiedBy / ModifiedDate, filled by the API
   from the signed-in user's JWT claims.
   ===================================================================================== */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET XACT_ABORT ON;
GO

IF SCHEMA_ID('auth') IS NULL EXEC('CREATE SCHEMA auth');
IF SCHEMA_ID('workspace') IS NULL EXEC('CREATE SCHEMA workspace');
IF SCHEMA_ID('people') IS NULL EXEC('CREATE SCHEMA people');
IF SCHEMA_ID('membership') IS NULL EXEC('CREATE SCHEMA membership');
IF SCHEMA_ID('booking') IS NULL EXEC('CREATE SCHEMA booking');
IF SCHEMA_ID('finance') IS NULL EXEC('CREATE SCHEMA finance');
IF SCHEMA_ID('operations') IS NULL EXEC('CREATE SCHEMA operations');
IF SCHEMA_ID('notify') IS NULL EXEC('CREATE SCHEMA notify');
IF SCHEMA_ID('crm') IS NULL EXEC('CREATE SCHEMA crm');
IF SCHEMA_ID('community') IS NULL EXEC('CREATE SCHEMA community');
IF SCHEMA_ID('content') IS NULL EXEC('CREATE SCHEMA content');
IF SCHEMA_ID('config') IS NULL EXEC('CREATE SCHEMA config');
IF SCHEMA_ID('audit') IS NULL EXEC('CREATE SCHEMA audit');
GO

/* ------------------------------------------------------------------ config ------------------------------------------------------------------ */
IF OBJECT_ID('config.States') IS NULL
CREATE TABLE config.States (
    StateCode       NVARCHAR(2)    NOT NULL CONSTRAINT PK_States PRIMARY KEY,
    Name            NVARCHAR(100)  NOT NULL CONSTRAINT UQ_States_Name UNIQUE,
    SortOrder       INT            NOT NULL CONSTRAINT DF_States_SortOrder DEFAULT (0),
    IsActive        BIT            NOT NULL CONSTRAINT DF_States_IsActive DEFAULT (1)
);
GO

IF OBJECT_ID('config.OrgSettings') IS NULL
CREATE TABLE config.OrgSettings (
    Id                      INT            NOT NULL CONSTRAINT PK_OrgSettings PRIMARY KEY CONSTRAINT CK_OrgSettings_Single CHECK (Id = 1),
    LegalName               NVARCHAR(200)  NOT NULL CONSTRAINT DF_OrgSettings_LegalName DEFAULT (N''),
    Gstin                   NVARCHAR(15)   NOT NULL CONSTRAINT DF_OrgSettings_Gstin DEFAULT (N''),
    Address                 NVARCHAR(500)  NOT NULL CONSTRAINT DF_OrgSettings_Address DEFAULT (N''),
    State                   NVARCHAR(100)  NOT NULL CONSTRAINT DF_OrgSettings_State DEFAULT (N''),
    StateCode               NVARCHAR(2)    NOT NULL CONSTRAINT DF_OrgSettings_StateCode DEFAULT (N''),
    Pan                     NVARCHAR(10)   NOT NULL CONSTRAINT DF_OrgSettings_Pan DEFAULT (N''),
    Email                   NVARCHAR(256)  NOT NULL CONSTRAINT DF_OrgSettings_Email DEFAULT (N''),
    Phone                   NVARCHAR(30)   NOT NULL CONSTRAINT DF_OrgSettings_Phone DEFAULT (N''),
    GstRate                 DECIMAL(5,2)   NOT NULL,
    SlotLockMinutes         INT            NOT NULL,
    FreeCancellationHours   INT            NOT NULL,
    TicketEscalationHours   INT            NOT NULL,
    PaymentRetryDays        NVARCHAR(50)   NOT NULL,
    GracePeriodDays         INT            NOT NULL,
    BookingReminderMinutes  INT            NOT NULL,
    RenewalReminderDays     INT            NOT NULL,
    MaxLoginAttempts        INT            NOT NULL,
    LockoutMinutes          INT            NOT NULL,
    Currency                NVARCHAR(3)    NOT NULL,
    Timezone                NVARCHAR(60)   NOT NULL,
    CreatedBy               NVARCHAR(32)   NULL,
    CreatedDate             DATETIME2(3)   NOT NULL CONSTRAINT DF_OrgSettings_CreatedDate DEFAULT (SYSUTCDATETIME()),
    ModifiedBy              NVARCHAR(32)   NULL,
    ModifiedDate            DATETIME2(3)   NULL
);
GO

/* ------------------------------------------------------------------ workspace ------------------------------------------------------------------ */
IF OBJECT_ID('workspace.Locations') IS NULL
CREATE TABLE workspace.Locations (
    Id                    NVARCHAR(32)   NOT NULL CONSTRAINT PK_Locations PRIMARY KEY,
    Name                  NVARCHAR(150)  NOT NULL CONSTRAINT UQ_Locations_Name UNIQUE,
    City                  NVARCHAR(100)  NOT NULL,
    State                 NVARCHAR(100)  NOT NULL,
    Address               NVARCHAR(500)  NOT NULL,
    Pincode               NVARCHAR(10)   NOT NULL,
    Latitude              DECIMAL(9,6)   NOT NULL CONSTRAINT DF_Locations_Latitude DEFAULT (0),
    Longitude             DECIMAL(9,6)   NOT NULL CONSTRAINT DF_Locations_Longitude DEFAULT (0),
    HoursWeekdays         NVARCHAR(60)   NOT NULL CONSTRAINT DF_Locations_HoursWeekdays DEFAULT (N''),
    HoursSaturday         NVARCHAR(60)   NOT NULL CONSTRAINT DF_Locations_HoursSaturday DEFAULT (N''),
    HoursSunday           NVARCHAR(60)   NOT NULL CONSTRAINT DF_Locations_HoursSunday DEFAULT (N''),
    AmenitiesJson         NVARCHAR(MAX)  NOT NULL CONSTRAINT DF_Locations_AmenitiesJson DEFAULT (N'[]'),
    PhotosJson            NVARCHAR(MAX)  NOT NULL CONSTRAINT DF_Locations_PhotosJson DEFAULT (N'[]'),
    Status                NVARCHAR(20)   NOT NULL CONSTRAINT CK_Locations_Status CHECK (Status IN (N'ACTIVE', N'INACTIVE', N'COMING_SOON')),
    Description           NVARCHAR(MAX)  NOT NULL CONSTRAINT DF_Locations_Description DEFAULT (N''),
    Rating                DECIMAL(3,2)   NOT NULL CONSTRAINT DF_Locations_Rating DEFAULT (0),
    ReviewCount           INT            NOT NULL CONSTRAINT DF_Locations_ReviewCount DEFAULT (0),
    TransportJson         NVARCHAR(MAX)  NOT NULL CONSTRAINT DF_Locations_TransportJson DEFAULT (N'[]'),
    SpaceTypesJson        NVARCHAR(MAX)  NOT NULL CONSTRAINT DF_Locations_SpaceTypesJson DEFAULT (N'[]'),
    StartingPrice         DECIMAL(18,2)  NOT NULL CONSTRAINT DF_Locations_StartingPrice DEFAULT (0),
    TotalSeats            INT            NOT NULL CONSTRAINT DF_Locations_TotalSeats DEFAULT (0),
    Phone                 NVARCHAR(30)   NOT NULL CONSTRAINT DF_Locations_Phone DEFAULT (N''),
    Email                 NVARCHAR(256)  NOT NULL CONSTRAINT DF_Locations_Email DEFAULT (N''),
    DistanceKm            DECIMAL(8,2)   NOT NULL CONSTRAINT DF_Locations_DistanceKm DEFAULT (0),
    CreatedBy             NVARCHAR(32)   NULL,
    CreatedDate           DATETIME2(3)   NOT NULL CONSTRAINT DF_Locations_CreatedDate DEFAULT (SYSUTCDATETIME()),
    ModifiedBy            NVARCHAR(32)   NULL,
    ModifiedDate          DATETIME2(3)   NULL
);
GO

IF OBJECT_ID('workspace.LocationReviews') IS NULL
CREATE TABLE workspace.LocationReviews (
    Id                    NVARCHAR(32)   NOT NULL CONSTRAINT PK_LocationReviews PRIMARY KEY,
    LocationId            NVARCHAR(32)   NOT NULL CONSTRAINT FK_LocationReviews_Locations REFERENCES workspace.Locations (Id) ON DELETE CASCADE,
    Author                NVARCHAR(150)  NOT NULL,
    Rating                INT            NOT NULL CONSTRAINT CK_LocationReviews_Rating CHECK (Rating BETWEEN 1 AND 5),
    ReviewText            NVARCHAR(2000) NOT NULL,
    ReviewDate            DATE           NOT NULL,
    CreatedBy             NVARCHAR(32)   NULL,
    CreatedDate           DATETIME2(3)   NOT NULL CONSTRAINT DF_LocationReviews_CreatedDate DEFAULT (SYSUTCDATETIME()),
    ModifiedBy            NVARCHAR(32)   NULL,
    ModifiedDate          DATETIME2(3)   NULL
);
CREATE INDEX IX_LocationReviews_LocationId ON workspace.LocationReviews (LocationId);
GO

IF OBJECT_ID('workspace.Resources') IS NULL
CREATE TABLE workspace.Resources (
    Id                    NVARCHAR(32)   NOT NULL CONSTRAINT PK_Resources PRIMARY KEY,
    Name                  NVARCHAR(150)  NOT NULL,
    Code                  NVARCHAR(30)   NOT NULL,
    ResourceType          NVARCHAR(20)   NOT NULL CONSTRAINT CK_Resources_Type CHECK (ResourceType IN (N'HOT_DESK', N'DEDICATED_DESK', N'PRIVATE_OFFICE', N'MEETING_ROOM')),
    LocationId            NVARCHAR(32)   NOT NULL CONSTRAINT FK_Resources_Locations REFERENCES workspace.Locations (Id),
    Floor                 NVARCHAR(50)   NOT NULL CONSTRAINT DF_Resources_Floor DEFAULT (N''),
    Capacity              INT            NOT NULL CONSTRAINT CK_Resources_Capacity CHECK (Capacity > 0),
    Price                 DECIMAL(18,2)  NOT NULL CONSTRAINT CK_Resources_Price CHECK (Price >= 0),
    PriceUnit             NVARCHAR(10)   NOT NULL CONSTRAINT CK_Resources_PriceUnit CHECK (PriceUnit IN (N'hour', N'day', N'month')),
    AmenitiesJson         NVARCHAR(MAX)  NOT NULL CONSTRAINT DF_Resources_AmenitiesJson DEFAULT (N'[]'),
    PhotosJson            NVARCHAR(MAX)  NOT NULL CONSTRAINT DF_Resources_PhotosJson DEFAULT (N'[]'),
    Availability          NVARCHAR(200)  NOT NULL CONSTRAINT DF_Resources_Availability DEFAULT (N''),
    CancellationRule      NVARCHAR(500)  NOT NULL CONSTRAINT DF_Resources_CancellationRule DEFAULT (N''),
    Status                NVARCHAR(20)   NOT NULL CONSTRAINT CK_Resources_Status CHECK (Status IN (N'ACTIVE', N'MAINTENANCE', N'INACTIVE')),
    MapX                  DECIMAL(6,2)   NOT NULL CONSTRAINT DF_Resources_MapX DEFAULT (0),
    MapY                  DECIMAL(6,2)   NOT NULL CONSTRAINT DF_Resources_MapY DEFAULT (0),
    MapW                  DECIMAL(6,2)   NOT NULL CONSTRAINT DF_Resources_MapW DEFAULT (10),
    MapH                  DECIMAL(6,2)   NOT NULL CONSTRAINT DF_Resources_MapH DEFAULT (10),
    IsBlocked             BIT            NOT NULL CONSTRAINT DF_Resources_IsBlocked DEFAULT (0),
    CreatedBy             NVARCHAR(32)   NULL,
    CreatedDate           DATETIME2(3)   NOT NULL CONSTRAINT DF_Resources_CreatedDate DEFAULT (SYSUTCDATETIME()),
    ModifiedBy            NVARCHAR(32)   NULL,
    ModifiedDate          DATETIME2(3)   NULL,
    CONSTRAINT UQ_Resources_Location_Code UNIQUE (LocationId, Code)
);
GO

/* ------------------------------------------------------------------ people ------------------------------------------------------------------ */
IF OBJECT_ID('people.Companies') IS NULL
CREATE TABLE people.Companies (
    Id                    NVARCHAR(32)   NOT NULL CONSTRAINT PK_Companies PRIMARY KEY,
    Name                  NVARCHAR(200)  NOT NULL,
    Gstin                 NVARCHAR(15)   NOT NULL CONSTRAINT DF_Companies_Gstin DEFAULT (N''),
    BillingAddress        NVARCHAR(500)  NOT NULL CONSTRAINT DF_Companies_BillingAddress DEFAULT (N''),
    State                 NVARCHAR(100)  NOT NULL CONSTRAINT DF_Companies_State DEFAULT (N''),
    Industry              NVARCHAR(100)  NOT NULL CONSTRAINT DF_Companies_Industry DEFAULT (N''),
    CompanySize           NVARCHAR(30)   NOT NULL CONSTRAINT DF_Companies_CompanySize DEFAULT (N''),
    Website               NVARCHAR(300)  NOT NULL CONSTRAINT DF_Companies_Website DEFAULT (N''),
    LocationId            NVARCHAR(32)   NOT NULL CONSTRAINT FK_Companies_Locations REFERENCES workspace.Locations (Id),
    PrimaryContactId      NVARCHAR(32)   NULL,
    CreatedBy             NVARCHAR(32)   NULL,
    CreatedDate           DATETIME2(3)   NOT NULL CONSTRAINT DF_Companies_CreatedDate DEFAULT (SYSUTCDATETIME()),
    ModifiedBy            NVARCHAR(32)   NULL,
    ModifiedDate          DATETIME2(3)   NULL
);
CREATE INDEX IX_Companies_LocationId ON people.Companies (LocationId);
GO

IF OBJECT_ID('people.Members') IS NULL
CREATE TABLE people.Members (
    Id                    NVARCHAR(32)   NOT NULL CONSTRAINT PK_Members PRIMARY KEY,
    FirstName             NVARCHAR(60)   NOT NULL,
    LastName              NVARCHAR(60)   NOT NULL,
    Email                 NVARCHAR(256)  NOT NULL CONSTRAINT UQ_Members_Email UNIQUE,
    Mobile                NVARCHAR(15)   NOT NULL,
    CompanyId             NVARCHAR(32)   NULL CONSTRAINT FK_Members_Companies REFERENCES people.Companies (Id),
    Designation           NVARCHAR(100)  NOT NULL CONSTRAINT DF_Members_Designation DEFAULT (N''),
    LocationId            NVARCHAR(32)   NOT NULL CONSTRAINT FK_Members_Locations REFERENCES workspace.Locations (Id),
    Status                NVARCHAR(20)   NOT NULL CONSTRAINT CK_Members_Status CHECK (Status IN (N'ACTIVE', N'SUSPENDED', N'INACTIVE', N'PENDING')),
    JoinDate              DATE           NOT NULL,
    DirectoryVisible      BIT            NOT NULL CONSTRAINT DF_Members_DirectoryVisible DEFAULT (0),
    Bio                   NVARCHAR(2000) NOT NULL CONSTRAINT DF_Members_Bio DEFAULT (N''),
    SkillsJson            NVARCHAR(MAX)  NOT NULL CONSTRAINT DF_Members_SkillsJson DEFAULT (N'[]'),
    LeadId                NVARCHAR(32)   NULL,
    Photo                 NVARCHAR(500)  NULL,
    ReferralCredit        DECIMAL(18,2)  NOT NULL CONSTRAINT DF_Members_ReferralCredit DEFAULT (0),
    ProfileCompleted      BIT            NOT NULL CONSTRAINT DF_Members_ProfileCompleted DEFAULT (0),
    CreatedBy             NVARCHAR(32)   NULL,
    CreatedDate           DATETIME2(3)   NOT NULL CONSTRAINT DF_Members_CreatedDate DEFAULT (SYSUTCDATETIME()),
    ModifiedBy            NVARCHAR(32)   NULL,
    ModifiedDate          DATETIME2(3)   NULL
);
CREATE INDEX IX_Members_LocationId ON people.Members (LocationId);
CREATE INDEX IX_Members_CompanyId ON people.Members (CompanyId);
GO

IF OBJECT_ID('FK_Companies_PrimaryContact') IS NULL
ALTER TABLE people.Companies ADD CONSTRAINT FK_Companies_PrimaryContact FOREIGN KEY (PrimaryContactId) REFERENCES people.Members (Id);
GO

/* ------------------------------------------------------------------ auth ------------------------------------------------------------------ */
IF OBJECT_ID('auth.Roles') IS NULL
CREATE TABLE auth.Roles (
    Id                    NVARCHAR(32)   NOT NULL CONSTRAINT PK_Roles PRIMARY KEY,
    RoleKey               NVARCHAR(30)   NOT NULL CONSTRAINT UQ_Roles_RoleKey UNIQUE,
    Name                  NVARCHAR(100)  NOT NULL,
    Description           NVARCHAR(500)  NOT NULL CONSTRAINT DF_Roles_Description DEFAULT (N''),
    IsSystem              BIT            NOT NULL CONSTRAINT DF_Roles_IsSystem DEFAULT (0),
    CreatedBy             NVARCHAR(32)   NULL,
    CreatedDate           DATETIME2(3)   NOT NULL CONSTRAINT DF_Roles_CreatedDate DEFAULT (SYSUTCDATETIME()),
    ModifiedBy            NVARCHAR(32)   NULL,
    ModifiedDate          DATETIME2(3)   NULL
);
GO

IF OBJECT_ID('auth.Permissions') IS NULL
CREATE TABLE auth.Permissions (
    PermissionKey         NVARCHAR(60)   NOT NULL CONSTRAINT PK_Permissions PRIMARY KEY,
    Module                NVARCHAR(100)  NOT NULL,
    ModuleKey             NVARCHAR(40)   NOT NULL,
    Action                NVARCHAR(20)   NOT NULL CONSTRAINT CK_Permissions_Action CHECK (Action IN (N'view', N'create', N'edit', N'delete', N'approve', N'export')),
    Label                 NVARCHAR(150)  NOT NULL,
    SortOrder             INT            NOT NULL CONSTRAINT DF_Permissions_SortOrder DEFAULT (0)
);
GO

IF OBJECT_ID('auth.RolePermissions') IS NULL
CREATE TABLE auth.RolePermissions (
    RoleId                NVARCHAR(32)   NOT NULL CONSTRAINT FK_RolePermissions_Roles REFERENCES auth.Roles (Id) ON DELETE CASCADE,
    PermissionKey         NVARCHAR(60)   NOT NULL CONSTRAINT FK_RolePermissions_Permissions REFERENCES auth.Permissions (PermissionKey) ON DELETE CASCADE,
    CreatedDate           DATETIME2(3)   NOT NULL CONSTRAINT DF_RolePermissions_CreatedDate DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_RolePermissions PRIMARY KEY (RoleId, PermissionKey)
);
GO

IF OBJECT_ID('auth.Users') IS NULL
CREATE TABLE auth.Users (
    Id                    NVARCHAR(32)   NOT NULL CONSTRAINT PK_Users PRIMARY KEY,
    Name                  NVARCHAR(150)  NOT NULL,
    Email                 NVARCHAR(256)  NOT NULL CONSTRAINT UQ_Users_Email UNIQUE,
    Mobile                NVARCHAR(15)   NOT NULL CONSTRAINT DF_Users_Mobile DEFAULT (N''),
    RoleKey               NVARCHAR(30)   NOT NULL CONSTRAINT FK_Users_Roles REFERENCES auth.Roles (RoleKey),
    Status                NVARCHAR(20)   NOT NULL CONSTRAINT CK_Users_Status CHECK (Status IN (N'ACTIVE', N'INACTIVE', N'LOCKED', N'INVITED')),
    MemberId              NVARCHAR(32)   NULL CONSTRAINT FK_Users_Members REFERENCES people.Members (Id),
    LastLogin             DATETIME2(3)   NULL,
    PasswordHash          NVARCHAR(500)  NULL,
    FailedLoginCount      INT            NOT NULL CONSTRAINT DF_Users_FailedLoginCount DEFAULT (0),
    LockoutUntil          DATETIME2(3)   NULL,
    CreatedBy             NVARCHAR(32)   NULL,
    CreatedDate           DATETIME2(3)   NOT NULL CONSTRAINT DF_Users_CreatedDate DEFAULT (SYSUTCDATETIME()),
    ModifiedBy            NVARCHAR(32)   NULL,
    ModifiedDate          DATETIME2(3)   NULL
);
CREATE INDEX IX_Users_Mobile ON auth.Users (Mobile);
CREATE UNIQUE INDEX UX_Users_MemberId ON auth.Users (MemberId) WHERE MemberId IS NOT NULL;
GO

IF OBJECT_ID('auth.UserLocations') IS NULL
CREATE TABLE auth.UserLocations (
    UserId                NVARCHAR(32)   NOT NULL CONSTRAINT FK_UserLocations_Users REFERENCES auth.Users (Id) ON DELETE CASCADE,
    LocationId            NVARCHAR(32)   NOT NULL CONSTRAINT FK_UserLocations_Locations REFERENCES workspace.Locations (Id) ON DELETE CASCADE,
    CreatedDate           DATETIME2(3)   NOT NULL CONSTRAINT DF_UserLocations_CreatedDate DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_UserLocations PRIMARY KEY (UserId, LocationId)
);
GO

IF OBJECT_ID('auth.OtpRequests') IS NULL
CREATE TABLE auth.OtpRequests (
    Id                    UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_OtpRequests PRIMARY KEY,
    Destination           NVARCHAR(256)  NOT NULL,
    Purpose               NVARCHAR(30)   NOT NULL CONSTRAINT CK_OtpRequests_Purpose CHECK (Purpose IN (N'LOGIN', N'REGISTER', N'RESET', N'ENQUIRY')),
    CodeHash              NVARCHAR(200)  NOT NULL,
    ExpiresAt             DATETIME2(3)   NOT NULL,
    Attempts              INT            NOT NULL CONSTRAINT DF_OtpRequests_Attempts DEFAULT (0),
    VerifiedAt            DATETIME2(3)   NULL,
    ConsumedAt            DATETIME2(3)   NULL,
    CreatedDate           DATETIME2(3)   NOT NULL CONSTRAINT DF_OtpRequests_CreatedDate DEFAULT (SYSUTCDATETIME())
);
CREATE INDEX IX_OtpRequests_Destination ON auth.OtpRequests (Destination, Purpose, CreatedDate DESC);
GO

/* ------------------------------------------------------------------ crm ------------------------------------------------------------------ */
IF OBJECT_ID('crm.Leads') IS NULL
CREATE TABLE crm.Leads (
    Id                    NVARCHAR(32)   NOT NULL CONSTRAINT PK_Leads PRIMARY KEY,
    Name                  NVARCHAR(150)  NOT NULL,
    Mobile                NVARCHAR(15)   NOT NULL,
    Email                 NVARCHAR(256)  NULL,
    Source                NVARCHAR(20)   NOT NULL CONSTRAINT CK_Leads_Source CHECK (Source IN (N'BOOK_NOW', N'CALLBACK', N'TOUR', N'WEBSITE', N'WALK_IN', N'REFERRAL', N'PARTNER')),
    LocationId            NVARCHAR(32)   NOT NULL CONSTRAINT FK_Leads_Locations REFERENCES workspace.Locations (Id),
    Requirement           NVARCHAR(500)  NOT NULL,
    SpaceType             NVARCHAR(30)   NULL,
    Seats                 INT            NULL,
    PreferredDate         DATE           NULL,
    PreferredTime         NVARCHAR(10)   NULL,
    Visitors              INT            NULL,
    Status                NVARCHAR(20)   NOT NULL CONSTRAINT CK_Leads_Status CHECK (Status IN (N'NEW', N'CONTACTED', N'TOUR_SCHEDULED', N'TOUR_DONE', N'CONVERTED', N'LOST')),
    OwnerId               NVARCHAR(32)   NULL CONSTRAINT FK_Leads_Owner REFERENCES auth.Users (Id),
    FollowUpDate          DATE           NULL,
    MobileVerified        BIT            NOT NULL CONSTRAINT DF_Leads_MobileVerified DEFAULT (0),
    NotesJson             NVARCHAR(MAX)  NOT NULL CONSTRAINT DF_Leads_NotesJson DEFAULT (N'[]'),
    CommentsJson          NVARCHAR(MAX)  NOT NULL CONSTRAINT DF_Leads_CommentsJson DEFAULT (N'[]'),
    ActivitiesJson        NVARCHAR(MAX)  NOT NULL CONSTRAINT DF_Leads_ActivitiesJson DEFAULT (N'[]'),
    LostReason            NVARCHAR(500)  NULL,
    MemberId              NVARCHAR(32)   NULL CONSTRAINT FK_Leads_Members REFERENCES people.Members (Id),
    CreatedBy             NVARCHAR(32)   NULL,
    CreatedDate           DATETIME2(3)   NOT NULL CONSTRAINT DF_Leads_CreatedDate DEFAULT (SYSUTCDATETIME()),
    ModifiedBy            NVARCHAR(32)   NULL,
    ModifiedDate          DATETIME2(3)   NULL
);
CREATE INDEX IX_Leads_LocationId ON crm.Leads (LocationId);
GO

IF OBJECT_ID('FK_Members_Leads') IS NULL
ALTER TABLE people.Members ADD CONSTRAINT FK_Members_Leads FOREIGN KEY (LeadId) REFERENCES crm.Leads (Id);
GO

/* ------------------------------------------------------------------ membership ------------------------------------------------------------------ */
IF OBJECT_ID('membership.Plans') IS NULL
CREATE TABLE membership.Plans (
    Id                    NVARCHAR(32)   NOT NULL CONSTRAINT PK_Plans PRIMARY KEY,
    Name                  NVARCHAR(150)  NOT NULL CONSTRAINT UQ_Plans_Name UNIQUE,
    PlanType              NVARCHAR(20)   NOT NULL CONSTRAINT CK_Plans_Type CHECK (PlanType IN (N'DAY_PASS', N'HOT_DESK', N'DEDICATED_DESK', N'PRIVATE_OFFICE')),
    Price                 DECIMAL(18,2)  NOT NULL CONSTRAINT CK_Plans_Price CHECK (Price >= 0),
    BillingCycle          NVARCHAR(20)   NOT NULL CONSTRAINT CK_Plans_Cycle CHECK (BillingCycle IN (N'DAILY', N'MONTHLY', N'QUARTERLY', N'YEARLY')),
    RoomHours             INT            NOT NULL CONSTRAINT DF_Plans_RoomHours DEFAULT (0),
    GuestPasses           INT            NOT NULL CONSTRAINT DF_Plans_GuestPasses DEFAULT (0),
    Credits               DECIMAL(18,2)  NOT NULL CONSTRAINT DF_Plans_Credits DEFAULT (0),
    SecurityDeposit       DECIMAL(18,2)  NOT NULL CONSTRAINT DF_Plans_SecurityDeposit DEFAULT (0),
    Description           NVARCHAR(2000) NOT NULL CONSTRAINT DF_Plans_Description DEFAULT (N''),
    BenefitsJson          NVARCHAR(MAX)  NOT NULL CONSTRAINT DF_Plans_BenefitsJson DEFAULT (N'[]'),
    AccessHours           NVARCHAR(60)   NOT NULL CONSTRAINT DF_Plans_AccessHours DEFAULT (N''),
    Status                NVARCHAR(20)   NOT NULL CONSTRAINT CK_Plans_Status CHECK (Status IN (N'ACTIVE', N'INACTIVE')),
    IsPopular             BIT            NOT NULL CONSTRAINT DF_Plans_IsPopular DEFAULT (0),
    Subscribers           INT            NOT NULL CONSTRAINT DF_Plans_Subscribers DEFAULT (0),
    CreatedBy             NVARCHAR(32)   NULL,
    CreatedDate           DATETIME2(3)   NOT NULL CONSTRAINT DF_Plans_CreatedDate DEFAULT (SYSUTCDATETIME()),
    ModifiedBy            NVARCHAR(32)   NULL,
    ModifiedDate          DATETIME2(3)   NULL
);
GO

IF OBJECT_ID('membership.Subscriptions') IS NULL
CREATE TABLE membership.Subscriptions (
    Id                    NVARCHAR(32)   NOT NULL CONSTRAINT PK_Subscriptions PRIMARY KEY,
    MemberId              NVARCHAR(32)   NOT NULL CONSTRAINT FK_Subscriptions_Members REFERENCES people.Members (Id),
    PlanId                NVARCHAR(32)   NOT NULL CONSTRAINT FK_Subscriptions_Plans REFERENCES membership.Plans (Id),
    LocationId            NVARCHAR(32)   NOT NULL CONSTRAINT FK_Subscriptions_Locations REFERENCES workspace.Locations (Id),
    Status                NVARCHAR(20)   NOT NULL CONSTRAINT CK_Subscriptions_Status CHECK (Status IN (N'ACTIVE', N'PAUSED', N'CANCELLED', N'EXPIRED', N'OVERDUE', N'SUSPENDED', N'PENDING_PAYMENT')),
    StartDate             DATE           NOT NULL,
    EndDate               DATE           NOT NULL,
    BillingCycle          NVARCHAR(20)   NOT NULL CONSTRAINT CK_Subscriptions_Cycle CHECK (BillingCycle IN (N'DAILY', N'MONTHLY', N'QUARTERLY', N'YEARLY')),
    Price                 DECIMAL(18,2)  NOT NULL,
    RoomHoursTotal        DECIMAL(8,2)   NOT NULL CONSTRAINT DF_Subscriptions_RoomHoursTotal DEFAULT (0),
    RoomHoursUsed         DECIMAL(8,2)   NOT NULL CONSTRAINT DF_Subscriptions_RoomHoursUsed DEFAULT (0),
    GuestPassesTotal      INT            NOT NULL CONSTRAINT DF_Subscriptions_GuestPassesTotal DEFAULT (0),
    GuestPassesUsed       INT            NOT NULL CONSTRAINT DF_Subscriptions_GuestPassesUsed DEFAULT (0),
    CreditsTotal          DECIMAL(18,2)  NOT NULL CONSTRAINT DF_Subscriptions_CreditsTotal DEFAULT (0),
    CreditsUsed           DECIMAL(18,2)  NOT NULL CONSTRAINT DF_Subscriptions_CreditsUsed DEFAULT (0),
    SecurityDeposit       DECIMAL(18,2)  NOT NULL CONSTRAINT DF_Subscriptions_SecurityDeposit DEFAULT (0),
    AutoRenew             BIT            NOT NULL CONSTRAINT DF_Subscriptions_AutoRenew DEFAULT (1),
    PaymentRetries        INT            NOT NULL CONSTRAINT DF_Subscriptions_PaymentRetries DEFAULT (0),
    GraceUntil            DATE           NULL,
    PausedUntil           DATE           NULL,
    CancelAt              DATE           NULL,
    CancelReason          NVARCHAR(500)  NULL,
    ScheduledPlanId       NVARCHAR(32)   NULL CONSTRAINT FK_Subscriptions_ScheduledPlan REFERENCES membership.Plans (Id),
    ScheduledEffective    DATE           NULL,
    CreatedBy             NVARCHAR(32)   NULL,
    CreatedDate           DATETIME2(3)   NOT NULL CONSTRAINT DF_Subscriptions_CreatedDate DEFAULT (SYSUTCDATETIME()),
    ModifiedBy            NVARCHAR(32)   NULL,
    ModifiedDate          DATETIME2(3)   NULL,
    CONSTRAINT CK_Subscriptions_Dates CHECK (EndDate >= StartDate)
);
CREATE INDEX IX_Subscriptions_MemberId ON membership.Subscriptions (MemberId);
CREATE INDEX IX_Subscriptions_LocationId ON membership.Subscriptions (LocationId);
GO

IF OBJECT_ID('membership.CreditTransactions') IS NULL
CREATE TABLE membership.CreditTransactions (
    Id                    NVARCHAR(32)   NOT NULL CONSTRAINT PK_CreditTransactions PRIMARY KEY,
    MemberId              NVARCHAR(32)   NOT NULL CONSTRAINT FK_CreditTransactions_Members REFERENCES people.Members (Id),
    TransactionDate       DATETIME2(3)   NOT NULL,
    TransactionType       NVARCHAR(20)   NOT NULL CONSTRAINT CK_CreditTransactions_Type CHECK (TransactionType IN (N'ALLOCATED', N'USED', N'REFUNDED', N'ADJUSTED', N'EXPIRED')),
    Amount                DECIMAL(18,2)  NOT NULL,
    Reference             NVARCHAR(100)  NOT NULL CONSTRAINT DF_CreditTransactions_Reference DEFAULT (N''),
    Note                  NVARCHAR(500)  NOT NULL CONSTRAINT DF_CreditTransactions_Note DEFAULT (N''),
    CreatedBy             NVARCHAR(32)   NULL,
    CreatedDate           DATETIME2(3)   NOT NULL CONSTRAINT DF_CreditTransactions_CreatedDate DEFAULT (SYSUTCDATETIME()),
    ModifiedBy            NVARCHAR(32)   NULL,
    ModifiedDate          DATETIME2(3)   NULL
);
CREATE INDEX IX_CreditTransactions_MemberId ON membership.CreditTransactions (MemberId);
GO

IF OBJECT_ID('membership.Promotions') IS NULL
CREATE TABLE membership.Promotions (
    Id                    NVARCHAR(32)   NOT NULL CONSTRAINT PK_Promotions PRIMARY KEY,
    Code                  NVARCHAR(30)   NOT NULL CONSTRAINT UQ_Promotions_Code UNIQUE,
    Description           NVARCHAR(500)  NOT NULL CONSTRAINT DF_Promotions_Description DEFAULT (N''),
    DiscountType          NVARCHAR(10)   NOT NULL CONSTRAINT CK_Promotions_DiscountType CHECK (DiscountType IN (N'PERCENT', N'FLAT')),
    Discount              DECIMAL(18,2)  NOT NULL CONSTRAINT CK_Promotions_Discount CHECK (Discount >= 0),
    Expiry                DATE           NOT NULL,
    UsageLimit            INT            NOT NULL,
    Used                  INT            NOT NULL CONSTRAINT DF_Promotions_Used DEFAULT (0),
    Status                NVARCHAR(20)   NOT NULL CONSTRAINT CK_Promotions_Status CHECK (Status IN (N'ACTIVE', N'INACTIVE', N'EXPIRED')),
    AppliesTo             NVARCHAR(20)   NOT NULL CONSTRAINT CK_Promotions_AppliesTo CHECK (AppliesTo IN (N'ALL', N'PLANS', N'BOOKINGS')),
    CreatedBy             NVARCHAR(32)   NULL,
    CreatedDate           DATETIME2(3)   NOT NULL CONSTRAINT DF_Promotions_CreatedDate DEFAULT (SYSUTCDATETIME()),
    ModifiedBy            NVARCHAR(32)   NULL,
    ModifiedDate          DATETIME2(3)   NULL
);
GO

/* ------------------------------------------------------------------ booking / finance ------------------------------------------------------------------ */
IF OBJECT_ID('booking.Bookings') IS NULL
CREATE TABLE booking.Bookings (
    Id                    NVARCHAR(32)   NOT NULL CONSTRAINT PK_Bookings PRIMARY KEY,
    MemberId              NVARCHAR(32)   NOT NULL CONSTRAINT FK_Bookings_Members REFERENCES people.Members (Id),
    CompanyId             NVARCHAR(32)   NULL CONSTRAINT FK_Bookings_Companies REFERENCES people.Companies (Id),
    LocationId            NVARCHAR(32)   NOT NULL CONSTRAINT FK_Bookings_Locations REFERENCES workspace.Locations (Id),
    ResourceId            NVARCHAR(32)   NOT NULL CONSTRAINT FK_Bookings_Resources REFERENCES workspace.Resources (Id),
    BookingDate           DATE           NOT NULL,
    StartTime             TIME(0)        NOT NULL,
    EndTime               TIME(0)        NOT NULL,
    Seats                 INT            NOT NULL CONSTRAINT CK_Bookings_Seats CHECK (Seats > 0),
    Amount                DECIMAL(18,2)  NOT NULL CONSTRAINT DF_Bookings_Amount DEFAULT (0),
    CreditsUsed           DECIMAL(18,2)  NOT NULL CONSTRAINT DF_Bookings_CreditsUsed DEFAULT (0),
    BalanceDue            DECIMAL(18,2)  NOT NULL CONSTRAINT DF_Bookings_BalanceDue DEFAULT (0),
    Status                NVARCHAR(20)   NOT NULL CONSTRAINT CK_Bookings_Status CHECK (Status IN (N'CONFIRMED', N'PENDING', N'COMPLETED', N'CANCELLED', N'EXPIRED')),
    PaymentStatus         NVARCHAR(20)   NOT NULL CONSTRAINT CK_Bookings_PaymentStatus CHECK (PaymentStatus IN (N'PAID', N'PENDING', N'FAILED', N'REFUNDED', N'NOT_REQUIRED')),
    PaymentMethod         NVARCHAR(20)   NULL CONSTRAINT CK_Bookings_PaymentMethod CHECK (PaymentMethod IN (N'UPI', N'CARD', N'NET_BANKING', N'CREDITS')),
    PaymentId             NVARCHAR(32)   NULL,
    Notes                 NVARCHAR(1000) NULL,
    CancelledAt           DATETIME2(3)   NULL,
    CancelReason          NVARCHAR(500)  NULL,
    CreatedBy             NVARCHAR(32)   NULL,
    CreatedDate           DATETIME2(3)   NOT NULL CONSTRAINT DF_Bookings_CreatedDate DEFAULT (SYSUTCDATETIME()),
    ModifiedBy            NVARCHAR(32)   NULL,
    ModifiedDate          DATETIME2(3)   NULL,
    CONSTRAINT CK_Bookings_Times CHECK (EndTime > StartTime)
);
CREATE INDEX IX_Bookings_Resource_Date ON booking.Bookings (ResourceId, BookingDate);
CREATE INDEX IX_Bookings_MemberId ON booking.Bookings (MemberId);
CREATE INDEX IX_Bookings_LocationId ON booking.Bookings (LocationId, BookingDate);
GO

IF OBJECT_ID('finance.Invoices') IS NULL
CREATE TABLE finance.Invoices (
    Id                    NVARCHAR(32)   NOT NULL CONSTRAINT PK_Invoices PRIMARY KEY,
    InvoiceNumber         NVARCHAR(40)   NOT NULL CONSTRAINT UQ_Invoices_Number UNIQUE,
    InvoiceDate           DATE           NOT NULL,
    DueDate               DATE           NOT NULL,
    MemberId              NVARCHAR(32)   NOT NULL CONSTRAINT FK_Invoices_Members REFERENCES people.Members (Id),
    LocationId            NVARCHAR(32)   NOT NULL CONSTRAINT FK_Invoices_Locations REFERENCES workspace.Locations (Id),
    CustomerName          NVARCHAR(200)  NOT NULL,
    CompanyName           NVARCHAR(200)  NULL,
    CustomerGstin         NVARCHAR(15)   NULL,
    BillingAddress        NVARCHAR(600)  NOT NULL CONSTRAINT DF_Invoices_BillingAddress DEFAULT (N''),
    PlaceOfSupply         NVARCHAR(100)  NOT NULL CONSTRAINT DF_Invoices_PlaceOfSupply DEFAULT (N''),
    IntraState            BIT            NOT NULL,
    Subtotal              DECIMAL(18,2)  NOT NULL,
    Cgst                  DECIMAL(18,2)  NOT NULL CONSTRAINT DF_Invoices_Cgst DEFAULT (0),
    Sgst                  DECIMAL(18,2)  NOT NULL CONSTRAINT DF_Invoices_Sgst DEFAULT (0),
    Igst                  DECIMAL(18,2)  NOT NULL CONSTRAINT DF_Invoices_Igst DEFAULT (0),
    Tax                   DECIMAL(18,2)  NOT NULL,
    Total                 DECIMAL(18,2)  NOT NULL,
    AmountPaid            DECIMAL(18,2)  NOT NULL CONSTRAINT DF_Invoices_AmountPaid DEFAULT (0),
    Status                NVARCHAR(20)   NOT NULL CONSTRAINT CK_Invoices_Status CHECK (Status IN (N'PAID', N'UNPAID', N'OVERDUE', N'CANCELLED', N'PARTIALLY_PAID')),
    PaymentId             NVARCHAR(32)   NULL,
    EmailedAt             DATETIME2(3)   NULL,
    CreatedBy             NVARCHAR(32)   NULL,
    CreatedDate           DATETIME2(3)   NOT NULL CONSTRAINT DF_Invoices_CreatedDate DEFAULT (SYSUTCDATETIME()),
    ModifiedBy            NVARCHAR(32)   NULL,
    ModifiedDate          DATETIME2(3)   NULL
);
CREATE INDEX IX_Invoices_MemberId ON finance.Invoices (MemberId);
CREATE INDEX IX_Invoices_LocationId ON finance.Invoices (LocationId);
GO

IF OBJECT_ID('finance.InvoiceLines') IS NULL
CREATE TABLE finance.InvoiceLines (
    Id                    INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_InvoiceLines PRIMARY KEY,
    InvoiceId             NVARCHAR(32)   NOT NULL CONSTRAINT FK_InvoiceLines_Invoices REFERENCES finance.Invoices (Id) ON DELETE CASCADE,
    LineNumber            INT            NOT NULL,
    Description           NVARCHAR(500)  NOT NULL,
    Sac                   NVARCHAR(10)   NOT NULL CONSTRAINT DF_InvoiceLines_Sac DEFAULT (N''),
    Qty                   DECIMAL(18,2)  NOT NULL,
    Rate                  DECIMAL(18,2)  NOT NULL,
    Amount                DECIMAL(18,2)  NOT NULL,
    CONSTRAINT UQ_InvoiceLines_Invoice_Line UNIQUE (InvoiceId, LineNumber)
);
GO

IF OBJECT_ID('finance.Payments') IS NULL
CREATE TABLE finance.Payments (
    Id                    NVARCHAR(32)   NOT NULL CONSTRAINT PK_Payments PRIMARY KEY,
    MemberId              NVARCHAR(32)   NOT NULL CONSTRAINT FK_Payments_Members REFERENCES people.Members (Id),
    LocationId            NVARCHAR(32)   NOT NULL CONSTRAINT FK_Payments_Locations REFERENCES workspace.Locations (Id),
    PaymentDate           DATETIME2(3)   NOT NULL,
    PaymentType           NVARCHAR(20)   NOT NULL CONSTRAINT CK_Payments_Type CHECK (PaymentType IN (N'SUBSCRIPTION', N'BOOKING', N'DEPOSIT', N'DAY_PASS', N'RENEWAL')),
    Description           NVARCHAR(500)  NOT NULL,
    Amount                DECIMAL(18,2)  NOT NULL CONSTRAINT CK_Payments_Amount CHECK (Amount >= 0),
    Method                NVARCHAR(20)   NOT NULL CONSTRAINT CK_Payments_Method CHECK (Method IN (N'UPI', N'CARD', N'NET_BANKING', N'CREDITS')),
    Status                NVARCHAR(20)   NOT NULL CONSTRAINT CK_Payments_Status CHECK (Status IN (N'SUCCESS', N'PENDING', N'FAILED', N'REFUNDED')),
    GatewayRef            NVARCHAR(100)  NOT NULL CONSTRAINT DF_Payments_GatewayRef DEFAULT (N''),
    InvoiceId             NVARCHAR(32)   NULL CONSTRAINT FK_Payments_Invoices REFERENCES finance.Invoices (Id),
    BookingId             NVARCHAR(32)   NULL CONSTRAINT FK_Payments_Bookings REFERENCES booking.Bookings (Id),
    SubscriptionId        NVARCHAR(32)   NULL CONSTRAINT FK_Payments_Subscriptions REFERENCES membership.Subscriptions (Id),
    RetryCount            INT            NOT NULL CONSTRAINT DF_Payments_RetryCount DEFAULT (0),
    FailureReason         NVARCHAR(500)  NULL,
    CreatedBy             NVARCHAR(32)   NULL,
    CreatedDate           DATETIME2(3)   NOT NULL CONSTRAINT DF_Payments_CreatedDate DEFAULT (SYSUTCDATETIME()),
    ModifiedBy            NVARCHAR(32)   NULL,
    ModifiedDate          DATETIME2(3)   NULL
);
CREATE INDEX IX_Payments_MemberId ON finance.Payments (MemberId);
CREATE INDEX IX_Payments_LocationId ON finance.Payments (LocationId, PaymentDate);
GO

IF OBJECT_ID('FK_Bookings_Payments') IS NULL
ALTER TABLE booking.Bookings ADD CONSTRAINT FK_Bookings_Payments FOREIGN KEY (PaymentId) REFERENCES finance.Payments (Id);
IF OBJECT_ID('FK_Invoices_Payments') IS NULL
ALTER TABLE finance.Invoices ADD CONSTRAINT FK_Invoices_Payments FOREIGN KEY (PaymentId) REFERENCES finance.Payments (Id);
GO

IF OBJECT_ID('finance.Refunds') IS NULL
CREATE TABLE finance.Refunds (
    Id                    NVARCHAR(32)   NOT NULL CONSTRAINT PK_Refunds PRIMARY KEY,
    PaymentId             NVARCHAR(32)   NOT NULL CONSTRAINT FK_Refunds_Payments REFERENCES finance.Payments (Id),
    MemberId              NVARCHAR(32)   NOT NULL CONSTRAINT FK_Refunds_Members REFERENCES people.Members (Id),
    LocationId            NVARCHAR(32)   NOT NULL CONSTRAINT FK_Refunds_Locations REFERENCES workspace.Locations (Id),
    Amount                DECIMAL(18,2)  NOT NULL CONSTRAINT CK_Refunds_Amount CHECK (Amount >= 0),
    Reason                NVARCHAR(1000) NOT NULL,
    Status                NVARCHAR(20)   NOT NULL CONSTRAINT CK_Refunds_Status CHECK (Status IN (N'REQUESTED', N'APPROVED', N'PROCESSED', N'REJECTED')),
    RequestedAt           DATETIME2(3)   NOT NULL,
    ProcessedAt           DATETIME2(3)   NULL,
    CreatedBy             NVARCHAR(32)   NULL,
    CreatedDate           DATETIME2(3)   NOT NULL CONSTRAINT DF_Refunds_CreatedDate DEFAULT (SYSUTCDATETIME()),
    ModifiedBy            NVARCHAR(32)   NULL,
    ModifiedDate          DATETIME2(3)   NULL
);
GO

IF OBJECT_ID('finance.CreditNotes') IS NULL
CREATE TABLE finance.CreditNotes (
    Id                    NVARCHAR(32)   NOT NULL CONSTRAINT PK_CreditNotes PRIMARY KEY,
    NoteNumber            NVARCHAR(40)   NOT NULL CONSTRAINT UQ_CreditNotes_Number UNIQUE,
    InvoiceId             NVARCHAR(32)   NOT NULL CONSTRAINT FK_CreditNotes_Invoices REFERENCES finance.Invoices (Id),
    MemberId              NVARCHAR(32)   NOT NULL CONSTRAINT FK_CreditNotes_Members REFERENCES people.Members (Id),
    LocationId            NVARCHAR(32)   NOT NULL CONSTRAINT FK_CreditNotes_Locations REFERENCES workspace.Locations (Id),
    Amount                DECIMAL(18,2)  NOT NULL CONSTRAINT CK_CreditNotes_Amount CHECK (Amount >= 0),
    Reason                NVARCHAR(1000) NOT NULL,
    NoteDate              DATE           NOT NULL,
    Status                NVARCHAR(20)   NOT NULL CONSTRAINT CK_CreditNotes_Status CHECK (Status IN (N'ISSUED', N'APPLIED', N'VOID')),
    CreatedBy             NVARCHAR(32)   NULL,
    CreatedDate           DATETIME2(3)   NOT NULL CONSTRAINT DF_CreditNotes_CreatedDate DEFAULT (SYSUTCDATETIME()),
    ModifiedBy            NVARCHAR(32)   NULL,
    ModifiedDate          DATETIME2(3)   NULL
);
GO

/* ------------------------------------------------------------------ operations ------------------------------------------------------------------ */
IF OBJECT_ID('operations.Visitors') IS NULL
CREATE TABLE operations.Visitors (
    Id                    NVARCHAR(32)   NOT NULL CONSTRAINT PK_Visitors PRIMARY KEY,
    Name                  NVARCHAR(150)  NOT NULL,
    Mobile                NVARCHAR(15)   NOT NULL,
    Email                 NVARCHAR(256)  NOT NULL CONSTRAINT DF_Visitors_Email DEFAULT (N''),
    Company               NVARCHAR(200)  NULL,
    HostMemberId          NVARCHAR(32)   NOT NULL CONSTRAINT FK_Visitors_Members REFERENCES people.Members (Id),
    LocationId            NVARCHAR(32)   NOT NULL CONSTRAINT FK_Visitors_Locations REFERENCES workspace.Locations (Id),
    VisitDate             DATE           NOT NULL,
    VisitTime             TIME(0)        NOT NULL,
    Purpose               NVARCHAR(200)  NOT NULL,
    Status                NVARCHAR(20)   NOT NULL CONSTRAINT CK_Visitors_Status CHECK (Status IN (N'EXPECTED', N'CHECKED_IN', N'CHECKED_OUT', N'EXPIRED', N'CANCELLED')),
    PassCode              NVARCHAR(20)   NOT NULL CONSTRAINT DF_Visitors_PassCode DEFAULT (N''),
    PhotoCaptured         BIT            NOT NULL CONSTRAINT DF_Visitors_PhotoCaptured DEFAULT (0),
    HostNotified          BIT            NOT NULL CONSTRAINT DF_Visitors_HostNotified DEFAULT (0),
    CheckInAt             DATETIME2(3)   NULL,
    CheckOutAt            DATETIME2(3)   NULL,
    NotifiedViaJson       NVARCHAR(200)  NOT NULL CONSTRAINT DF_Visitors_NotifiedViaJson DEFAULT (N'[]'),
    CreatedBy             NVARCHAR(32)   NULL,
    CreatedDate           DATETIME2(3)   NOT NULL CONSTRAINT DF_Visitors_CreatedDate DEFAULT (SYSUTCDATETIME()),
    ModifiedBy            NVARCHAR(32)   NULL,
    ModifiedDate          DATETIME2(3)   NULL
);
CREATE UNIQUE INDEX UX_Visitors_PassCode ON operations.Visitors (PassCode) WHERE PassCode <> N'';
CREATE INDEX IX_Visitors_Location_Date ON operations.Visitors (LocationId, VisitDate);
GO

IF OBJECT_ID('operations.AccessCredentials') IS NULL
CREATE TABLE operations.AccessCredentials (
    Id                    NVARCHAR(32)   NOT NULL CONSTRAINT PK_AccessCredentials PRIMARY KEY,
    HolderId              NVARCHAR(32)   NOT NULL,
    HolderName            NVARCHAR(150)  NOT NULL,
    HolderType            NVARCHAR(20)   NOT NULL CONSTRAINT CK_AccessCredentials_HolderType CHECK (HolderType IN (N'MEMBER', N'VISITOR', N'STAFF')),
    LocationId            NVARCHAR(32)   NOT NULL CONSTRAINT FK_AccessCredentials_Locations REFERENCES workspace.Locations (Id),
    Code                  NVARCHAR(40)   NOT NULL CONSTRAINT UQ_AccessCredentials_Code UNIQUE,
    Status                NVARCHAR(20)   NOT NULL CONSTRAINT CK_AccessCredentials_Status CHECK (Status IN (N'ACTIVE', N'REVOKED', N'EXPIRED')),
    IssuedAt              DATETIME2(3)   NOT NULL,
    ValidUntil            DATE           NOT NULL,
    AccessHours           NVARCHAR(60)   NOT NULL,
    RevokedReason         NVARCHAR(500)  NULL,
    CreatedBy             NVARCHAR(32)   NULL,
    CreatedDate           DATETIME2(3)   NOT NULL CONSTRAINT DF_AccessCredentials_CreatedDate DEFAULT (SYSUTCDATETIME()),
    ModifiedBy            NVARCHAR(32)   NULL,
    ModifiedDate          DATETIME2(3)   NULL
);
CREATE INDEX IX_AccessCredentials_HolderId ON operations.AccessCredentials (HolderId);
GO

IF OBJECT_ID('operations.AccessLogs') IS NULL
CREATE TABLE operations.AccessLogs (
    Id                    NVARCHAR(32)   NOT NULL CONSTRAINT PK_AccessLogs PRIMARY KEY,
    Person                NVARCHAR(150)  NOT NULL,
    PersonType            NVARCHAR(20)   NOT NULL CONSTRAINT CK_AccessLogs_PersonType CHECK (PersonType IN (N'MEMBER', N'VISITOR', N'STAFF')),
    PersonId              NVARCHAR(32)   NOT NULL,
    LocationId            NVARCHAR(32)   NOT NULL CONSTRAINT FK_AccessLogs_Locations REFERENCES workspace.Locations (Id),
    Door                  NVARCHAR(100)  NOT NULL,
    LoggedAt              DATETIME2(3)   NOT NULL,
    Direction             NVARCHAR(3)    NOT NULL CONSTRAINT CK_AccessLogs_Direction CHECK (Direction IN (N'IN', N'OUT')),
    Status                NVARCHAR(10)   NOT NULL CONSTRAINT CK_AccessLogs_Status CHECK (Status IN (N'GRANTED', N'DENIED')),
    Reason                NVARCHAR(500)  NULL,
    CreatedBy             NVARCHAR(32)   NULL,
    CreatedDate           DATETIME2(3)   NOT NULL CONSTRAINT DF_AccessLogs_CreatedDate DEFAULT (SYSUTCDATETIME()),
    ModifiedBy            NVARCHAR(32)   NULL,
    ModifiedDate          DATETIME2(3)   NULL
);
CREATE INDEX IX_AccessLogs_Location_LoggedAt ON operations.AccessLogs (LocationId, LoggedAt DESC);
GO

IF OBJECT_ID('operations.Tickets') IS NULL
CREATE TABLE operations.Tickets (
    Id                    NVARCHAR(32)   NOT NULL CONSTRAINT PK_Tickets PRIMARY KEY,
    MemberId              NVARCHAR(32)   NOT NULL CONSTRAINT FK_Tickets_Members REFERENCES people.Members (Id),
    LocationId            NVARCHAR(32)   NOT NULL CONSTRAINT FK_Tickets_Locations REFERENCES workspace.Locations (Id),
    Category              NVARCHAR(100)  NOT NULL,
    Subject               NVARCHAR(200)  NOT NULL,
    Description           NVARCHAR(4000) NOT NULL,
    Priority              NVARCHAR(10)   NOT NULL CONSTRAINT CK_Tickets_Priority CHECK (Priority IN (N'LOW', N'MEDIUM', N'HIGH', N'URGENT')),
    Status                NVARCHAR(20)   NOT NULL CONSTRAINT CK_Tickets_Status CHECK (Status IN (N'OPEN', N'IN_PROGRESS', N'RESOLVED')),
    AssignedTo            NVARCHAR(32)   NULL CONSTRAINT FK_Tickets_AssignedTo REFERENCES auth.Users (Id),
    ResolvedAt            DATETIME2(3)   NULL,
    Escalated             BIT            NOT NULL CONSTRAINT DF_Tickets_Escalated DEFAULT (0),
    EscalatedTo           NVARCHAR(100)  NULL,
    AttachmentsJson       NVARCHAR(MAX)  NOT NULL CONSTRAINT DF_Tickets_AttachmentsJson DEFAULT (N'[]'),
    CommentsJson          NVARCHAR(MAX)  NOT NULL CONSTRAINT DF_Tickets_CommentsJson DEFAULT (N'[]'),
    TimelineJson          NVARCHAR(MAX)  NOT NULL CONSTRAINT DF_Tickets_TimelineJson DEFAULT (N'[]'),
    CreatedBy             NVARCHAR(32)   NULL,
    CreatedDate           DATETIME2(3)   NOT NULL CONSTRAINT DF_Tickets_CreatedDate DEFAULT (SYSUTCDATETIME()),
    ModifiedBy            NVARCHAR(32)   NULL,
    ModifiedDate          DATETIME2(3)   NULL
);
CREATE INDEX IX_Tickets_MemberId ON operations.Tickets (MemberId);
CREATE INDEX IX_Tickets_LocationId ON operations.Tickets (LocationId, Status);
GO

/* ------------------------------------------------------------------ notify ------------------------------------------------------------------ */
IF OBJECT_ID('notify.Notifications') IS NULL
CREATE TABLE notify.Notifications (
    Id                    NVARCHAR(32)   NOT NULL CONSTRAINT PK_Notifications PRIMARY KEY,
    Audience              NVARCHAR(10)   NOT NULL CONSTRAINT CK_Notifications_Audience CHECK (Audience IN (N'MEMBER', N'STAFF')),
    UserId                NVARCHAR(32)   NULL CONSTRAINT FK_Notifications_Users REFERENCES auth.Users (Id),
    Category              NVARCHAR(20)   NOT NULL CONSTRAINT CK_Notifications_Category CHECK (Category IN (N'BOOKING', N'PAYMENT', N'MEMBERSHIP', N'VISITOR', N'SUPPORT', N'SYSTEM')),
    Title                 NVARCHAR(200)  NOT NULL,
    Message               NVARCHAR(2000) NOT NULL,
    NotifiedAt            DATETIME2(3)   NOT NULL,
    IsRead                BIT            NOT NULL CONSTRAINT DF_Notifications_IsRead DEFAULT (0),
    Link                  NVARCHAR(300)  NULL,
    CreatedBy             NVARCHAR(32)   NULL,
    CreatedDate           DATETIME2(3)   NOT NULL CONSTRAINT DF_Notifications_CreatedDate DEFAULT (SYSUTCDATETIME()),
    ModifiedBy            NVARCHAR(32)   NULL,
    ModifiedDate          DATETIME2(3)   NULL
);
CREATE INDEX IX_Notifications_Audience_User ON notify.Notifications (Audience, UserId, NotifiedAt DESC);
GO

IF OBJECT_ID('notify.NotificationTemplates') IS NULL
CREATE TABLE notify.NotificationTemplates (
    Id                    NVARCHAR(32)   NOT NULL CONSTRAINT PK_NotificationTemplates PRIMARY KEY,
    Name                  NVARCHAR(150)  NOT NULL CONSTRAINT UQ_NotificationTemplates_Name UNIQUE,
    EventName             NVARCHAR(100)  NOT NULL,
    Channel               NVARCHAR(10)   NOT NULL CONSTRAINT CK_NotificationTemplates_Channel CHECK (Channel IN (N'EMAIL', N'SMS', N'PUSH')),
    Subject               NVARCHAR(300)  NOT NULL CONSTRAINT DF_NotificationTemplates_Subject DEFAULT (N''),
    Message               NVARCHAR(4000) NOT NULL,
    Status                NVARCHAR(20)   NOT NULL CONSTRAINT CK_NotificationTemplates_Status CHECK (Status IN (N'ACTIVE', N'INACTIVE')),
    CreatedBy             NVARCHAR(32)   NULL,
    CreatedDate           DATETIME2(3)   NOT NULL CONSTRAINT DF_NotificationTemplates_CreatedDate DEFAULT (SYSUTCDATETIME()),
    ModifiedBy            NVARCHAR(32)   NULL,
    ModifiedDate          DATETIME2(3)   NULL
);
GO

IF OBJECT_ID('notify.NotificationLogs') IS NULL
CREATE TABLE notify.NotificationLogs (
    Id                    NVARCHAR(32)   NOT NULL CONSTRAINT PK_NotificationLogs PRIMARY KEY,
    EventName             NVARCHAR(100)  NOT NULL,
    TemplateName          NVARCHAR(150)  NOT NULL,
    Channel               NVARCHAR(10)   NOT NULL CONSTRAINT CK_NotificationLogs_Channel CHECK (Channel IN (N'EMAIL', N'SMS', N'PUSH')),
    Recipient             NVARCHAR(256)  NOT NULL,
    LoggedAt              DATETIME2(3)   NOT NULL,
    Status                NVARCHAR(20)   NOT NULL CONSTRAINT CK_NotificationLogs_Status CHECK (Status IN (N'DELIVERED', N'FAILED', N'QUEUED')),
    Provider              NVARCHAR(150)  NULL,
    LocationId            NVARCHAR(32)   NULL CONSTRAINT FK_NotificationLogs_Locations REFERENCES workspace.Locations (Id),
    CreatedBy             NVARCHAR(32)   NULL,
    CreatedDate           DATETIME2(3)   NOT NULL CONSTRAINT DF_NotificationLogs_CreatedDate DEFAULT (SYSUTCDATETIME()),
    ModifiedBy            NVARCHAR(32)   NULL,
    ModifiedDate          DATETIME2(3)   NULL
);
CREATE INDEX IX_NotificationLogs_LoggedAt ON notify.NotificationLogs (LoggedAt DESC);
GO

/* ------------------------------------------------------------------ community ------------------------------------------------------------------ */
IF OBJECT_ID('community.Posts') IS NULL
CREATE TABLE community.Posts (
    Id                    NVARCHAR(32)   NOT NULL CONSTRAINT PK_Posts PRIMARY KEY,
    AuthorName            NVARCHAR(150)  NOT NULL,
    AuthorRole            NVARCHAR(100)  NOT NULL CONSTRAINT DF_Posts_AuthorRole DEFAULT (N''),
    AuthorMemberId        NVARCHAR(32)   NULL CONSTRAINT FK_Posts_Members REFERENCES people.Members (Id),
    PostType              NVARCHAR(20)   NOT NULL CONSTRAINT CK_Posts_Type CHECK (PostType IN (N'POST', N'ANNOUNCEMENT')),
    Content               NVARCHAR(4000) NOT NULL,
    PostedAt              DATETIME2(3)   NOT NULL,
    Likes                 INT            NOT NULL CONSTRAINT DF_Posts_Likes DEFAULT (0),
    LikedByJson           NVARCHAR(MAX)  NOT NULL CONSTRAINT DF_Posts_LikedByJson DEFAULT (N'[]'),
    CommentsJson          NVARCHAR(MAX)  NOT NULL CONSTRAINT DF_Posts_CommentsJson DEFAULT (N'[]'),
    LocationId            NVARCHAR(32)   NULL CONSTRAINT FK_Posts_Locations REFERENCES workspace.Locations (Id),
    Status                NVARCHAR(20)   NOT NULL CONSTRAINT CK_Posts_Status CHECK (Status IN (N'PUBLISHED', N'HIDDEN')),
    IsPinned              BIT            NOT NULL CONSTRAINT DF_Posts_IsPinned DEFAULT (0),
    CreatedBy             NVARCHAR(32)   NULL,
    CreatedDate           DATETIME2(3)   NOT NULL CONSTRAINT DF_Posts_CreatedDate DEFAULT (SYSUTCDATETIME()),
    ModifiedBy            NVARCHAR(32)   NULL,
    ModifiedDate          DATETIME2(3)   NULL
);
GO

IF OBJECT_ID('community.Events') IS NULL
CREATE TABLE community.Events (
    Id                    NVARCHAR(32)   NOT NULL CONSTRAINT PK_Events PRIMARY KEY,
    Title                 NVARCHAR(200)  NOT NULL,
    Category              NVARCHAR(100)  NOT NULL,
    EventDate             DATE           NOT NULL,
    StartTime             TIME(0)        NOT NULL,
    EndTime               TIME(0)        NOT NULL,
    LocationId            NVARCHAR(32)   NOT NULL CONSTRAINT FK_Events_Locations REFERENCES workspace.Locations (Id),
    Venue                 NVARCHAR(200)  NOT NULL CONSTRAINT DF_Events_Venue DEFAULT (N''),
    Description           NVARCHAR(4000) NOT NULL CONSTRAINT DF_Events_Description DEFAULT (N''),
    Capacity              INT            NOT NULL CONSTRAINT CK_Events_Capacity CHECK (Capacity > 0),
    AttendeesJson         NVARCHAR(MAX)  NOT NULL CONSTRAINT DF_Events_AttendeesJson DEFAULT (N'[]'),
    IsPublic              BIT            NOT NULL CONSTRAINT DF_Events_IsPublic DEFAULT (0),
    Status                NVARCHAR(20)   NOT NULL CONSTRAINT CK_Events_Status CHECK (Status IN (N'PUBLISHED', N'DRAFT', N'CANCELLED')),
    Host                  NVARCHAR(150)  NOT NULL CONSTRAINT DF_Events_Host DEFAULT (N''),
    ImageSeed             NVARCHAR(500)  NOT NULL CONSTRAINT DF_Events_ImageSeed DEFAULT (N'61'),
    CreatedBy             NVARCHAR(32)   NULL,
    CreatedDate           DATETIME2(3)   NOT NULL CONSTRAINT DF_Events_CreatedDate DEFAULT (SYSUTCDATETIME()),
    ModifiedBy            NVARCHAR(32)   NULL,
    ModifiedDate          DATETIME2(3)   NULL,
    CONSTRAINT CK_Events_Times CHECK (EndTime > StartTime)
);
GO

IF OBJECT_ID('community.Perks') IS NULL
CREATE TABLE community.Perks (
    Id                    NVARCHAR(32)   NOT NULL CONSTRAINT PK_Perks PRIMARY KEY,
    Partner               NVARCHAR(150)  NOT NULL,
    Category              NVARCHAR(100)  NOT NULL,
    Offer                 NVARCHAR(200)  NOT NULL,
    Description           NVARCHAR(2000) NOT NULL CONSTRAINT DF_Perks_Description DEFAULT (N''),
    Discount              NVARCHAR(50)   NOT NULL CONSTRAINT DF_Perks_Discount DEFAULT (N''),
    Code                  NVARCHAR(50)   NOT NULL CONSTRAINT DF_Perks_Code DEFAULT (N''),
    Expiry                DATE           NOT NULL,
    Terms                 NVARCHAR(2000) NOT NULL CONSTRAINT DF_Perks_Terms DEFAULT (N''),
    Status                NVARCHAR(20)   NOT NULL CONSTRAINT CK_Perks_Status CHECK (Status IN (N'ACTIVE', N'INACTIVE')),
    Redemptions           INT            NOT NULL CONSTRAINT DF_Perks_Redemptions DEFAULT (0),
    CreatedBy             NVARCHAR(32)   NULL,
    CreatedDate           DATETIME2(3)   NOT NULL CONSTRAINT DF_Perks_CreatedDate DEFAULT (SYSUTCDATETIME()),
    ModifiedBy            NVARCHAR(32)   NULL,
    ModifiedDate          DATETIME2(3)   NULL
);
GO

/* ------------------------------------------------------------------ content ------------------------------------------------------------------ */
IF OBJECT_ID('content.BlogPosts') IS NULL
CREATE TABLE content.BlogPosts (
    Id                    NVARCHAR(32)   NOT NULL CONSTRAINT PK_BlogPosts PRIMARY KEY,
    Title                 NVARCHAR(200)  NOT NULL,
    Excerpt               NVARCHAR(1000) NOT NULL CONSTRAINT DF_BlogPosts_Excerpt DEFAULT (N''),
    BodyJson              NVARCHAR(MAX)  NOT NULL CONSTRAINT DF_BlogPosts_BodyJson DEFAULT (N'[]'),
    Author                NVARCHAR(150)  NOT NULL,
    Category              NVARCHAR(100)  NOT NULL,
    PublishedAt           DATE           NOT NULL,
    ReadMinutes           INT            NOT NULL CONSTRAINT DF_BlogPosts_ReadMinutes DEFAULT (1),
    Status                NVARCHAR(20)   NOT NULL CONSTRAINT CK_BlogPosts_Status CHECK (Status IN (N'PUBLISHED', N'DRAFT')),
    ImageSeed             NVARCHAR(500)  NOT NULL CONSTRAINT DF_BlogPosts_ImageSeed DEFAULT (N'71'),
    CreatedBy             NVARCHAR(32)   NULL,
    CreatedDate           DATETIME2(3)   NOT NULL CONSTRAINT DF_BlogPosts_CreatedDate DEFAULT (SYSUTCDATETIME()),
    ModifiedBy            NVARCHAR(32)   NULL,
    ModifiedDate          DATETIME2(3)   NULL
);
GO

IF OBJECT_ID('content.GalleryItems') IS NULL
CREATE TABLE content.GalleryItems (
    Id                    NVARCHAR(32)   NOT NULL CONSTRAINT PK_GalleryItems PRIMARY KEY,
    Title                 NVARCHAR(200)  NOT NULL,
    LocationId            NVARCHAR(32)   NOT NULL CONSTRAINT FK_GalleryItems_Locations REFERENCES workspace.Locations (Id),
    Category              NVARCHAR(30)   NOT NULL CONSTRAINT CK_GalleryItems_Category CHECK (Category IN (N'Workspace', N'Meeting Rooms', N'Events', N'Amenities')),
    Seed                  NVARCHAR(500)  NOT NULL,
    Status                NVARCHAR(20)   NOT NULL CONSTRAINT CK_GalleryItems_Status CHECK (Status IN (N'PUBLISHED', N'HIDDEN')),
    CreatedBy             NVARCHAR(32)   NULL,
    CreatedDate           DATETIME2(3)   NOT NULL CONSTRAINT DF_GalleryItems_CreatedDate DEFAULT (SYSUTCDATETIME()),
    ModifiedBy            NVARCHAR(32)   NULL,
    ModifiedDate          DATETIME2(3)   NULL
);
GO

IF OBJECT_ID('content.HomepageContent') IS NULL
CREATE TABLE content.HomepageContent (
    Id                    INT            NOT NULL CONSTRAINT PK_HomepageContent PRIMARY KEY CONSTRAINT CK_HomepageContent_Single CHECK (Id = 1),
    HeroTitle             NVARCHAR(200)  NOT NULL,
    HeroSubtitle          NVARCHAR(1000) NOT NULL,
    StatsJson             NVARCHAR(MAX)  NOT NULL CONSTRAINT DF_HomepageContent_StatsJson DEFAULT (N'[]'),
    TestimonialsJson      NVARCHAR(MAX)  NOT NULL CONSTRAINT DF_HomepageContent_TestimonialsJson DEFAULT (N'[]'),
    FeaturesJson          NVARCHAR(MAX)  NOT NULL CONSTRAINT DF_HomepageContent_FeaturesJson DEFAULT (N'[]'),
    Announcement          NVARCHAR(500)  NOT NULL CONSTRAINT DF_HomepageContent_Announcement DEFAULT (N''),
    ShowAnnouncement      BIT            NOT NULL CONSTRAINT DF_HomepageContent_ShowAnnouncement DEFAULT (0),
    CreatedBy             NVARCHAR(32)   NULL,
    CreatedDate           DATETIME2(3)   NOT NULL CONSTRAINT DF_HomepageContent_CreatedDate DEFAULT (SYSUTCDATETIME()),
    ModifiedBy            NVARCHAR(32)   NULL,
    ModifiedDate          DATETIME2(3)   NULL
);
GO

/* ------------------------------------------------------------------ integrations / files ------------------------------------------------------------------ */
IF OBJECT_ID('config.Integrations') IS NULL
CREATE TABLE config.Integrations (
    Id                    NVARCHAR(32)   NOT NULL CONSTRAINT PK_Integrations PRIMARY KEY,
    Category              NVARCHAR(30)   NOT NULL,
    ProviderKey           NVARCHAR(50)   NOT NULL,
    DisplayName           NVARCHAR(150)  NOT NULL,
    Environment           NVARCHAR(10)   NOT NULL CONSTRAINT CK_Integrations_Environment CHECK (Environment IN (N'SANDBOX', N'LIVE')),
    Enabled               BIT            NOT NULL CONSTRAINT DF_Integrations_Enabled DEFAULT (1),
    IsActive              BIT            NOT NULL CONSTRAINT DF_Integrations_IsActive DEFAULT (0),
    Status                NVARCHAR(20)   NOT NULL CONSTRAINT CK_Integrations_Status CHECK (Status IN (N'CONNECTED', N'NOT_CONFIGURED', N'ERROR', N'DISABLED', N'UNTESTED')),
    ConfigJson            NVARCHAR(MAX)  NOT NULL CONSTRAINT DF_Integrations_ConfigJson DEFAULT (N'{}'),
    TestsJson             NVARCHAR(MAX)  NOT NULL CONSTRAINT DF_Integrations_TestsJson DEFAULT (N'[]'),
    UpdatedByName         NVARCHAR(150)  NOT NULL CONSTRAINT DF_Integrations_UpdatedByName DEFAULT (N''),
    CreatedBy             NVARCHAR(32)   NULL,
    CreatedDate           DATETIME2(3)   NOT NULL CONSTRAINT DF_Integrations_CreatedDate DEFAULT (SYSUTCDATETIME()),
    ModifiedBy            NVARCHAR(32)   NULL,
    ModifiedDate          DATETIME2(3)   NULL
);
/* "One active provider per category" is enforced by IntegrationService (switching providers updates both rows in one save). */
CREATE INDEX IX_Integrations_Category ON config.Integrations (Category, IsActive);
GO

IF OBJECT_ID('config.IntegrationSecrets') IS NULL
CREATE TABLE config.IntegrationSecrets (
    IntegrationId         NVARCHAR(32)   NOT NULL CONSTRAINT FK_IntegrationSecrets_Integrations REFERENCES config.Integrations (Id) ON DELETE CASCADE,
    FieldKey              NVARCHAR(60)   NOT NULL,
    ProtectedValue        NVARCHAR(MAX)  NOT NULL,
    Hint                  NVARCHAR(20)   NOT NULL,
    UpdatedAt             DATETIME2(3)   NOT NULL,
    UpdatedBy             NVARCHAR(32)   NULL,
    CONSTRAINT PK_IntegrationSecrets PRIMARY KEY (IntegrationId, FieldKey)
);
GO

/* Human-readable id sequences (LOC-0001, BKG-0042 ...). The API reserves ids atomically (RowVersion concurrency). */
IF OBJECT_ID('config.IdSequences') IS NULL
CREATE TABLE config.IdSequences (
    Prefix                NVARCHAR(40)   NOT NULL CONSTRAINT PK_IdSequences PRIMARY KEY,
    LastValue             INT            NOT NULL CONSTRAINT DF_IdSequences_LastValue DEFAULT (0),
    RowVersion            ROWVERSION     NOT NULL
);
GO

IF OBJECT_ID('config.UploadedFiles') IS NULL
CREATE TABLE config.UploadedFiles (
    Id                    UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_UploadedFiles PRIMARY KEY,
    OriginalName          NVARCHAR(260)  NOT NULL,
    StoredName            NVARCHAR(100)  NOT NULL,
    RelativePath          NVARCHAR(300)  NOT NULL CONSTRAINT UQ_UploadedFiles_RelativePath UNIQUE,
    ContentType           NVARCHAR(100)  NOT NULL,
    SizeBytes             BIGINT         NOT NULL,
    Category              NVARCHAR(30)   NOT NULL CONSTRAINT CK_UploadedFiles_Category CHECK (Category IN (N'images', N'documents', N'profiles', N'attachments')),
    UploadedBy            NVARCHAR(32)   NULL,
    UploadedAt            DATETIME2(3)   NOT NULL CONSTRAINT DF_UploadedFiles_UploadedAt DEFAULT (SYSUTCDATETIME())
);
GO

/* ------------------------------------------------------------------ audit ------------------------------------------------------------------ */
IF OBJECT_ID('audit.AuditLogs') IS NULL
CREATE TABLE audit.AuditLogs (
    Id                    NVARCHAR(32)   NOT NULL CONSTRAINT PK_AuditLogs PRIMARY KEY,
    UserId                NVARCHAR(32)   NULL,
    UserName              NVARCHAR(150)  NOT NULL,
    RoleName              NVARCHAR(100)  NOT NULL,
    Action                NVARCHAR(20)   NOT NULL CONSTRAINT CK_AuditLogs_Action CHECK (Action IN (N'CREATE', N'UPDATE', N'DELETE', N'LOGIN', N'LOGOUT', N'EXPORT', N'APPROVE', N'STATUS_CHANGE')),
    Module                NVARCHAR(100)  NOT NULL,
    Entity                NVARCHAR(100)  NOT NULL,
    EntityId              NVARCHAR(64)   NOT NULL,
    LoggedAt              DATETIME2(3)   NOT NULL,
    IpAddress             NVARCHAR(64)   NOT NULL CONSTRAINT DF_AuditLogs_IpAddress DEFAULT (N''),
    Device                NVARCHAR(100)  NOT NULL CONSTRAINT DF_AuditLogs_Device DEFAULT (N''),
    Description           NVARCHAR(2000) NOT NULL,
    CreatedBy             NVARCHAR(32)   NULL,
    CreatedDate           DATETIME2(3)   NOT NULL CONSTRAINT DF_AuditLogs_CreatedDate DEFAULT (SYSUTCDATETIME()),
    ModifiedBy            NVARCHAR(32)   NULL,
    ModifiedDate          DATETIME2(3)   NULL
);
CREATE INDEX IX_AuditLogs_LoggedAt ON audit.AuditLogs (LoggedAt DESC);
GO
