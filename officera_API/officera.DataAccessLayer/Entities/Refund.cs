using System;
using System.Collections.Generic;

namespace officera.DataAccessLayer.Entities;

public partial class Refund
{
    public string Id { get; set; } = null!;

    public string PaymentId { get; set; } = null!;

    public string MemberId { get; set; } = null!;

    public string LocationId { get; set; } = null!;

    public decimal Amount { get; set; }

    public string Reason { get; set; } = null!;

    public string Status { get; set; } = null!;

    public DateTime RequestedAt { get; set; }

    public DateTime? ProcessedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime CreatedDate { get; set; }

    public string? ModifiedBy { get; set; }

    public DateTime? ModifiedDate { get; set; }

    public virtual Location Location { get; set; } = null!;

    public virtual Member Member { get; set; } = null!;

    public virtual Payment Payment { get; set; } = null!;
}
