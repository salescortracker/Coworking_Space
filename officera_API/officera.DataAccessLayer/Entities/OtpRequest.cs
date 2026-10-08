using System;
using System.Collections.Generic;

namespace officera.DataAccessLayer.Entities;

public partial class OtpRequest
{
    public Guid Id { get; set; }

    public string Destination { get; set; } = null!;

    public string Purpose { get; set; } = null!;

    public string CodeHash { get; set; } = null!;

    public DateTime ExpiresAt { get; set; }

    public int Attempts { get; set; }

    public DateTime? VerifiedAt { get; set; }

    public DateTime? ConsumedAt { get; set; }

    public DateTime CreatedDate { get; set; }
}
