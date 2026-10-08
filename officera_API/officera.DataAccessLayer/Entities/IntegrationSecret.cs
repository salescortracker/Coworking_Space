using System;
using System.Collections.Generic;

namespace officera.DataAccessLayer.Entities;

public partial class IntegrationSecret
{
    public string IntegrationId { get; set; } = null!;

    public string FieldKey { get; set; } = null!;

    public string ProtectedValue { get; set; } = null!;

    public string Hint { get; set; } = null!;

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public virtual Integration Integration { get; set; } = null!;
}
