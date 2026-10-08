using System;
using System.Collections.Generic;

namespace officera.DataAccessLayer.Entities;

public partial class Visitor
{
    public string Id { get; set; } = null!;

    public string Name { get; set; } = null!;

    public string Mobile { get; set; } = null!;

    public string Email { get; set; } = null!;

    public string? Company { get; set; }

    public string HostMemberId { get; set; } = null!;

    public string LocationId { get; set; } = null!;

    public DateOnly VisitDate { get; set; }

    public TimeOnly VisitTime { get; set; }

    public string Purpose { get; set; } = null!;

    public string Status { get; set; } = null!;

    public string PassCode { get; set; } = null!;

    public bool PhotoCaptured { get; set; }

    public bool HostNotified { get; set; }

    public DateTime? CheckInAt { get; set; }

    public DateTime? CheckOutAt { get; set; }

    public string NotifiedViaJson { get; set; } = null!;

    public string? CreatedBy { get; set; }

    public DateTime CreatedDate { get; set; }

    public string? ModifiedBy { get; set; }

    public DateTime? ModifiedDate { get; set; }

    public virtual Member HostMember { get; set; } = null!;

    public virtual Location Location { get; set; } = null!;
}
