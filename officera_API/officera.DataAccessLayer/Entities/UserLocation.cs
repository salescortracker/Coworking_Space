using System;
using System.Collections.Generic;

namespace officera.DataAccessLayer.Entities;

public partial class UserLocation
{
    public string UserId { get; set; } = null!;

    public string LocationId { get; set; } = null!;

    public DateTime CreatedDate { get; set; }

    public virtual Location Location { get; set; } = null!;

    public virtual User User { get; set; } = null!;
}
