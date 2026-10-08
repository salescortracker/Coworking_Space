using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace officera.Shared.Common
{
    /// <summary>Supplies the signed-in user id for audit columns.</summary>
    public interface IAuditUserProvider
    {
        string? AuditUserId { get; }
    }

    /// <summary>
    /// Fills CreatedBy / CreatedDate / ModifiedBy / ModifiedDate on every insert and update, from the JWT user.
    /// Registered on the DbContext, so no service or repository has to remember to do it.
    /// </summary>
    public sealed class AuditSaveChangesInterceptor : SaveChangesInterceptor
    {
        private readonly IAuditUserProvider _userProvider;

        public AuditSaveChangesInterceptor(IAuditUserProvider userProvider)
        {
            _userProvider = userProvider;
        }

        public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
        {
            Apply(eventData.Context);
            return base.SavingChanges(eventData, result);
        }

        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            Apply(eventData.Context);
            return base.SavingChangesAsync(eventData, result, cancellationToken);
        }

        private void Apply(DbContext? context)
        {
            if (context == null)
            {
                return;
            }

            var now = DateTime.UtcNow;
            var userId = _userProvider.AuditUserId ?? "SYSTEM";
            foreach (var entry in context.ChangeTracker.Entries())
            {
                switch (entry.State)
                {
                    case EntityState.Added:
                        Set(entry, "CreatedDate", now, onlyIfDefault: true);
                        Set(entry, "CreatedBy", userId, onlyIfDefault: true);
                        break;
                    case EntityState.Modified:
                        Set(entry, "ModifiedDate", now);
                        Set(entry, "ModifiedBy", userId);
                        // Creation audit is immutable.
                        Protect(entry, "CreatedDate");
                        Protect(entry, "CreatedBy");
                        break;
                }
            }
        }

        private static void Set(EntityEntry entry, string property, object value, bool onlyIfDefault = false)
        {
            var prop = entry.Metadata.FindProperty(property);
            if (prop == null)
            {
                return;
            }

            var current = entry.Property(property).CurrentValue;
            if (onlyIfDefault && current != null && !(current is DateTime dt && dt == default) && !(current is string s && s.Length == 0))
            {
                return;
            }

            entry.Property(property).CurrentValue = value;
        }

        private static void Protect(EntityEntry entry, string property)
        {
            if (entry.Metadata.FindProperty(property) != null)
            {
                entry.Property(property).IsModified = false;
            }
        }
    }
}
