namespace officera.BusinessAccessLayer.DTOs
{
    /// <summary>Frontend: Lead.</summary>
    public class LeadDto : IEntityDto
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Mobile { get; set; } = string.Empty;
        public string? Email { get; set; }
        public string Source { get; set; } = "WEBSITE";
        public string LocationId { get; set; } = string.Empty;
        public string Requirement { get; set; } = string.Empty;
        public string? SpaceType { get; set; }
        public int? Seats { get; set; }
        public string? PreferredDate { get; set; }
        public string? PreferredTime { get; set; }
        public int? Visitors { get; set; }
        public string Status { get; set; } = "NEW";
        public string? OwnerId { get; set; }
        public string? FollowUpDate { get; set; }
        public bool MobileVerified { get; set; }
        public string? CreatedAt { get; set; }
        public string? UpdatedAt { get; set; }
        public List<CommentDto> Notes { get; set; } = new();
        public List<CommentDto> Comments { get; set; } = new();
        public List<TimelineEntryDto> Activities { get; set; } = new();
        public string? LostReason { get; set; }
        public string? MemberId { get; set; }
    }

    /// <summary>Public enquiry (Book Now / Callback / Tour / Contact) submitted after mobile OTP verification.</summary>
    public class LeadCaptureRequest
    {
        public string Source { get; set; } = "WEBSITE";
        public string Name { get; set; } = string.Empty;
        public string Mobile { get; set; } = string.Empty;
        public string? Email { get; set; }
        public string LocationId { get; set; } = string.Empty;
        public string Requirement { get; set; } = string.Empty;
        public string? SpaceType { get; set; }
        public int? Seats { get; set; }
        public string? PreferredDate { get; set; }
        public string? PreferredTime { get; set; }
        public int? Visitors { get; set; }
        /// <summary>Id returned by POST /api/Auth/VerifyOtp for purpose ENQUIRY.</summary>
        public string VerificationId { get; set; } = string.Empty;
    }

    /// <summary>Frontend: Post.</summary>
    public class PostDto : IEntityDto
    {
        public string Id { get; set; } = string.Empty;
        public string AuthorName { get; set; } = string.Empty;
        public string AuthorRole { get; set; } = string.Empty;
        public string? AuthorMemberId { get; set; }
        public string Type { get; set; } = "POST";
        public string Content { get; set; } = string.Empty;
        public string At { get; set; } = string.Empty;
        public int Likes { get; set; }
        public List<string> LikedBy { get; set; } = new();
        public List<CommentDto> Comments { get; set; } = new();
        public string? LocationId { get; set; }
        public string Status { get; set; } = "PUBLISHED";
        public bool? Pinned { get; set; }
    }

    /// <summary>Frontend: CommunityEvent. ImageSeed is a catalogue seed number or an uploaded image URL.</summary>
    public class EventDto : IEntityDto
    {
        public string Id { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string Date { get; set; } = string.Empty;
        public string StartTime { get; set; } = string.Empty;
        public string EndTime { get; set; } = string.Empty;
        public string LocationId { get; set; } = string.Empty;
        public string Venue { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public int Capacity { get; set; }
        public List<string> Attendees { get; set; } = new();
        public bool IsPublic { get; set; }
        public string Status { get; set; } = "DRAFT";
        public string Host { get; set; } = string.Empty;
        public System.Text.Json.JsonElement? ImageSeed { get; set; }
    }

    /// <summary>Frontend: Perk.</summary>
    public class PerkDto : IEntityDto
    {
        public string Id { get; set; } = string.Empty;
        public string Partner { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string Offer { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Discount { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
        public string Expiry { get; set; } = string.Empty;
        public string Terms { get; set; } = string.Empty;
        public string Status { get; set; } = "ACTIVE";
        public int Redemptions { get; set; }
    }

    /// <summary>Frontend: BlogPost.</summary>
    public class BlogPostDto : IEntityDto
    {
        public string Id { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Excerpt { get; set; } = string.Empty;
        public List<string> Body { get; set; } = new();
        public string Author { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string PublishedAt { get; set; } = string.Empty;
        public int ReadMinutes { get; set; }
        public string Status { get; set; } = "DRAFT";
        public System.Text.Json.JsonElement? ImageSeed { get; set; }
    }

    /// <summary>Frontend: GalleryItem.</summary>
    public class GalleryItemDto : IEntityDto
    {
        public string Id { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string LocationId { get; set; } = string.Empty;
        public string Category { get; set; } = "Workspace";
        public System.Text.Json.JsonElement? Seed { get; set; }
        public string Status { get; set; } = "PUBLISHED";
    }

    public class LabelValueDto
    {
        public string Label { get; set; } = string.Empty;
        public string Value { get; set; } = string.Empty;
    }

    public class TestimonialDto
    {
        public string Quote { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
    }

    public class FeatureDto
    {
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Icon { get; set; } = string.Empty;
    }

    /// <summary>Frontend: HomepageContent.</summary>
    public class HomepageContentDto
    {
        public string HeroTitle { get; set; } = string.Empty;
        public string HeroSubtitle { get; set; } = string.Empty;
        public List<LabelValueDto> Stats { get; set; } = new();
        public List<TestimonialDto> Testimonials { get; set; } = new();
        public List<FeatureDto> Features { get; set; } = new();
        public string Announcement { get; set; } = string.Empty;
        public bool ShowAnnouncement { get; set; }
    }
}
