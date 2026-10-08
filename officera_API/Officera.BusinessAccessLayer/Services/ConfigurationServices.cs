using System.Diagnostics;
using System.Linq.Expressions;
using System.Net.Http.Headers;
using System.Net.Sockets;
using System.Text;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Logging;
using officera.BusinessAccessLayer.DTOs;
using officera.BusinessAccessLayer.Interfaces;
using officera.DataAccessLayer.Entities;
using officera.DataAccessLayer.Repositories;
using officera.Shared.Common;

namespace officera.BusinessAccessLayer.Services
{
    /// <summary>
    /// Configuration / Integrations (Super Admin). Non-secret settings are stored as JSON; secret values are encrypted
    /// with ASP.NET Core Data Protection into config.IntegrationSecrets and only a masked hint is ever returned.
    /// </summary>
    public class IntegrationService : CrudServiceBase<Integration, IntegrationDto>, IIntegrationService
    {
        private const string ProtectorPurpose = "Officera.IntegrationSecrets.v1";
        private static readonly string[] Statuses = { "CONNECTED", "NOT_CONFIGURED", "ERROR", "DISABLED", "UNTESTED" };
        private readonly IDataProtector _protector;
        private readonly IHttpClientFactory _httpClientFactory;

        public IntegrationService(ServiceContext context, IDataProtectionProvider dataProtection, IHttpClientFactory httpClientFactory)
            : base(context)
        {
            _protector = dataProtection.CreateProtector(ProtectorPurpose);
            _httpClientFactory = httpClientFactory;
        }

        protected override string EntityName => "Integration";
        protected override string ModuleKey => "integrations";
        protected override string IdPrefix => "INT";

        /// <summary>
        /// Every screen needs to know which provider is active (checkout shows the gateway, login shows "Continue
        /// with Google" ...). Callers without integrations.view only get active providers with settings removed.
        /// </summary>
        protected override ReadAccess ReadAccess => ReadAccess.Public;

        protected override Expression<Func<Integration, bool>>? PublicFilter => e => e.IsActive && e.Enabled;

        protected override Expression<Func<Integration, bool>> IdEquals(string id) => e => e.Id == id;
        protected override string KeyOf(Integration entity) => entity.Id;
        protected override void SetKey(Integration entity, string id) => entity.Id = id;

        public override async Task<PagedResult<IntegrationDto>> GetAsync(PagedRequest request)
        {
            var user = await CurrentUser.GetContextAsync();
            var result = await base.GetAsync(request);
            if (!user.Can("integrations.view"))
            {
                result.Items = result.Items.Where(i => i.Active && i.Enabled).Select(Sanitize).ToList();
                result.TotalCount = result.Items.Count;
            }

            return result;
        }

        public override async Task<IntegrationDto> GetByIdAsync(string id)
        {
            var user = await CurrentUser.GetContextAsync();
            var dto = await base.GetByIdAsync(id);
            return user.Can("integrations.view") ? dto : Sanitize(dto);
        }

        private static IntegrationDto Sanitize(IntegrationDto dto)
        {
            dto.Config = new Dictionary<string, string>();
            dto.Secrets = new Dictionary<string, SecretRefDto>();
            dto.Tests = new List<ConnectionTestDto>();
            return dto;
        }

        protected override IEnumerable<string?> SearchValues(IntegrationDto dto) => new[] { dto.DisplayName, dto.ProviderKey, dto.Category };

        protected override IntegrationDto ToDto(Integration e) => ToDto(e, Array.Empty<IntegrationSecret>());

        private static IntegrationDto ToDto(Integration e, IEnumerable<IntegrationSecret> secrets) => new()
        {
            Id = e.Id,
            Category = e.Category,
            ProviderKey = e.ProviderKey,
            DisplayName = e.DisplayName,
            Environment = e.Environment,
            Enabled = e.Enabled,
            Active = e.IsActive,
            Status = e.Status,
            Config = JsonHelper.Deserialize(e.ConfigJson, new Dictionary<string, string>()),
            Secrets = secrets.ToDictionary(
                s => s.FieldKey,
                s => new SecretRefDto { IsSet = true, Hint = s.Hint, VaultRef = $"db://config.IntegrationSecrets/{e.Id}/{s.FieldKey}", UpdatedAt = DateTimeHelper.ToIso(s.UpdatedAt) }),
            Tests = JsonHelper.DeserializeList<ConnectionTestDto>(e.TestsJson),
            UpdatedAt = DateTimeHelper.ToIso(e.ModifiedDate ?? e.CreatedDate),
            UpdatedBy = e.UpdatedByName,
        };

        protected override async Task<List<IntegrationDto>> ToDtosAsync(IReadOnlyList<Integration> entities)
        {
            var ids = entities.Select(e => e.Id).ToList();
            var secrets = (await Repo<IntegrationSecret>().FindAsync(s => ids.Contains(s.IntegrationId))).ToLookup(s => s.IntegrationId);
            return entities.Select(e => ToDto(e, secrets[e.Id])).ToList();
        }

        protected override void MapToEntity(IntegrationDto dto, Integration e, bool isNew)
        {
            e.Category = dto.Category;
            e.ProviderKey = dto.ProviderKey;
            e.DisplayName = dto.DisplayName.Trim();
            e.Environment = dto.Environment;
            e.Enabled = dto.Enabled;
            e.IsActive = dto.Active && dto.Enabled;
            e.Status = dto.Enabled ? dto.Status : "DISABLED";
            e.ConfigJson = JsonHelper.Serialize(dto.Config ?? new Dictionary<string, string>());
            e.TestsJson = JsonHelper.Serialize((dto.Tests ?? new()).Take(10).ToList());
        }

        protected override async Task ValidateAsync(IntegrationDto dto, Integration? existing, CurrentUserContext user)
        {
            new ValidationHelper.Collector()
                .OneOf(dto.Category, IntegrationCategories.All, "Category")
                .Required(dto.ProviderKey, "Provider")
                .Required(dto.DisplayName, "Display name").MaxLength(dto.DisplayName, 150, "Display name")
                .OneOf(dto.Environment, new[] { "SANDBOX", "LIVE" }, "Environment")
                .OneOf(dto.Status, Statuses, "Status")
                .Must((dto.Config ?? new()).Keys.All(k => k.Length <= 60), "Configuration keys are too long.")
                .Must((dto.SecretInputs ?? new()).Values.All(v => v.Length <= 8000), "A secret value is too long.")
                .ThrowIfInvalid();

            var badUrls = (dto.Config ?? new())
                .Where(kv => kv.Key.EndsWith("Url", StringComparison.OrdinalIgnoreCase) || kv.Key.EndsWith("Uri", StringComparison.OrdinalIgnoreCase))
                .Where(kv => !string.IsNullOrWhiteSpace(kv.Value) && !ValidationHelper.IsHttpUrl(kv.Value))
                .Select(kv => kv.Key)
                .ToList();
            if (badUrls.Count > 0)
            {
                throw new ValidationException($"Invalid URL in: {string.Join(", ", badUrls)}.");
            }

            await Task.CompletedTask;
        }

        protected override async Task OnSavingAsync(Integration entity, IntegrationDto dto, bool isNew, CurrentUserContext user)
        {
            entity.UpdatedByName = string.IsNullOrEmpty(user.Name) ? "Super Admin" : user.Name;

            // One active provider per category.
            if (entity.IsActive)
            {
                var others = await Repository.FindAsync(i => i.Category == entity.Category && i.Id != entity.Id && i.IsActive);
                foreach (var other in others)
                {
                    other.IsActive = false;
                }
            }

            var secretRepo = Repo<IntegrationSecret>();
            var stored = isNew ? new List<IntegrationSecret>() : (await secretRepo.FindAsync(s => s.IntegrationId == entity.Id)).ToList();

            // Secrets the admin cleared are removed.
            var keep = (dto.Secrets ?? new()).Where(kv => kv.Value?.IsSet == true).Select(kv => kv.Key).ToHashSet();
            foreach (var secret in stored.Where(s => !keep.Contains(s.FieldKey) && !(dto.SecretInputs?.ContainsKey(s.FieldKey) ?? false)))
            {
                secretRepo.Remove(secret);
            }

            // New values are encrypted; the plain text is never stored or logged.
            foreach (var (key, value) in dto.SecretInputs ?? new())
            {
                if (string.IsNullOrWhiteSpace(value))
                {
                    continue;
                }

                var trimmed = value.Trim();
                var row = stored.FirstOrDefault(s => s.FieldKey == key);
                if (row == null)
                {
                    row = new IntegrationSecret { IntegrationId = entity.Id, FieldKey = key };
                    await secretRepo.AddAsync(row);
                }

                row.ProtectedValue = _protector.Protect(trimmed);
                row.Hint = "••••" + (trimmed.Length > 4 ? trimmed[^4..] : string.Empty);
                row.UpdatedAt = DateTime.UtcNow;
                row.UpdatedBy = user.UserId;
            }

            dto.SecretInputs = null;
        }

        public async Task<ActiveProviderConfig?> GetActiveProviderAsync(string category)
        {
            var integration = (await Repository.FindAsync(i => i.Category == category && i.IsActive && i.Enabled && i.Status != "ERROR")).FirstOrDefault();
            if (integration == null)
            {
                return null;
            }

            return await ResolveAsync(integration);
        }

        private async Task<ActiveProviderConfig> ResolveAsync(Integration integration)
        {
            var secrets = new Dictionary<string, string>();
            foreach (var secret in await Repo<IntegrationSecret>().FindAsync(s => s.IntegrationId == integration.Id))
            {
                try
                {
                    secrets[secret.FieldKey] = _protector.Unprotect(secret.ProtectedValue);
                }
                catch (System.Security.Cryptography.CryptographicException ex)
                {
                    Logger.LogError(ex, "Secret {Field} of integration {IntegrationId} cannot be decrypted (data-protection keys changed?)", secret.FieldKey, integration.Id);
                }
            }

            return new ActiveProviderConfig
            {
                IntegrationId = integration.Id,
                ProviderKey = integration.ProviderKey,
                DisplayName = integration.DisplayName,
                Environment = integration.Environment,
                Config = JsonHelper.Deserialize(integration.ConfigJson, new Dictionary<string, string>()),
                Secrets = secrets,
            };
        }

        /// <summary>
        /// Server-side connection test. Providers with a public API are called with the stored credentials
        /// (SendGrid, Twilio, Razorpay, Stripe, Slack webhook); SMTP and other host/URL based providers get a
        /// network reachability check.
        /// </summary>
        public async Task<ConnectionTestDto> TestConnectionAsync(string id)
        {
            var user = await CurrentUser.GetContextAsync();
            if (!user.Can("integrations.edit") && !user.Can("integrations.create"))
            {
                throw new ForbiddenException();
            }

            var integration = await FindUnscopedAsync(id) ?? throw new NotFoundException(EntityName, id);
            var watch = Stopwatch.StartNew();
            bool ok;
            string message;

            if (!integration.Enabled)
            {
                ok = false;
                message = "Integration is disabled. Enable it before testing.";
            }
            else
            {
                var provider = await ResolveAsync(integration);
                try
                {
                    (ok, message) = await ProbeAsync(provider);
                }
                catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or SocketException or IOException)
                {
                    ok = false;
                    message = $"Could not reach {integration.DisplayName}: {ex.Message}";
                }
            }

            watch.Stop();
            var result = new ConnectionTestDto
            {
                At = DateTimeHelper.ToIso(DateTime.UtcNow),
                Ok = ok,
                LatencyMs = (int)watch.ElapsedMilliseconds,
                Message = message,
                By = string.IsNullOrEmpty(user.Name) ? "Super Admin" : user.Name,
            };

            var tests = JsonHelper.DeserializeList<ConnectionTestDto>(integration.TestsJson);
            tests.Insert(0, result);
            integration.TestsJson = JsonHelper.Serialize(tests.Take(10).ToList());
            integration.Status = ok ? "CONNECTED" : "ERROR";
            integration.UpdatedByName = result.By;
            Repository.Update(integration);
            await UnitOfWork.CompleteAsync();

            Logger.LogInformation("Integration {IntegrationId} ({Provider}) tested: {Ok}", integration.Id, integration.ProviderKey, ok);
            return result;
        }

        private async Task<(bool Ok, string Message)> ProbeAsync(ActiveProviderConfig p)
        {
            var http = _httpClientFactory.CreateClient("integrations");
            http.Timeout = TimeSpan.FromSeconds(8);

            switch (p.ProviderKey)
            {
                case "SENDGRID":
                {
                    using var req = new HttpRequestMessage(HttpMethod.Get, "https://api.sendgrid.com/v3/scopes");
                    req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", p.Get("apiKey"));
                    using var res = await http.SendAsync(req);
                    return res.IsSuccessStatusCode ? (true, "SendGrid accepted the API key.") : (false, $"SendGrid rejected the API key ({(int)res.StatusCode}).");
                }
                case "TWILIO":
                {
                    var sid = p.Get("accountSid");
                    using var req = new HttpRequestMessage(HttpMethod.Get, $"https://api.twilio.com/2010-04-01/Accounts/{Uri.EscapeDataString(sid)}.json");
                    req.Headers.Authorization = Basic(sid, p.Get("authToken"));
                    using var res = await http.SendAsync(req);
                    return res.IsSuccessStatusCode ? (true, "Twilio credentials verified.") : (false, $"Twilio rejected the credentials ({(int)res.StatusCode}).");
                }
                case "RAZORPAY":
                {
                    using var req = new HttpRequestMessage(HttpMethod.Get, "https://api.razorpay.com/v1/orders?count=1");
                    req.Headers.Authorization = Basic(p.Get("keyId"), p.Get("keySecret"));
                    using var res = await http.SendAsync(req);
                    return res.IsSuccessStatusCode ? (true, "Razorpay credentials verified.") : (false, $"Razorpay rejected the credentials ({(int)res.StatusCode}).");
                }
                case "STRIPE":
                {
                    using var req = new HttpRequestMessage(HttpMethod.Get, "https://api.stripe.com/v1/balance");
                    req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", p.Get("secretKey"));
                    using var res = await http.SendAsync(req);
                    return res.IsSuccessStatusCode ? (true, "Stripe secret key verified.") : (false, $"Stripe rejected the secret key ({(int)res.StatusCode}).");
                }
                case "SMTP":
                {
                    var host = p.Get("host");
                    if (!int.TryParse(p.Get("port"), out var port))
                    {
                        port = 587;
                    }

                    using var tcp = new TcpClient();
                    using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(8));
                    await tcp.ConnectAsync(host, port, cts.Token);
                    return (true, $"SMTP server {host}:{port} is reachable. Credentials are verified on the first send.");
                }
            }

            // Generic: probe the first configured URL.
            var url = p.Config.Values.FirstOrDefault(ValidationHelper.IsHttpUrl);
            if (url != null)
            {
                using var res = await http.GetAsync(url);
                return (true, $"{p.DisplayName} endpoint responded ({(int)res.StatusCode}). Credentials are verified when the provider is first used.");
            }

            var missing = p.Config.Count == 0 && p.Secrets.Count == 0;
            return missing
                ? (false, "No settings have been entered for this provider.")
                : (true, $"Settings for {p.DisplayName} are stored. This provider has no test endpoint; it is verified when first used.");
        }

        private static AuthenticationHeaderValue Basic(string user, string password) =>
            new("Basic", Convert.ToBase64String(Encoding.UTF8.GetBytes($"{user}:{password}")));
    }

    /// <summary>Organisation settings (GST registration + business rules). Single row config.OrgSettings.</summary>
    public class SettingsService : ISettingsService
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly ICurrentUserService _currentUser;

        public SettingsService(IUnitOfWork unitOfWork, ICurrentUserService currentUser)
        {
            _unitOfWork = unitOfWork;
            _currentUser = currentUser;
        }

        public async Task<OrgSettingsDto> GetAsync()
        {
            var row = (await _unitOfWork.Repository<OrgSetting>().FindAsync(s => s.Id == 1)).FirstOrDefault()
                ?? throw new NotFoundException("Organisation settings (run Database/02_SeedData.sql)");
            return ToDto(row);
        }

        public async Task<OrgSettingsDto> UpdateAsync(OrgSettingsDto dto)
        {
            var user = await _currentUser.GetContextAsync();
            if (!user.Can("settings.edit"))
            {
                throw new ForbiddenException();
            }

            var s = dto.Supplier ?? new SupplierInfoDto();
            new ValidationHelper.Collector()
                .Required(s.LegalName, "Legal name")
                .Must(ValidationHelper.IsGstin(s.Gstin), "GSTIN is not valid.")
                .Must(ValidationHelper.IsPan(s.Pan), "PAN is not valid.")
                .Required(s.Address, "Registered address")
                .Required(s.State, "State")
                .Must(s.StateCode.Length == 2 && s.StateCode.All(char.IsDigit), "State code must be 2 digits.")
                .Email(s.Email, "Billing email")
                .Range(dto.GstRate, 0, 28, "GST rate")
                .Must(dto.SlotLockMinutes >= 1, "Slot lock must be at least 1 minute.")
                .Must(dto.FreeCancellationHours >= 0, "Free cancellation window cannot be negative.")
                .Must(dto.TicketEscalationHours >= 1, "Ticket escalation must be at least 1 hour.")
                .Must(dto.PaymentRetryDays is { Count: > 0 } && dto.PaymentRetryDays.All(d => d > 0), "Payment retry days must be positive numbers.")
                .Must(dto.GracePeriodDays >= 0, "Grace period cannot be negative.")
                .Must(dto.BookingReminderMinutes >= 5, "Booking reminder must be at least 5 minutes.")
                .Must(dto.RenewalReminderDays >= 1, "Renewal reminder must be at least 1 day.")
                .Must(dto.MaxLoginAttempts >= 1, "Max failed logins must be at least 1.")
                .Must(dto.LockoutMinutes >= 1, "Lockout must be at least 1 minute.")
                .ThrowIfInvalid();

            var repo = _unitOfWork.Repository<OrgSetting>();
            var row = (await repo.FindAsync(x => x.Id == 1)).FirstOrDefault();
            if (row == null)
            {
                row = new OrgSetting { Id = 1 };
                await repo.AddAsync(row);
            }

            row.LegalName = s.LegalName.Trim();
            row.Gstin = s.Gstin.Trim().ToUpperInvariant();
            row.Address = s.Address.Trim();
            row.State = s.State.Trim();
            row.StateCode = s.StateCode.Trim();
            row.Pan = s.Pan.Trim().ToUpperInvariant();
            row.Email = s.Email.Trim();
            row.Phone = s.Phone?.Trim() ?? string.Empty;
            row.GstRate = dto.GstRate;
            row.SlotLockMinutes = dto.SlotLockMinutes;
            row.FreeCancellationHours = dto.FreeCancellationHours;
            row.TicketEscalationHours = dto.TicketEscalationHours;
            row.PaymentRetryDays = string.Join(",", dto.PaymentRetryDays);
            row.GracePeriodDays = dto.GracePeriodDays;
            row.BookingReminderMinutes = dto.BookingReminderMinutes;
            row.RenewalReminderDays = dto.RenewalReminderDays;
            row.MaxLoginAttempts = dto.MaxLoginAttempts;
            row.LockoutMinutes = dto.LockoutMinutes;
            row.Currency = string.IsNullOrWhiteSpace(dto.Currency) ? "INR" : dto.Currency;
            row.Timezone = string.IsNullOrWhiteSpace(dto.Timezone) ? "Asia/Kolkata" : dto.Timezone;
            await _unitOfWork.CompleteAsync();
            return ToDto(row);
        }

        public static OrgSettingsDto ToDto(OrgSetting r) => new()
        {
            Supplier = new SupplierInfoDto
            {
                LegalName = r.LegalName,
                Gstin = r.Gstin,
                Address = r.Address,
                State = r.State,
                StateCode = r.StateCode,
                Pan = r.Pan,
                Email = r.Email,
                Phone = r.Phone,
            },
            GstRate = r.GstRate,
            SlotLockMinutes = r.SlotLockMinutes,
            FreeCancellationHours = r.FreeCancellationHours,
            TicketEscalationHours = r.TicketEscalationHours,
            PaymentRetryDays = r.PaymentRetryDays.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(x => int.TryParse(x, out var v) ? v : 0).Where(v => v > 0).ToList(),
            GracePeriodDays = r.GracePeriodDays,
            BookingReminderMinutes = r.BookingReminderMinutes,
            RenewalReminderDays = r.RenewalReminderDays,
            MaxLoginAttempts = r.MaxLoginAttempts,
            LockoutMinutes = r.LockoutMinutes,
            Currency = r.Currency,
            Timezone = r.Timezone,
        };
    }

    /// <summary>Homepage marketing copy (Marketing Content → Homepage). Single row content.HomepageContent.</summary>
    public class HomepageContentService : IHomepageContentService
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly ICurrentUserService _currentUser;

        public HomepageContentService(IUnitOfWork unitOfWork, ICurrentUserService currentUser)
        {
            _unitOfWork = unitOfWork;
            _currentUser = currentUser;
        }

        public async Task<HomepageContentDto> GetAsync()
        {
            var row = (await _unitOfWork.Repository<HomepageContent>().FindAsync(h => h.Id == 1)).FirstOrDefault();
            return row == null ? new HomepageContentDto() : ToDto(row);
        }

        public async Task<HomepageContentDto> UpdateAsync(HomepageContentDto dto)
        {
            var user = await _currentUser.GetContextAsync();
            if (!user.CanAny("content", PermissionActions.Edit, PermissionActions.Create))
            {
                throw new ForbiddenException();
            }

            new ValidationHelper.Collector()
                .Required(dto.HeroTitle, "Hero title").MaxLength(dto.HeroTitle, 200, "Hero title")
                .Required(dto.HeroSubtitle, "Hero subtitle").MaxLength(dto.HeroSubtitle, 1000, "Hero subtitle")
                .MaxLength(dto.Announcement, 500, "Announcement")
                .ThrowIfInvalid();

            var repo = _unitOfWork.Repository<HomepageContent>();
            var row = (await repo.FindAsync(h => h.Id == 1)).FirstOrDefault();
            if (row == null)
            {
                row = new HomepageContent { Id = 1 };
                await repo.AddAsync(row);
            }

            row.HeroTitle = dto.HeroTitle.Trim();
            row.HeroSubtitle = dto.HeroSubtitle.Trim();
            row.StatsJson = JsonHelper.Serialize(dto.Stats ?? new());
            row.TestimonialsJson = JsonHelper.Serialize(dto.Testimonials ?? new());
            row.FeaturesJson = JsonHelper.Serialize(dto.Features ?? new());
            row.Announcement = dto.Announcement ?? string.Empty;
            row.ShowAnnouncement = dto.ShowAnnouncement;
            await _unitOfWork.CompleteAsync();
            return ToDto(row);
        }

        private static HomepageContentDto ToDto(HomepageContent r) => new()
        {
            HeroTitle = r.HeroTitle,
            HeroSubtitle = r.HeroSubtitle,
            Stats = JsonHelper.DeserializeList<LabelValueDto>(r.StatsJson),
            Testimonials = JsonHelper.DeserializeList<TestimonialDto>(r.TestimonialsJson),
            Features = JsonHelper.DeserializeList<FeatureDto>(r.FeaturesJson),
            Announcement = r.Announcement,
            ShowAnnouncement = r.ShowAnnouncement,
        };
    }

    /// <summary>Dropdown reference data.</summary>
    public class LookupService : ILookupService
    {
        private readonly IUnitOfWork _unitOfWork;

        public LookupService(IUnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }

        public async Task<List<StateDto>> GetStatesAsync() =>
            (await _unitOfWork.Repository<State>().FindAsync(s => s.IsActive))
                .OrderBy(s => s.SortOrder).ThenBy(s => s.Name)
                .Select(s => new StateDto { Code = s.StateCode, Name = s.Name })
                .ToList();
    }
}
