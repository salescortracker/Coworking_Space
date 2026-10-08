using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using officera.BusinessAccessLayer.DTOs;
using officera.BusinessAccessLayer.Interfaces;
using officera.Shared.Common;

namespace officera_API.Controllers
{
    /// <summary>
    /// Sign-in (password / mobile OTP), registration, password reset and session endpoints.
    /// Login returns a JWT: send it as "Authorization: Bearer {token}".
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Produces("application/json")]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _auth;

        public AuthController(IAuthService auth)
        {
            _auth = auth;
        }

        /// <summary>Email + password sign-in. 5 failed attempts lock the account (Settings › Business rules).</summary>
        [AllowAnonymous]
        [EnableRateLimiting("auth")]
        [HttpPost("Login")]
        public async Task<ActionResult<ApiResponse<AuthResponse>>> Login([FromBody] LoginRequest request) =>
            Ok(ApiResponse<AuthResponse>.Ok(await _auth.LoginAsync(request), "Signed in"));

        /// <summary>Sign-in with a mobile OTP (request it first with SendOtp, purpose LOGIN).</summary>
        [AllowAnonymous]
        [EnableRateLimiting("auth")]
        [HttpPost("LoginWithOtp")]
        public async Task<ActionResult<ApiResponse<AuthResponse>>> LoginWithOtp([FromBody] OtpLoginRequest request) =>
            Ok(ApiResponse<AuthResponse>.Ok(await _auth.LoginWithOtpAsync(request), "Signed in"));

        /// <summary>Sends a one-time code. Purpose: LOGIN, REGISTER, ENQUIRY (mobile) or RESET (account email).</summary>
        [AllowAnonymous]
        [EnableRateLimiting("otp")]
        [HttpPost("SendOtp")]
        public async Task<ActionResult<ApiResponse<SendOtpResponse>>> SendOtp([FromBody] SendOtpRequest request) =>
            Ok(ApiResponse<SendOtpResponse>.Ok(await _auth.SendOtpAsync(request), "Verification code sent"));

        /// <summary>Checks a code and returns a single-use verification id for Register / ResetPassword / Lead capture.</summary>
        [AllowAnonymous]
        [EnableRateLimiting("auth")]
        [HttpPost("VerifyOtp")]
        public async Task<ActionResult<ApiResponse<VerifyOtpResponse>>> VerifyOtp([FromBody] VerifyOtpRequest request) =>
            Ok(ApiResponse<VerifyOtpResponse>.Ok(await _auth.VerifyOtpAsync(request), "Verified"));

        [AllowAnonymous]
        [EnableRateLimiting("auth")]
        [HttpPost("Register")]
        public async Task<ActionResult<ApiResponse<AuthResponse>>> Register([FromBody] RegisterRequest request) =>
            StatusCode(201, ApiResponse<AuthResponse>.Created(await _auth.RegisterAsync(request), "Account created"));

        [AllowAnonymous]
        [EnableRateLimiting("auth")]
        [HttpPost("ResetPassword")]
        public async Task<ActionResult<ApiResponse>> ResetPassword([FromBody] ResetPasswordRequest request)
        {
            await _auth.ResetPasswordAsync(request);
            return Ok(ApiResponse.Ok("Password updated"));
        }

        [Authorize]
        [HttpPost("ChangePassword")]
        public async Task<ActionResult<ApiResponse>> ChangePassword([FromBody] ChangePasswordRequest request)
        {
            await _auth.ChangePasswordAsync(request);
            return Ok(ApiResponse.Ok("Password updated"));
        }

        /// <summary>The signed-in user and their current permissions (read from the database, not the token).</summary>
        [Authorize]
        [HttpPost("Me")]
        public async Task<ActionResult<ApiResponse<MeResponse>>> Me() =>
            Ok(ApiResponse<MeResponse>.Ok(await _auth.MeAsync()));

        [Authorize]
        [HttpPost("Logout")]
        public async Task<ActionResult<ApiResponse>> Logout()
        {
            await _auth.LogoutAsync();
            return Ok(ApiResponse.Ok("Signed out"));
        }

        /// <summary>Creates a member login (e.g. after lead conversion) with a one-time temporary password.</summary>
        [Authorize(Roles = RoleKeys.StaffRoles)]
        [HttpPost("CreateMemberLogin")]
        public async Task<ActionResult<ApiResponse<CreateMemberLoginResponse>>> CreateMemberLogin([FromBody] CreateMemberLoginRequest request) =>
            Ok(ApiResponse<CreateMemberLoginResponse>.Ok(await _auth.CreateMemberLoginAsync(request)));

        /// <summary>Clears a sign-in lockout (Administration › Users).</summary>
        [Authorize(Roles = RoleKeys.StaffRoles)]
        [HttpPost("Unlock")]
        public async Task<ActionResult<ApiResponse>> Unlock([FromBody] UnlockUserRequest request)
        {
            await _auth.UnlockAsync(request);
            return Ok(ApiResponse.Ok("Account unlocked"));
        }
    }
}
