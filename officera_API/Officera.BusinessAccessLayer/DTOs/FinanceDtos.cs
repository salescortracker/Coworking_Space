namespace officera.BusinessAccessLayer.DTOs
{
    /// <summary>Frontend: Booking.</summary>
    public class BookingDto : IEntityDto
    {
        public string Id { get; set; } = string.Empty;
        public string MemberId { get; set; } = string.Empty;
        public string? CompanyId { get; set; }
        public string LocationId { get; set; } = string.Empty;
        public string ResourceId { get; set; } = string.Empty;
        public string Date { get; set; } = string.Empty;
        public string StartTime { get; set; } = string.Empty;
        public string EndTime { get; set; } = string.Empty;
        public int Seats { get; set; } = 1;
        public decimal Amount { get; set; }
        public decimal CreditsUsed { get; set; }
        public decimal BalanceDue { get; set; }
        public string Status { get; set; } = "PENDING";
        public string PaymentStatus { get; set; } = "PENDING";
        public string? PaymentMethod { get; set; }
        public string? PaymentId { get; set; }
        public string? Notes { get; set; }
        public string? CreatedAt { get; set; }
        public string? CancelledAt { get; set; }
        public string? CancelReason { get; set; }
    }

    /// <summary>Occupied slot without any member information (availability grid, public search).</summary>
    public class OccupancySlotDto
    {
        public string ResourceId { get; set; } = string.Empty;
        public string LocationId { get; set; } = string.Empty;
        public string Date { get; set; } = string.Empty;
        public string StartTime { get; set; } = string.Empty;
        public string EndTime { get; set; } = string.Empty;
    }

    public class OccupancyRequest
    {
        public string? From { get; set; }
        public string? To { get; set; }
        public string? LocationId { get; set; }
    }

    /// <summary>Frontend: Payment.</summary>
    public class PaymentDto : IEntityDto
    {
        public string Id { get; set; } = string.Empty;
        public string MemberId { get; set; } = string.Empty;
        public string LocationId { get; set; } = string.Empty;
        public string Date { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public string Method { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string GatewayRef { get; set; } = string.Empty;
        public string? InvoiceId { get; set; }
        public string? BookingId { get; set; }
        public string? SubscriptionId { get; set; }
        public int RetryCount { get; set; }
        public string? FailureReason { get; set; }
    }

    public class InvoiceLineDto
    {
        public string Description { get; set; } = string.Empty;
        public string Sac { get; set; } = string.Empty;
        public decimal Qty { get; set; }
        public decimal Rate { get; set; }
        public decimal Amount { get; set; }
    }

    /// <summary>Frontend: Invoice.</summary>
    public class InvoiceDto : IEntityDto
    {
        public string Id { get; set; } = string.Empty;
        public string Number { get; set; } = string.Empty;
        public string Date { get; set; } = string.Empty;
        public string DueDate { get; set; } = string.Empty;
        public string MemberId { get; set; } = string.Empty;
        public string LocationId { get; set; } = string.Empty;
        public string CustomerName { get; set; } = string.Empty;
        public string? CompanyName { get; set; }
        public string? CustomerGstin { get; set; }
        public string BillingAddress { get; set; } = string.Empty;
        public string PlaceOfSupply { get; set; } = string.Empty;
        public bool IntraState { get; set; }
        public List<InvoiceLineDto> Lines { get; set; } = new();
        public decimal Subtotal { get; set; }
        public decimal Cgst { get; set; }
        public decimal Sgst { get; set; }
        public decimal Igst { get; set; }
        public decimal Tax { get; set; }
        public decimal Total { get; set; }
        public decimal AmountPaid { get; set; }
        public string Status { get; set; } = "UNPAID";
        public string? PaymentId { get; set; }
        public string? EmailedAt { get; set; }
    }

    /// <summary>Frontend: Refund.</summary>
    public class RefundDto : IEntityDto
    {
        public string Id { get; set; } = string.Empty;
        public string PaymentId { get; set; } = string.Empty;
        public string MemberId { get; set; } = string.Empty;
        public string LocationId { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public string Reason { get; set; } = string.Empty;
        public string Status { get; set; } = "REQUESTED";
        public string RequestedAt { get; set; } = string.Empty;
        public string? ProcessedAt { get; set; }
    }

    /// <summary>Frontend: CreditNote.</summary>
    public class CreditNoteDto : IEntityDto
    {
        public string Id { get; set; } = string.Empty;
        public string Number { get; set; } = string.Empty;
        public string InvoiceId { get; set; } = string.Empty;
        public string MemberId { get; set; } = string.Empty;
        public string LocationId { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public string Reason { get; set; } = string.Empty;
        public string Date { get; set; } = string.Empty;
        public string Status { get; set; } = "ISSUED";
    }
}
