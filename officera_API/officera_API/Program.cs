using Microsoft.Extensions.FileProviders;
using Microsoft.Net.Http.Headers;
using officera_API.Infrastructure;
using officera.Shared.Common;
using Serilog;

// Bootstrap logger so start-up failures are captured before configuration is read.
Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{
    Log.Information("Starting Officera API");

    var builder = WebApplication.CreateBuilder(args);

    // Serilog: configured from the "Serilog" section of appsettings.json (console + rolling files in Logs/).
    builder.Host.UseSerilog((context, services, configuration) => configuration
        .ReadFrom.Configuration(context.Configuration)
        .ReadFrom.Services(services)
        .Enrich.FromLogContext());

    // Add services to the container.
    builder.Services.AddOfficeraApi();
    builder.Services.AddOfficeraSecurity(builder.Configuration, builder.Environment);
    builder.Services.AddOfficeraData(builder.Configuration);
    builder.Services.AddOfficeraBusiness(builder.Configuration);

    var app = builder.Build();

    // Configure the HTTP request pipeline.
    // Request logging wraps the error handler so the logged status code is the one the client receives.
    app.UseSerilogRequestLogging(options =>
    {
        options.MessageTemplate = "HTTP {RequestMethod} {RequestPath} responded {StatusCode} in {Elapsed:0} ms";
        options.EnrichDiagnosticContext = (diagnostics, http) =>
        {
            diagnostics.Set("UserId", http.User.GetUserId() ?? "anonymous");
            diagnostics.Set("ClientIp", http.Connection.RemoteIpAddress?.ToString() ?? string.Empty);
        };
    });
    app.UseMiddleware<ExceptionHandlingMiddleware>();

    if (app.Environment.IsDevelopment())
    {
        app.UseSwagger();
        app.UseSwaggerUI(c =>
        {
            c.SwaggerEndpoint("/swagger/v1/swagger.json", "Officera API v1");
            c.DocumentTitle = "Officera API";
            c.EnablePersistAuthorization();
        });
    }
    else
    {
        app.UseHsts();
    }

    app.UseHttpsRedirection();

    // Uploaded files: wwwroot/uploads. Only the uploads folder is served, with no content sniffing.
    var webRoot = app.Environment.WebRootPath ?? Path.Combine(app.Environment.ContentRootPath, "wwwroot");
    foreach (var folder in FileCategories.All)
    {
        Directory.CreateDirectory(Path.Combine(webRoot, "uploads", folder));
    }

    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new PhysicalFileProvider(Path.Combine(webRoot, "uploads")),
        RequestPath = "/uploads",
        OnPrepareResponse = ctx =>
        {
            ctx.Context.Response.Headers[HeaderNames.XContentTypeOptions] = "nosniff";
            ctx.Context.Response.Headers[HeaderNames.CacheControl] = "public,max-age=604800";
            ctx.Context.Response.Headers["Content-Security-Policy"] = "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'";
        },
    });

    app.UseCors(ServiceRegistration.CorsPolicy);
    app.UseRateLimiter();
    app.UseAuthentication();
    app.UseAuthorization();

    app.MapControllers();

    app.Run();
}
catch (Exception ex) when (ex is not HostAbortedException)
{
    Log.Fatal(ex, "Officera API terminated unexpectedly");
    throw;
}
finally
{
    Log.CloseAndFlush();
}

/// <summary>Exposed for integration tests (WebApplicationFactory).</summary>
public partial class Program { }
