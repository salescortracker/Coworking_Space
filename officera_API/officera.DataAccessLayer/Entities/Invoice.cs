using System;
using System.Collections.Generic;

namespace officera.DataAccessLayer.Entities;

public partial class Invoice
{
    public string Id { get; set; } = null!;

    public string InvoiceNumber { get; set; } = null!;

    public DateOnly InvoiceDate { get; set; }

    public DateOnly DueDate { get; set; }

    public string MemberId { get; set; } = null!;

    public string LocationId { get; set; } = null!;

    public string CustomerName { get; set; } = null!;

    public string? CompanyName { get; set; }

    public string? CustomerGstin { get; set; }

    public string BillingAddress { get; set; } = null!;

    public string PlaceOfSupply { get; set; } = null!;

    public bool IntraState { get; set; }

    public decimal Subtotal { get; set; }

    public decimal Cgst { get; set; }

    public decimal Sgst { get; set; }

    public decimal Igst { get; set; }

    public decimal Tax { get; set; }

    public decimal Total { get; set; }

    public decimal AmountPaid { get; set; }

    public string Status { get; set; } = null!;

    public string? PaymentId { get; set; }

    public DateTime? EmailedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime CreatedDate { get; set; }

    public string? ModifiedBy { get; set; }

    public DateTime? ModifiedDate { get; set; }

    public virtual ICollection<CreditNote> CreditNotes { get; set; } = new List<CreditNote>();

    public virtual ICollection<InvoiceLine> InvoiceLines { get; set; } = new List<InvoiceLine>();

    public virtual Location Location { get; set; } = null!;

    public virtual Member Member { get; set; } = null!;

    public virtual Payment? Payment { get; set; }

    public virtual ICollection<Payment> Payments { get; set; } = new List<Payment>();
}
