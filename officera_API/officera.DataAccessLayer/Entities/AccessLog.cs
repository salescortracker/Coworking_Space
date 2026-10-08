using System;
using System.Collections.Generic;

namespace officera.DataAccessLayer.Entities;

public partial class AccessLog
{
    public string Id { get; set; } = null!;

    public string Person { get; set; } = null!;

    public string PersonType { get; set; } = null!;

    public string PersonId { get; set; } = null!;

    public string LocationId { get; set; } = null!;

    public string Door { get; set; } = null!;

    public DateTime LoggedAt { get; set; }

    public string Direction { get; set; } = null!;

    public string Status { get; set; } = null!;

    public string? Reason { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime CreatedDate { get; set; }

    public string? ModifiedBy { get; set; }

    public DateTime? ModifiedDate { get; set; }

    public virtual Location Location { get; set; } = null!;
}
