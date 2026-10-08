using officera.Shared.Common;

namespace officera.BusinessAccessLayer.Interfaces
{
    /// <summary>
    /// The caller of the current request. Identity comes only from the validated JWT; role, locations,
    /// permissions and account status are re-read from the database once per request, so role changes and
    /// deactivations take effect immediately and nothing sent by the browser is trusted.
    /// </summary>
    public interface ICurrentUserService : IAuditUserProvider
    {
        bool IsAuthenticated { get; }
        string? UserId { get; }
        string? IpAddress { get; }
        string? UserAgent { get; }

        Task<CurrentUserContext> GetContextAsync();
    }

    public sealed class CurrentUserContext
    {
        public static readonly CurrentUserContext Anonymous = new();

        public bool IsAuthenticated { get; init; }
        public string UserId { get; init; } = string.Empty;
        public string Name { get; init; } = string.Empty;
        public string Email { get; init; } = string.Empty;
        public string Role { get; init; } = string.Empty;
        public string? MemberId { get; init; }
        /// <summary>The member's company (members only), used for company-level access.</summary>
        public string? MemberCompanyId { get; init; }
        /// <summary>Locations a staff user may operate. Empty means all locations.</summary>
        public IReadOnlyCollection<string> LocationIds { get; init; } = Array.Empty<string>();
        public IReadOnlySet<string> Permissions { get; init; } = new HashSet<string>();

        public bool IsSuperAdmin => Role == RoleKeys.SuperAdmin;
        public bool IsMember => IsAuthenticated && Role == RoleKeys.Member;
        public bool IsStaff => IsAuthenticated && RoleKeys.IsStaff(Role);

        /// <summary>Location managers / front desk restricted to specific centres.</summary>
        public bool IsLocationRestricted => IsStaff && !IsSuperAdmin && LocationIds.Count > 0;

        public bool Can(string permission) => IsSuperAdmin || Permissions.Contains(permission);

        public bool CanAny(string module, params string[] actions) =>
            IsSuperAdmin || actions.Any(a => Permissions.Contains($"{module}.{a}"));

        public bool CanAccessLocation(string? locationId) =>
            !IsLocationRestricted || string.IsNullOrEmpty(locationId) || LocationIds.Contains(locationId);
    }
}
