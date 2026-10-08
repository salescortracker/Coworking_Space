using System.Text.RegularExpressions;

namespace officera.Shared.Common
{
    /// <summary>
    /// Server-side validation rules. They mirror the Angular validators in shared/utils/validators.ts
    /// so both sides accept the same input.
    /// </summary>
    public static partial class ValidationHelper
    {
        [GeneratedRegex(@"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")]
        private static partial Regex EmailRegex();

        [GeneratedRegex(@"^[6-9]\d{9}$")]
        private static partial Regex MobileRegex();

        [GeneratedRegex(@"^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")]
        private static partial Regex GstinRegex();

        [GeneratedRegex(@"^[A-Z]{5}\d{4}[A-Z]$")]
        private static partial Regex PanRegex();

        [GeneratedRegex(@"^\d{6}$")]
        private static partial Regex PincodeRegex();

        public static bool IsEmail(string? value) => !string.IsNullOrWhiteSpace(value) && value.Length <= 256 && EmailRegex().IsMatch(value.Trim());

        /// <summary>Indian 10-digit mobile number (an optional +91 / 0 prefix and spaces are stripped).</summary>
        public static bool IsMobile(string? value) => !string.IsNullOrWhiteSpace(value) && MobileRegex().IsMatch(NormalizeMobile(value));

        public static string NormalizeMobile(string? value)
        {
            var digits = new string((value ?? string.Empty).Where(char.IsDigit).ToArray());
            return digits.Length > 10 ? digits[^10..] : digits;
        }

        public static bool IsGstin(string? value) => !string.IsNullOrWhiteSpace(value) && GstinRegex().IsMatch(value.Trim().ToUpperInvariant());

        public static bool IsPan(string? value) => !string.IsNullOrWhiteSpace(value) && PanRegex().IsMatch(value.Trim().ToUpperInvariant());

        public static bool IsPincode(string? value) => !string.IsNullOrWhiteSpace(value) && PincodeRegex().IsMatch(value.Trim());

        /// <summary>8+ characters with upper case, lower case, a number and a symbol (same rule as the register screen).</summary>
        public static bool IsStrongPassword(string? value) =>
            !string.IsNullOrEmpty(value)
            && value.Length >= 8
            && value.Any(char.IsUpper)
            && value.Any(char.IsLower)
            && value.Any(char.IsDigit)
            && value.Any(c => !char.IsLetterOrDigit(c));

        public static bool IsHttpUrl(string? value) =>
            Uri.TryCreate(value, UriKind.Absolute, out var uri) && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);

        /// <summary>Collects validation errors and throws one <see cref="ValidationException"/> with all of them.</summary>
        public sealed class Collector
        {
            private readonly List<string> _errors = new();

            public Collector Required(string? value, string field)
            {
                if (string.IsNullOrWhiteSpace(value))
                {
                    _errors.Add($"{field} is required.");
                }
                return this;
            }

            public Collector MaxLength(string? value, int max, string field)
            {
                if (value != null && value.Length > max)
                {
                    _errors.Add($"{field} must be at most {max} characters.");
                }
                return this;
            }

            public Collector Email(string? value, string field, bool required = true)
            {
                if (string.IsNullOrWhiteSpace(value))
                {
                    if (required)
                    {
                        _errors.Add($"{field} is required.");
                    }
                }
                else if (!IsEmail(value))
                {
                    _errors.Add($"{field} must be a valid email address.");
                }
                return this;
            }

            public Collector Mobile(string? value, string field, bool required = true)
            {
                if (string.IsNullOrWhiteSpace(value))
                {
                    if (required)
                    {
                        _errors.Add($"{field} is required.");
                    }
                }
                else if (!IsMobile(value))
                {
                    _errors.Add($"{field} must be a valid 10-digit mobile number.");
                }
                return this;
            }

            public Collector Gstin(string? value, string field)
            {
                if (!string.IsNullOrWhiteSpace(value) && !IsGstin(value))
                {
                    _errors.Add($"{field} is not a valid GSTIN.");
                }
                return this;
            }

            public Collector Range(decimal value, decimal min, decimal max, string field)
            {
                if (value < min || value > max)
                {
                    _errors.Add($"{field} must be between {min} and {max}.");
                }
                return this;
            }

            public Collector Min(decimal value, decimal min, string field)
            {
                if (value < min)
                {
                    _errors.Add($"{field} must be at least {min}.");
                }
                return this;
            }

            public Collector OneOf(string? value, IEnumerable<string> allowed, string field)
            {
                if (value == null || !allowed.Contains(value))
                {
                    _errors.Add($"{field} has an invalid value '{value}'.");
                }
                return this;
            }

            public Collector Must(bool condition, string message)
            {
                if (!condition)
                {
                    _errors.Add(message);
                }
                return this;
            }

            public void ThrowIfInvalid()
            {
                if (_errors.Count > 0)
                {
                    throw new ValidationException(_errors.Count == 1 ? _errors[0] : "Please correct the highlighted fields.", _errors);
                }
            }
        }
    }
}
