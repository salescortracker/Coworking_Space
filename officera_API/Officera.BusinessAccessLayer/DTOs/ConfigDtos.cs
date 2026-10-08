namespace officera.BusinessAccessLayer.DTOs
{
    /// <summary>Frontend: SupplierInfo.</summary>
    public class SupplierInfoDto
    {
        public string LegalName { get; set; } = string.Empty;
        public string Gstin { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public string State { get; set; } = string.Empty;
        public string StateCode { get; set; } = string.Empty;
        public string Pan { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
    }

    /// <summary>Frontend: OrgSettings (core/services/settings.service.ts).</summary>
    public class OrgSettingsDto
    {
        public SupplierInfoDto Supplier { get; set; } = new();
        public decimal GstRate { get; set; }
        public int SlotLockMinutes { get; set; }
        public int FreeCancellationHours { get; set; }
        public int TicketEscalationHours { get; set; }
        public List<int> PaymentRetryDays { get; set; } = new();
        public int GracePeriodDays { get; set; }
        public int BookingReminderMinutes { get; set; }
        public int RenewalReminderDays { get; set; }
        public int MaxLoginAttempts { get; set; }
        public int LockoutMinutes { get; set; }
        public string Currency { get; set; } = "INR";
        public string Timezone { get; set; } = "Asia/Kolkata";
    }

    /// <summary>Masked reference to a secret held server-side (frontend: SecretRef).</summary>
    public class SecretRefDto
    {
        public bool IsSet { get; set; }
        public string? Hint { get; set; }
        public string? VaultRef { get; set; }
        public string? UpdatedAt { get; set; }
    }

    /// <summary>Frontend: ConnectionTest.</summary>
    public class ConnectionTestDto
    {
        public string At { get; set; } = string.Empty;
        public bool Ok { get; set; }
        public int LatencyMs { get; set; }
        public string Message { get; set; } = string.Empty;
        public string By { get; set; } = string.Empty;
    }

    /// <summary>
    /// Frontend: Integration. Secret values are accepted once through <see cref="SecretInputs"/>,
    /// encrypted with ASP.NET Core Data Protection and never returned.
    /// </summary>
    public class IntegrationDto : IEntityDto
    {
        public string Id { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string ProviderKey { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
        public string Environment { get; set; } = "SANDBOX";
        public bool Enabled { get; set; } = true;
        public bool Active { get; set; }
        public string Status { get; set; } = "UNTESTED";
        public Dictionary<string, string> Config { get; set; } = new();
        public Dictionary<string, SecretRefDto> Secrets { get; set; } = new();
        public List<ConnectionTestDto> Tests { get; set; } = new();
        public string? UpdatedAt { get; set; }
        public string UpdatedBy { get; set; } = string.Empty;

        /// <summary>Write-only: plain secret values typed by the Super Admin (key → value).</summary>
        public Dictionary<string, string>? SecretInputs { get; set; }
    }

    public class StateDto
    {
        public string Code { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
    }

    /// <summary>Result of an upload (frontend: Attachment + url).</summary>
    public class FileUploadResultDto
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public long Size { get; set; }
        public string Type { get; set; } = string.Empty;
        /// <summary>Path relative to the API base URL, e.g. /uploads/images/2f1c....jpg</summary>
        public string Url { get; set; } = string.Empty;
    }

    public class ReserveIdsRequest
    {
        public List<string> Prefixes { get; set; } = new();
        public int Count { get; set; } = 5;
    }
}
