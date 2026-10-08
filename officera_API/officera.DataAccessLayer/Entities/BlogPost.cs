using System;
using System.Collections.Generic;

namespace officera.DataAccessLayer.Entities;

public partial class BlogPost
{
    public string Id { get; set; } = null!;

    public string Title { get; set; } = null!;

    public string Excerpt { get; set; } = null!;

    public string BodyJson { get; set; } = null!;

    public string Author { get; set; } = null!;

    public string Category { get; set; } = null!;

    public DateOnly PublishedAt { get; set; }

    public int ReadMinutes { get; set; }

    public string Status { get; set; } = null!;

    public string ImageSeed { get; set; } = null!;

    public string? CreatedBy { get; set; }

    public DateTime CreatedDate { get; set; }

    public string? ModifiedBy { get; set; }

    public DateTime? ModifiedDate { get; set; }
}
