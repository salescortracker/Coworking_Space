using System;
using System.Collections.Generic;

namespace officera.DataAccessLayer.Entities;

public partial class CreditNote
{
    public string Id { get; set; } = null!;

    public string NoteNumber { get; set; } = null!;

    public string InvoiceId { get; set; } = null!;

    public string MemberId { get; set; } = null!;

    public string LocationId { get; set; } = null!;

    public decimal Amount { get; set; }

    public string Reason { get; set; } = null!;

    public DateOnly NoteDate { get; set; }

    public string Status { get; set; } = null!;

    public string? CreatedBy { get; set; }

    public DateTime CreatedDate { get; set; }

    public string? ModifiedBy { get; set; }

    public DateTime? ModifiedDate { get; set; }

    public virtual Invoice Invoice { get; set; } = null!;

    public virtual Location Location { get; set; } = null!;

    public virtual Member Member { get; set; } = null!;
}
