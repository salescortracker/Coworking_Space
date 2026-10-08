using System;
using System.Collections.Generic;

namespace officera.DataAccessLayer.Entities;

public partial class Perk
{
    public string Id { get; set; } = null!;

    public string Partner { get; set; } = null!;

    public string Category { get; set; } = null!;

    public string Offer { get; set; } = null!;

    public string Description { get; set; } = null!;

    public string Discount { get; set; } = null!;

    public string Code { get; set; } = null!;

    public DateOnly Expiry { get; set; }

    public string Terms { get; set; } = null!;

    public string Status { get; set; } = null!;

    public int Redemptions { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime CreatedDate { get; set; }

    public string? ModifiedBy { get; set; }

    public DateTime? ModifiedDate { get; set; }
}
