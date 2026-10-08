using System;
using System.Collections.Generic;

namespace officera.DataAccessLayer.Entities;

public partial class Integration
{
    public string Id { get; set; } = null!;

    public string Category { get; set; } = null!;

    public string ProviderKey { get; set; } = null!;

    public string DisplayName { get; set; } = null!;

    public string Environment { get; set; } = null!;

    public bool Enabled { get; set; }

    public bool IsActive { get; set; }

    public string Status { get; set; } = null!;

    public string ConfigJson { get; set; } = null!;

    public string TestsJson { get; set; } = null!;

    public string UpdatedByName { get; set; } = null!;

    public string? CreatedBy { get; set; }

    public DateTime CreatedDate { get; set; }

    public string? ModifiedBy { get; set; }

    public DateTime? ModifiedDate { get; set; }

    public virtual ICollection<IntegrationSecret> IntegrationSecrets { get; set; } = new List<IntegrationSecret>();
}
