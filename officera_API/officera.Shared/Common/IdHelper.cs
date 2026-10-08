using System.Text.RegularExpressions;

namespace officera.Shared.Common
{
    /// <summary>Business ids such as LOC-0001 or BKG-0042.</summary>
    public static partial class IdHelper
    {
        [GeneratedRegex(@"^[A-Z]{2,6}-[A-Z0-9]{1,24}$")]
        private static partial Regex IdRegex();

        public static string Format(string prefix, int value) => $"{prefix}-{value.ToString().PadLeft(4, '0')}";

        /// <summary>True when the id is well formed and uses the expected prefix.</summary>
        public static bool IsValid(string? id, string prefix) =>
            !string.IsNullOrWhiteSpace(id) && IdRegex().IsMatch(id) && id.StartsWith(prefix + "-", StringComparison.Ordinal);
    }
}
