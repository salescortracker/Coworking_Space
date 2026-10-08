using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using officera.BusinessAccessLayer.Interfaces;
using officera.BusinessAccessLayer.Services;
using officera.DataAccessLayer.Data;
using officera.DataAccessLayer.Repositories;
using officera.Shared.Common;

namespace officera_API.Infrastructure
{
    /// <summary>Dependency-injection and pipeline setup, kept out of Program.cs.</summary>
    public static class ServiceRegistration
    {
        public const string CorsPolicy = "AllowAngular";

        public static IServiceCollection AddOfficeraData(this IServiceCollection services, IConfiguration configuration)
        {
            var connectionString = configuration.GetConnectionString("DefaultConnection");
            if (string.IsNullOrWhiteSpace(connectionString))
            {
                throw new InvalidOperationException("ConnectionStrings:DefaultConnection is missing from appsettings.json.");
            }

            services.AddHttpContextAccessor();
            services.AddScoped<IAuditUserProvider, HttpContextAuditUserProvider>();
            services.AddDbContext<OfficeraContext>((sp, options) =>
            {
                options.UseSqlServer(
                    connectionString,
                    sql => sql.EnableRetryOnFailure(
                        maxRetryCount: 3,
                        maxRetryDelay: TimeSpan.FromSeconds(5),
                        errorNumbersToAdd: null));
                options.AddInterceptors(new AuditSaveChangesInterceptor(sp.GetRequiredService<IAuditUserProvider>()));
            });

            services.AddScoped(typeof(IGeneralRepository<>), typeof(GeneralRepository<>));
            services.AddScoped<IUnitOfWork, UnitOfWork>();
            return services;
        }

        public static IServiceCollection AddOfficeraBusiness(this IServiceCollection services, IConfiguration configuration)
        {
            services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.SectionName));
            services.Configure<OtpOptions>(configuration.GetSection(OtpOptions.SectionName));
            services.Configure<FileStorageOptions>(configuration.GetSection(FileStorageOptions.SectionName));
            services.Configure<LoginUrlOptions>(configuration.GetSection(LoginUrlOptions.SectionName));

            services.AddHttpClient("integrations", c => c.Timeout = TimeSpan.FromSeconds(15));

            services.AddScoped<ICurrentUserService, CurrentUserService>();
            services.AddScoped<IIdSequenceService, IdSequenceService>();
            services.AddScoped<ServiceContext>();

            // Module services (Controller → Service → UnitOfWork / Repository → OfficeraContext)
            services.AddScoped<ILocationService, LocationService>();
            services.AddScoped<IResourceService, ResourceService>();
            services.AddScoped<IMemberService, MemberService>();
            services.AddScoped<ICompanyService, CompanyService>();
            services.AddScoped<IUserService, UserService>();
            services.AddScoped<IRoleService, RoleService>();
            services.AddScoped<IPlanService, PlanService>();
            services.AddScoped<IPromotionService, PromotionService>();
            services.AddScoped<ISubscriptionService, SubscriptionService>();
            services.AddScoped<ICreditTransactionService, CreditTransactionService>();
            services.AddScoped<IBookingService, BookingService>();
            services.AddScoped<IPaymentService, PaymentService>();
            services.AddScoped<IInvoiceService, InvoiceService>();
            services.AddScoped<IRefundService, RefundService>();
            services.AddScoped<ICreditNoteService, CreditNoteService>();
            services.AddScoped<IVisitorService, VisitorService>();
            services.AddScoped<IAccessCredentialService, AccessCredentialService>();
            services.AddScoped<IAccessLogService, AccessLogService>();
            services.AddScoped<ITicketService, TicketService>();
            services.AddScoped<INotificationDataService, NotificationDataService>();
            services.AddScoped<INotificationTemplateService, NotificationTemplateService>();
            services.AddScoped<INotificationLogService, NotificationLogService>();
            services.AddScoped<IAuditLogService, AuditLogService>();
            services.AddScoped<ILeadService, LeadService>();
            services.AddScoped<IPostService, PostService>();
            services.AddScoped<IEventService, EventService>();
            services.AddScoped<IPerkService, PerkService>();
            services.AddScoped<IBlogPostService, BlogPostService>();
            services.AddScoped<IGalleryService, GalleryService>();
            services.AddScoped<IIntegrationService, IntegrationService>();
            services.AddScoped<ISettingsService, SettingsService>();
            services.AddScoped<IHomepageContentService, HomepageContentService>();
            services.AddScoped<ILookupService, LookupService>();
            services.AddScoped<IDashboardService, DashboardService>();

            // Security
            services.AddSingleton<IPasswordService, PasswordService>();
            services.AddSingleton<IJwtTokenService, JwtTokenService>();
            services.AddScoped<IOtpService, OtpService>();
            services.AddScoped<IAuthService, AuthService>();

            // Infrastructure / third-party providers (resolved from Configuration / Integrations at runtime)
            services.AddScoped<IFileStorageService, FileStorageService>();
            services.AddScoped<IEmailService, EmailService>();
            services.AddScoped<ISmsService, SmsService>();
            services.AddScoped<INotificationService, NotificationService>();
            services.AddScoped<IPaymentGatewayService, PaymentGatewayService>();
            services.AddSingleton<ICalendarService, CalendarService>();
            return services;
        }

        public static IServiceCollection AddOfficeraSecurity(this IServiceCollection services, IConfiguration configuration, IWebHostEnvironment environment)
        {
            var jwt = configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>() ?? new JwtOptions();
            if (string.IsNullOrWhiteSpace(jwt.Key) || Encoding.UTF8.GetByteCount(jwt.Key) < 32)
            {
                throw new InvalidOperationException(
                    "Jwt:Key is not configured (minimum 32 characters). Set it with " +
                    "'dotnet user-secrets set \"Jwt:Key\" \"<random value>\"' in officera_API, or the Jwt__Key environment variable. " +
                    "It must never be committed to appsettings.json or source code.");
            }

            services
                .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
                .AddJwtBearer(options =>
                {
                    options.MapInboundClaims = false;
                    options.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuer = true,
                        ValidIssuer = jwt.Issuer,
                        ValidateAudience = true,
                        ValidAudience = jwt.Audience,
                        ValidateIssuerSigningKey = true,
                        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key)),
                        ValidateLifetime = true,
                        ClockSkew = TimeSpan.FromMinutes(1),
                        RoleClaimType = System.Security.Claims.ClaimTypes.Role,
                        NameClaimType = OfficeraClaims.Name,
                    };
                    options.Events = new JwtBearerEvents
                    {
                        OnAuthenticationFailed = ctx =>
                        {
                            var logger = ctx.HttpContext.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("JwtBearer");
                            logger.LogWarning("JWT rejected for {Path}: {Reason}", ctx.Request.Path, ctx.Exception.GetType().Name);
                            if (ctx.Exception is SecurityTokenExpiredException)
                            {
                                ctx.Response.Headers.Append("Token-Expired", "true");
                            }

                            return Task.CompletedTask;
                        },
                        OnChallenge = async ctx =>
                        {
                            ctx.HandleResponse();
                            ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
                            ctx.Response.ContentType = "application/json";
                            await ctx.Response.WriteAsync(System.Text.Json.JsonSerializer.Serialize(
                                ApiResponse<object>.Fail("Please sign in to continue.", 401), JsonHelper.Options));
                        },
                        OnForbidden = async ctx =>
                        {
                            ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
                            ctx.Response.ContentType = "application/json";
                            await ctx.Response.WriteAsync(System.Text.Json.JsonSerializer.Serialize(
                                ApiResponse<object>.Fail("You do not have permission to perform this action.", 403), JsonHelper.Options));
                        },
                    };
                });
            services.AddAuthorization();

            // Encryption keys for integration secrets. Stored outside wwwroot; protected with DPAPI on Windows.
            var keysFolder = new DirectoryInfo(Path.Combine(environment.ContentRootPath, "App_Data", "DataProtection-Keys"));
            var dataProtection = services.AddDataProtection().SetApplicationName("Officera").PersistKeysToFileSystem(keysFolder);
            if (OperatingSystem.IsWindows())
            {
                dataProtection.ProtectKeysWithDpapi();
            }

            // Brute-force protection for sign-in and OTP endpoints.
            services.AddRateLimiter(options =>
            {
                options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
                options.AddPolicy("auth", ctx => RateLimitPartition.GetFixedWindowLimiter(
                    ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                    _ => new FixedWindowRateLimiterOptions { PermitLimit = 20, Window = TimeSpan.FromMinutes(1) }));
                options.AddPolicy("otp", ctx => RateLimitPartition.GetFixedWindowLimiter(
                    ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                    _ => new FixedWindowRateLimiterOptions { PermitLimit = 5, Window = TimeSpan.FromMinutes(1) }));
                options.OnRejected = async (ctx, token) =>
                {
                    ctx.HttpContext.Response.ContentType = "application/json";
                    await ctx.HttpContext.Response.WriteAsync(System.Text.Json.JsonSerializer.Serialize(
                        ApiResponse<object>.Fail("Too many attempts. Please wait a minute and try again.", 429), JsonHelper.Options), token);
                };
            });

            var origins = configuration.GetSection(CorsOptions.SectionName).Get<CorsOptions>()?.AllowedOrigins ?? Array.Empty<string>();
            services.AddCors(options => options.AddPolicy(CorsPolicy, policy =>
            {
                policy.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod().WithExposedHeaders("Token-Expired");
            }));

            return services;
        }

        public static IServiceCollection AddOfficeraApi(this IServiceCollection services)
        {
            services
                .AddControllers()
                .AddJsonOptions(o => JsonHelper.Configure(o.JsonSerializerOptions))
                .ConfigureApiBehaviorOptions(o =>
                {
                    // Model binding errors use the same envelope as every other error.
                    o.InvalidModelStateResponseFactory = ctx =>
                    {
                        var errors = ctx.ModelState
                            .Where(kv => kv.Value?.Errors.Count > 0)
                            .SelectMany(kv => kv.Value!.Errors.Select(e => string.IsNullOrEmpty(kv.Key) ? e.ErrorMessage : $"{kv.Key}: {e.ErrorMessage}"))
                            .ToList();
                        return new BadRequestObjectResult(ApiResponse<object>.Fail("The request is not valid.", 400, errors));
                    };
                });

            services.AddEndpointsApiExplorer();
            services.AddSwaggerGen(c =>
            {
                c.SwaggerDoc("v1", new OpenApiInfo
                {
                    Title = "Officera API",
                    Version = "v1",
                    Description = "Officera coworking management platform. Sign in with POST /api/Auth/Login, then click Authorize and enter: Bearer {token}",
                });

                c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
                {
                    Name = "Authorization",
                    In = ParameterLocation.Header,
                    Type = SecuritySchemeType.ApiKey,
                    Scheme = "Bearer",
                    BearerFormat = "JWT",
                    Description = "Enter: Bearer {your JWT token}",
                });
                c.AddSecurityRequirement(new OpenApiSecurityRequirement
                {
                    {
                        new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } },
                        Array.Empty<string>()
                    },
                });

                c.CustomSchemaIds(t => t.FullName?.Replace('+', '.'));
                var xml = Path.Combine(AppContext.BaseDirectory, $"{typeof(ServiceRegistration).Assembly.GetName().Name}.xml");
                if (File.Exists(xml))
                {
                    c.IncludeXmlComments(xml);
                }
            });

            return services;
        }
    }
}
