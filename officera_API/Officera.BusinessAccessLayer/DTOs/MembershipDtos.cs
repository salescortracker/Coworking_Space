namespace officera.BusinessAccessLayer.DTOs
{
    /// <summary>Frontend: Plan.</summary>
    public class PlanDto : IEntityDto
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public decimal Price { get; set; }
        public string BillingCycle { get; set; } = "MONTHLY";
        public int RoomHours { get; set; }
        public int GuestPasses { get; set; }
        public decimal Credits { get; set; }
        public decimal SecurityDeposit { get; set; }
        public string Description { get; set; } = string.Empty;
        public List<string> Benefits { get; set; } = new();
        public string AccessHours { get; set; } = string.Empty;
        public string Status { get; set; } = "ACTIVE";
        public bool? Popular { get; set; }
        public int Subscribers { get; set; }
    }

    public class ScheduledChangeDto
    {
        public string PlanId { get; set; } = string.Empty;
        public string Effective { get; set; } = string.Empty;
    }

    /// <summary>Frontend: Subscription.</summary>
    public class SubscriptionDto : IEntityDto
    {
        public string Id { get; set; } = string.Empty;
        public string MemberId { get; set; } = string.Empty;
        public string PlanId { get; set; } = string.Empty;
        public string LocationId { get; set; } = string.Empty;
        public string Status { get; set; } = "PENDING_PAYMENT";
        public string StartDate { get; set; } = string.Empty;
        public string EndDate { get; set; } = string.Empty;
        public string BillingCycle { get; set; } = "MONTHLY";
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
        public string? GraceUntil { get; set; }
        public string? PausedUntil { get; set; }
        public string? CancelAt { get; set; }
        public string? CancelReason { get; set; }
        public ScheduledChangeDto? ScheduledChange { get; set; }
        public string? CreatedAt { get; set; }
    }

    /// <summary>Frontend: CreditTransaction.</summary>
    public class CreditTransactionDto : IEntityDto
    {
        public string Id { get; set; } = string.Empty;
        public string MemberId { get; set; } = string.Empty;
        public string Date { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public string Reference { get; set; } = string.Empty;
        public string Note { get; set; } = string.Empty;
    }

    /// <summary>Frontend: Promotion.</summary>
    public class PromotionDto : IEntityDto
    {
        public string Id { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string DiscountType { get; set; } = "PERCENT";
        public decimal Discount { get; set; }
        public string Expiry { get; set; } = string.Empty;
        public int UsageLimit { get; set; }
        public int Used { get; set; }
        public string Status { get; set; } = "ACTIVE";
        public string AppliesTo { get; set; } = "ALL";
    }
}
