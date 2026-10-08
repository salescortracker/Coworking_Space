using System;
using System.Collections.Generic;

namespace officera.DataAccessLayer.Entities;

public partial class AccessCredential
{
    public string Id { get; set; } = null!;

    public string HolderId { get; set; } = null!;

    public string HolderName { get; set; } = null!;

    public string HolderType { get; set; } = null!;

    public string LocationId { get; set; } = null!;

    public string Code { get; set; } = null!;

    public string Status { get; set; } = null!;

    public DateTime IssuedAt { get; set; }

    public DateOnly ValidUntil { get; set; }

    public string AccessHours { get; set; } = null!;

    public string? RevokedReason { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime CreatedDate { get; set; }

    public string? ModifiedBy { get; set; }

    public DateTime? ModifiedDate { get; set; }

    public virtual Location Location { get; set; } = null!;
}
