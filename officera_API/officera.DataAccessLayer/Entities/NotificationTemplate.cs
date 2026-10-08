using System;
using System.Collections.Generic;

namespace officera.DataAccessLayer.Entities;

public partial class NotificationTemplate
{
    public string Id { get; set; } = null!;

    public string Name { get; set; } = null!;

    public string EventName { get; set; } = null!;

    public string Channel { get; set; } = null!;

    public string Subject { get; set; } = null!;

    public string Message { get; set; } = null!;

    public string Status { get; set; } = null!;

    public string? CreatedBy { get; set; }

    public DateTime CreatedDate { get; set; }

    public string? ModifiedBy { get; set; }

    public DateTime? ModifiedDate { get; set; }
}
