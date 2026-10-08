using System;
using System.Collections.Generic;

namespace officera.DataAccessLayer.Entities;

public partial class Location
{
    public string Id { get; set; } = null!;

    public string Name { get; set; } = null!;

    public string City { get; set; } = null!;

    public string State { get; set; } = null!;

    public string Address { get; set; } = null!;

    public string Pincode { get; set; } = null!;

    public decimal Latitude { get; set; }

    public decimal Longitude { get; set; }

    public string HoursWeekdays { get; set; } = null!;

    public string HoursSaturday { get; set; } = null!;

    public string HoursSunday { get; set; } = null!;

    public string AmenitiesJson { get; set; } = null!;

    public string PhotosJson { get; set; } = null!;

    public string Status { get; set; } = null!;

    public string Description { get; set; } = null!;

    public decimal Rating { get; set; }

    public int ReviewCount { get; set; }

    public string TransportJson { get; set; } = null!;

    public string SpaceTypesJson { get; set; } = null!;

    public decimal StartingPrice { get; set; }

    public int TotalSeats { get; set; }

    public string Phone { get; set; } = null!;

    public string Email { get; set; } = null!;

    public decimal DistanceKm { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime CreatedDate { get; set; }

    public string? ModifiedBy { get; set; }

    public DateTime? ModifiedDate { get; set; }

    public virtual ICollection<AccessCredential> AccessCredentials { get; set; } = new List<AccessCredential>();

    public virtual ICollection<AccessLog> AccessLogs { get; set; } = new List<AccessLog>();

    public virtual ICollection<Booking> Bookings { get; set; } = new List<Booking>();

    public virtual ICollection<Company> Companies { get; set; } = new List<Company>();

    public virtual ICollection<CreditNote> CreditNotes { get; set; } = new List<CreditNote>();

    public virtual ICollection<Event> Events { get; set; } = new List<Event>();

    public virtual ICollection<GalleryItem> GalleryItems { get; set; } = new List<GalleryItem>();

    public virtual ICollection<Invoice> Invoices { get; set; } = new List<Invoice>();

    public virtual ICollection<Lead> Leads { get; set; } = new List<Lead>();

    public virtual ICollection<LocationReview> LocationReviews { get; set; } = new List<LocationReview>();

    public virtual ICollection<Member> Members { get; set; } = new List<Member>();

    public virtual ICollection<NotificationLog> NotificationLogs { get; set; } = new List<NotificationLog>();

    public virtual ICollection<Payment> Payments { get; set; } = new List<Payment>();

    public virtual ICollection<Post> Posts { get; set; } = new List<Post>();

    public virtual ICollection<Refund> Refunds { get; set; } = new List<Refund>();

    public virtual ICollection<Resource> Resources { get; set; } = new List<Resource>();

    public virtual ICollection<Subscription> Subscriptions { get; set; } = new List<Subscription>();

    public virtual ICollection<Ticket> Tickets { get; set; } = new List<Ticket>();

    public virtual ICollection<UserLocation> UserLocations { get; set; } = new List<UserLocation>();

    public virtual ICollection<Visitor> Visitors { get; set; } = new List<Visitor>();
}
