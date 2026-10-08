# Officera database (database-first)

No EF Core migrations are used. The schema lives in these scripts and the entities are scaffolded from the database.

1. Create the tables (empty database named in `appsettings.json`):

   ```
   sqlcmd -S "(localdb)\MSSQLLocalDB" -E -d officera_Dev -I -f 65001 -i 01_Schema.sql
   sqlcmd -S "(localdb)\MSSQLLocalDB" -E -d officera_Dev -I -f 65001 -i 02_SeedData.sql
   ```

   `-I` (QUOTED_IDENTIFIER on) is required for the filtered indexes; `-f 65001` keeps the UTF-8 text intact.

2. After changing the schema, re-scaffold from `officera.DataAccessLayer`:

   ```
   dotnet ef dbcontext scaffold "Server=(localdb)\MSSQLLocalDB;Database=officera_Dev;Trusted_Connection=True;TrustServerCertificate=True" Microsoft.EntityFrameworkCore.SqlServer --output-dir Entities --context-dir Data --context OfficeraContext --namespace officera.DataAccessLayer.Entities --context-namespace officera.DataAccessLayer.Data --no-onconfiguring --force
   ```

   Hand-written additions live in `Data/OfficeraContext.Partial.cs`, which scaffolding never overwrites.

3. The seed creates only reference data (roles, permissions, GST states, business rules, notification templates,
   homepage copy) and the Super Admin `admin@officera.in`. Change that password after the first sign-in.

The API also needs a JWT signing key (never committed):

```
cd officera_API/officera_API
dotnet user-secrets set "Jwt:Key" "<at least 32 random characters>"
```
