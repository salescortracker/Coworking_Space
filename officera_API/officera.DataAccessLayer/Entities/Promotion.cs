using System;
using System.Collections.Generic;

namespace officera.DataAccessLayer.Entities;

public partial class Promotion
{
    public string Id { get; set; } = null!;

    public string Code { get; set; } = null!;

    public string Description { get; set; } = null!;

    public string DiscountType { get; set; } = null!;

    public decimal Discount { get; set; }

    public DateOnly Expiry { get; set; }

    public int UsageLimit { get; set; }

    public int Used { get; set; }

    public string Status { get; set; } = null!;

    public string AppliesTo { get; set; } = null!;

    public string? CreatedBy { get; set; }

    public DateTime CreatedDate { get; set; }

    public string? ModifiedBy { get; set; }

    public DateTime? ModifiedDate { get; set; }
}
