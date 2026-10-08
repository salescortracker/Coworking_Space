namespace officera.BusinessAccessLayer.DTOs
{
    public class LoginRequest
    {
        public string Email { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    public class OtpLoginRequest
    {
        public string Mobile { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
    }

    public class SendOtpRequest
    {
        /// <summary>Mobile number (LOGIN, REGISTER, ENQUIRY) or account email (RESET).</summary>
        public string Destination { get; set; } = string.Empty;
        public string Purpose { get; set; } = "LOGIN";
    }

    public class SendOtpResponse
    {
        /// <summary>Masked destination shown to the user, e.g. "+91 ••••• 43210".</summary>
        public string SentTo { get; set; } = string.Empty;
        public int ExpiresInSec { get; set; }
        /// <summary>Only filled in the Development environment when no SMS/e-mail provider is active.</summary>
        public string? DevCode { get; set; }
    }

    public class VerifyOtpRequest
    {
        public string Destination { get; set; } = string.Empty;
        public string Purpose { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
    }

    public class VerifyOtpResponse
    {
        /// <summary>Single-use proof of verification, passed to Register / ResetPassword / Lead capture.</summary>
        public string VerificationId { get; set; } = string.Empty;
    }

    public class RegisterRequest
    {
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Mobile { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string VerificationId { get; set; } = string.Empty;
    }

    public class ResetPasswordRequest
    {
        public string Email { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string VerificationId { get; set; } = string.Empty;
    }

    public class ChangePasswordRequest
    {
        public string CurrentPassword { get; set; } = string.Empty;
        public string NewPassword { get; set; } = string.Empty;
    }

    public class CreateMemberLoginRequest
    {
        public string MemberId { get; set; } = string.Empty;
    }

    public class CreateMemberLoginResponse
    {
        public UserDto User { get; set; } = new();
        public bool AlreadyExisted { get; set; }
    }

    public class UnlockUserRequest
    {
        public string Email { get; set; } = string.Empty;
    }

    public class AuthResponse
    {
        public string Token { get; set; } = string.Empty;
        public string ExpiresAt { get; set; } = string.Empty;
        public UserDto User { get; set; } = new();
        public List<string> Permissions { get; set; } = new();
    }

    public class MeResponse
    {
        public UserDto User { get; set; } = new();
        public List<string> Permissions { get; set; } = new();
    }

    /// <summary>Error payload for failed sign-ins (frontend: AuthError).</summary>
    public class AuthErrorDto
    {
        public string Code { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public int? AttemptsLeft { get; set; }
        public long? LockedUntil { get; set; }
    }
}
