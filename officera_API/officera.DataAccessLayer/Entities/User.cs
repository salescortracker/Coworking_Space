using System;
using System.Collections.Generic;

namespace officera.DataAccessLayer.Entities;

public partial class User
{
    public string Id { get; set; } = null!;

    public string Name { get; set; } = null!;

    public string Email { get; set; } = null!;

    public string Mobile { get; set; } = null!;

    public string RoleKey { get; set; } = null!;

    public string Status { get; set; } = null!;

    public string? MemberId { get; set; }

    public DateTime? LastLogin { get; set; }

    public string? PasswordHash { get; set; }

    public int FailedLoginCount { get; set; }

    public DateTime? LockoutUntil { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime CreatedDate { get; set; }

    public string? ModifiedBy { get; set; }

    public DateTime? ModifiedDate { get; set; }

    public virtual ICollection<Lead> Leads { get; set; } = new List<Lead>();

    public virtual Member? Member { get; set; }

    public virtual ICollection<Notification> Notifications { get; set; } = new List<Notification>();

    public virtual Role RoleKeyNavigation { get; set; } = null!;

    public virtual ICollection<Ticket> Tickets { get; set; } = new List<Ticket>();

    public virtual ICollection<UserLocation> UserLocations { get; set; } = new List<UserLocation>();
}
