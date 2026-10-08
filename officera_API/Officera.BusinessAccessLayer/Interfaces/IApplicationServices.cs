using officera.BusinessAccessLayer.DTOs;

namespace officera.BusinessAccessLayer.Interfaces
{
    public interface IAuthService
    {
        Task<AuthResponse> LoginAsync(LoginRequest request);
        Task<AuthResponse> LoginWithOtpAsync(OtpLoginRequest request);
        Task<SendOtpResponse> SendOtpAsync(SendOtpRequest request);
        Task<VerifyOtpResponse> VerifyOtpAsync(VerifyOtpRequest request);
        Task<AuthResponse> RegisterAsync(RegisterRequest request);
        Task ResetPasswordAsync(ResetPasswordRequest request);
        Task ChangePasswordAsync(ChangePasswordRequest request);
        Task<MeResponse> MeAsync();
        Task LogoutAsync();
        Task<CreateMemberLoginResponse> CreateMemberLoginAsync(CreateMemberLoginRequest request);
        Task UnlockAsync(UnlockUserRequest request);
    }

    /// <summary>Validates single-use OTP verifications for flows outside the auth service (lead capture).</summary>
    public interface IOtpService
    {
        Task<SendOtpResponse> SendAsync(string destination, string purpose, string? displayDestination = null, string? emailFallback = null);
        Task<string> VerifyAsync(string destination, string purpose, string code);
        Task ConsumeAsync(string verificationId, string destination, string purpose);
    }

    public interface IPasswordService
    {
        string Hash(string password);
        bool Verify(string hash, string password);
        string GenerateTemporaryPassword();
    }

    public interface IJwtTokenService
    {
        (string Token, DateTime ExpiresAt) CreateToken(string userId, string name, string email, string role, string? memberId);
    }

    public interface ISettingsService
    {
        Task<OrgSettingsDto> GetAsync();
        Task<OrgSettingsDto> UpdateAsync(OrgSettingsDto dto);
    }

    public interface IHomepageContentService
    {
        Task<HomepageContentDto> GetAsync();
        Task<HomepageContentDto> UpdateAsync(HomepageContentDto dto);
    }

    public interface ILookupService
    {
        Task<List<StateDto>> GetStatesAsync();
    }

    public interface IDashboardService
    {
        Task<DashboardSummaryDto> GetSummaryAsync(DashboardRequest request);
    }

    /// <summary>Atomic, human-readable id sequences (LOC-0001 ...).</summary>
    public interface IIdSequenceService
    {
        Task<string> NextIdAsync(string prefix);
        Task<int> ReserveAsync(string prefix, int count);
        Task<Dictionary<string, List<string>>> ReserveIdsAsync(IEnumerable<string> prefixes, int count);
    }

    /// <summary>Saves validated uploads and records their metadata.</summary>
    public interface IFileStorageService
    {
        Task<FileUploadResultDto> SaveAsync(Stream content, string originalName, long length, string category);
    }

    /// <summary>Server-side notification dispatch (in-app notification + delivery logs + provider send).</summary>
    public interface INotificationService
    {
        Task DispatchAsync(NotificationMessage message);

        /// <summary>
        /// Sends a private message (e.g. login details) by e-mail and SMS without creating an in-app notification.
        /// Only the delivery is logged, never the content. Returns true when at least one channel delivered it.
        /// </summary>
        Task<bool> SendDirectAsync(string eventName, string? email, string? mobile, string subject, string text, string? locationId);
    }

    public sealed class NotificationMessage
    {
        public string Event { get; init; } = string.Empty;
        public string Audience { get; init; } = "STAFF";
        public string? UserId { get; init; }
        public string Category { get; init; } = "SYSTEM";
        public string Title { get; init; } = string.Empty;
        public string Message { get; init; } = string.Empty;
        public string? Link { get; init; }
        public string? Email { get; init; }
        public string? Mobile { get; init; }
        public string? LocationId { get; init; }
        public IReadOnlyList<string> Channels { get; init; } = new[] { "EMAIL", "PUSH" };
    }

    public sealed record DeliveryResult(bool Sent, string Provider, string? Error = null)
    {
        public static DeliveryResult NoProvider(string channel) => new(false, $"No active {channel} provider");
    }

    /// <summary>E-mail delivery through the active EMAIL integration (SMTP, SendGrid ...).</summary>
    public interface IEmailService
    {
        Task<DeliveryResult> SendAsync(string to, string subject, string body);
    }

    /// <summary>SMS delivery through the active SMS integration (MSG91, Twilio ...).</summary>
    public interface ISmsService
    {
        Task<DeliveryResult> SendAsync(string mobile, string text);
    }

    /// <summary>Payment gateway selected in Configuration / Integrations.</summary>
    public interface IPaymentGatewayService
    {
        Task<PaymentGatewayInfo?> GetActiveGatewayAsync();
        Task<GatewayOrder> CreateOrderAsync(decimal amount, string currency, string receipt);
    }

    public sealed record PaymentGatewayInfo(string ProviderKey, string DisplayName, string Environment, string? PublicKey);

    public sealed record GatewayOrder(string Provider, string OrderId, decimal Amount, string Currency, string? PublicKey);

    /// <summary>Calendar invites for bookings (ICS today; Google / Outlook via their integrations).</summary>
    public interface ICalendarService
    {
        string BuildIcs(string uid, string summary, string location, DateTime startUtc, DateTime endUtc, string description);
    }
}
