using System;
using System.Collections.Generic;

namespace officera.DataAccessLayer.Entities;

public partial class Member
{
    public string Id { get; set; } = null!;

    public string FirstName { get; set; } = null!;

    public string LastName { get; set; } = null!;

    public string Email { get; set; } = null!;

    public string Mobile { get; set; } = null!;

    public string? CompanyId { get; set; }

    public string Designation { get; set; } = null!;

    public string LocationId { get; set; } = null!;

    public string Status { get; set; } = null!;

    public DateOnly JoinDate { get; set; }

    public bool DirectoryVisible { get; set; }

    public string Bio { get; set; } = null!;

    public string SkillsJson { get; set; } = null!;

    public string? LeadId { get; set; }

    public string? Photo { get; set; }

    public decimal ReferralCredit { get; set; }

    public bool ProfileCompleted { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime CreatedDate { get; set; }

    public string? ModifiedBy { get; set; }

    public DateTime? ModifiedDate { get; set; }

    public virtual ICollection<Booking> Bookings { get; set; } = new List<Booking>();

    public virtual ICollection<Company> Companies { get; set; } = new List<Company>();

    public virtual Company? Company { get; set; }

    public virtual ICollection<CreditNote> CreditNotes { get; set; } = new List<CreditNote>();

    public virtual ICollection<CreditTransaction> CreditTransactions { get; set; } = new List<CreditTransaction>();

    public virtual ICollection<Invoice> Invoices { get; set; } = new List<Invoice>();

    public virtual Lead? Lead { get; set; }

    public virtual ICollection<Lead> Leads { get; set; } = new List<Lead>();

    public virtual Location Location { get; set; } = null!;

    public virtual ICollection<Payment> Payments { get; set; } = new List<Payment>();

    public virtual ICollection<Post> Posts { get; set; } = new List<Post>();

    public virtual ICollection<Refund> Refunds { get; set; } = new List<Refund>();

    public virtual ICollection<Subscription> Subscriptions { get; set; } = new List<Subscription>();

    public virtual ICollection<Ticket> Tickets { get; set; } = new List<Ticket>();

    public virtual User? User { get; set; }

    public virtual ICollection<Visitor> Visitors { get; set; } = new List<Visitor>();
}
