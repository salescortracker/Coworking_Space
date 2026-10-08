using System;
using System.Collections.Generic;

namespace officera.DataAccessLayer.Entities;

public partial class Event
{
    public string Id { get; set; } = null!;

    public string Title { get; set; } = null!;

    public string Category { get; set; } = null!;

    public DateOnly EventDate { get; set; }

    public TimeOnly StartTime { get; set; }

    public TimeOnly EndTime { get; set; }

    public string LocationId { get; set; } = null!;

    public string Venue { get; set; } = null!;

    public string Description { get; set; } = null!;

    public int Capacity { get; set; }

    public string AttendeesJson { get; set; } = null!;

    public bool IsPublic { get; set; }

    public string Status { get; set; } = null!;

    public string Host { get; set; } = null!;

    public string ImageSeed { get; set; } = null!;

    public string? CreatedBy { get; set; }

    public DateTime CreatedDate { get; set; }

    public string? ModifiedBy { get; set; }

    public DateTime? ModifiedDate { get; set; }

    public virtual Location Location { get; set; } = null!;
}
