using System.Globalization;

namespace officera.Shared.Common
{
    /// <summary>
    /// Conversions between the database types (DateOnly / TimeOnly / DateTime UTC) and the
    /// string formats the Angular app uses (yyyy-MM-dd, HH:mm, ISO-8601 UTC).
    /// </summary>
    public static class DateTimeHelper
    {
        private static readonly CultureInfo Inv = CultureInfo.InvariantCulture;

        public static DateTime UtcNow => DateTime.UtcNow;

        public static DateOnly TodayUtc => DateOnly.FromDateTime(DateTime.UtcNow);

        public static string ToIso(DateTime value)
        {
            var utc = value.Kind switch
            {
                DateTimeKind.Utc => value,
                DateTimeKind.Local => value.ToUniversalTime(),
                _ => DateTime.SpecifyKind(value, DateTimeKind.Utc), // values read from SQL Server are stored as UTC
            };
            return utc.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", Inv);
        }

        public static string? ToIso(DateTime? value) => value.HasValue ? ToIso(value.Value) : null;

        public static DateTime? ParseUtc(string? text)
        {
            if (string.IsNullOrWhiteSpace(text))
            {
                return null;
            }

            if (DateTime.TryParse(text, Inv, DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal, out var parsed))
            {
                return DateTime.SpecifyKind(parsed, DateTimeKind.Utc);
            }

            return null;
        }

        public static string ToDateString(DateOnly value) => value.ToString("yyyy-MM-dd", Inv);

        public static string? ToDateString(DateOnly? value) => value.HasValue ? ToDateString(value.Value) : null;

        /// <summary>Parses yyyy-MM-dd (or a full ISO date-time, taking its date part).</summary>
        public static DateOnly? ParseDate(string? text)
        {
            if (string.IsNullOrWhiteSpace(text))
            {
                return null;
            }

            var part = text.Length >= 10 ? text[..10] : text;
            return DateOnly.TryParseExact(part, "yyyy-MM-dd", Inv, DateTimeStyles.None, out var d) ? d : null;
        }

        public static DateOnly RequireDate(string? text, string field) =>
            ParseDate(text) ?? throw new ValidationException($"{field} must be a valid date (yyyy-mm-dd).");

        public static string ToTimeString(TimeOnly value) => value.ToString("HH:mm", Inv);

        /// <summary>Parses HH:mm or H:mm (seconds optional).</summary>
        public static TimeOnly? ParseTime(string? text)
        {
            if (string.IsNullOrWhiteSpace(text))
            {
                return null;
            }

            string[] formats = { "HH:mm", "H:mm", "HH:mm:ss", "H:mm:ss" };
            return TimeOnly.TryParseExact(text.Trim(), formats, Inv, DateTimeStyles.None, out var t) ? t : null;
        }

        public static TimeOnly RequireTime(string? text, string field) =>
            ParseTime(text) ?? throw new ValidationException($"{field} must be a valid time (HH:mm).");
    }
}
