using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

namespace officera.DataAccessLayer.Data;

/// <summary>
/// Hand-written additions to the scaffolded <see cref="OfficeraContext"/>.
/// Kept in a separate partial file so re-scaffolding (dotnet ef dbcontext scaffold --force) never overwrites it.
/// </summary>
public partial class OfficeraContext
{
    partial void OnModelCreatingPartial(ModelBuilder modelBuilder)
    {
        // Scaffolded columns with SQL defaults are configured as "generated on add", so EF skips the value
        // whenever it equals the CLR default (false / 0). For columns such as Subscriptions.AutoRenew (DEFAULT 1)
        // that would silently turn an explicit "false" into "true". The API always sets every value
        // (audit columns are filled by the audit interceptor), so the application value must always be sent.
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var property in entityType.GetProperties())
            {
                if (property.IsKey() || property.IsConcurrencyToken)
                {
                    continue;
                }

                if (property.GetDefaultValue() != null || property.GetDefaultValueSql() != null)
                {
                    property.ValueGenerated = ValueGenerated.Never;
                }
            }
        }
    }
}
