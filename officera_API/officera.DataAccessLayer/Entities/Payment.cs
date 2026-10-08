using System;
using System.Collections.Generic;

namespace officera.DataAccessLayer.Entities;

public partial class Payment
{
    public string Id { get; set; } = null!;

    public string MemberId { get; set; } = null!;

    public string LocationId { get; set; } = null!;

    public DateTime PaymentDate { get; set; }

    public string PaymentType { get; set; } = null!;

    public string Description { get; set; } = null!;

    public decimal Amount { get; set; }

    public string Method { get; set; } = null!;

    public string Status { get; set; } = null!;

    public string GatewayRef { get; set; } = null!;

    public string? InvoiceId { get; set; }

    public string? BookingId { get; set; }

    public string? SubscriptionId { get; set; }

    public int RetryCount { get; set; }

    public string? FailureReason { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime CreatedDate { get; set; }

    public string? ModifiedBy { get; set; }

    public DateTime? ModifiedDate { get; set; }

    public virtual Booking? Booking { get; set; }

    public virtual ICollection<Booking> Bookings { get; set; } = new List<Booking>();

    public virtual Invoice? Invoice { get; set; }

    public virtual ICollection<Invoice> Invoices { get; set; } = new List<Invoice>();

    public virtual Location Location { get; set; } = null!;

    public virtual Member Member { get; set; } = null!;

    public virtual ICollection<Refund> Refunds { get; set; } = new List<Refund>();

    public virtual Subscription? Subscription { get; set; }
}
