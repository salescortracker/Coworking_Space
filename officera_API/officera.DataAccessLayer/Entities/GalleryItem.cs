using System;
using System.Collections.Generic;

namespace officera.DataAccessLayer.Entities;

public partial class GalleryItem
{
    public string Id { get; set; } = null!;

    public string Title { get; set; } = null!;

    public string LocationId { get; set; } = null!;

    public string Category { get; set; } = null!;

    public string Seed { get; set; } = null!;

    public string Status { get; set; } = null!;

    public string? CreatedBy { get; set; }

    public DateTime CreatedDate { get; set; }

    public string? ModifiedBy { get; set; }

    public DateTime? ModifiedDate { get; set; }

    public virtual Location Location { get; set; } = null!;
}
