using System;
using System.Collections.Generic;

namespace officera.DataAccessLayer.Entities;

public partial class Booking
{
    public string Id { get; set; } = null!;

    public string MemberId { get; set; } = null!;

    public string? CompanyId { get; set; }

    public string LocationId { get; set; } = null!;

    public string ResourceId { get; set; } = null!;

    public DateOnly BookingDate { get; set; }

    public TimeOnly StartTime { get; set; }

    public TimeOnly EndTime { get; set; }

    public int Seats { get; set; }

    public decimal Amount { get; set; }

    public decimal CreditsUsed { get; set; }

    public decimal BalanceDue { get; set; }

    public string Status { get; set; } = null!;

    public string PaymentStatus { get; set; } = null!;

    public string? PaymentMethod { get; set; }

    public string? PaymentId { get; set; }

    public string? Notes { get; set; }

    public DateTime? CancelledAt { get; set; }

    public string? CancelReason { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime CreatedDate { get; set; }

    public string? ModifiedBy { get; set; }

    public DateTime? ModifiedDate { get; set; }

    public virtual Company? Company { get; set; }

    public virtual Location Location { get; set; } = null!;

    public virtual Member Member { get; set; } = null!;

    public virtual Payment? Payment { get; set; }

    public virtual ICollection<Payment> Payments { get; set; } = new List<Payment>();

    public virtual Resource Resource { get; set; } = null!;
}
