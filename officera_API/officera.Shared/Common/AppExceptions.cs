using officera.Shared.Exceptions;

namespace officera.Shared.Common
{
    /// <summary>400 – business rule or input validation failed.</summary>
    public class ValidationException : CustomException
    {
        public IReadOnlyList<string> Errors { get; }

        public ValidationException(string message, IEnumerable<string>? errors = null)
            : base(message, 400)
        {
            Errors = errors?.ToList() ?? new List<string> { message };
        }
    }

    /// <summary>401 – not signed in or credentials rejected.</summary>
    public class UnauthorizedException : CustomException
    {
        public string? Code { get; }

        public UnauthorizedException(string message, string? code = null)
            : base(message, 401)
        {
            Code = code;
        }
    }

    /// <summary>403 – signed in but not allowed.</summary>
    public class ForbiddenException : CustomException
    {
        public ForbiddenException(string message = "You do not have permission to perform this action.")
            : base(message, 403)
        {
        }
    }

    /// <summary>404 – record not found (or not visible to the caller).</summary>
    public class NotFoundException : CustomException
    {
        public NotFoundException(string entity, string? id = null)
            : base(id == null ? $"{entity} not found." : $"{entity} '{id}' was not found.", 404)
        {
        }
    }

    /// <summary>409 – duplicate record or record still referenced.</summary>
    public class ConflictException : CustomException
    {
        public ConflictException(string message)
            : base(message, 409)
        {
        }
    }

    /// <summary>
    /// Authentication failure with a machine-readable code the login screen understands
    /// (INVALID_CREDENTIALS, LOCKED, NOT_FOUND, INACTIVE, INVALID_OTP, EXISTS).
    /// </summary>
    public class AuthFailedException : CustomException
    {
        public string Code { get; }
        public int? AttemptsLeft { get; }
        public long? LockedUntil { get; }

        public AuthFailedException(string code, string message, int statusCode = 401, int? attemptsLeft = null, long? lockedUntil = null)
            : base(message, statusCode)
        {
            Code = code;
            AttemptsLeft = attemptsLeft;
            LockedUntil = lockedUntil;
        }
    }
}
