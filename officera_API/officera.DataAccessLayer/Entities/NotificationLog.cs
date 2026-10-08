using System;
using System.Collections.Generic;

namespace officera.DataAccessLayer.Entities;

public partial class NotificationLog
{
    public string Id { get; set; } = null!;

    public string EventName { get; set; } = null!;

    public string TemplateName { get; set; } = null!;

    public string Channel { get; set; } = null!;

    public string Recipient { get; set; } = null!;

    public DateTime LoggedAt { get; set; }

    public string Status { get; set; } = null!;

    public string? Provider { get; set; }

    public string? LocationId { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime CreatedDate { get; set; }

    public string? ModifiedBy { get; set; }

    public DateTime? ModifiedDate { get; set; }

    public virtual Location? Location { get; set; }
}
