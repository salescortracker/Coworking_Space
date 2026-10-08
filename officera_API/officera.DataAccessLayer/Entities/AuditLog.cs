using System;
using System.Collections.Generic;

namespace officera.DataAccessLayer.Entities;

public partial class AuditLog
{
    public string Id { get; set; } = null!;

    public string? UserId { get; set; }

    public string UserName { get; set; } = null!;

    public string RoleName { get; set; } = null!;

    public string Action { get; set; } = null!;

    public string Module { get; set; } = null!;

    public string Entity { get; set; } = null!;

    public string EntityId { get; set; } = null!;

    public DateTime LoggedAt { get; set; }

    public string IpAddress { get; set; } = null!;

    public string Device { get; set; } = null!;

    public string Description { get; set; } = null!;

    public string? CreatedBy { get; set; }

    public DateTime CreatedDate { get; set; }

    public string? ModifiedBy { get; set; }

    public DateTime? ModifiedDate { get; set; }
}
