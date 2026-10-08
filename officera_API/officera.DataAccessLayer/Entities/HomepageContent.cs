using System;
using System.Collections.Generic;

namespace officera.DataAccessLayer.Entities;

public partial class HomepageContent
{
    public int Id { get; set; }

    public string HeroTitle { get; set; } = null!;

    public string HeroSubtitle { get; set; } = null!;

    public string StatsJson { get; set; } = null!;

    public string TestimonialsJson { get; set; } = null!;

    public string FeaturesJson { get; set; } = null!;

    public string Announcement { get; set; } = null!;

    public bool ShowAnnouncement { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime CreatedDate { get; set; }

    public string? ModifiedBy { get; set; }

    public DateTime? ModifiedDate { get; set; }
}
