using System;
using System.Collections.Generic;

namespace officera.DataAccessLayer.Entities;

public partial class Ticket
{
    public string Id { get; set; } = null!;

    public string MemberId { get; set; } = null!;

    public string LocationId { get; set; } = null!;

    public string Category { get; set; } = null!;

    public string Subject { get; set; } = null!;

    public string Description { get; set; } = null!;

    public string Priority { get; set; } = null!;

    public string Status { get; set; } = null!;

    public string? AssignedTo { get; set; }

    public DateTime? ResolvedAt { get; set; }

    public bool Escalated { get; set; }

    public string? EscalatedTo { get; set; }

    public string AttachmentsJson { get; set; } = null!;

    public string CommentsJson { get; set; } = null!;

    public string TimelineJson { get; set; } = null!;

    public string? CreatedBy { get; set; }

    public DateTime CreatedDate { get; set; }

    public string? ModifiedBy { get; set; }

    public DateTime? ModifiedDate { get; set; }

    public virtual User? AssignedToNavigation { get; set; }

    public virtual Location Location { get; set; } = null!;

    public virtual Member Member { get; set; } = null!;
}
