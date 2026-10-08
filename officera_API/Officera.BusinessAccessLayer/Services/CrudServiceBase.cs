using System.Globalization;
using System.Linq.Expressions;
using System.Reflection;
using Microsoft.Extensions.Logging;
using officera.BusinessAccessLayer.DTOs;
using officera.BusinessAccessLayer.Interfaces;
using officera.DataAccessLayer.Repositories;
using officera.Shared.Common;

namespace officera.BusinessAccessLayer.Services
{
    /// <summary>Who may read a module's records.</summary>
    public enum ReadAccess
    {
        /// <summary>Anyone, including the public website (rows limited by <see cref="CrudServiceBase{TEntity,TDto}.PublicFilter"/>).</summary>
        Public,
        /// <summary>Any signed-in user (members limited by their member filter).</summary>
        Authenticated,
        /// <summary>Any staff role; members only through their member filter.</summary>
        Staff,
        /// <summary>Staff holding "{module}.view"; members only through their member filter.</summary>
        Permission,
    }

    /// <summary>Dependencies shared by every CRUD service (keeps constructors short).</summary>
    public sealed class ServiceContext
    {
        public ServiceContext(IUnitOfWork unitOfWork, ICurrentUserService currentUser, IIdSequenceService ids, ILoggerFactory loggerFactory)
        {
            UnitOfWork = unitOfWork;
            CurrentUser = currentUser;
            Ids = ids;
            LoggerFactory = loggerFactory;
        }

        public IUnitOfWork UnitOfWork { get; }
        public ICurrentUserService CurrentUser { get; }
        public IIdSequenceService Ids { get; }
        public ILoggerFactory LoggerFactory { get; }
    }

    /// <summary>
    /// Business-layer implementation of the standard Get / GetById / Save / Update / Delete operations on top of the
    /// existing UnitOfWork + GeneralRepository. Each module service supplies mapping, validation and access rules:
    ///  - reads are scoped in the database query (member → own rows, location manager → own centres),
    ///  - writes are checked against the role permission matrix (auth.RolePermissions),
    ///  - members can only create/change rows they own, and only the fields the module allows.
    /// </summary>
    public abstract class CrudServiceBase<TEntity, TDto> : ICrudService<TDto>
        where TEntity : class, new()
        where TDto : class, IEntityDto
    {
        protected readonly IUnitOfWork UnitOfWork;
        protected readonly ICurrentUserService CurrentUser;
        protected readonly IIdSequenceService Ids;
        protected readonly ILogger Logger;

        protected CrudServiceBase(ServiceContext context)
        {
            UnitOfWork = context.UnitOfWork;
            CurrentUser = context.CurrentUser;
            Ids = context.Ids;
            Logger = context.LoggerFactory.CreateLogger(GetType());
        }

        protected IGeneralRepository<TEntity> Repository => UnitOfWork.Repository<TEntity>();

        protected IGeneralRepository<T> Repo<T>() where T : class => UnitOfWork.Repository<T>();

        // ------------------------------------------------------------------ module definition
        /// <summary>Display name used in messages and logs, e.g. "Location".</summary>
        protected abstract string EntityName { get; }

        /// <summary>Permission module key from auth.Permissions (locations, bookings ...).</summary>
        protected abstract string ModuleKey { get; }

        /// <summary>Business id prefix (LOC, BKG ...).</summary>
        protected abstract string IdPrefix { get; }

        protected abstract Expression<Func<TEntity, bool>> IdEquals(string id);

        protected abstract string KeyOf(TEntity entity);

        protected abstract void SetKey(TEntity entity, string id);

        protected abstract TDto ToDto(TEntity entity);

        /// <summary>Copies the DTO onto the entity (never the key or audit columns).</summary>
        protected abstract void MapToEntity(TDto dto, TEntity entity, bool isNew);

        /// <summary>Batch mapping hook; override to load child rows (lines, reviews ...) in one query.</summary>
        protected virtual Task<List<TDto>> ToDtosAsync(IReadOnlyList<TEntity> entities) =>
            Task.FromResult(entities.Select(ToDto).ToList());

        protected virtual Task ValidateAsync(TDto dto, TEntity? existing, CurrentUserContext user) => Task.CompletedTask;

        /// <summary>Runs after the entity is added/updated and before the unit of work commits (child rows, derived values).</summary>
        protected virtual Task OnSavingAsync(TEntity entity, TDto dto, bool isNew, CurrentUserContext user) => Task.CompletedTask;

        /// <summary>Runs after a successful commit.</summary>
        protected virtual Task OnSavedAsync(TEntity entity, bool isNew, CurrentUserContext user) => Task.CompletedTask;

        protected virtual Task OnDeletingAsync(TEntity entity) => Task.CompletedTask;

        /// <summary>Values the free-text search looks at.</summary>
        protected virtual IEnumerable<string?> SearchValues(TDto dto) => new[] { dto.Id };

        protected virtual IEnumerable<TDto> DefaultOrder(IEnumerable<TDto> items) => items;

        // ------------------------------------------------------------------ access rules
        protected virtual ReadAccess ReadAccess => ReadAccess.Staff;

        /// <summary>Rows visible to anonymous visitors (and members when no member filter applies).</summary>
        protected virtual Expression<Func<TEntity, bool>>? PublicFilter => null;

        /// <summary>Rows a member may read; null means members cannot read this module (unless public/authenticated).</summary>
        protected virtual Expression<Func<TEntity, bool>>? MemberFilter(CurrentUserContext user) => null;

        /// <summary>Location column used for location-restricted staff, e.g. e => e.LocationId.</summary>
        protected virtual Expression<Func<TEntity, bool>>? LocationFilter(IReadOnlyCollection<string> locationIds) => null;

        protected virtual string? LocationOf(TEntity entity) => null;

        protected virtual string? LocationOf(TDto dto) => null;

        protected virtual bool MemberCanCreate(TEntity entity, CurrentUserContext user) => false;

        /// <summary>True when the module lets members create rows at all (it overrides <see cref="MemberCanCreate"/>).</summary>
        private bool MembersMayCreate =>
            GetType().GetMethod(nameof(MemberCanCreate), BindingFlags.NonPublic | BindingFlags.Instance)?.DeclaringType != typeof(CrudServiceBase<TEntity, TDto>);

        protected virtual bool MemberCanUpdate(TEntity existing, CurrentUserContext user) => false;

        /// <summary>Applies a member's update. Override to restrict which fields a member may change.</summary>
        protected virtual void ApplyMemberUpdate(TDto dto, TEntity existing, CurrentUserContext user) => MapToEntity(dto, existing, false);

        /// <summary>Append-only records (logs) any staff role may write as a side effect of their work.</summary>
        protected virtual bool AnyStaffCanCreate => false;

        protected virtual bool AnyStaffCanUpdate => false;

        protected virtual bool AllowDelete => true;

        // ------------------------------------------------------------------ operations
        public virtual async Task<PagedResult<TDto>> GetAsync(PagedRequest request)
        {
            request ??= new PagedRequest();
            var user = await CurrentUser.GetContextAsync();
            var scope = ReadScope(user);
            var entities = (await Repository.FindAsync(scope)).ToList();

            if (request.LocationIds is { Count: > 0 })
            {
                var wanted = request.LocationIds.ToHashSet();
                entities = entities.Where(e => LocationOf(e) is not { } loc || wanted.Contains(loc)).ToList();
            }

            IEnumerable<TDto> dtos = await ToDtosAsync(entities);
            dtos = ApplySearch(dtos, request.Search);
            dtos = ApplyFilters(dtos, request.Filters);
            dtos = ApplySort(dtos, request.SortBy, request.SortDirection);
            return PagedResult<TDto>.Create(dtos.ToList(), request);
        }

        public virtual async Task<TDto> GetByIdAsync(string id)
        {
            var user = await CurrentUser.GetContextAsync();
            var entity = await FindScopedAsync(id, user) ?? throw new NotFoundException(EntityName, id);
            return (await ToDtosAsync(new[] { entity })).Single();
        }

        public virtual async Task<TDto> SaveAsync(TDto dto)
        {
            ArgumentNullException.ThrowIfNull(dto);
            var user = await CurrentUser.GetContextAsync();
            RequireAuthenticated(user);
            if (user.IsMember && !MembersMayCreate)
            {
                throw new ForbiddenException();
            }

            if (user.IsStaff && !AnyStaffCanCreate && !user.CanAny(ModuleKey, PermissionActions.Create, PermissionActions.Edit, PermissionActions.Approve))
            {
                throw new ForbiddenException();
            }

            await ValidateAsync(dto, null, user);

            var entity = new TEntity();
            MapToEntity(dto, entity, true);
            EnsureCanCreate(entity, dto, user);

            var id = await ResolveNewIdAsync(dto.Id);
            SetKey(entity, id);
            dto.Id = id;

            await Repository.AddAsync(entity);
            await OnSavingAsync(entity, dto, true, user);
            await UnitOfWork.CompleteAsync();
            await OnSavedAsync(entity, true, user);

            Logger.LogInformation("{Entity} {EntityId} created by {UserId}", EntityName, id, user.UserId);
            return (await ToDtosAsync(new[] { entity })).Single();
        }

        public virtual async Task<TDto> UpdateAsync(TDto dto)
        {
            ArgumentNullException.ThrowIfNull(dto);
            if (string.IsNullOrWhiteSpace(dto.Id))
            {
                throw new ValidationException($"{EntityName} id is required.");
            }

            var user = await CurrentUser.GetContextAsync();
            RequireAuthenticated(user);
            var existing = await FindScopedAsync(dto.Id, user) ?? throw new NotFoundException(EntityName, dto.Id);
            EnsureCanUpdate(existing, user);
            await ValidateAsync(dto, existing, user);

            if (user.IsMember)
            {
                ApplyMemberUpdate(dto, existing, user);
            }
            else
            {
                MapToEntity(dto, existing, false);
                if (!user.CanAccessLocation(LocationOf(existing)))
                {
                    throw new ForbiddenException($"You cannot move this {EntityName.ToLowerInvariant()} to a location you do not manage.");
                }
            }

            Repository.Update(existing);
            await OnSavingAsync(existing, dto, false, user);
            await UnitOfWork.CompleteAsync();
            await OnSavedAsync(existing, false, user);

            Logger.LogInformation("{Entity} {EntityId} updated by {UserId}", EntityName, dto.Id, user.UserId);
            return (await ToDtosAsync(new[] { existing })).Single();
        }

        public virtual async Task DeleteAsync(string id)
        {
            var user = await CurrentUser.GetContextAsync();
            RequireAuthenticated(user);
            if (!AllowDelete)
            {
                throw new ForbiddenException($"{EntityName} records cannot be deleted.");
            }

            var existing = await FindScopedAsync(id, user) ?? throw new NotFoundException(EntityName, id);
            if (user.IsMember || !user.Can($"{ModuleKey}.{PermissionActions.Delete}"))
            {
                throw new ForbiddenException();
            }

            if (!user.CanAccessLocation(LocationOf(existing)))
            {
                throw new ForbiddenException();
            }

            await OnDeletingAsync(existing);
            Repository.Remove(existing);
            await UnitOfWork.CompleteAsync();
            Logger.LogInformation("{Entity} {EntityId} deleted by {UserId}", EntityName, id, user.UserId);
        }

        // ------------------------------------------------------------------ helpers
        protected Expression<Func<TEntity, bool>> ReadScope(CurrentUserContext user)
        {
            if (!user.IsAuthenticated)
            {
                if (ReadAccess == ReadAccess.Public)
                {
                    return PublicFilter ?? ExpressionHelper.True<TEntity>();
                }

                throw new UnauthorizedException("Please sign in to continue.");
            }

            if (user.IsMember)
            {
                var memberFilter = MemberFilter(user);
                if (memberFilter != null)
                {
                    return memberFilter;
                }

                if (ReadAccess is ReadAccess.Public or ReadAccess.Authenticated)
                {
                    return PublicFilter ?? ExpressionHelper.True<TEntity>();
                }

                throw new ForbiddenException();
            }

            if (!user.IsStaff)
            {
                throw new ForbiddenException();
            }

            if (ReadAccess == ReadAccess.Permission && !user.Can($"{ModuleKey}.{PermissionActions.View}"))
            {
                throw new ForbiddenException();
            }

            if (user.IsLocationRestricted && LocationFilter(user.LocationIds) is { } locationScope)
            {
                return locationScope;
            }

            return ExpressionHelper.True<TEntity>();
        }

        protected async Task<TEntity?> FindScopedAsync(string id, CurrentUserContext user) =>
            (await Repository.FindAsync(ReadScope(user).And(IdEquals(id)))).FirstOrDefault();

        protected async Task<TEntity?> FindUnscopedAsync(string id) =>
            (await Repository.FindAsync(IdEquals(id))).FirstOrDefault();

        protected static void RequireAuthenticated(CurrentUserContext user)
        {
            if (!user.IsAuthenticated)
            {
                throw new UnauthorizedException("Please sign in to continue.");
            }
        }

        protected void EnsureCanCreate(TEntity entity, TDto dto, CurrentUserContext user)
        {
            if (user.IsMember)
            {
                if (!MemberCanCreate(entity, user))
                {
                    throw new ForbiddenException();
                }
                return;
            }

            if (!user.IsStaff)
            {
                throw new ForbiddenException();
            }

            if (!AnyStaffCanCreate && !user.CanAny(ModuleKey, PermissionActions.Create, PermissionActions.Edit, PermissionActions.Approve))
            {
                throw new ForbiddenException();
            }

            if (!user.CanAccessLocation(LocationOf(entity)))
            {
                throw new ForbiddenException($"You cannot create a {EntityName.ToLowerInvariant()} for a location you do not manage.");
            }
        }

        protected void EnsureCanUpdate(TEntity existing, CurrentUserContext user)
        {
            if (user.IsMember)
            {
                if (!MemberCanUpdate(existing, user))
                {
                    throw new ForbiddenException();
                }
                return;
            }

            if (!user.IsStaff)
            {
                throw new ForbiddenException();
            }

            if (!AnyStaffCanUpdate && !user.CanAny(ModuleKey, PermissionActions.Create, PermissionActions.Edit, PermissionActions.Approve))
            {
                throw new ForbiddenException();
            }

            if (!user.CanAccessLocation(LocationOf(existing)))
            {
                throw new ForbiddenException();
            }
        }

        /// <summary>Uses the id the client reserved (POST /api/Ids/Reserve) when it is valid and unused, else the next sequence value.</summary>
        protected async Task<string> ResolveNewIdAsync(string? requestedId)
        {
            if (IdHelper.IsValid(requestedId, IdPrefix) && await FindUnscopedAsync(requestedId!) == null)
            {
                return requestedId!;
            }

            while (true)
            {
                var candidate = await Ids.NextIdAsync(IdPrefix);
                if (await FindUnscopedAsync(candidate) == null)
                {
                    return candidate;
                }
            }
        }

        private IEnumerable<TDto> ApplySearch(IEnumerable<TDto> items, string? search)
        {
            if (string.IsNullOrWhiteSpace(search))
            {
                return items;
            }

            var term = search.Trim();
            return items.Where(d => SearchValues(d).Any(v => v != null && v.Contains(term, StringComparison.OrdinalIgnoreCase)));
        }

        private static readonly Dictionary<string, PropertyInfo> DtoProperties =
            typeof(TDto).GetProperties(BindingFlags.Public | BindingFlags.Instance)
                .ToDictionary(p => p.Name, p => p, StringComparer.OrdinalIgnoreCase);

        private static IEnumerable<TDto> ApplyFilters(IEnumerable<TDto> items, Dictionary<string, string>? filters)
        {
            if (filters == null || filters.Count == 0)
            {
                return items;
            }

            foreach (var (name, value) in filters)
            {
                if (string.IsNullOrEmpty(value) || !DtoProperties.TryGetValue(name, out var prop))
                {
                    continue;
                }

                items = items.Where(d => string.Equals(Convert.ToString(prop.GetValue(d), CultureInfo.InvariantCulture), value, StringComparison.OrdinalIgnoreCase));
            }

            return items;
        }

        private IEnumerable<TDto> ApplySort(IEnumerable<TDto> items, string? sortBy, string? direction)
        {
            if (string.IsNullOrWhiteSpace(sortBy) || !DtoProperties.TryGetValue(sortBy, out var prop))
            {
                return DefaultOrder(items);
            }

            var desc = string.Equals(direction, "desc", StringComparison.OrdinalIgnoreCase);
            Func<TDto, object?> key = d => prop.GetValue(d);
            return desc ? items.OrderByDescending(key, Comparer<object?>.Default) : items.OrderBy(key, Comparer<object?>.Default);
        }
    }
}
