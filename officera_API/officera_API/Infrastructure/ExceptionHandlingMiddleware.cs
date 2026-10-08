using System.Text.Json;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using officera.BusinessAccessLayer.DTOs;
using officera.Shared.Common;
using officera.Shared.Exceptions;

namespace officera_API.Infrastructure
{
    /// <summary>
    /// Central error handling: every exception becomes the standard ApiResponse envelope. Business errors keep their
    /// message; unexpected errors are logged in full (Serilog) and the client only sees a generic message and a trace id.
    /// </summary>
    public sealed class ExceptionHandlingMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<ExceptionHandlingMiddleware> _logger;
        private readonly IHostEnvironment _environment;

        public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger, IHostEnvironment environment)
        {
            _next = next;
            _logger = logger;
            _environment = environment;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            try
            {
                await _next(context);
            }
            catch (Exception ex) when (!context.Response.HasStarted)
            {
                await HandleAsync(context, ex);
            }
        }

        private async Task HandleAsync(HttpContext context, Exception exception)
        {
            var traceId = context.TraceIdentifier;
            ApiResponse<object> body;

            switch (exception)
            {
                case AuthFailedException auth:
                    _logger.LogWarning("Authentication failed on {Path}: {Code}", context.Request.Path, auth.Code);
                    body = ApiResponse<object>.Fail(auth.Message, auth.StatusCode);
                    body.Data = new AuthErrorDto { Code = auth.Code, Message = auth.Message, AttemptsLeft = auth.AttemptsLeft, LockedUntil = auth.LockedUntil };
                    break;

                case ValidationException validation:
                    _logger.LogInformation("Validation failed on {Path}: {Errors}", context.Request.Path, validation.Errors);
                    body = ApiResponse<object>.Fail(validation.Message, 400, validation.Errors);
                    break;

                case UnauthorizedException unauthorized:
                    _logger.LogWarning("Unauthorized request to {Path}", context.Request.Path);
                    body = ApiResponse<object>.Fail(unauthorized.Message, 401);
                    break;

                case CustomException custom:
                    if (custom.StatusCode == 403)
                    {
                        _logger.LogWarning("Forbidden: user {UserId} on {Method} {Path}", context.User.GetUserId(), context.Request.Method, context.Request.Path);
                    }
                    else
                    {
                        _logger.LogInformation("{Status} on {Path}: {Message}", custom.StatusCode, context.Request.Path, custom.Message);
                    }

                    body = ApiResponse<object>.Fail(custom.Message, custom.StatusCode);
                    break;

                case DbUpdateConcurrencyException concurrency:
                    _logger.LogWarning(concurrency, "Concurrency conflict on {Path}", context.Request.Path);
                    body = ApiResponse<object>.Fail("This record was changed by someone else. Reload and try again.", 409);
                    break;

                case DbUpdateException db when db.InnerException is SqlException sql:
                    _logger.LogError(db, "Database error {SqlNumber} on {Path}", sql.Number, context.Request.Path);
                    body = sql.Number switch
                    {
                        2627 or 2601 => ApiResponse<object>.Fail("A record with the same unique value already exists.", 409),
                        547 => ApiResponse<object>.Fail(context.Request.Path.Value?.EndsWith("/Delete", StringComparison.OrdinalIgnoreCase) == true
                            ? "This record is still used by other records and cannot be deleted."
                            : "A related record does not exist.", 409),
                        515 => ApiResponse<object>.Fail("A required value is missing.", 400),
                        2628 or 8152 => ApiResponse<object>.Fail("A value is longer than allowed.", 400),
                        _ => ApiResponse<object>.Fail("The database could not save the changes.", 500),
                    };
                    break;

                case SqlException sqlException:
                    _logger.LogError(sqlException, "Database unavailable on {Path}", context.Request.Path);
                    body = ApiResponse<object>.Fail("The database is not reachable right now. Please try again shortly.", 503);
                    break;

                case JsonException or BadHttpRequestException:
                    _logger.LogInformation(exception, "Malformed request to {Path}", context.Request.Path);
                    body = ApiResponse<object>.Fail("The request body is not valid.", 400);
                    break;

                default:
                    _logger.LogError(exception, "Unhandled exception on {Method} {Path} (trace {TraceId})", context.Request.Method, context.Request.Path, traceId);
                    body = ApiResponse<object>.Fail(
                        _environment.IsDevelopment() ? exception.Message : "Something went wrong on our side. Please try again.",
                        500,
                        new[] { $"Trace id: {traceId}" });
                    break;
            }

            context.Response.StatusCode = body.StatusCode;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync(JsonSerializer.Serialize(body, JsonHelper.Options));
        }
    }
}
