using System;
using System.Collections.Generic;

namespace officera.DataAccessLayer.Entities;

public partial class Subscription
{
    public string Id { get; set; } = null!;

    public string MemberId { get; set; } = null!;

    public string PlanId { get; set; } = null!;

    public string LocationId { get; set; } = null!;

    public string Status { get; set; } = null!;

    public DateOnly StartDate { get; set; }

    public DateOnly EndDate { get; set; }

    public string BillingCycle { get; set; } = null!;

    public decimal Price { get; set; }

    public decimal RoomHoursTotal { get; set; }

    public decimal RoomHoursUsed { get; set; }

    public int GuestPassesTotal { get; set; }

    public int GuestPassesUsed { get; set; }

    public decimal CreditsTotal { get; set; }

    public decimal CreditsUsed { get; set; }

    public decimal SecurityDeposit { get; set; }

    public bool AutoRenew { get; set; }

    public int PaymentRetries { get; set; }

    public DateOnly? GraceUntil { get; set; }

    public DateOnly? PausedUntil { get; set; }

    public DateOnly? CancelAt { get; set; }

    public string? CancelReason { get; set; }

    public string? ScheduledPlanId { get; set; }

    public DateOnly? ScheduledEffective { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime CreatedDate { get; set; }

    public string? ModifiedBy { get; set; }

    public DateTime? ModifiedDate { get; set; }

    public virtual Location Location { get; set; } = null!;

    public virtual Member Member { get; set; } = null!;

    public virtual ICollection<Payment> Payments { get; set; } = new List<Payment>();

    public virtual Plan Plan { get; set; } = null!;

    public virtual Plan? ScheduledPlan { get; set; }
}
