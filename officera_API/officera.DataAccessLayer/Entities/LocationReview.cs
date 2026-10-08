using System;
using System.Collections.Generic;

namespace officera.DataAccessLayer.Entities;

public partial class LocationReview
{
    public string Id { get; set; } = null!;

    public string LocationId { get; set; } = null!;

    public string Author { get; set; } = null!;

    public int Rating { get; set; }

    public string ReviewText { get; set; } = null!;

    public DateOnly ReviewDate { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime CreatedDate { get; set; }

    public string? ModifiedBy { get; set; }

    public DateTime? ModifiedDate { get; set; }

    public virtual Location Location { get; set; } = null!;
}
