using System;
using System.Collections.Generic;

namespace officera.DataAccessLayer.Entities;

public partial class Lead
{
    public string Id { get; set; } = null!;

    public string Name { get; set; } = null!;

    public string Mobile { get; set; } = null!;

    public string? Email { get; set; }

    public string Source { get; set; } = null!;

    public string LocationId { get; set; } = null!;

    public string Requirement { get; set; } = null!;

    public string? SpaceType { get; set; }

    public int? Seats { get; set; }

    public DateOnly? PreferredDate { get; set; }

    public string? PreferredTime { get; set; }

    public int? Visitors { get; set; }

    public string Status { get; set; } = null!;

    public string? OwnerId { get; set; }

    public DateOnly? FollowUpDate { get; set; }

    public bool MobileVerified { get; set; }

    public string NotesJson { get; set; } = null!;

    public string CommentsJson { get; set; } = null!;

    public string ActivitiesJson { get; set; } = null!;

    public string? LostReason { get; set; }

    public string? MemberId { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime CreatedDate { get; set; }

    public string? ModifiedBy { get; set; }

    public DateTime? ModifiedDate { get; set; }

    public virtual Location Location { get; set; } = null!;

    public virtual Member? Member { get; set; }

    public virtual ICollection<Member> Members { get; set; } = new List<Member>();

    public virtual User? Owner { get; set; }
}
