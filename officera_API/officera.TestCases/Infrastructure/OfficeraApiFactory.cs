using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using officera.BusinessAccessLayer.Interfaces;
using officera.DataAccessLayer.Data;
using officera.DataAccessLayer.Entities;
using officera.Shared.Common;

namespace officera.TestCases.Infrastructure
{
    /// <summary>
    /// Runs the real API pipeline (controllers → services → UnitOfWork/Repository → OfficeraContext) in memory.
    /// SQL Server is replaced by the EF Core in-memory provider seeded with the same reference data as
    /// Database/02_SeedData.sql, so the tests never touch the developer database.
    /// </summary>
    public sealed class OfficeraApiFactory : WebApplicationFactory<Program>
    {
        public const string AdminEmail = "admin@test.local";
        public const string AdminPassword = "Admin@Test1";
        public const string MemberEmail = "member@test.local";
        public const string MemberPassword = "Member@Test1";
        public const string JwtKey = "test-only-signing-key-0123456789abcdef0123456789";

        private readonly string _dbName = "officera-tests-" + Guid.NewGuid().ToString("N");
        private readonly Dictionary<string, string> _tokens = new();

        public string WebRoot { get; } = Path.Combine(Path.GetTempPath(), "officera-tests-wwwroot-" + Guid.NewGuid().ToString("N"));

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            Directory.CreateDirectory(WebRoot);
            builder.UseEnvironment("Development");
            builder.UseSetting("Jwt:Key", JwtKey);
            builder.UseSetting("Jwt:Issuer", "https://officera.test");
            builder.UseSetting("Jwt:Audience", "https://officera.test");
            builder.UseSetting("Jwt:ExpiryMinutes", "60");
            builder.UseSetting(WebHostDefaults.WebRootKey, WebRoot);

            builder.ConfigureServices(services =>
            {
                services.RemoveAll<DbContextOptions<OfficeraContext>>();
                services.RemoveAll<OfficeraContext>();
                services.AddDbContext<OfficeraContext>((sp, options) =>
                {
                    options.UseInMemoryDatabase(_dbName);
                    options.AddInterceptors(new AuditSaveChangesInterceptor(sp.GetRequiredService<IAuditUserProvider>()));
                });
            });
        }

        /// <summary>Creates the in-memory database with roles, permissions, settings, a Super Admin and a member.</summary>
        public void Seed()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<OfficeraContext>();
            if (db.Roles.Any())
            {
                return;
            }

            var hasher = scope.ServiceProvider.GetRequiredService<IPasswordService>();
            var now = DateTime.UtcNow;

            string[] modules = { "dashboard", "locations", "resources", "plans", "subscriptions", "bookings", "members", "visitors", "payments", "invoices", "refunds", "support", "community", "leads", "content", "notifications", "reports", "users", "audit", "settings", "integrations" };
            string[] actions = { "view", "create", "edit", "delete", "approve", "export" };
            var order = 0;
            foreach (var m in modules)
            {
                foreach (var a in actions)
                {
                    db.Permissions.Add(new Permission { PermissionKey = $"{m}.{a}", Module = m, ModuleKey = m, Action = a, Label = $"{a} {m}", SortOrder = order++ });
                }
            }

            db.Roles.AddRange(
                new Role { Id = "ROL-1", RoleKey = RoleKeys.SuperAdmin, Name = "Super Admin", Description = "", IsSystem = true, CreatedDate = now },
                new Role { Id = "ROL-3", RoleKey = RoleKeys.FrontDesk, Name = "Front Desk", Description = "", IsSystem = true, CreatedDate = now },
                new Role { Id = "ROL-5", RoleKey = RoleKeys.Member, Name = "Member", Description = "", IsSystem = true, CreatedDate = now });
            db.RolePermissions.AddRange(
                new RolePermission { RoleId = "ROL-3", PermissionKey = "visitors.view", CreatedDate = now },
                new RolePermission { RoleId = "ROL-3", PermissionKey = "visitors.edit", CreatedDate = now },
                new RolePermission { RoleId = "ROL-3", PermissionKey = "bookings.view", CreatedDate = now });

            db.OrgSettings.Add(new OrgSetting
            {
                Id = 1, LegalName = "", Gstin = "", Address = "", State = "", StateCode = "", Pan = "", Email = "", Phone = "",
                GstRate = 18, SlotLockMinutes = 10, FreeCancellationHours = 2, TicketEscalationHours = 24, PaymentRetryDays = "1,3,7",
                GracePeriodDays = 5, BookingReminderMinutes = 60, RenewalReminderDays = 7, MaxLoginAttempts = 5, LockoutMinutes = 15,
                Currency = "INR", Timezone = "Asia/Kolkata", CreatedDate = now,
            });

            db.Locations.Add(new Location
            {
                Id = "LOC-0001", Name = "Test Centre", City = "Hyderabad", State = "Telangana", Address = "1 Test Road", Pincode = "500081",
                HoursWeekdays = "", HoursSaturday = "", HoursSunday = "", AmenitiesJson = "[]", PhotosJson = "[]", Status = "ACTIVE", Description = "",
                TransportJson = "[]", SpaceTypesJson = "[]", Phone = "", Email = "", CreatedDate = now,
            });
            db.Resources.Add(new Resource
            {
                Id = "RES-0001", Name = "Room A", Code = "RA-1", ResourceType = "MEETING_ROOM", LocationId = "LOC-0001", Floor = "", Capacity = 6, Price = 500,
                PriceUnit = "hour", AmenitiesJson = "[]", PhotosJson = "[]", Availability = "", CancellationRule = "", Status = "ACTIVE", MapW = 10, MapH = 10, CreatedDate = now,
            });
            db.Members.Add(new Member
            {
                Id = "MEM-0001", FirstName = "Test", LastName = "Member", Email = MemberEmail, Mobile = "9876500001", Designation = "", LocationId = "LOC-0001",
                Status = "ACTIVE", JoinDate = DateOnly.FromDateTime(now), Bio = "", SkillsJson = "[]", CreatedDate = now,
            });
            db.Members.Add(new Member
            {
                Id = "MEM-0002", FirstName = "Other", LastName = "Member", Email = "other@test.local", Mobile = "9876500002", Designation = "", LocationId = "LOC-0001",
                Status = "ACTIVE", JoinDate = DateOnly.FromDateTime(now), Bio = "", SkillsJson = "[]", CreatedDate = now,
            });

            db.Users.AddRange(
                new User { Id = "USR-0001", Name = "Test Admin", Email = AdminEmail, Mobile = "", RoleKey = RoleKeys.SuperAdmin, Status = "ACTIVE", PasswordHash = hasher.Hash(AdminPassword), CreatedDate = now },
                new User { Id = "USR-0002", Name = "Test Member", Email = MemberEmail, Mobile = "9876500001", RoleKey = RoleKeys.Member, Status = "ACTIVE", MemberId = "MEM-0001", PasswordHash = hasher.Hash(MemberPassword), CreatedDate = now },
                new User { Id = "USR-0003", Name = "Inactive User", Email = "inactive@test.local", Mobile = "", RoleKey = RoleKeys.FrontDesk, Status = "INACTIVE", PasswordHash = hasher.Hash(AdminPassword), CreatedDate = now });

            // SQL Server generates IdSequences.RowVersion; the in-memory provider cannot, so the rows are pre-created
            // (starting after the ids used by this seed).
            var fy = officera.BusinessAccessLayer.Services.FinanceRules.FinancialYear(DateOnly.FromDateTime(now));
            foreach (var prefix in officera.BusinessAccessLayer.Services.IdSequenceService.KnownPrefixes.Concat(new[] { $"INVNO-{fy}", $"CNNO-{fy}" }))
            {
                db.IdSequences.Add(new IdSequence { Prefix = prefix, LastValue = 10, RowVersion = new byte[8] });
            }

            db.SaveChanges();
        }

        /// <summary>Signs in once per account (the auth endpoints are rate-limited) and reuses the token.</summary>
        public async Task<string> TokenAsync(string email, string password)
        {
            if (_tokens.TryGetValue(email, out var cached))
            {
                return cached;
            }

            using var client = CreateClient();
            var res = await client.PostAsJsonAsync("/api/Auth/Login", new { email, password });
            if (!res.IsSuccessStatusCode)
            {
                throw new InvalidOperationException($"Login for {email} failed ({(int)res.StatusCode}): {await res.Content.ReadAsStringAsync()}");
            }

            var body = await res.Content.ReadFromJsonAsync<JsonElement>();
            var token = body.GetProperty("data").GetProperty("token").GetString()!;
            _tokens[email] = token;
            return token;
        }

        public async Task<HttpClient> AdminClientAsync() => Authorized(await TokenAsync(AdminEmail, AdminPassword));

        public async Task<HttpClient> MemberClientAsync() => Authorized(await TokenAsync(MemberEmail, MemberPassword));

        public HttpClient Authorized(string token)
        {
            var client = CreateClient();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
            return client;
        }

        protected override void Dispose(bool disposing)
        {
            base.Dispose(disposing);
            try
            {
                Directory.Delete(WebRoot, true);
            }
            catch (IOException)
            {
                // temp folder clean-up is best effort
            }
        }
    }

    [CollectionDefinition(Name)]
    public sealed class ApiCollection : ICollectionFixture<ApiFixture>
    {
        public const string Name = "Officera API";
    }

    /// <summary>One API host shared by all integration tests (Serilog's bootstrap logger can only be frozen once per process).</summary>
    public sealed class ApiFixture : IDisposable
    {
        public ApiFixture()
        {
            Factory = new OfficeraApiFactory();
            Factory.Seed();
        }

        public OfficeraApiFactory Factory { get; }

        public void Dispose() => Factory.Dispose();
    }

    public static class HttpExtensions
    {
        public static async Task<JsonElement> DataAsync(this HttpResponseMessage response)
        {
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            return body.GetProperty("data");
        }
    }
}
