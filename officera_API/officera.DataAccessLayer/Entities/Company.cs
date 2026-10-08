using System;
using System.Collections.Generic;

namespace officera.DataAccessLayer.Entities;

public partial class Company
{
    public string Id { get; set; } = null!;

    public string Name { get; set; } = null!;

    public string Gstin { get; set; } = null!;

    public string BillingAddress { get; set; } = null!;

    public string State { get; set; } = null!;

    public string Industry { get; set; } = null!;

    public string CompanySize { get; set; } = null!;

    public string Website { get; set; } = null!;

    public string LocationId { get; set; } = null!;

    public string? PrimaryContactId { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime CreatedDate { get; set; }

    public string? ModifiedBy { get; set; }

    public DateTime? ModifiedDate { get; set; }

    public virtual ICollection<Booking> Bookings { get; set; } = new List<Booking>();

    public virtual Location Location { get; set; } = null!;

    public virtual ICollection<Member> Members { get; set; } = new List<Member>();

    public virtual Member? PrimaryContact { get; set; }
}
