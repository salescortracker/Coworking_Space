using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using officera.BusinessAccessLayer.DTOs;
using officera.BusinessAccessLayer.Interfaces;
using officera.DataAccessLayer.Entities;
using officera.DataAccessLayer.Repositories;
using officera.Shared.Common;

namespace officera.BusinessAccessLayer.Services
{
    /// <summary>PBKDF2 password hashing (ASP.NET Core Identity format). Passwords are never stored or logged in plain text.</summary>
    public class PasswordService : IPasswordService
    {
        private static readonly object HashOwner = new();
        private readonly PasswordHasher<object> _hasher = new();

        public string Hash(string password) => _hasher.HashPassword(HashOwner, password);

        public bool Verify(string hash, string password)
        {
            if (string.IsNullOrEmpty(hash) || string.IsNullOrEmpty(password))
            {
                return false;
            }

            try
            {
                return _hasher.VerifyHashedPassword(HashOwner, hash, password) != PasswordVerificationResult.Failed;
            }
            catch (FormatException)
            {
                return false;
            }
        }

        /// <summary>Random temporary password that satisfies the password policy.</summary>
        public string GenerateTemporaryPassword()
        {
            const string upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
            const string lower = "abcdefghijkmnopqrstuvwxyz";
            const string digits = "23456789";
            const string symbols = "@#$%&*!";
            var all = upper + lower + digits + symbols;
            var chars = new List<char>
            {
                upper[RandomNumberGenerator.GetInt32(upper.Length)],
                lower[RandomNumberGenerator.GetInt32(lower.Length)],
                digits[RandomNumberGenerator.GetInt32(digits.Length)],
                symbols[RandomNumberGenerator.GetInt32(symbols.Length)],
            };
            while (chars.Count < 12)
            {
                chars.Add(all[RandomNumberGenerator.GetInt32(all.Length)]);
            }

            return new string(chars.OrderBy(_ => RandomNumberGenerator.GetInt32(1000)).ToArray());
        }
    }

    /// <summary>Issues signed JWTs from the "Jwt" configuration section.</summary>
    public class JwtTokenService : IJwtTokenService
    {
        private readonly JwtOptions _options;

        public JwtTokenService(IOptions<JwtOptions> options)
        {
            _options = options.Value;
        }

        public (string Token, DateTime ExpiresAt) CreateToken(string userId, string name, string email, string role, string? memberId)
        {
            var expires = DateTime.UtcNow.AddMinutes(_options.ExpiryMinutes);
            var claims = new List<Claim>
            {
                new(JwtRegisteredClaimNames.Sub, userId),
                new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),
                new(OfficeraClaims.UserId, userId),
                new(OfficeraClaims.Name, name),
                new(OfficeraClaims.Email, email),
                new(ClaimTypes.Role, role),
            };
            if (!string.IsNullOrEmpty(memberId))
            {
                claims.Add(new Claim(OfficeraClaims.MemberId, memberId));
            }

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.Key));
            var token = new JwtSecurityToken(
                issuer: _options.Issuer,
                audience: _options.Audience,
                claims: claims,
                notBefore: DateTime.UtcNow,
                expires: expires,
                signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
            return (new JwtSecurityTokenHandler().WriteToken(token), expires);
        }
    }

    /// <summary>
    /// One-time codes for mobile sign-in, registration, password reset and website enquiries.
    /// Codes are random, stored only as a hash, expire, allow a limited number of attempts and are single-use.
    /// </summary>
    public class OtpService : IOtpService
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly ISmsService _sms;
        private readonly IEmailService _email;
        private readonly OtpOptions _options;
        private readonly IWebHostEnvironment _environment;
        private readonly ILogger<OtpService> _logger;

        public OtpService(IUnitOfWork unitOfWork, ISmsService sms, IEmailService email, IOptions<OtpOptions> options, IWebHostEnvironment environment, ILogger<OtpService> logger)
        {
            _unitOfWork = unitOfWork;
            _sms = sms;
            _email = email;
            _options = options.Value;
            _environment = environment;
            _logger = logger;
        }

        public async Task<SendOtpResponse> SendAsync(string destination, string purpose, string? displayDestination = null, string? emailFallback = null)
        {
            if (!OtpPurposes.All.Contains(purpose))
            {
                throw new ValidationException("Unknown verification purpose.");
            }

            var repo = _unitOfWork.Repository<OtpRequest>();
            var recent = (await repo.FindAsync(o => o.Destination == destination && o.Purpose == purpose && o.CreatedDate > DateTime.UtcNow.AddSeconds(-25))).Any();
            if (recent)
            {
                throw new ValidationException("Please wait a few seconds before requesting another code.");
            }

            var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
            await repo.AddAsync(new OtpRequest
            {
                Id = Guid.NewGuid(),
                Destination = destination,
                Purpose = purpose,
                CodeHash = HashCode(destination, purpose, code),
                ExpiresAt = DateTime.UtcNow.AddMinutes(_options.ExpiryMinutes),
                CreatedDate = DateTime.UtcNow,
            });
            await _unitOfWork.CompleteAsync();

            var text = $"{code} is your Officera verification code. Valid for {_options.ExpiryMinutes} minutes.";
            DeliveryResult delivery = DeliveryResult.NoProvider("SMS");
            var isMobile = ValidationHelper.IsMobile(destination);
            if (isMobile)
            {
                delivery = await _sms.SendAsync(destination, text);
            }

            if (!delivery.Sent && !string.IsNullOrEmpty(emailFallback))
            {
                delivery = await _email.SendAsync(emailFallback, "Your Officera verification code", text);
            }

            _logger.LogInformation("OTP issued for {Purpose} to {Destination}; delivered: {Delivered} via {Provider}", purpose, Mask(destination), delivery.Sent, delivery.Provider);

            return new SendOtpResponse
            {
                SentTo = displayDestination ?? Mask(destination),
                ExpiresInSec = _options.ExpiryMinutes * 60,
                DevCode = !delivery.Sent && _options.ExposeCodeWhenNoProvider && _environment.IsDevelopment() ? code : null,
            };
        }

        public async Task<string> VerifyAsync(string destination, string purpose, string code)
        {
            var repo = _unitOfWork.Repository<OtpRequest>();
            var otp = (await repo.FindAsync(o => o.Destination == destination && o.Purpose == purpose && o.ConsumedAt == null && o.VerifiedAt == null))
                .OrderByDescending(o => o.CreatedDate)
                .FirstOrDefault();

            if (otp == null || otp.ExpiresAt < DateTime.UtcNow)
            {
                throw new AuthFailedException("INVALID_OTP", "This code has expired. Please request a new one.", 400);
            }

            if (otp.Attempts >= _options.MaxAttempts)
            {
                throw new AuthFailedException("INVALID_OTP", "Too many incorrect attempts. Please request a new code.", 400);
            }

            if (!CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(otp.CodeHash), Encoding.UTF8.GetBytes(HashCode(destination, purpose, code ?? string.Empty))))
            {
                otp.Attempts += 1;
                await _unitOfWork.CompleteAsync();
                throw new AuthFailedException("INVALID_OTP", "The code you entered is incorrect. Please try again.", 400, attemptsLeft: Math.Max(0, _options.MaxAttempts - otp.Attempts));
            }

            otp.VerifiedAt = DateTime.UtcNow;
            await _unitOfWork.CompleteAsync();
            return otp.Id.ToString("N");
        }

        public async Task ConsumeAsync(string verificationId, string destination, string purpose)
        {
            if (!Guid.TryParse(verificationId, out var id))
            {
                throw new AuthFailedException("INVALID_OTP", "Please verify your mobile number first.", 400);
            }

            var otp = (await _unitOfWork.Repository<OtpRequest>().FindAsync(o => o.Id == id)).FirstOrDefault();
            if (otp == null || otp.Destination != destination || otp.Purpose != purpose || otp.VerifiedAt == null || otp.ConsumedAt != null
                || otp.VerifiedAt < DateTime.UtcNow.AddMinutes(-_options.VerificationValidMinutes))
            {
                throw new AuthFailedException("INVALID_OTP", "Your verification has expired. Please verify your mobile number again.", 400);
            }

            otp.ConsumedAt = DateTime.UtcNow;
            await _unitOfWork.CompleteAsync();
        }

        private static string HashCode(string destination, string purpose, string code)
        {
            var bytes = SHA256.HashData(Encoding.UTF8.GetBytes($"{purpose}|{destination}|{code}"));
            return Convert.ToBase64String(bytes);
        }

        public static string Mask(string destination)
        {
            if (ValidationHelper.IsMobile(destination))
            {
                var digits = ValidationHelper.NormalizeMobile(destination);
                return $"+91 ••••• {digits[^5..]}";
            }

            var at = destination.IndexOf('@');
            return at > 1 ? $"{destination[0]}•••{destination[(at - 1)..]}" : "your registered contact";
        }
    }

    /// <summary>Sign-in, registration, OTP and password flows. Returns a JWT; role and permissions come from the database.</summary>
    public class AuthService : IAuthService
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly IPasswordService _passwords;
        private readonly IJwtTokenService _jwt;
        private readonly IOtpService _otp;
        private readonly IIdSequenceService _ids;
        private readonly ICurrentUserService _currentUser;
        private readonly INotificationService _notifications;
        private readonly ILogger<AuthService> _logger;

        public AuthService(IUnitOfWork unitOfWork, IPasswordService passwords, IJwtTokenService jwt, IOtpService otp, IIdSequenceService ids,
            ICurrentUserService currentUser, INotificationService notifications, ILogger<AuthService> logger)
        {
            _unitOfWork = unitOfWork;
            _passwords = passwords;
            _jwt = jwt;
            _otp = otp;
            _ids = ids;
            _currentUser = currentUser;
            _notifications = notifications;
            _logger = logger;
        }

        private IGeneralRepository<User> Users => _unitOfWork.Repository<User>();

        public async Task<AuthResponse> LoginAsync(LoginRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrEmpty(request.Password))
            {
                throw new ValidationException("Email and password are required.");
            }

            var email = request.Email.Trim().ToLowerInvariant();
            var settings = await GetRulesAsync();
            var user = (await Users.FindAsync(u => u.Email == email)).FirstOrDefault();

            if (user?.LockoutUntil is { } lockedUntil && lockedUntil > DateTime.UtcNow)
            {
                _logger.LogWarning("Sign-in refused for locked account {UserId}", user.Id);
                throw new AuthFailedException("LOCKED", $"Too many failed attempts. Your account is locked until {ToIndiaTime(lockedUntil)}.", 423, lockedUntil: ToEpochMs(lockedUntil));
            }

            if (user == null || string.IsNullOrEmpty(user.PasswordHash) || !_passwords.Verify(user.PasswordHash, request.Password))
            {
                if (user != null)
                {
                    var fails = (user.LockoutUntil.HasValue && user.LockoutUntil <= DateTime.UtcNow ? 0 : user.FailedLoginCount) + 1;
                    user.FailedLoginCount = fails;
                    if (fails >= settings.MaxAttempts)
                    {
                        user.LockoutUntil = DateTime.UtcNow.AddMinutes(settings.LockoutMinutes);
                        await _unitOfWork.CompleteAsync();
                        _logger.LogWarning("Account {UserId} locked after {Fails} failed sign-ins", user.Id, fails);
                        throw new AuthFailedException("LOCKED", $"Your account has been locked for {settings.LockoutMinutes} minutes after {settings.MaxAttempts} failed attempts.", 423, lockedUntil: ToEpochMs(user.LockoutUntil.Value));
                    }

                    await _unitOfWork.CompleteAsync();
                    _logger.LogWarning("Failed sign-in for {UserId} ({Fails}/{Max})", user.Id, fails, settings.MaxAttempts);
                    throw new AuthFailedException("INVALID_CREDENTIALS", "The email or password you entered is incorrect.", attemptsLeft: settings.MaxAttempts - fails);
                }

                _logger.LogWarning("Failed sign-in for unknown email");
                throw new AuthFailedException("INVALID_CREDENTIALS", "The email or password you entered is incorrect.", attemptsLeft: settings.MaxAttempts - 1);
            }

            EnsureCanSignIn(user);
            return await StartSessionAsync(user);
        }

        public async Task<AuthResponse> LoginWithOtpAsync(OtpLoginRequest request)
        {
            var mobile = ValidationHelper.NormalizeMobile(request.Mobile);
            if (!ValidationHelper.IsMobile(mobile))
            {
                throw new ValidationException("Enter a valid 10-digit mobile number.");
            }

            var verificationId = await _otp.VerifyAsync(mobile, OtpPurposes.Login, request.Code);
            await _otp.ConsumeAsync(verificationId, mobile, OtpPurposes.Login);
            var user = (await Users.FindAsync(u => u.Mobile == mobile)).FirstOrDefault()
                ?? throw new AuthFailedException("NOT_FOUND", "No account is registered with this mobile number.", 404);
            EnsureCanSignIn(user);
            return await StartSessionAsync(user);
        }

        public async Task<SendOtpResponse> SendOtpAsync(SendOtpRequest request)
        {
            switch (request.Purpose)
            {
                case OtpPurposes.Login:
                case OtpPurposes.Register:
                case OtpPurposes.Enquiry:
                {
                    var mobile = ValidationHelper.NormalizeMobile(request.Destination);
                    if (!ValidationHelper.IsMobile(mobile))
                    {
                        throw new ValidationException("Enter a valid 10-digit mobile number.");
                    }

                    if (request.Purpose == OtpPurposes.Login && !(await Users.FindAsync(u => u.Mobile == mobile)).Any())
                    {
                        // Same answer as a real send, so the endpoint cannot be used to discover registered numbers.
                        return new SendOtpResponse { SentTo = OtpService.Mask(mobile), ExpiresInSec = 600 };
                    }

                    return await _otp.SendAsync(mobile, request.Purpose);
                }

                case OtpPurposes.Reset:
                {
                    var email = (request.Destination ?? string.Empty).Trim().ToLowerInvariant();
                    var user = (await Users.FindAsync(u => u.Email == email)).FirstOrDefault();
                    if (user == null)
                    {
                        // Do not reveal whether the account exists.
                        return new SendOtpResponse { SentTo = "your registered mobile", ExpiresInSec = 600 };
                    }

                    var display = ValidationHelper.IsMobile(user.Mobile) ? OtpService.Mask(user.Mobile) : OtpService.Mask(user.Email);
                    return await _otp.SendAsync(email, OtpPurposes.Reset, display, emailFallback: user.Email);
                }

                default:
                    throw new ValidationException("Unknown verification purpose.");
            }
        }

        public async Task<VerifyOtpResponse> VerifyOtpAsync(VerifyOtpRequest request)
        {
            var destination = request.Purpose == OtpPurposes.Reset
                ? (request.Destination ?? string.Empty).Trim().ToLowerInvariant()
                : ValidationHelper.NormalizeMobile(request.Destination);
            var id = await _otp.VerifyAsync(destination, request.Purpose, request.Code);
            return new VerifyOtpResponse { VerificationId = id };
        }

        public async Task<AuthResponse> RegisterAsync(RegisterRequest request)
        {
            var mobile = ValidationHelper.NormalizeMobile(request.Mobile);
            new ValidationHelper.Collector()
                .Required(request.FirstName, "First name").MaxLength(request.FirstName, 40, "First name")
                .Required(request.LastName, "Last name").MaxLength(request.LastName, 40, "Last name")
                .Email(request.Email, "Email")
                .Mobile(mobile, "Mobile number")
                .Must(ValidationHelper.IsStrongPassword(request.Password), "Password must be 8+ characters with upper and lower case letters, a number and a symbol.")
                .ThrowIfInvalid();

            var email = request.Email.Trim().ToLowerInvariant();
            if ((await Users.FindAsync(u => u.Email == email)).Any() || (await _unitOfWork.Repository<Member>().FindAsync(m => m.Email == email)).Any())
            {
                throw new AuthFailedException("EXISTS", "An account with this email already exists. Try signing in instead.", 409);
            }

            await _otp.ConsumeAsync(request.VerificationId, mobile, OtpPurposes.Register);

            var homeLocation = (await _unitOfWork.Repository<Location>().FindAsync(l => l.Status == "ACTIVE")).OrderBy(l => l.Id).FirstOrDefault()
                ?? throw new ValidationException("Registration opens once the first workspace location has been set up.");

            var memberId = await _ids.NextIdAsync("MEM");
            var userId = await _ids.NextIdAsync("USR");
            await _unitOfWork.Repository<Member>().AddAsync(new Member
            {
                Id = memberId,
                FirstName = request.FirstName.Trim(),
                LastName = request.LastName.Trim(),
                Email = email,
                Mobile = mobile,
                Designation = string.Empty,
                LocationId = homeLocation.Id,
                Status = "PENDING",
                JoinDate = DateTimeHelper.TodayUtc,
                Bio = string.Empty,
                SkillsJson = "[]",
            });
            var user = new User
            {
                Id = userId,
                Name = $"{request.FirstName.Trim()} {request.LastName.Trim()}",
                Email = email,
                Mobile = mobile,
                RoleKey = RoleKeys.Member,
                Status = "ACTIVE",
                MemberId = memberId,
                PasswordHash = _passwords.Hash(request.Password),
            };
            await Users.AddAsync(user);
            await _unitOfWork.CompleteAsync();
            _logger.LogInformation("Member {MemberId} registered (user {UserId})", memberId, userId);

            await _notifications.DispatchAsync(new NotificationMessage
            {
                Event = "Member Welcome",
                Audience = "MEMBER",
                UserId = userId,
                Category = "MEMBERSHIP",
                Title = "Welcome to Officera",
                Message = "Your account is ready. Complete your profile and pick a plan to get started.",
                Link = "/member/dashboard",
                Email = email,
                LocationId = homeLocation.Id,
                Channels = new[] { "EMAIL", "PUSH" },
            });

            return await StartSessionAsync(user);
        }

        public async Task ResetPasswordAsync(ResetPasswordRequest request)
        {
            if (!ValidationHelper.IsStrongPassword(request.Password))
            {
                throw new ValidationException("Password must be 8+ characters with upper and lower case letters, a number and a symbol.");
            }

            var email = (request.Email ?? string.Empty).Trim().ToLowerInvariant();
            await _otp.ConsumeAsync(request.VerificationId, email, OtpPurposes.Reset);
            var user = (await Users.FindAsync(u => u.Email == email)).FirstOrDefault()
                ?? throw new AuthFailedException("NOT_FOUND", "No account found for this email.", 404);

            user.PasswordHash = _passwords.Hash(request.Password);
            user.FailedLoginCount = 0;
            user.LockoutUntil = null;
            if (user.Status is "INVITED" or "LOCKED")
            {
                user.Status = "ACTIVE";
            }

            await _unitOfWork.CompleteAsync();
            _logger.LogInformation("Password reset for {UserId}", user.Id);
        }

        public async Task ChangePasswordAsync(ChangePasswordRequest request)
        {
            var context = await _currentUser.GetContextAsync();
            if (!context.IsAuthenticated)
            {
                throw new UnauthorizedException("You are not signed in.");
            }

            var user = (await Users.FindAsync(u => u.Id == context.UserId)).FirstOrDefault() ?? throw new NotFoundException("User");
            if (string.IsNullOrEmpty(user.PasswordHash) || !_passwords.Verify(user.PasswordHash, request.CurrentPassword))
            {
                throw new AuthFailedException("INVALID_CREDENTIALS", "Your current password is incorrect.", 400);
            }

            if (!ValidationHelper.IsStrongPassword(request.NewPassword))
            {
                throw new ValidationException("Password must be 8+ characters with upper and lower case letters, a number and a symbol.");
            }

            if (_passwords.Verify(user.PasswordHash, request.NewPassword))
            {
                throw new ValidationException("The new password must be different from the current one.");
            }

            user.PasswordHash = _passwords.Hash(request.NewPassword);
            await _unitOfWork.CompleteAsync();
            _logger.LogInformation("Password changed for {UserId}", user.Id);
        }

        public async Task<MeResponse> MeAsync()
        {
            var context = await _currentUser.GetContextAsync();
            if (!context.IsAuthenticated)
            {
                throw new UnauthorizedException("Your session has expired. Please sign in again.");
            }

            var user = (await Users.FindAsync(u => u.Id == context.UserId)).First();
            return new MeResponse { User = UserService.ToDto(user, context.LocationIds), Permissions = context.Permissions.OrderBy(p => p).ToList() };
        }

        public async Task LogoutAsync()
        {
            var context = await _currentUser.GetContextAsync();
            if (context.IsAuthenticated)
            {
                await AuditAsync(context.UserId, context.Name, context.Role, "LOGOUT", "Signed out");
            }
        }

        public async Task<CreateMemberLoginResponse> CreateMemberLoginAsync(CreateMemberLoginRequest request)
        {
            var context = await _currentUser.GetContextAsync();
            if (!context.IsStaff || !context.CanAny("members", PermissionActions.Create, PermissionActions.Edit))
            {
                throw new ForbiddenException();
            }

            var member = (await _unitOfWork.Repository<Member>().FindAsync(m => m.Id == request.MemberId)).FirstOrDefault()
                ?? throw new NotFoundException("Member", request.MemberId);
            if (!context.CanAccessLocation(member.LocationId))
            {
                throw new ForbiddenException();
            }

            var existing = (await Users.FindAsync(u => u.MemberId == member.Id)).FirstOrDefault();
            if (existing != null)
            {
                return new CreateMemberLoginResponse { User = await ToUserDtoAsync(existing), AlreadyExisted = true };
            }

            if ((await Users.FindAsync(u => u.Email == member.Email)).Any())
            {
                throw new ConflictException("Another login already uses this member's email address.");
            }

            var temporary = _passwords.GenerateTemporaryPassword();
            var user = new User
            {
                Id = await _ids.NextIdAsync("USR"),
                Name = $"{member.FirstName} {member.LastName}",
                Email = member.Email,
                Mobile = member.Mobile,
                RoleKey = RoleKeys.Member,
                Status = "ACTIVE",
                MemberId = member.Id,
                PasswordHash = _passwords.Hash(temporary),
            };
            await Users.AddAsync(user);
            await _unitOfWork.Repository<UserLocation>().AddAsync(new UserLocation { UserId = user.Id, LocationId = member.LocationId, CreatedDate = DateTime.UtcNow });
            await _unitOfWork.CompleteAsync();
            _logger.LogInformation("Member login {UserId} created for {MemberId} by {StaffId}", user.Id, member.Id, context.UserId);

            // The temporary password goes only to the member (e-mail / SMS through the active providers); it is not
            // stored in notifications, logs or the API response. Without a provider the member uses "Forgot password".
            var text = $"Welcome to Officera. Sign in with {member.Email} and the temporary password {temporary}, then change it from your profile.";
            var delivered = await _notifications.SendDirectAsync("Member Login Created", member.Email, member.Mobile, "Your Officera login", text, member.LocationId);
            if (!delivered)
            {
                _logger.LogWarning("Login details for {MemberId} could not be delivered (no active e-mail/SMS provider); the member can use Forgot password", member.Id);
            }

            return new CreateMemberLoginResponse { User = await ToUserDtoAsync(user) };
        }

        public async Task UnlockAsync(UnlockUserRequest request)
        {
            var context = await _currentUser.GetContextAsync();
            if (!context.Can("users.edit"))
            {
                throw new ForbiddenException();
            }

            var email = (request.Email ?? string.Empty).Trim().ToLowerInvariant();
            var user = (await Users.FindAsync(u => u.Email == email)).FirstOrDefault() ?? throw new NotFoundException("User");
            user.FailedLoginCount = 0;
            user.LockoutUntil = null;
            if (user.Status == "LOCKED")
            {
                user.Status = "ACTIVE";
            }

            await _unitOfWork.CompleteAsync();
        }

        // ------------------------------------------------------------------ helpers
        private static void EnsureCanSignIn(User user)
        {
            if (user.Status == "INACTIVE")
            {
                throw new AuthFailedException("INACTIVE", "This account has been deactivated. Contact your administrator.", 403);
            }

            if (user.Status == "INVITED" && string.IsNullOrEmpty(user.PasswordHash))
            {
                throw new AuthFailedException("INACTIVE", "Your invitation is pending. Use \"Forgot password\" to set your password.", 403);
            }
        }

        private async Task<AuthResponse> StartSessionAsync(User user)
        {
            user.FailedLoginCount = 0;
            user.LockoutUntil = null;
            user.LastLogin = DateTime.UtcNow;
            if (user.Status is "INVITED" or "LOCKED")
            {
                user.Status = "ACTIVE";
            }

            await _unitOfWork.CompleteAsync();

            var (token, expires) = _jwt.CreateToken(user.Id, user.Name, user.Email, user.RoleKey, user.MemberId);
            var permissions = await PermissionsForAsync(user.RoleKey);
            await AuditAsync(user.Id, user.Name, user.RoleKey, "LOGIN", "Signed in");
            _logger.LogInformation("User {UserId} signed in as {Role}", user.Id, user.RoleKey);

            return new AuthResponse
            {
                Token = token,
                ExpiresAt = DateTimeHelper.ToIso(expires),
                User = await ToUserDtoAsync(user),
                Permissions = permissions,
            };
        }

        private async Task<UserDto> ToUserDtoAsync(User user)
        {
            var locations = (await _unitOfWork.Repository<UserLocation>().FindAsync(l => l.UserId == user.Id)).Select(l => l.LocationId);
            return UserService.ToDto(user, locations);
        }

        private async Task<List<string>> PermissionsForAsync(string roleKey)
        {
            if (roleKey == RoleKeys.SuperAdmin)
            {
                return (await _unitOfWork.Repository<Permission>().FindAsync(p => true)).Select(p => p.PermissionKey).OrderBy(p => p).ToList();
            }

            var role = (await _unitOfWork.Repository<Role>().FindAsync(r => r.RoleKey == roleKey)).FirstOrDefault();
            if (role == null)
            {
                return new List<string>();
            }

            return (await _unitOfWork.Repository<RolePermission>().FindAsync(p => p.RoleId == role.Id)).Select(p => p.PermissionKey).OrderBy(p => p).ToList();
        }

        private async Task AuditAsync(string userId, string name, string role, string action, string description)
        {
            await _unitOfWork.Repository<AuditLog>().AddAsync(new AuditLog
            {
                Id = await _ids.NextIdAsync("AUD"),
                UserId = userId,
                UserName = name,
                RoleName = RoleLabels.For(role),
                Action = action,
                Module = "Authentication",
                Entity = "Session",
                EntityId = userId,
                LoggedAt = DateTime.UtcNow,
                IpAddress = _currentUser.IpAddress ?? string.Empty,
                Device = ClaimsHelper.DeviceFromUserAgent(_currentUser.UserAgent),
                Description = description,
            });
            await _unitOfWork.CompleteAsync();
        }

        private async Task<(int MaxAttempts, int LockoutMinutes)> GetRulesAsync()
        {
            var row = (await _unitOfWork.Repository<OrgSetting>().FindAsync(s => s.Id == 1)).FirstOrDefault();
            return (row?.MaxLoginAttempts ?? 5, row?.LockoutMinutes ?? 15);
        }

        private static long ToEpochMs(DateTime utc) => new DateTimeOffset(DateTime.SpecifyKind(utc, DateTimeKind.Utc)).ToUnixTimeMilliseconds();

        private static string ToIndiaTime(DateTime utc)
        {
            try
            {
                var zone = TimeZoneInfo.FindSystemTimeZoneById("India Standard Time");
                return TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), zone).ToString("hh:mm tt");
            }
            catch (TimeZoneNotFoundException)
            {
                return utc.ToString("HH:mm") + " UTC";
            }
        }
    }
}
