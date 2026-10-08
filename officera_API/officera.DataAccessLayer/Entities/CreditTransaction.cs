using System;
using System.Collections.Generic;

namespace officera.DataAccessLayer.Entities;

public partial class CreditTransaction
{
    public string Id { get; set; } = null!;

    public string MemberId { get; set; } = null!;

    public DateTime TransactionDate { get; set; }

    public string TransactionType { get; set; } = null!;

    public decimal Amount { get; set; }

    public string Reference { get; set; } = null!;

    public string Note { get; set; } = null!;

    public string? CreatedBy { get; set; }

    public DateTime CreatedDate { get; set; }

    public string? ModifiedBy { get; set; }

    public DateTime? ModifiedDate { get; set; }

    public virtual Member Member { get; set; } = null!;
}
