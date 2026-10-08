using System;
using System.Collections.Generic;

namespace officera.DataAccessLayer.Entities;

public partial class Notification
{
    public string Id { get; set; } = null!;

    public string Audience { get; set; } = null!;

    public string? UserId { get; set; }

    public string Category { get; set; } = null!;

    public string Title { get; set; } = null!;

    public string Message { get; set; } = null!;

    public DateTime NotifiedAt { get; set; }

    public bool IsRead { get; set; }

    public string? Link { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime CreatedDate { get; set; }

    public string? ModifiedBy { get; set; }

    public DateTime? ModifiedDate { get; set; }

    public virtual User? User { get; set; }
}
