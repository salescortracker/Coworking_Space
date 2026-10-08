namespace officera.Shared.Common
{
    /// <summary>Role keys stored in auth.Roles.RoleKey and used by the frontend route guards.</summary>
    public static class RoleKeys
    {
        public const string SuperAdmin = "SUPER_ADMIN";
        public const string LocationManager = "LOCATION_MANAGER";
        public const string FrontDesk = "FRONT_DESK";
        public const string Finance = "FINANCE";
        public const string Member = "MEMBER";

        public static readonly string[] Staff = { SuperAdmin, LocationManager, FrontDesk, Finance };

        /// <summary>Comma-separated list for [Authorize(Roles = ...)].</summary>
        public const string StaffRoles = SuperAdmin + "," + LocationManager + "," + FrontDesk + "," + Finance;

        public static bool IsStaff(string? role) => role != null && Staff.Contains(role);
    }

    /// <summary>Custom JWT claim types.</summary>
    public static class OfficeraClaims
    {
        public const string UserId = "uid";
        public const string MemberId = "mid";
        public const string Role = "role";
        public const string Name = "name";
        public const string Email = "email";
    }

    /// <summary>Permission actions from the role matrix (auth.Permissions.Action).</summary>
    public static class PermissionActions
    {
        public const string View = "view";
        public const string Create = "create";
        public const string Edit = "edit";
        public const string Delete = "delete";
        public const string Approve = "approve";
        public const string Export = "export";
    }

    /// <summary>Status values shared by several modules.</summary>
    public static class StatusValues
    {
        public const string Active = "ACTIVE";
        public const string Inactive = "INACTIVE";
        public const string Published = "PUBLISHED";
        public const string Pending = "PENDING";
        public const string Cancelled = "CANCELLED";
        public const string Confirmed = "CONFIRMED";
        public const string Locked = "LOCKED";
        public const string Invited = "INVITED";
    }

    /// <summary>OTP purposes (auth.OtpRequests.Purpose).</summary>
    public static class OtpPurposes
    {
        public const string Login = "LOGIN";
        public const string Register = "REGISTER";
        public const string Reset = "RESET";
        public const string Enquiry = "ENQUIRY";

        public static readonly string[] All = { Login, Register, Reset, Enquiry };
    }

    /// <summary>Upload folders under wwwroot/uploads.</summary>
    public static class FileCategories
    {
        public const string Images = "images";
        public const string Documents = "documents";
        public const string Profiles = "profiles";
        public const string Attachments = "attachments";

        public static readonly string[] All = { Images, Documents, Profiles, Attachments };
    }

    /// <summary>Integration categories (config.Integrations.Category), matching the frontend catalogue.</summary>
    public static class IntegrationCategories
    {
        public const string Email = "EMAIL";
        public const string Sms = "SMS";
        public const string WhatsApp = "WHATSAPP";
        public const string Push = "PUSH";
        public const string Payment = "PAYMENT";
        public const string GoogleCalendar = "GOOGLE_CALENDAR";
        public const string OutlookCalendar = "OUTLOOK_CALENDAR";
        public const string AccessControl = "ACCESS_CONTROL";
        public const string Storage = "STORAGE";
        public const string OAuth = "OAUTH";
        public const string Accounting = "ACCOUNTING";
        public const string Maps = "MAPS";
        public const string GstEInvoice = "GST_EINVOICE";
        public const string Webhook = "WEBHOOK";

        public static readonly string[] All =
        {
            Email, Sms, WhatsApp, Push, Payment, GoogleCalendar, OutlookCalendar, AccessControl, Storage, OAuth, Accounting, Maps, GstEInvoice, Webhook,
        };
    }
}
