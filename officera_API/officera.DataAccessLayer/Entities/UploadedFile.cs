using System;
using System.Collections.Generic;

namespace officera.DataAccessLayer.Entities;

public partial class UploadedFile
{
    public Guid Id { get; set; }

    public string OriginalName { get; set; } = null!;

    public string StoredName { get; set; } = null!;

    public string RelativePath { get; set; } = null!;

    public string ContentType { get; set; } = null!;

    public long SizeBytes { get; set; }

    public string Category { get; set; } = null!;

    public string? UploadedBy { get; set; }

    public DateTime UploadedAt { get; set; }
}
