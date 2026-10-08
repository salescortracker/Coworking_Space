namespace officera.Shared.Common
{
    /// <summary>appsettings "Jwt" section. The signing key must come from configuration / user secrets / environment, never source code.</summary>
    public class JwtOptions
    {
        public const string SectionName = "Jwt";

        public string Key { get; set; } = string.Empty;
        public string Issuer { get; set; } = string.Empty;
        public string Audience { get; set; } = string.Empty;
        public int ExpiryMinutes { get; set; } = 60;
    }

    /// <summary>appsettings "Otp" section.</summary>
    public class OtpOptions
    {
        public const string SectionName = "Otp";

        public int ExpiryMinutes { get; set; } = 10;
        public int MaxAttempts { get; set; } = 5;
        /// <summary>Minutes a verified code may be used to finish registration / reset / enquiry.</summary>
        public int VerificationValidMinutes { get; set; } = 15;
        /// <summary>
        /// Development only: when no SMS / e-mail provider is active, return the code in the API response so the
        /// flows can be tested. Ignored outside the Development environment.
        /// </summary>
        public bool ExposeCodeWhenNoProvider { get; set; }
    }

    /// <summary>appsettings "FileStorage" section (uploads under wwwroot/uploads).</summary>
    public class FileStorageOptions
    {
        public const string SectionName = "FileStorage";

        public string UploadFolder { get; set; } = "uploads";
        public long MaxImageBytes { get; set; } = 5 * 1024 * 1024;
        public long MaxProfileImageBytes { get; set; } = 2 * 1024 * 1024;
        public long MaxDocumentBytes { get; set; } = 10 * 1024 * 1024;
        public int MaxFilesPerRequest { get; set; } = 10;
    }

    /// <summary>appsettings "loginURL" section: public URL of the Officera web app (links in e-mails, CORS).</summary>
    public class LoginUrlOptions
    {
        public const string SectionName = "loginURL";

        public string LoginURL { get; set; } = string.Empty;
    }

    /// <summary>appsettings "Cors" section.</summary>
    public class CorsOptions
    {
        public const string SectionName = "Cors";

        public string[] AllowedOrigins { get; set; } = Array.Empty<string>();
    }
}
