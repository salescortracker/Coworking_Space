using System;
using System.Collections.Generic;

namespace officera.DataAccessLayer.Entities;

public partial class Resource
{
    public string Id { get; set; } = null!;

    public string Name { get; set; } = null!;

    public string Code { get; set; } = null!;

    public string ResourceType { get; set; } = null!;

    public string LocationId { get; set; } = null!;

    public string Floor { get; set; } = null!;

    public int Capacity { get; set; }

    public decimal Price { get; set; }

    public string PriceUnit { get; set; } = null!;

    public string AmenitiesJson { get; set; } = null!;

    public string PhotosJson { get; set; } = null!;

    public string Availability { get; set; } = null!;

    public string CancellationRule { get; set; } = null!;

    public string Status { get; set; } = null!;

    public decimal MapX { get; set; }

    public decimal MapY { get; set; }

    public decimal MapW { get; set; }

    public decimal MapH { get; set; }

    public bool IsBlocked { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime CreatedDate { get; set; }

    public string? ModifiedBy { get; set; }

    public DateTime? ModifiedDate { get; set; }

    public virtual ICollection<Booking> Bookings { get; set; } = new List<Booking>();

    public virtual Location Location { get; set; } = null!;
}
