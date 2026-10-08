using System.Security.Claims;

namespace officera.Shared.Common
{
    /// <summary>Reads Officera claims from the authenticated principal.</summary>
    public static class ClaimsHelper
    {
        public static string? GetUserId(this ClaimsPrincipal? principal) =>
            principal?.FindFirst(OfficeraClaims.UserId)?.Value ?? principal?.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        public static string? GetRole(this ClaimsPrincipal? principal) =>
            principal?.FindFirst(ClaimTypes.Role)?.Value ?? principal?.FindFirst(OfficeraClaims.Role)?.Value;

        public static string? GetMemberId(this ClaimsPrincipal? principal) => principal?.FindFirst(OfficeraClaims.MemberId)?.Value;

        public static string? GetName(this ClaimsPrincipal? principal) => principal?.FindFirst(OfficeraClaims.Name)?.Value;

        /// <summary>"Chrome / Windows" style label for the audit log.</summary>
        public static string DeviceFromUserAgent(string? userAgent)
        {
            var ua = userAgent ?? string.Empty;
            var browser = ua.Contains("Edg/") ? "Edge" : ua.Contains("Chrome/") ? "Chrome" : ua.Contains("Firefox/") ? "Firefox" : ua.Contains("Safari/") ? "Safari" : string.IsNullOrEmpty(ua) ? "API client" : "Browser";
            var os = ua.Contains("Windows") ? "Windows" : ua.Contains("Android") ? "Android" : ua.Contains("iPhone") || ua.Contains("iPad") ? "iOS" : ua.Contains("Mac OS") ? "macOS" : ua.Contains("Linux") ? "Linux" : "Unknown OS";
            return $"{browser} / {os}";
        }
    }
}
