using System;
using System.Collections.Generic;

namespace officera.DataAccessLayer.Entities;

public partial class InvoiceLine
{
    public int Id { get; set; }

    public string InvoiceId { get; set; } = null!;

    public int LineNumber { get; set; }

    public string Description { get; set; } = null!;

    public string Sac { get; set; } = null!;

    public decimal Qty { get; set; }

    public decimal Rate { get; set; }

    public decimal Amount { get; set; }

    public virtual Invoice Invoice { get; set; } = null!;
}
