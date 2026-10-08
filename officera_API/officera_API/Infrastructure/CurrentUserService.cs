using officera.BusinessAccessLayer.Interfaces;
using officera.DataAccessLayer.Entities;
using officera.DataAccessLayer.Repositories;
using officera.Shared.Common;

namespace officera_API.Infrastructure
{
    /// <summary>
    /// Resolves the caller from the validated JWT, then loads role, locations, permissions and status from the
    /// database once per request. A deactivated or deleted account is treated as signed out immediately.
    /// </summary>
    public sealed class CurrentUserService : ICurrentUserService
    {
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly IUnitOfWork _unitOfWork;
        private CurrentUserContext? _context;

        public CurrentUserService(IHttpContextAccessor httpContextAccessor, IUnitOfWork unitOfWork)
        {
            _httpContextAccessor = httpContextAccessor;
            _unitOfWork = unitOfWork;
        }

        private HttpContext? Http => _httpContextAccessor.HttpContext;

        public bool IsAuthenticated => Http?.User.Identity?.IsAuthenticated == true && UserId != null;

        public string? UserId => Http?.User.GetUserId();

        public string? AuditUserId => UserId;

        public string? IpAddress => Http?.Connection.RemoteIpAddress?.ToString();

        public string? UserAgent => Http?.Request.Headers.UserAgent.ToString();

        public async Task<CurrentUserContext> GetContextAsync()
        {
            if (_context != null)
            {
                return _context;
            }

            if (!IsAuthenticated)
            {
                return _context = CurrentUserContext.Anonymous;
            }

            var userId = UserId!;
            var user = (await _unitOfWork.Repository<User>().FindAsync(u => u.Id == userId)).FirstOrDefault();
            if (user == null || user.Status == "INACTIVE")
            {
                throw new UnauthorizedException("Your session is no longer valid. Please sign in again.");
            }

            var locations = (await _unitOfWork.Repository<UserLocation>().FindAsync(l => l.UserId == userId)).Select(l => l.LocationId).ToList();

            HashSet<string> permissions;
            if (user.RoleKey == RoleKeys.SuperAdmin)
            {
                permissions = (await _unitOfWork.Repository<Permission>().FindAsync(p => true)).Select(p => p.PermissionKey).ToHashSet();
            }
            else
            {
                var role = (await _unitOfWork.Repository<Role>().FindAsync(r => r.RoleKey == user.RoleKey)).FirstOrDefault();
                permissions = role == null
                    ? new HashSet<string>()
                    : (await _unitOfWork.Repository<RolePermission>().FindAsync(p => p.RoleId == role.Id)).Select(p => p.PermissionKey).ToHashSet();
            }

            string? companyId = null;
            if (user.MemberId != null)
            {
                companyId = (await _unitOfWork.Repository<Member>().FindAsync(m => m.Id == user.MemberId)).FirstOrDefault()?.CompanyId;
            }

            return _context = new CurrentUserContext
            {
                IsAuthenticated = true,
                UserId = user.Id,
                Name = user.Name,
                Email = user.Email,
                Role = user.RoleKey,
                MemberId = user.MemberId,
                MemberCompanyId = companyId,
                LocationIds = user.RoleKey == RoleKeys.Member ? Array.Empty<string>() : locations,
                Permissions = permissions,
            };
        }
    }

    /// <summary>Audit-column user id taken straight from the token (no database access, so it is safe inside DbContext setup).</summary>
    public sealed class HttpContextAuditUserProvider : IAuditUserProvider
    {
        private readonly IHttpContextAccessor _httpContextAccessor;

        public HttpContextAuditUserProvider(IHttpContextAccessor httpContextAccessor)
        {
            _httpContextAccessor = httpContextAccessor;
        }

        public string? AuditUserId => _httpContextAccessor.HttpContext?.User.GetUserId();
    }
}
