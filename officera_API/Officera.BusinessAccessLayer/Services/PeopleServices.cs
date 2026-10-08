using System.Linq.Expressions;
using officera.BusinessAccessLayer.DTOs;
using officera.BusinessAccessLayer.Interfaces;
using officera.DataAccessLayer.Entities;
using officera.Shared.Common;

namespace officera.BusinessAccessLayer.Services
{
    /// <summary>Members (Members & Companies, member profile, community directory).</summary>
    public class MemberService : CrudServiceBase<Member, MemberDto>, IMemberService
    {
        private static readonly string[] Statuses = { "ACTIVE", "SUSPENDED", "INACTIVE", "PENDING" };

        public MemberService(ServiceContext context) : base(context) { }

        protected override string EntityName => "Member";
        protected override string ModuleKey => "members";
        protected override string IdPrefix => "MEM";

        protected override Expression<Func<Member, bool>> IdEquals(string id) => e => e.Id == id;
        protected override string KeyOf(Member entity) => entity.Id;
        protected override void SetKey(Member entity, string id) => entity.Id = id;

        /// <summary>A member sees their own record and members who opted into the community directory.</summary>
        protected override Expression<Func<Member, bool>>? MemberFilter(CurrentUserContext user)
        {
            var memberId = user.MemberId;
            return e => e.Id == memberId || (e.DirectoryVisible && e.Status == "ACTIVE");
        }

        protected override Expression<Func<Member, bool>>? LocationFilter(IReadOnlyCollection<string> locationIds) => e => locationIds.Contains(e.LocationId);
        protected override string? LocationOf(Member entity) => entity.LocationId;

        protected override bool MemberCanUpdate(Member existing, CurrentUserContext user) => existing.Id == user.MemberId;

        protected override void ApplyMemberUpdate(MemberDto dto, Member e, CurrentUserContext user)
        {
            // Profile fields only. Status may only move PENDING → ACTIVE (activated by the member's paid subscription);
            // referral credit can only be spent, never increased.
            e.FirstName = dto.FirstName.Trim();
            e.LastName = dto.LastName.Trim();
            e.Email = dto.Email.Trim().ToLowerInvariant();
            e.Mobile = ValidationHelper.NormalizeMobile(dto.Mobile);
            e.CompanyId = string.IsNullOrWhiteSpace(dto.CompanyId) ? null : dto.CompanyId;
            e.Designation = dto.Designation ?? string.Empty;
            e.LocationId = dto.LocationId;
            e.DirectoryVisible = dto.DirectoryVisible;
            e.Bio = dto.Bio ?? string.Empty;
            e.SkillsJson = JsonHelper.Serialize(dto.Skills ?? new());
            e.Photo = dto.Photo;
            e.ProfileCompleted = dto.ProfileCompleted ?? e.ProfileCompleted;
            if (dto.ReferralCredit.HasValue && dto.ReferralCredit.Value < e.ReferralCredit)
            {
                e.ReferralCredit = Math.Max(0, dto.ReferralCredit.Value);
            }
            if (e.Status == "PENDING" && dto.Status == "ACTIVE")
            {
                e.Status = "ACTIVE";
            }
        }

        protected override IEnumerable<string?> SearchValues(MemberDto dto) => new[] { dto.Id, dto.FirstName + " " + dto.LastName, dto.Email, dto.Mobile };
        protected override IEnumerable<MemberDto> DefaultOrder(IEnumerable<MemberDto> items) => items.OrderBy(m => m.FirstName).ThenBy(m => m.LastName);

        protected override MemberDto ToDto(Member e) => new()
        {
            Id = e.Id,
            FirstName = e.FirstName,
            LastName = e.LastName,
            Email = e.Email,
            Mobile = e.Mobile,
            CompanyId = e.CompanyId,
            Designation = e.Designation,
            LocationId = e.LocationId,
            Status = e.Status,
            JoinDate = DateTimeHelper.ToDateString(e.JoinDate),
            DirectoryVisible = e.DirectoryVisible,
            Bio = e.Bio,
            Skills = JsonHelper.DeserializeList<string>(e.SkillsJson),
            LeadId = e.LeadId,
            Photo = e.Photo,
            ReferralCredit = e.ReferralCredit,
            ProfileCompleted = e.ProfileCompleted,
            CreatedAt = DateTimeHelper.ToIso(e.CreatedDate),
        };

        protected override void MapToEntity(MemberDto dto, Member e, bool isNew)
        {
            e.FirstName = dto.FirstName.Trim();
            e.LastName = dto.LastName.Trim();
            e.Email = dto.Email.Trim().ToLowerInvariant();
            e.Mobile = ValidationHelper.NormalizeMobile(dto.Mobile);
            e.CompanyId = string.IsNullOrWhiteSpace(dto.CompanyId) ? null : dto.CompanyId;
            e.Designation = dto.Designation ?? string.Empty;
            e.LocationId = dto.LocationId;
            e.Status = dto.Status;
            e.JoinDate = DateTimeHelper.ParseDate(dto.JoinDate) ?? (isNew ? DateTimeHelper.TodayUtc : e.JoinDate);
            e.DirectoryVisible = dto.DirectoryVisible;
            e.Bio = dto.Bio ?? string.Empty;
            e.SkillsJson = JsonHelper.Serialize(dto.Skills ?? new());
            e.LeadId = string.IsNullOrWhiteSpace(dto.LeadId) ? null : dto.LeadId;
            e.Photo = dto.Photo;
            e.ReferralCredit = Math.Max(0, dto.ReferralCredit ?? 0);
            e.ProfileCompleted = dto.ProfileCompleted ?? false;
        }

        protected override async Task ValidateAsync(MemberDto dto, Member? existing, CurrentUserContext user)
        {
            new ValidationHelper.Collector()
                .Required(dto.FirstName, "First name").MaxLength(dto.FirstName, 60, "First name")
                .Required(dto.LastName, "Last name").MaxLength(dto.LastName, 60, "Last name")
                .Email(dto.Email, "Email")
                .Mobile(dto.Mobile, "Mobile")
                .Required(dto.LocationId, "Home location")
                .OneOf(dto.Status, Statuses, "Status")
                .ThrowIfInvalid();

            var email = dto.Email.Trim().ToLowerInvariant();
            if ((await Repository.FindAsync(m => m.Email == email && (existing == null || m.Id != existing.Id))).Any())
            {
                throw new ConflictException("A member with this email already exists.");
            }

            if (!(await Repo<Location>().FindAsync(l => l.Id == dto.LocationId)).Any())
            {
                throw new ValidationException("The selected location does not exist.");
            }

            if (!string.IsNullOrWhiteSpace(dto.CompanyId) && !(await Repo<Company>().FindAsync(c => c.Id == dto.CompanyId)).Any())
            {
                throw new ValidationException("The selected company does not exist.");
            }
        }

        protected override async Task OnSavingAsync(Member entity, MemberDto dto, bool isNew, CurrentUserContext user)
        {
            // Keep the member's login identity in step with the profile.
            if (isNew)
            {
                return;
            }

            var login = (await Repo<User>().FindAsync(u => u.MemberId == entity.Id)).FirstOrDefault();
            if (login != null)
            {
                login.Name = $"{entity.FirstName} {entity.LastName}".Trim();
                login.Mobile = entity.Mobile;
                if (!string.Equals(login.Email, entity.Email, StringComparison.OrdinalIgnoreCase)
                    && !(await Repo<User>().FindAsync(u => u.Email == entity.Email && u.Id != login.Id)).Any())
                {
                    login.Email = entity.Email;
                }
            }
        }
    }

    /// <summary>Companies (Members & Companies, member billing profile).</summary>
    public class CompanyService : CrudServiceBase<Company, CompanyDto>, ICompanyService
    {
        public CompanyService(ServiceContext context) : base(context) { }

        protected override string EntityName => "Company";
        protected override string ModuleKey => "members";
        protected override string IdPrefix => "COM";

        protected override Expression<Func<Company, bool>> IdEquals(string id) => e => e.Id == id;
        protected override string KeyOf(Company entity) => entity.Id;
        protected override void SetKey(Company entity, string id) => entity.Id = id;

        /// <summary>Members see their own company and the companies of members listed in the community directory.</summary>
        protected override Expression<Func<Company, bool>>? MemberFilter(CurrentUserContext user)
        {
            var memberId = user.MemberId;
            var companyId = user.MemberCompanyId;
            return e => e.Id == companyId || e.PrimaryContactId == memberId || e.Members.Any(m => m.DirectoryVisible && m.Status == "ACTIVE");
        }

        protected override Expression<Func<Company, bool>>? LocationFilter(IReadOnlyCollection<string> locationIds) => e => locationIds.Contains(e.LocationId);
        protected override string? LocationOf(Company entity) => entity.LocationId;

        protected override bool MemberCanCreate(Company entity, CurrentUserContext user) => entity.PrimaryContactId == user.MemberId;

        protected override bool MemberCanUpdate(Company existing, CurrentUserContext user) =>
            existing.Id == user.MemberCompanyId || existing.PrimaryContactId == user.MemberId;

        protected override void ApplyMemberUpdate(CompanyDto dto, Company e, CurrentUserContext user)
        {
            var contact = e.PrimaryContactId;
            MapToEntity(dto, e, false);
            e.PrimaryContactId = contact;
        }

        protected override IEnumerable<string?> SearchValues(CompanyDto dto) => new[] { dto.Id, dto.Name, dto.Gstin, dto.Industry };
        protected override IEnumerable<CompanyDto> DefaultOrder(IEnumerable<CompanyDto> items) => items.OrderBy(c => c.Name);

        protected override CompanyDto ToDto(Company e) => new()
        {
            Id = e.Id,
            Name = e.Name,
            Gstin = e.Gstin,
            BillingAddress = e.BillingAddress,
            State = e.State,
            Industry = e.Industry,
            Size = e.CompanySize,
            Website = e.Website,
            LocationId = e.LocationId,
            PrimaryContactId = e.PrimaryContactId,
        };

        protected override void MapToEntity(CompanyDto dto, Company e, bool isNew)
        {
            e.Name = dto.Name.Trim();
            e.Gstin = (dto.Gstin ?? string.Empty).Trim().ToUpperInvariant();
            e.BillingAddress = dto.BillingAddress ?? string.Empty;
            e.State = dto.State ?? string.Empty;
            e.Industry = dto.Industry ?? string.Empty;
            e.CompanySize = dto.Size ?? string.Empty;
            e.Website = dto.Website ?? string.Empty;
            e.LocationId = dto.LocationId;
            e.PrimaryContactId = string.IsNullOrWhiteSpace(dto.PrimaryContactId) ? null : dto.PrimaryContactId;
        }

        protected override async Task ValidateAsync(CompanyDto dto, Company? existing, CurrentUserContext user)
        {
            new ValidationHelper.Collector()
                .Required(dto.Name, "Company name").MaxLength(dto.Name, 200, "Company name")
                .Gstin(dto.Gstin, "GST number")
                .Required(dto.LocationId, "Location")
                .ThrowIfInvalid();

            if (!(await Repo<Location>().FindAsync(l => l.Id == dto.LocationId)).Any())
            {
                throw new ValidationException("The selected location does not exist.");
            }

            var gstin = (dto.Gstin ?? string.Empty).Trim().ToUpperInvariant();
            if (gstin.Length > 0 && (await Repository.FindAsync(c => c.Gstin == gstin && (existing == null || c.Id != existing.Id))).Any())
            {
                throw new ConflictException("Another company is already registered with this GST number.");
            }
        }
    }

    /// <summary>Staff users and member logins (Administration → Users). Password hashes never leave this service.</summary>
    public class UserService : CrudServiceBase<User, UserDto>, IUserService
    {
        private static readonly string[] Statuses = { "ACTIVE", "INACTIVE", "LOCKED", "INVITED" };

        public UserService(ServiceContext context) : base(context) { }

        protected override string EntityName => "User";
        protected override string ModuleKey => "users";
        protected override string IdPrefix => "USR";

        protected override Expression<Func<User, bool>> IdEquals(string id) => e => e.Id == id;
        protected override string KeyOf(User entity) => entity.Id;
        protected override void SetKey(User entity, string id) => entity.Id = id;

        protected override Expression<Func<User, bool>>? MemberFilter(CurrentUserContext user)
        {
            var userId = user.UserId;
            return e => e.Id == userId;
        }

        protected override bool MemberCanUpdate(User existing, CurrentUserContext user) => existing.Id == user.UserId;

        /// <summary>A member may only change their own name, email and mobile – never role, status or locations.</summary>
        protected override void ApplyMemberUpdate(UserDto dto, User e, CurrentUserContext user)
        {
            e.Name = dto.Name.Trim();
            e.Email = dto.Email.Trim().ToLowerInvariant();
            e.Mobile = ValidationHelper.NormalizeMobile(dto.Mobile);
        }

        protected override IEnumerable<string?> SearchValues(UserDto dto) => new[] { dto.Id, dto.Name, dto.Email, dto.Mobile, dto.Role };
        protected override IEnumerable<UserDto> DefaultOrder(IEnumerable<UserDto> items) => items.OrderBy(u => u.Name);

        protected override UserDto ToDto(User e) => ToDto(e, Array.Empty<string>());

        internal static UserDto ToDto(User e, IEnumerable<string> locationIds) => new()
        {
            Id = e.Id,
            Name = e.Name,
            Email = e.Email,
            Mobile = e.Mobile,
            Role = e.RoleKey,
            LocationIds = locationIds.ToList(),
            Status = e.Status,
            MemberId = e.MemberId,
            LastLogin = DateTimeHelper.ToIso(e.LastLogin),
            CreatedAt = DateTimeHelper.ToIso(e.CreatedDate),
            LockedUntil = e.LockoutUntil > DateTime.UtcNow ? DateTimeHelper.ToIso(e.LockoutUntil) : null,
        };

        protected override async Task<List<UserDto>> ToDtosAsync(IReadOnlyList<User> entities)
        {
            var ids = entities.Select(e => e.Id).ToList();
            var locations = (await Repo<UserLocation>().FindAsync(l => ids.Contains(l.UserId))).ToLookup(l => l.UserId, l => l.LocationId);
            return entities.Select(e => ToDto(e, locations[e.Id])).ToList();
        }

        protected override void MapToEntity(UserDto dto, User e, bool isNew)
        {
            e.Name = dto.Name.Trim();
            e.Email = dto.Email.Trim().ToLowerInvariant();
            e.Mobile = ValidationHelper.NormalizeMobile(dto.Mobile);
            e.RoleKey = dto.Role;
            e.Status = dto.Status;
            e.MemberId = string.IsNullOrWhiteSpace(dto.MemberId) ? null : dto.MemberId;
            if (e.Status == "ACTIVE" && e.LockoutUntil.HasValue)
            {
                e.LockoutUntil = null;
                e.FailedLoginCount = 0;
            }
        }

        protected override async Task ValidateAsync(UserDto dto, User? existing, CurrentUserContext user)
        {
            new ValidationHelper.Collector()
                .Required(dto.Name, "Name").MaxLength(dto.Name, 150, "Name")
                .Email(dto.Email, "Email")
                .Mobile(dto.Mobile, "Mobile", required: false)
                .OneOf(dto.Status, Statuses, "Status")
                .ThrowIfInvalid();

            var email = dto.Email.Trim().ToLowerInvariant();
            if ((await Repository.FindAsync(u => u.Email == email && (existing == null || u.Id != existing.Id))).Any())
            {
                throw new ConflictException("A user with this email already exists.");
            }

            if (user.IsMember)
            {
                return;
            }

            if (!(await Repo<Role>().FindAsync(r => r.RoleKey == dto.Role)).Any())
            {
                throw new ValidationException($"Unknown role '{dto.Role}'.");
            }

            if (dto.Role == RoleKeys.SuperAdmin && !user.IsSuperAdmin)
            {
                throw new ForbiddenException("Only a Super Admin can grant the Super Admin role.");
            }

            if (existing != null && existing.Id == user.UserId && (dto.Status != "ACTIVE" || dto.Role != existing.RoleKey))
            {
                throw new ValidationException("You cannot change your own role or deactivate your own account.");
            }

            if (existing?.RoleKey == RoleKeys.SuperAdmin && dto.Role != RoleKeys.SuperAdmin)
            {
                var superAdmins = (await Repository.FindAsync(u => u.RoleKey == RoleKeys.SuperAdmin && u.Status == "ACTIVE")).Count();
                if (superAdmins <= 1)
                {
                    throw new ValidationException("At least one active Super Admin is required.");
                }
            }

            var locationIds = dto.LocationIds ?? new List<string>();
            if (locationIds.Count > 0)
            {
                var known = (await Repo<Location>().FindAsync(l => locationIds.Contains(l.Id))).Count();
                if (known != locationIds.Distinct().Count())
                {
                    throw new ValidationException("One or more selected locations do not exist.");
                }
            }
        }

        protected override async Task OnSavingAsync(User entity, UserDto dto, bool isNew, CurrentUserContext user)
        {
            if (user.IsMember)
            {
                return;
            }

            var repo = Repo<UserLocation>();
            var wanted = (dto.LocationIds ?? new List<string>()).Distinct().ToHashSet();
            var current = isNew ? new List<UserLocation>() : (await repo.FindAsync(l => l.UserId == entity.Id)).ToList();
            foreach (var row in current.Where(r => !wanted.Contains(r.LocationId)))
            {
                repo.Remove(row);
            }

            foreach (var locationId in wanted.Where(w => current.All(c => c.LocationId != w)))
            {
                await repo.AddAsync(new UserLocation { UserId = entity.Id, LocationId = locationId, CreatedDate = DateTime.UtcNow });
            }
        }

        public override async Task DeleteAsync(string id)
        {
            var user = await CurrentUser.GetContextAsync();
            if (id == user.UserId)
            {
                throw new ValidationException("You cannot delete your own account.");
            }

            await base.DeleteAsync(id);
        }
    }

    /// <summary>Roles and the permission matrix (Administration → Roles & Permissions).</summary>
    public class RoleService : CrudServiceBase<Role, RoleDto>, IRoleService
    {
        public RoleService(ServiceContext context) : base(context) { }

        protected override string EntityName => "Role";
        protected override string ModuleKey => "users";
        protected override string IdPrefix => "ROL";

        protected override Expression<Func<Role, bool>> IdEquals(string id) => e => e.Id == id;
        protected override string KeyOf(Role entity) => entity.Id;
        protected override void SetKey(Role entity, string id) => entity.Id = id;

        /// <summary>The MEMBER role is internal (member portal) and is not shown in the staff role matrix.</summary>
        public override async Task<PagedResult<RoleDto>> GetAsync(PagedRequest request)
        {
            var result = await base.GetAsync(request);
            result.Items = result.Items.Where(r => r.Key != RoleKeys.Member).ToList();
            result.TotalCount = result.Items.Count;
            return result;
        }

        public async Task<List<PermissionDto>> GetPermissionsAsync()
        {
            var user = await CurrentUser.GetContextAsync();
            if (!user.IsStaff)
            {
                throw new ForbiddenException();
            }

            return (await Repo<Permission>().FindAsync(p => true))
                .OrderBy(p => p.SortOrder)
                .Select(p => new PermissionDto { Key = p.PermissionKey, Module = p.Module, Action = p.Action, Label = p.Label })
                .ToList();
        }

        protected override RoleDto ToDto(Role e) => ToDto(e, Array.Empty<string>());

        private static RoleDto ToDto(Role e, IEnumerable<string> permissions) => new()
        {
            Id = e.Id,
            Key = e.RoleKey,
            Name = e.Name,
            Description = e.Description,
            Permissions = permissions.ToList(),
            System = e.IsSystem,
        };

        protected override async Task<List<RoleDto>> ToDtosAsync(IReadOnlyList<Role> entities)
        {
            var ids = entities.Select(e => e.Id).ToList();
            var perms = (await Repo<RolePermission>().FindAsync(p => ids.Contains(p.RoleId))).ToLookup(p => p.RoleId, p => p.PermissionKey);
            return entities.Select(e => ToDto(e, perms[e.Id])).ToList();
        }

        protected override void MapToEntity(RoleDto dto, Role e, bool isNew)
        {
            e.Name = dto.Name.Trim();
            e.Description = dto.Description ?? string.Empty;
            if (isNew)
            {
                e.RoleKey = dto.Key.Trim().ToUpperInvariant();
                e.IsSystem = false;
            }
        }

        protected override async Task ValidateAsync(RoleDto dto, Role? existing, CurrentUserContext user)
        {
            new ValidationHelper.Collector()
                .Required(dto.Name, "Role name")
                .Required(dto.Key, "Role key")
                .ThrowIfInvalid();

            if (existing == null && (await Repository.FindAsync(r => r.RoleKey == dto.Key.Trim().ToUpperInvariant())).Any())
            {
                throw new ConflictException("A role with this key already exists.");
            }

            var all = (await Repo<Permission>().FindAsync(p => true)).Select(p => p.PermissionKey).ToHashSet();
            var unknown = (dto.Permissions ?? new()).Where(p => !all.Contains(p)).ToList();
            if (unknown.Count > 0)
            {
                throw new ValidationException($"Unknown permissions: {string.Join(", ", unknown)}.");
            }
        }

        protected override async Task OnSavingAsync(Role entity, RoleDto dto, bool isNew, CurrentUserContext user)
        {
            var repo = Repo<RolePermission>();
            HashSet<string> wanted;
            if (entity.RoleKey == RoleKeys.SuperAdmin)
            {
                // The Super Admin always keeps every permission so the system can never be locked out.
                wanted = (await Repo<Permission>().FindAsync(p => true)).Select(p => p.PermissionKey).ToHashSet();
            }
            else
            {
                wanted = (dto.Permissions ?? new()).ToHashSet();
            }

            var current = isNew ? new List<RolePermission>() : (await repo.FindAsync(p => p.RoleId == entity.Id)).ToList();
            foreach (var row in current.Where(r => !wanted.Contains(r.PermissionKey)))
            {
                repo.Remove(row);
            }

            foreach (var key in wanted.Where(w => current.All(c => c.PermissionKey != w)))
            {
                await repo.AddAsync(new RolePermission { RoleId = entity.Id, PermissionKey = key, CreatedDate = DateTime.UtcNow });
            }
        }

        protected override async Task OnDeletingAsync(Role entity)
        {
            if (entity.IsSystem)
            {
                throw new ValidationException("System roles cannot be deleted.");
            }

            if ((await Repo<User>().FindAsync(u => u.RoleKey == entity.RoleKey)).Any())
            {
                throw new ConflictException("This role is still assigned to users.");
            }
        }
    }
}
