using System;
using System.Collections.Generic;

namespace officera.DataAccessLayer.Entities;

public partial class Post
{
    public string Id { get; set; } = null!;

    public string AuthorName { get; set; } = null!;

    public string AuthorRole { get; set; } = null!;

    public string? AuthorMemberId { get; set; }

    public string PostType { get; set; } = null!;

    public string Content { get; set; } = null!;

    public DateTime PostedAt { get; set; }

    public int Likes { get; set; }

    public string LikedByJson { get; set; } = null!;

    public string CommentsJson { get; set; } = null!;

    public string? LocationId { get; set; }

    public string Status { get; set; } = null!;

    public bool IsPinned { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime CreatedDate { get; set; }

    public string? ModifiedBy { get; set; }

    public DateTime? ModifiedDate { get; set; }

    public virtual Member? AuthorMember { get; set; }

    public virtual Location? Location { get; set; }
}
