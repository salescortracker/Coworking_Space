using System;
using System.Collections.Generic;

namespace officera.DataAccessLayer.Entities;

public partial class Plan
{
    public string Id { get; set; } = null!;

    public string Name { get; set; } = null!;

    public string PlanType { get; set; } = null!;

    public decimal Price { get; set; }

    public string BillingCycle { get; set; } = null!;

    public int RoomHours { get; set; }

    public int GuestPasses { get; set; }

    public decimal Credits { get; set; }

    public decimal SecurityDeposit { get; set; }

    public string Description { get; set; } = null!;

    public string BenefitsJson { get; set; } = null!;

    public string AccessHours { get; set; } = null!;

    public string Status { get; set; } = null!;

    public bool IsPopular { get; set; }

    public int Subscribers { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime CreatedDate { get; set; }

    public string? ModifiedBy { get; set; }

    public DateTime? ModifiedDate { get; set; }

    public virtual ICollection<Subscription> SubscriptionPlans { get; set; } = new List<Subscription>();

    public virtual ICollection<Subscription> SubscriptionScheduledPlans { get; set; } = new List<Subscription>();
}
