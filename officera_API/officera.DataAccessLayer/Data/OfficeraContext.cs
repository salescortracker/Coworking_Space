using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;
using officera.DataAccessLayer.Entities;

namespace officera.DataAccessLayer.Data;

public partial class OfficeraContext : DbContext
{
    public OfficeraContext(DbContextOptions<OfficeraContext> options)
        : base(options)
    {
    }

    public virtual DbSet<AccessCredential> AccessCredentials { get; set; }

    public virtual DbSet<AccessLog> AccessLogs { get; set; }

    public virtual DbSet<AuditLog> AuditLogs { get; set; }

    public virtual DbSet<BlogPost> BlogPosts { get; set; }

    public virtual DbSet<Booking> Bookings { get; set; }

    public virtual DbSet<Company> Companies { get; set; }

    public virtual DbSet<CreditNote> CreditNotes { get; set; }

    public virtual DbSet<CreditTransaction> CreditTransactions { get; set; }

    public virtual DbSet<Event> Events { get; set; }

    public virtual DbSet<GalleryItem> GalleryItems { get; set; }

    public virtual DbSet<HomepageContent> HomepageContents { get; set; }

    public virtual DbSet<IdSequence> IdSequences { get; set; }

    public virtual DbSet<Integration> Integrations { get; set; }

    public virtual DbSet<IntegrationSecret> IntegrationSecrets { get; set; }

    public virtual DbSet<Invoice> Invoices { get; set; }

    public virtual DbSet<InvoiceLine> InvoiceLines { get; set; }

    public virtual DbSet<Lead> Leads { get; set; }

    public virtual DbSet<Location> Locations { get; set; }

    public virtual DbSet<LocationReview> LocationReviews { get; set; }

    public virtual DbSet<Member> Members { get; set; }

    public virtual DbSet<Notification> Notifications { get; set; }

    public virtual DbSet<NotificationLog> NotificationLogs { get; set; }

    public virtual DbSet<NotificationTemplate> NotificationTemplates { get; set; }

    public virtual DbSet<OrgSetting> OrgSettings { get; set; }

    public virtual DbSet<OtpRequest> OtpRequests { get; set; }

    public virtual DbSet<Payment> Payments { get; set; }

    public virtual DbSet<Perk> Perks { get; set; }

    public virtual DbSet<Permission> Permissions { get; set; }

    public virtual DbSet<Plan> Plans { get; set; }

    public virtual DbSet<Post> Posts { get; set; }

    public virtual DbSet<Promotion> Promotions { get; set; }

    public virtual DbSet<Refund> Refunds { get; set; }

    public virtual DbSet<Resource> Resources { get; set; }

    public virtual DbSet<Role> Roles { get; set; }

    public virtual DbSet<RolePermission> RolePermissions { get; set; }

    public virtual DbSet<State> States { get; set; }

    public virtual DbSet<Subscription> Subscriptions { get; set; }

    public virtual DbSet<Ticket> Tickets { get; set; }

    public virtual DbSet<UploadedFile> UploadedFiles { get; set; }

    public virtual DbSet<User> Users { get; set; }

    public virtual DbSet<UserLocation> UserLocations { get; set; }

    public virtual DbSet<Visitor> Visitors { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AccessCredential>(entity =>
        {
            entity.ToTable("AccessCredentials", "operations");

            entity.HasIndex(e => e.HolderId, "IX_AccessCredentials_HolderId");

            entity.HasIndex(e => e.Code, "UQ_AccessCredentials_Code").IsUnique();

            entity.Property(e => e.Id).HasMaxLength(32);
            entity.Property(e => e.AccessHours).HasMaxLength(60);
            entity.Property(e => e.Code).HasMaxLength(40);
            entity.Property(e => e.CreatedBy).HasMaxLength(32);
            entity.Property(e => e.CreatedDate)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.HolderId).HasMaxLength(32);
            entity.Property(e => e.HolderName).HasMaxLength(150);
            entity.Property(e => e.HolderType).HasMaxLength(20);
            entity.Property(e => e.IssuedAt).HasPrecision(3);
            entity.Property(e => e.LocationId).HasMaxLength(32);
            entity.Property(e => e.ModifiedBy).HasMaxLength(32);
            entity.Property(e => e.ModifiedDate).HasPrecision(3);
            entity.Property(e => e.RevokedReason).HasMaxLength(500);
            entity.Property(e => e.Status).HasMaxLength(20);

            entity.HasOne(d => d.Location).WithMany(p => p.AccessCredentials)
                .HasForeignKey(d => d.LocationId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_AccessCredentials_Locations");
        });

        modelBuilder.Entity<AccessLog>(entity =>
        {
            entity.ToTable("AccessLogs", "operations");

            entity.HasIndex(e => new { e.LocationId, e.LoggedAt }, "IX_AccessLogs_Location_LoggedAt").IsDescending(false, true);

            entity.Property(e => e.Id).HasMaxLength(32);
            entity.Property(e => e.CreatedBy).HasMaxLength(32);
            entity.Property(e => e.CreatedDate)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.Direction).HasMaxLength(3);
            entity.Property(e => e.Door).HasMaxLength(100);
            entity.Property(e => e.LocationId).HasMaxLength(32);
            entity.Property(e => e.LoggedAt).HasPrecision(3);
            entity.Property(e => e.ModifiedBy).HasMaxLength(32);
            entity.Property(e => e.ModifiedDate).HasPrecision(3);
            entity.Property(e => e.Person).HasMaxLength(150);
            entity.Property(e => e.PersonId).HasMaxLength(32);
            entity.Property(e => e.PersonType).HasMaxLength(20);
            entity.Property(e => e.Reason).HasMaxLength(500);
            entity.Property(e => e.Status).HasMaxLength(10);

            entity.HasOne(d => d.Location).WithMany(p => p.AccessLogs)
                .HasForeignKey(d => d.LocationId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_AccessLogs_Locations");
        });

        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.ToTable("AuditLogs", "audit");

            entity.HasIndex(e => e.LoggedAt, "IX_AuditLogs_LoggedAt").IsDescending();

            entity.Property(e => e.Id).HasMaxLength(32);
            entity.Property(e => e.Action).HasMaxLength(20);
            entity.Property(e => e.CreatedBy).HasMaxLength(32);
            entity.Property(e => e.CreatedDate)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.Description).HasMaxLength(2000);
            entity.Property(e => e.Device)
                .HasMaxLength(100)
                .HasDefaultValue("");
            entity.Property(e => e.Entity).HasMaxLength(100);
            entity.Property(e => e.EntityId).HasMaxLength(64);
            entity.Property(e => e.IpAddress)
                .HasMaxLength(64)
                .HasDefaultValue("");
            entity.Property(e => e.LoggedAt).HasPrecision(3);
            entity.Property(e => e.ModifiedBy).HasMaxLength(32);
            entity.Property(e => e.ModifiedDate).HasPrecision(3);
            entity.Property(e => e.Module).HasMaxLength(100);
            entity.Property(e => e.RoleName).HasMaxLength(100);
            entity.Property(e => e.UserId).HasMaxLength(32);
            entity.Property(e => e.UserName).HasMaxLength(150);
        });

        modelBuilder.Entity<BlogPost>(entity =>
        {
            entity.ToTable("BlogPosts", "content");

            entity.Property(e => e.Id).HasMaxLength(32);
            entity.Property(e => e.Author).HasMaxLength(150);
            entity.Property(e => e.BodyJson).HasDefaultValue("[]");
            entity.Property(e => e.Category).HasMaxLength(100);
            entity.Property(e => e.CreatedBy).HasMaxLength(32);
            entity.Property(e => e.CreatedDate)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.Excerpt)
                .HasMaxLength(1000)
                .HasDefaultValue("");
            entity.Property(e => e.ImageSeed)
                .HasMaxLength(500)
                .HasDefaultValue("71");
            entity.Property(e => e.ModifiedBy).HasMaxLength(32);
            entity.Property(e => e.ModifiedDate).HasPrecision(3);
            entity.Property(e => e.ReadMinutes).HasDefaultValue(1);
            entity.Property(e => e.Status).HasMaxLength(20);
            entity.Property(e => e.Title).HasMaxLength(200);
        });

        modelBuilder.Entity<Booking>(entity =>
        {
            entity.ToTable("Bookings", "booking");

            entity.HasIndex(e => new { e.LocationId, e.BookingDate }, "IX_Bookings_LocationId");

            entity.HasIndex(e => e.MemberId, "IX_Bookings_MemberId");

            entity.HasIndex(e => new { e.ResourceId, e.BookingDate }, "IX_Bookings_Resource_Date");

            entity.Property(e => e.Id).HasMaxLength(32);
            entity.Property(e => e.Amount).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.BalanceDue).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.CancelReason).HasMaxLength(500);
            entity.Property(e => e.CancelledAt).HasPrecision(3);
            entity.Property(e => e.CompanyId).HasMaxLength(32);
            entity.Property(e => e.CreatedBy).HasMaxLength(32);
            entity.Property(e => e.CreatedDate)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.CreditsUsed).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.EndTime).HasPrecision(0);
            entity.Property(e => e.LocationId).HasMaxLength(32);
            entity.Property(e => e.MemberId).HasMaxLength(32);
            entity.Property(e => e.ModifiedBy).HasMaxLength(32);
            entity.Property(e => e.ModifiedDate).HasPrecision(3);
            entity.Property(e => e.Notes).HasMaxLength(1000);
            entity.Property(e => e.PaymentId).HasMaxLength(32);
            entity.Property(e => e.PaymentMethod).HasMaxLength(20);
            entity.Property(e => e.PaymentStatus).HasMaxLength(20);
            entity.Property(e => e.ResourceId).HasMaxLength(32);
            entity.Property(e => e.StartTime).HasPrecision(0);
            entity.Property(e => e.Status).HasMaxLength(20);

            entity.HasOne(d => d.Company).WithMany(p => p.Bookings)
                .HasForeignKey(d => d.CompanyId)
                .HasConstraintName("FK_Bookings_Companies");

            entity.HasOne(d => d.Location).WithMany(p => p.Bookings)
                .HasForeignKey(d => d.LocationId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Bookings_Locations");

            entity.HasOne(d => d.Member).WithMany(p => p.Bookings)
                .HasForeignKey(d => d.MemberId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Bookings_Members");

            entity.HasOne(d => d.Payment).WithMany(p => p.Bookings)
                .HasForeignKey(d => d.PaymentId)
                .HasConstraintName("FK_Bookings_Payments");

            entity.HasOne(d => d.Resource).WithMany(p => p.Bookings)
                .HasForeignKey(d => d.ResourceId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Bookings_Resources");
        });

        modelBuilder.Entity<Company>(entity =>
        {
            entity.ToTable("Companies", "people");

            entity.HasIndex(e => e.LocationId, "IX_Companies_LocationId");

            entity.Property(e => e.Id).HasMaxLength(32);
            entity.Property(e => e.BillingAddress)
                .HasMaxLength(500)
                .HasDefaultValue("");
            entity.Property(e => e.CompanySize)
                .HasMaxLength(30)
                .HasDefaultValue("");
            entity.Property(e => e.CreatedBy).HasMaxLength(32);
            entity.Property(e => e.CreatedDate)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.Gstin)
                .HasMaxLength(15)
                .HasDefaultValue("");
            entity.Property(e => e.Industry)
                .HasMaxLength(100)
                .HasDefaultValue("");
            entity.Property(e => e.LocationId).HasMaxLength(32);
            entity.Property(e => e.ModifiedBy).HasMaxLength(32);
            entity.Property(e => e.ModifiedDate).HasPrecision(3);
            entity.Property(e => e.Name).HasMaxLength(200);
            entity.Property(e => e.PrimaryContactId).HasMaxLength(32);
            entity.Property(e => e.State)
                .HasMaxLength(100)
                .HasDefaultValue("");
            entity.Property(e => e.Website)
                .HasMaxLength(300)
                .HasDefaultValue("");

            entity.HasOne(d => d.Location).WithMany(p => p.Companies)
                .HasForeignKey(d => d.LocationId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Companies_Locations");

            entity.HasOne(d => d.PrimaryContact).WithMany(p => p.Companies)
                .HasForeignKey(d => d.PrimaryContactId)
                .HasConstraintName("FK_Companies_PrimaryContact");
        });

        modelBuilder.Entity<CreditNote>(entity =>
        {
            entity.ToTable("CreditNotes", "finance");

            entity.HasIndex(e => e.NoteNumber, "UQ_CreditNotes_Number").IsUnique();

            entity.Property(e => e.Id).HasMaxLength(32);
            entity.Property(e => e.Amount).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.CreatedBy).HasMaxLength(32);
            entity.Property(e => e.CreatedDate)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.InvoiceId).HasMaxLength(32);
            entity.Property(e => e.LocationId).HasMaxLength(32);
            entity.Property(e => e.MemberId).HasMaxLength(32);
            entity.Property(e => e.ModifiedBy).HasMaxLength(32);
            entity.Property(e => e.ModifiedDate).HasPrecision(3);
            entity.Property(e => e.NoteNumber).HasMaxLength(40);
            entity.Property(e => e.Reason).HasMaxLength(1000);
            entity.Property(e => e.Status).HasMaxLength(20);

            entity.HasOne(d => d.Invoice).WithMany(p => p.CreditNotes)
                .HasForeignKey(d => d.InvoiceId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_CreditNotes_Invoices");

            entity.HasOne(d => d.Location).WithMany(p => p.CreditNotes)
                .HasForeignKey(d => d.LocationId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_CreditNotes_Locations");

            entity.HasOne(d => d.Member).WithMany(p => p.CreditNotes)
                .HasForeignKey(d => d.MemberId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_CreditNotes_Members");
        });

        modelBuilder.Entity<CreditTransaction>(entity =>
        {
            entity.ToTable("CreditTransactions", "membership");

            entity.HasIndex(e => e.MemberId, "IX_CreditTransactions_MemberId");

            entity.Property(e => e.Id).HasMaxLength(32);
            entity.Property(e => e.Amount).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.CreatedBy).HasMaxLength(32);
            entity.Property(e => e.CreatedDate)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.MemberId).HasMaxLength(32);
            entity.Property(e => e.ModifiedBy).HasMaxLength(32);
            entity.Property(e => e.ModifiedDate).HasPrecision(3);
            entity.Property(e => e.Note)
                .HasMaxLength(500)
                .HasDefaultValue("");
            entity.Property(e => e.Reference)
                .HasMaxLength(100)
                .HasDefaultValue("");
            entity.Property(e => e.TransactionDate).HasPrecision(3);
            entity.Property(e => e.TransactionType).HasMaxLength(20);

            entity.HasOne(d => d.Member).WithMany(p => p.CreditTransactions)
                .HasForeignKey(d => d.MemberId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_CreditTransactions_Members");
        });

        modelBuilder.Entity<Event>(entity =>
        {
            entity.ToTable("Events", "community");

            entity.Property(e => e.Id).HasMaxLength(32);
            entity.Property(e => e.AttendeesJson).HasDefaultValue("[]");
            entity.Property(e => e.Category).HasMaxLength(100);
            entity.Property(e => e.CreatedBy).HasMaxLength(32);
            entity.Property(e => e.CreatedDate)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.Description)
                .HasMaxLength(4000)
                .HasDefaultValue("");
            entity.Property(e => e.EndTime).HasPrecision(0);
            entity.Property(e => e.Host)
                .HasMaxLength(150)
                .HasDefaultValue("");
            entity.Property(e => e.ImageSeed)
                .HasMaxLength(500)
                .HasDefaultValue("61");
            entity.Property(e => e.LocationId).HasMaxLength(32);
            entity.Property(e => e.ModifiedBy).HasMaxLength(32);
            entity.Property(e => e.ModifiedDate).HasPrecision(3);
            entity.Property(e => e.StartTime).HasPrecision(0);
            entity.Property(e => e.Status).HasMaxLength(20);
            entity.Property(e => e.Title).HasMaxLength(200);
            entity.Property(e => e.Venue)
                .HasMaxLength(200)
                .HasDefaultValue("");

            entity.HasOne(d => d.Location).WithMany(p => p.Events)
                .HasForeignKey(d => d.LocationId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Events_Locations");
        });

        modelBuilder.Entity<GalleryItem>(entity =>
        {
            entity.ToTable("GalleryItems", "content");

            entity.Property(e => e.Id).HasMaxLength(32);
            entity.Property(e => e.Category).HasMaxLength(30);
            entity.Property(e => e.CreatedBy).HasMaxLength(32);
            entity.Property(e => e.CreatedDate)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.LocationId).HasMaxLength(32);
            entity.Property(e => e.ModifiedBy).HasMaxLength(32);
            entity.Property(e => e.ModifiedDate).HasPrecision(3);
            entity.Property(e => e.Seed).HasMaxLength(500);
            entity.Property(e => e.Status).HasMaxLength(20);
            entity.Property(e => e.Title).HasMaxLength(200);

            entity.HasOne(d => d.Location).WithMany(p => p.GalleryItems)
                .HasForeignKey(d => d.LocationId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_GalleryItems_Locations");
        });

        modelBuilder.Entity<HomepageContent>(entity =>
        {
            entity.ToTable("HomepageContent", "content");

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.Announcement)
                .HasMaxLength(500)
                .HasDefaultValue("");
            entity.Property(e => e.CreatedBy).HasMaxLength(32);
            entity.Property(e => e.CreatedDate)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.FeaturesJson).HasDefaultValue("[]");
            entity.Property(e => e.HeroSubtitle).HasMaxLength(1000);
            entity.Property(e => e.HeroTitle).HasMaxLength(200);
            entity.Property(e => e.ModifiedBy).HasMaxLength(32);
            entity.Property(e => e.ModifiedDate).HasPrecision(3);
            entity.Property(e => e.StatsJson).HasDefaultValue("[]");
            entity.Property(e => e.TestimonialsJson).HasDefaultValue("[]");
        });

        modelBuilder.Entity<IdSequence>(entity =>
        {
            entity.HasKey(e => e.Prefix);

            entity.ToTable("IdSequences", "config");

            entity.Property(e => e.Prefix).HasMaxLength(40);
            entity.Property(e => e.RowVersion)
                .IsRowVersion()
                .IsConcurrencyToken();
        });

        modelBuilder.Entity<Integration>(entity =>
        {
            entity.ToTable("Integrations", "config");

            entity.HasIndex(e => e.Category, "UX_Integrations_ActivePerCategory")
                .IsUnique()
                .HasFilter("([IsActive]=(1))");

            entity.Property(e => e.Id).HasMaxLength(32);
            entity.Property(e => e.Category).HasMaxLength(30);
            entity.Property(e => e.ConfigJson).HasDefaultValue("{}");
            entity.Property(e => e.CreatedBy).HasMaxLength(32);
            entity.Property(e => e.CreatedDate)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.DisplayName).HasMaxLength(150);
            entity.Property(e => e.Enabled).HasDefaultValue(true);
            entity.Property(e => e.Environment).HasMaxLength(10);
            entity.Property(e => e.ModifiedBy).HasMaxLength(32);
            entity.Property(e => e.ModifiedDate).HasPrecision(3);
            entity.Property(e => e.ProviderKey).HasMaxLength(50);
            entity.Property(e => e.Status).HasMaxLength(20);
            entity.Property(e => e.TestsJson).HasDefaultValue("[]");
            entity.Property(e => e.UpdatedByName)
                .HasMaxLength(150)
                .HasDefaultValue("");
        });

        modelBuilder.Entity<IntegrationSecret>(entity =>
        {
            entity.HasKey(e => new { e.IntegrationId, e.FieldKey });

            entity.ToTable("IntegrationSecrets", "config");

            entity.Property(e => e.IntegrationId).HasMaxLength(32);
            entity.Property(e => e.FieldKey).HasMaxLength(60);
            entity.Property(e => e.Hint).HasMaxLength(20);
            entity.Property(e => e.UpdatedAt).HasPrecision(3);
            entity.Property(e => e.UpdatedBy).HasMaxLength(32);

            entity.HasOne(d => d.Integration).WithMany(p => p.IntegrationSecrets)
                .HasForeignKey(d => d.IntegrationId)
                .HasConstraintName("FK_IntegrationSecrets_Integrations");
        });

        modelBuilder.Entity<Invoice>(entity =>
        {
            entity.ToTable("Invoices", "finance");

            entity.HasIndex(e => e.LocationId, "IX_Invoices_LocationId");

            entity.HasIndex(e => e.MemberId, "IX_Invoices_MemberId");

            entity.HasIndex(e => e.InvoiceNumber, "UQ_Invoices_Number").IsUnique();

            entity.Property(e => e.Id).HasMaxLength(32);
            entity.Property(e => e.AmountPaid).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.BillingAddress)
                .HasMaxLength(600)
                .HasDefaultValue("");
            entity.Property(e => e.Cgst).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.CompanyName).HasMaxLength(200);
            entity.Property(e => e.CreatedBy).HasMaxLength(32);
            entity.Property(e => e.CreatedDate)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.CustomerGstin).HasMaxLength(15);
            entity.Property(e => e.CustomerName).HasMaxLength(200);
            entity.Property(e => e.EmailedAt).HasPrecision(3);
            entity.Property(e => e.Igst).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.InvoiceNumber).HasMaxLength(40);
            entity.Property(e => e.LocationId).HasMaxLength(32);
            entity.Property(e => e.MemberId).HasMaxLength(32);
            entity.Property(e => e.ModifiedBy).HasMaxLength(32);
            entity.Property(e => e.ModifiedDate).HasPrecision(3);
            entity.Property(e => e.PaymentId).HasMaxLength(32);
            entity.Property(e => e.PlaceOfSupply)
                .HasMaxLength(100)
                .HasDefaultValue("");
            entity.Property(e => e.Sgst).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.Status).HasMaxLength(20);
            entity.Property(e => e.Subtotal).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.Tax).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.Total).HasColumnType("decimal(18, 2)");

            entity.HasOne(d => d.Location).WithMany(p => p.Invoices)
                .HasForeignKey(d => d.LocationId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Invoices_Locations");

            entity.HasOne(d => d.Member).WithMany(p => p.Invoices)
                .HasForeignKey(d => d.MemberId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Invoices_Members");

            entity.HasOne(d => d.Payment).WithMany(p => p.Invoices)
                .HasForeignKey(d => d.PaymentId)
                .HasConstraintName("FK_Invoices_Payments");
        });

        modelBuilder.Entity<InvoiceLine>(entity =>
        {
            entity.ToTable("InvoiceLines", "finance");

            entity.HasIndex(e => new { e.InvoiceId, e.LineNumber }, "UQ_InvoiceLines_Invoice_Line").IsUnique();

            entity.Property(e => e.Amount).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.Description).HasMaxLength(500);
            entity.Property(e => e.InvoiceId).HasMaxLength(32);
            entity.Property(e => e.Qty).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.Rate).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.Sac)
                .HasMaxLength(10)
                .HasDefaultValue("");

            entity.HasOne(d => d.Invoice).WithMany(p => p.InvoiceLines)
                .HasForeignKey(d => d.InvoiceId)
                .HasConstraintName("FK_InvoiceLines_Invoices");
        });

        modelBuilder.Entity<Lead>(entity =>
        {
            entity.ToTable("Leads", "crm");

            entity.HasIndex(e => e.LocationId, "IX_Leads_LocationId");

            entity.Property(e => e.Id).HasMaxLength(32);
            entity.Property(e => e.ActivitiesJson).HasDefaultValue("[]");
            entity.Property(e => e.CommentsJson).HasDefaultValue("[]");
            entity.Property(e => e.CreatedBy).HasMaxLength(32);
            entity.Property(e => e.CreatedDate)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.Email).HasMaxLength(256);
            entity.Property(e => e.LocationId).HasMaxLength(32);
            entity.Property(e => e.LostReason).HasMaxLength(500);
            entity.Property(e => e.MemberId).HasMaxLength(32);
            entity.Property(e => e.Mobile).HasMaxLength(15);
            entity.Property(e => e.ModifiedBy).HasMaxLength(32);
            entity.Property(e => e.ModifiedDate).HasPrecision(3);
            entity.Property(e => e.Name).HasMaxLength(150);
            entity.Property(e => e.NotesJson).HasDefaultValue("[]");
            entity.Property(e => e.OwnerId).HasMaxLength(32);
            entity.Property(e => e.PreferredTime).HasMaxLength(10);
            entity.Property(e => e.Requirement).HasMaxLength(500);
            entity.Property(e => e.Source).HasMaxLength(20);
            entity.Property(e => e.SpaceType).HasMaxLength(30);
            entity.Property(e => e.Status).HasMaxLength(20);

            entity.HasOne(d => d.Location).WithMany(p => p.Leads)
                .HasForeignKey(d => d.LocationId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Leads_Locations");

            entity.HasOne(d => d.Member).WithMany(p => p.Leads)
                .HasForeignKey(d => d.MemberId)
                .HasConstraintName("FK_Leads_Members");

            entity.HasOne(d => d.Owner).WithMany(p => p.Leads)
                .HasForeignKey(d => d.OwnerId)
                .HasConstraintName("FK_Leads_Owner");
        });

        modelBuilder.Entity<Location>(entity =>
        {
            entity.ToTable("Locations", "workspace");

            entity.HasIndex(e => e.Name, "UQ_Locations_Name").IsUnique();

            entity.Property(e => e.Id).HasMaxLength(32);
            entity.Property(e => e.Address).HasMaxLength(500);
            entity.Property(e => e.AmenitiesJson).HasDefaultValue("[]");
            entity.Property(e => e.City).HasMaxLength(100);
            entity.Property(e => e.CreatedBy).HasMaxLength(32);
            entity.Property(e => e.CreatedDate)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.Description).HasDefaultValue("");
            entity.Property(e => e.DistanceKm).HasColumnType("decimal(8, 2)");
            entity.Property(e => e.Email)
                .HasMaxLength(256)
                .HasDefaultValue("");
            entity.Property(e => e.HoursSaturday)
                .HasMaxLength(60)
                .HasDefaultValue("");
            entity.Property(e => e.HoursSunday)
                .HasMaxLength(60)
                .HasDefaultValue("");
            entity.Property(e => e.HoursWeekdays)
                .HasMaxLength(60)
                .HasDefaultValue("");
            entity.Property(e => e.Latitude).HasColumnType("decimal(9, 6)");
            entity.Property(e => e.Longitude).HasColumnType("decimal(9, 6)");
            entity.Property(e => e.ModifiedBy).HasMaxLength(32);
            entity.Property(e => e.ModifiedDate).HasPrecision(3);
            entity.Property(e => e.Name).HasMaxLength(150);
            entity.Property(e => e.Phone)
                .HasMaxLength(30)
                .HasDefaultValue("");
            entity.Property(e => e.PhotosJson).HasDefaultValue("[]");
            entity.Property(e => e.Pincode).HasMaxLength(10);
            entity.Property(e => e.Rating).HasColumnType("decimal(3, 2)");
            entity.Property(e => e.SpaceTypesJson).HasDefaultValue("[]");
            entity.Property(e => e.StartingPrice).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.State).HasMaxLength(100);
            entity.Property(e => e.Status).HasMaxLength(20);
            entity.Property(e => e.TransportJson).HasDefaultValue("[]");
        });

        modelBuilder.Entity<LocationReview>(entity =>
        {
            entity.ToTable("LocationReviews", "workspace");

            entity.HasIndex(e => e.LocationId, "IX_LocationReviews_LocationId");

            entity.Property(e => e.Id).HasMaxLength(32);
            entity.Property(e => e.Author).HasMaxLength(150);
            entity.Property(e => e.CreatedBy).HasMaxLength(32);
            entity.Property(e => e.CreatedDate)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.LocationId).HasMaxLength(32);
            entity.Property(e => e.ModifiedBy).HasMaxLength(32);
            entity.Property(e => e.ModifiedDate).HasPrecision(3);
            entity.Property(e => e.ReviewText).HasMaxLength(2000);

            entity.HasOne(d => d.Location).WithMany(p => p.LocationReviews)
                .HasForeignKey(d => d.LocationId)
                .HasConstraintName("FK_LocationReviews_Locations");
        });

        modelBuilder.Entity<Member>(entity =>
        {
            entity.ToTable("Members", "people");

            entity.HasIndex(e => e.CompanyId, "IX_Members_CompanyId");

            entity.HasIndex(e => e.LocationId, "IX_Members_LocationId");

            entity.HasIndex(e => e.Email, "UQ_Members_Email").IsUnique();

            entity.Property(e => e.Id).HasMaxLength(32);
            entity.Property(e => e.Bio)
                .HasMaxLength(2000)
                .HasDefaultValue("");
            entity.Property(e => e.CompanyId).HasMaxLength(32);
            entity.Property(e => e.CreatedBy).HasMaxLength(32);
            entity.Property(e => e.CreatedDate)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.Designation)
                .HasMaxLength(100)
                .HasDefaultValue("");
            entity.Property(e => e.Email).HasMaxLength(256);
            entity.Property(e => e.FirstName).HasMaxLength(60);
            entity.Property(e => e.LastName).HasMaxLength(60);
            entity.Property(e => e.LeadId).HasMaxLength(32);
            entity.Property(e => e.LocationId).HasMaxLength(32);
            entity.Property(e => e.Mobile).HasMaxLength(15);
            entity.Property(e => e.ModifiedBy).HasMaxLength(32);
            entity.Property(e => e.ModifiedDate).HasPrecision(3);
            entity.Property(e => e.Photo).HasMaxLength(500);
            entity.Property(e => e.ReferralCredit).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.SkillsJson).HasDefaultValue("[]");
            entity.Property(e => e.Status).HasMaxLength(20);

            entity.HasOne(d => d.Company).WithMany(p => p.Members)
                .HasForeignKey(d => d.CompanyId)
                .HasConstraintName("FK_Members_Companies");

            entity.HasOne(d => d.Lead).WithMany(p => p.Members)
                .HasForeignKey(d => d.LeadId)
                .HasConstraintName("FK_Members_Leads");

            entity.HasOne(d => d.Location).WithMany(p => p.Members)
                .HasForeignKey(d => d.LocationId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Members_Locations");
        });

        modelBuilder.Entity<Notification>(entity =>
        {
            entity.ToTable("Notifications", "notify");

            entity.HasIndex(e => new { e.Audience, e.UserId, e.NotifiedAt }, "IX_Notifications_Audience_User").IsDescending(false, false, true);

            entity.Property(e => e.Id).HasMaxLength(32);
            entity.Property(e => e.Audience).HasMaxLength(10);
            entity.Property(e => e.Category).HasMaxLength(20);
            entity.Property(e => e.CreatedBy).HasMaxLength(32);
            entity.Property(e => e.CreatedDate)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.Link).HasMaxLength(300);
            entity.Property(e => e.Message).HasMaxLength(2000);
            entity.Property(e => e.ModifiedBy).HasMaxLength(32);
            entity.Property(e => e.ModifiedDate).HasPrecision(3);
            entity.Property(e => e.NotifiedAt).HasPrecision(3);
            entity.Property(e => e.Title).HasMaxLength(200);
            entity.Property(e => e.UserId).HasMaxLength(32);

            entity.HasOne(d => d.User).WithMany(p => p.Notifications)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("FK_Notifications_Users");
        });

        modelBuilder.Entity<NotificationLog>(entity =>
        {
            entity.ToTable("NotificationLogs", "notify");

            entity.HasIndex(e => e.LoggedAt, "IX_NotificationLogs_LoggedAt").IsDescending();

            entity.Property(e => e.Id).HasMaxLength(32);
            entity.Property(e => e.Channel).HasMaxLength(10);
            entity.Property(e => e.CreatedBy).HasMaxLength(32);
            entity.Property(e => e.CreatedDate)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.EventName).HasMaxLength(100);
            entity.Property(e => e.LocationId).HasMaxLength(32);
            entity.Property(e => e.LoggedAt).HasPrecision(3);
            entity.Property(e => e.ModifiedBy).HasMaxLength(32);
            entity.Property(e => e.ModifiedDate).HasPrecision(3);
            entity.Property(e => e.Provider).HasMaxLength(150);
            entity.Property(e => e.Recipient).HasMaxLength(256);
            entity.Property(e => e.Status).HasMaxLength(20);
            entity.Property(e => e.TemplateName).HasMaxLength(150);

            entity.HasOne(d => d.Location).WithMany(p => p.NotificationLogs)
                .HasForeignKey(d => d.LocationId)
                .HasConstraintName("FK_NotificationLogs_Locations");
        });

        modelBuilder.Entity<NotificationTemplate>(entity =>
        {
            entity.ToTable("NotificationTemplates", "notify");

            entity.HasIndex(e => e.Name, "UQ_NotificationTemplates_Name").IsUnique();

            entity.Property(e => e.Id).HasMaxLength(32);
            entity.Property(e => e.Channel).HasMaxLength(10);
            entity.Property(e => e.CreatedBy).HasMaxLength(32);
            entity.Property(e => e.CreatedDate)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.EventName).HasMaxLength(100);
            entity.Property(e => e.Message).HasMaxLength(4000);
            entity.Property(e => e.ModifiedBy).HasMaxLength(32);
            entity.Property(e => e.ModifiedDate).HasPrecision(3);
            entity.Property(e => e.Name).HasMaxLength(150);
            entity.Property(e => e.Status).HasMaxLength(20);
            entity.Property(e => e.Subject)
                .HasMaxLength(300)
                .HasDefaultValue("");
        });

        modelBuilder.Entity<OrgSetting>(entity =>
        {
            entity.ToTable("OrgSettings", "config");

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.Address)
                .HasMaxLength(500)
                .HasDefaultValue("");
            entity.Property(e => e.CreatedBy).HasMaxLength(32);
            entity.Property(e => e.CreatedDate)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.Currency).HasMaxLength(3);
            entity.Property(e => e.Email)
                .HasMaxLength(256)
                .HasDefaultValue("");
            entity.Property(e => e.GstRate).HasColumnType("decimal(5, 2)");
            entity.Property(e => e.Gstin)
                .HasMaxLength(15)
                .HasDefaultValue("");
            entity.Property(e => e.LegalName)
                .HasMaxLength(200)
                .HasDefaultValue("");
            entity.Property(e => e.ModifiedBy).HasMaxLength(32);
            entity.Property(e => e.ModifiedDate).HasPrecision(3);
            entity.Property(e => e.Pan)
                .HasMaxLength(10)
                .HasDefaultValue("");
            entity.Property(e => e.PaymentRetryDays).HasMaxLength(50);
            entity.Property(e => e.Phone)
                .HasMaxLength(30)
                .HasDefaultValue("");
            entity.Property(e => e.State)
                .HasMaxLength(100)
                .HasDefaultValue("");
            entity.Property(e => e.StateCode)
                .HasMaxLength(2)
                .HasDefaultValue("");
            entity.Property(e => e.Timezone).HasMaxLength(60);
        });

        modelBuilder.Entity<OtpRequest>(entity =>
        {
            entity.ToTable("OtpRequests", "auth");

            entity.HasIndex(e => new { e.Destination, e.Purpose, e.CreatedDate }, "IX_OtpRequests_Destination").IsDescending(false, false, true);

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.CodeHash).HasMaxLength(200);
            entity.Property(e => e.ConsumedAt).HasPrecision(3);
            entity.Property(e => e.CreatedDate)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.Destination).HasMaxLength(256);
            entity.Property(e => e.ExpiresAt).HasPrecision(3);
            entity.Property(e => e.Purpose).HasMaxLength(30);
            entity.Property(e => e.VerifiedAt).HasPrecision(3);
        });

        modelBuilder.Entity<Payment>(entity =>
        {
            entity.ToTable("Payments", "finance");

            entity.HasIndex(e => new { e.LocationId, e.PaymentDate }, "IX_Payments_LocationId");

            entity.HasIndex(e => e.MemberId, "IX_Payments_MemberId");

            entity.Property(e => e.Id).HasMaxLength(32);
            entity.Property(e => e.Amount).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.BookingId).HasMaxLength(32);
            entity.Property(e => e.CreatedBy).HasMaxLength(32);
            entity.Property(e => e.CreatedDate)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.Description).HasMaxLength(500);
            entity.Property(e => e.FailureReason).HasMaxLength(500);
            entity.Property(e => e.GatewayRef)
                .HasMaxLength(100)
                .HasDefaultValue("");
            entity.Property(e => e.InvoiceId).HasMaxLength(32);
            entity.Property(e => e.LocationId).HasMaxLength(32);
            entity.Property(e => e.MemberId).HasMaxLength(32);
            entity.Property(e => e.Method).HasMaxLength(20);
            entity.Property(e => e.ModifiedBy).HasMaxLength(32);
            entity.Property(e => e.ModifiedDate).HasPrecision(3);
            entity.Property(e => e.PaymentDate).HasPrecision(3);
            entity.Property(e => e.PaymentType).HasMaxLength(20);
            entity.Property(e => e.Status).HasMaxLength(20);
            entity.Property(e => e.SubscriptionId).HasMaxLength(32);

            entity.HasOne(d => d.Booking).WithMany(p => p.Payments)
                .HasForeignKey(d => d.BookingId)
                .HasConstraintName("FK_Payments_Bookings");

            entity.HasOne(d => d.Invoice).WithMany(p => p.Payments)
                .HasForeignKey(d => d.InvoiceId)
                .HasConstraintName("FK_Payments_Invoices");

            entity.HasOne(d => d.Location).WithMany(p => p.Payments)
                .HasForeignKey(d => d.LocationId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Payments_Locations");

            entity.HasOne(d => d.Member).WithMany(p => p.Payments)
                .HasForeignKey(d => d.MemberId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Payments_Members");

            entity.HasOne(d => d.Subscription).WithMany(p => p.Payments)
                .HasForeignKey(d => d.SubscriptionId)
                .HasConstraintName("FK_Payments_Subscriptions");
        });

        modelBuilder.Entity<Perk>(entity =>
        {
            entity.ToTable("Perks", "community");

            entity.Property(e => e.Id).HasMaxLength(32);
            entity.Property(e => e.Category).HasMaxLength(100);
            entity.Property(e => e.Code)
                .HasMaxLength(50)
                .HasDefaultValue("");
            entity.Property(e => e.CreatedBy).HasMaxLength(32);
            entity.Property(e => e.CreatedDate)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.Description)
                .HasMaxLength(2000)
                .HasDefaultValue("");
            entity.Property(e => e.Discount)
                .HasMaxLength(50)
                .HasDefaultValue("");
            entity.Property(e => e.ModifiedBy).HasMaxLength(32);
            entity.Property(e => e.ModifiedDate).HasPrecision(3);
            entity.Property(e => e.Offer).HasMaxLength(200);
            entity.Property(e => e.Partner).HasMaxLength(150);
            entity.Property(e => e.Status).HasMaxLength(20);
            entity.Property(e => e.Terms)
                .HasMaxLength(2000)
                .HasDefaultValue("");
        });

        modelBuilder.Entity<Permission>(entity =>
        {
            entity.HasKey(e => e.PermissionKey);

            entity.ToTable("Permissions", "auth");

            entity.Property(e => e.PermissionKey).HasMaxLength(60);
            entity.Property(e => e.Action).HasMaxLength(20);
            entity.Property(e => e.Label).HasMaxLength(150);
            entity.Property(e => e.Module).HasMaxLength(100);
            entity.Property(e => e.ModuleKey).HasMaxLength(40);
        });

        modelBuilder.Entity<Plan>(entity =>
        {
            entity.ToTable("Plans", "membership");

            entity.HasIndex(e => e.Name, "UQ_Plans_Name").IsUnique();

            entity.Property(e => e.Id).HasMaxLength(32);
            entity.Property(e => e.AccessHours)
                .HasMaxLength(60)
                .HasDefaultValue("");
            entity.Property(e => e.BenefitsJson).HasDefaultValue("[]");
            entity.Property(e => e.BillingCycle).HasMaxLength(20);
            entity.Property(e => e.CreatedBy).HasMaxLength(32);
            entity.Property(e => e.CreatedDate)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.Credits).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.Description)
                .HasMaxLength(2000)
                .HasDefaultValue("");
            entity.Property(e => e.ModifiedBy).HasMaxLength(32);
            entity.Property(e => e.ModifiedDate).HasPrecision(3);
            entity.Property(e => e.Name).HasMaxLength(150);
            entity.Property(e => e.PlanType).HasMaxLength(20);
            entity.Property(e => e.Price).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.SecurityDeposit).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.Status).HasMaxLength(20);
        });

        modelBuilder.Entity<Post>(entity =>
        {
            entity.ToTable("Posts", "community");

            entity.Property(e => e.Id).HasMaxLength(32);
            entity.Property(e => e.AuthorMemberId).HasMaxLength(32);
            entity.Property(e => e.AuthorName).HasMaxLength(150);
            entity.Property(e => e.AuthorRole)
                .HasMaxLength(100)
                .HasDefaultValue("");
            entity.Property(e => e.CommentsJson).HasDefaultValue("[]");
            entity.Property(e => e.Content).HasMaxLength(4000);
            entity.Property(e => e.CreatedBy).HasMaxLength(32);
            entity.Property(e => e.CreatedDate)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.LikedByJson).HasDefaultValue("[]");
            entity.Property(e => e.LocationId).HasMaxLength(32);
            entity.Property(e => e.ModifiedBy).HasMaxLength(32);
            entity.Property(e => e.ModifiedDate).HasPrecision(3);
            entity.Property(e => e.PostType).HasMaxLength(20);
            entity.Property(e => e.PostedAt).HasPrecision(3);
            entity.Property(e => e.Status).HasMaxLength(20);

            entity.HasOne(d => d.AuthorMember).WithMany(p => p.Posts)
                .HasForeignKey(d => d.AuthorMemberId)
                .HasConstraintName("FK_Posts_Members");

            entity.HasOne(d => d.Location).WithMany(p => p.Posts)
                .HasForeignKey(d => d.LocationId)
                .HasConstraintName("FK_Posts_Locations");
        });

        modelBuilder.Entity<Promotion>(entity =>
        {
            entity.ToTable("Promotions", "membership");

            entity.HasIndex(e => e.Code, "UQ_Promotions_Code").IsUnique();

            entity.Property(e => e.Id).HasMaxLength(32);
            entity.Property(e => e.AppliesTo).HasMaxLength(20);
            entity.Property(e => e.Code).HasMaxLength(30);
            entity.Property(e => e.CreatedBy).HasMaxLength(32);
            entity.Property(e => e.CreatedDate)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.Description)
                .HasMaxLength(500)
                .HasDefaultValue("");
            entity.Property(e => e.Discount).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.DiscountType).HasMaxLength(10);
            entity.Property(e => e.ModifiedBy).HasMaxLength(32);
            entity.Property(e => e.ModifiedDate).HasPrecision(3);
            entity.Property(e => e.Status).HasMaxLength(20);
        });

        modelBuilder.Entity<Refund>(entity =>
        {
            entity.ToTable("Refunds", "finance");

            entity.Property(e => e.Id).HasMaxLength(32);
            entity.Property(e => e.Amount).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.CreatedBy).HasMaxLength(32);
            entity.Property(e => e.CreatedDate)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.LocationId).HasMaxLength(32);
            entity.Property(e => e.MemberId).HasMaxLength(32);
            entity.Property(e => e.ModifiedBy).HasMaxLength(32);
            entity.Property(e => e.ModifiedDate).HasPrecision(3);
            entity.Property(e => e.PaymentId).HasMaxLength(32);
            entity.Property(e => e.ProcessedAt).HasPrecision(3);
            entity.Property(e => e.Reason).HasMaxLength(1000);
            entity.Property(e => e.RequestedAt).HasPrecision(3);
            entity.Property(e => e.Status).HasMaxLength(20);

            entity.HasOne(d => d.Location).WithMany(p => p.Refunds)
                .HasForeignKey(d => d.LocationId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Refunds_Locations");

            entity.HasOne(d => d.Member).WithMany(p => p.Refunds)
                .HasForeignKey(d => d.MemberId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Refunds_Members");

            entity.HasOne(d => d.Payment).WithMany(p => p.Refunds)
                .HasForeignKey(d => d.PaymentId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Refunds_Payments");
        });

        modelBuilder.Entity<Resource>(entity =>
        {
            entity.ToTable("Resources", "workspace");

            entity.HasIndex(e => new { e.LocationId, e.Code }, "UQ_Resources_Location_Code").IsUnique();

            entity.Property(e => e.Id).HasMaxLength(32);
            entity.Property(e => e.AmenitiesJson).HasDefaultValue("[]");
            entity.Property(e => e.Availability)
                .HasMaxLength(200)
                .HasDefaultValue("");
            entity.Property(e => e.CancellationRule)
                .HasMaxLength(500)
                .HasDefaultValue("");
            entity.Property(e => e.Code).HasMaxLength(30);
            entity.Property(e => e.CreatedBy).HasMaxLength(32);
            entity.Property(e => e.CreatedDate)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.Floor)
                .HasMaxLength(50)
                .HasDefaultValue("");
            entity.Property(e => e.LocationId).HasMaxLength(32);
            entity.Property(e => e.MapH)
                .HasDefaultValue(10m)
                .HasColumnType("decimal(6, 2)");
            entity.Property(e => e.MapW)
                .HasDefaultValue(10m)
                .HasColumnType("decimal(6, 2)");
            entity.Property(e => e.MapX).HasColumnType("decimal(6, 2)");
            entity.Property(e => e.MapY).HasColumnType("decimal(6, 2)");
            entity.Property(e => e.ModifiedBy).HasMaxLength(32);
            entity.Property(e => e.ModifiedDate).HasPrecision(3);
            entity.Property(e => e.Name).HasMaxLength(150);
            entity.Property(e => e.PhotosJson).HasDefaultValue("[]");
            entity.Property(e => e.Price).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.PriceUnit).HasMaxLength(10);
            entity.Property(e => e.ResourceType).HasMaxLength(20);
            entity.Property(e => e.Status).HasMaxLength(20);

            entity.HasOne(d => d.Location).WithMany(p => p.Resources)
                .HasForeignKey(d => d.LocationId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Resources_Locations");
        });

        modelBuilder.Entity<Role>(entity =>
        {
            entity.ToTable("Roles", "auth");

            entity.HasIndex(e => e.RoleKey, "UQ_Roles_RoleKey").IsUnique();

            entity.Property(e => e.Id).HasMaxLength(32);
            entity.Property(e => e.CreatedBy).HasMaxLength(32);
            entity.Property(e => e.CreatedDate)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.Description)
                .HasMaxLength(500)
                .HasDefaultValue("");
            entity.Property(e => e.ModifiedBy).HasMaxLength(32);
            entity.Property(e => e.ModifiedDate).HasPrecision(3);
            entity.Property(e => e.Name).HasMaxLength(100);
            entity.Property(e => e.RoleKey).HasMaxLength(30);
        });

        modelBuilder.Entity<RolePermission>(entity =>
        {
            entity.HasKey(e => new { e.RoleId, e.PermissionKey });

            entity.ToTable("RolePermissions", "auth");

            entity.Property(e => e.RoleId).HasMaxLength(32);
            entity.Property(e => e.PermissionKey).HasMaxLength(60);
            entity.Property(e => e.CreatedDate)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())");

            entity.HasOne(d => d.PermissionKeyNavigation).WithMany(p => p.RolePermissions)
                .HasForeignKey(d => d.PermissionKey)
                .HasConstraintName("FK_RolePermissions_Permissions");

            entity.HasOne(d => d.Role).WithMany(p => p.RolePermissions)
                .HasForeignKey(d => d.RoleId)
                .HasConstraintName("FK_RolePermissions_Roles");
        });

        modelBuilder.Entity<State>(entity =>
        {
            entity.HasKey(e => e.StateCode);

            entity.ToTable("States", "config");

            entity.HasIndex(e => e.Name, "UQ_States_Name").IsUnique();

            entity.Property(e => e.StateCode).HasMaxLength(2);
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.Name).HasMaxLength(100);
        });

        modelBuilder.Entity<Subscription>(entity =>
        {
            entity.ToTable("Subscriptions", "membership");

            entity.HasIndex(e => e.LocationId, "IX_Subscriptions_LocationId");

            entity.HasIndex(e => e.MemberId, "IX_Subscriptions_MemberId");

            entity.Property(e => e.Id).HasMaxLength(32);
            entity.Property(e => e.AutoRenew).HasDefaultValue(true);
            entity.Property(e => e.BillingCycle).HasMaxLength(20);
            entity.Property(e => e.CancelReason).HasMaxLength(500);
            entity.Property(e => e.CreatedBy).HasMaxLength(32);
            entity.Property(e => e.CreatedDate)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.CreditsTotal).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.CreditsUsed).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.LocationId).HasMaxLength(32);
            entity.Property(e => e.MemberId).HasMaxLength(32);
            entity.Property(e => e.ModifiedBy).HasMaxLength(32);
            entity.Property(e => e.ModifiedDate).HasPrecision(3);
            entity.Property(e => e.PlanId).HasMaxLength(32);
            entity.Property(e => e.Price).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.RoomHoursTotal).HasColumnType("decimal(8, 2)");
            entity.Property(e => e.RoomHoursUsed).HasColumnType("decimal(8, 2)");
            entity.Property(e => e.ScheduledPlanId).HasMaxLength(32);
            entity.Property(e => e.SecurityDeposit).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.Status).HasMaxLength(20);

            entity.HasOne(d => d.Location).WithMany(p => p.Subscriptions)
                .HasForeignKey(d => d.LocationId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Subscriptions_Locations");

            entity.HasOne(d => d.Member).WithMany(p => p.Subscriptions)
                .HasForeignKey(d => d.MemberId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Subscriptions_Members");

            entity.HasOne(d => d.Plan).WithMany(p => p.SubscriptionPlans)
                .HasForeignKey(d => d.PlanId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Subscriptions_Plans");

            entity.HasOne(d => d.ScheduledPlan).WithMany(p => p.SubscriptionScheduledPlans)
                .HasForeignKey(d => d.ScheduledPlanId)
                .HasConstraintName("FK_Subscriptions_ScheduledPlan");
        });

        modelBuilder.Entity<Ticket>(entity =>
        {
            entity.ToTable("Tickets", "operations");

            entity.HasIndex(e => new { e.LocationId, e.Status }, "IX_Tickets_LocationId");

            entity.HasIndex(e => e.MemberId, "IX_Tickets_MemberId");

            entity.Property(e => e.Id).HasMaxLength(32);
            entity.Property(e => e.AssignedTo).HasMaxLength(32);
            entity.Property(e => e.AttachmentsJson).HasDefaultValue("[]");
            entity.Property(e => e.Category).HasMaxLength(100);
            entity.Property(e => e.CommentsJson).HasDefaultValue("[]");
            entity.Property(e => e.CreatedBy).HasMaxLength(32);
            entity.Property(e => e.CreatedDate)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.Description).HasMaxLength(4000);
            entity.Property(e => e.EscalatedTo).HasMaxLength(100);
            entity.Property(e => e.LocationId).HasMaxLength(32);
            entity.Property(e => e.MemberId).HasMaxLength(32);
            entity.Property(e => e.ModifiedBy).HasMaxLength(32);
            entity.Property(e => e.ModifiedDate).HasPrecision(3);
            entity.Property(e => e.Priority).HasMaxLength(10);
            entity.Property(e => e.ResolvedAt).HasPrecision(3);
            entity.Property(e => e.Status).HasMaxLength(20);
            entity.Property(e => e.Subject).HasMaxLength(200);
            entity.Property(e => e.TimelineJson).HasDefaultValue("[]");

            entity.HasOne(d => d.AssignedToNavigation).WithMany(p => p.Tickets)
                .HasForeignKey(d => d.AssignedTo)
                .HasConstraintName("FK_Tickets_AssignedTo");

            entity.HasOne(d => d.Location).WithMany(p => p.Tickets)
                .HasForeignKey(d => d.LocationId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Tickets_Locations");

            entity.HasOne(d => d.Member).WithMany(p => p.Tickets)
                .HasForeignKey(d => d.MemberId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Tickets_Members");
        });

        modelBuilder.Entity<UploadedFile>(entity =>
        {
            entity.ToTable("UploadedFiles", "config");

            entity.HasIndex(e => e.RelativePath, "UQ_UploadedFiles_RelativePath").IsUnique();

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.Category).HasMaxLength(30);
            entity.Property(e => e.ContentType).HasMaxLength(100);
            entity.Property(e => e.OriginalName).HasMaxLength(260);
            entity.Property(e => e.RelativePath).HasMaxLength(300);
            entity.Property(e => e.StoredName).HasMaxLength(100);
            entity.Property(e => e.UploadedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.UploadedBy).HasMaxLength(32);
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("Users", "auth");

            entity.HasIndex(e => e.Mobile, "IX_Users_Mobile");

            entity.HasIndex(e => e.Email, "UQ_Users_Email").IsUnique();

            entity.HasIndex(e => e.MemberId, "UX_Users_MemberId")
                .IsUnique()
                .HasFilter("([MemberId] IS NOT NULL)");

            entity.Property(e => e.Id).HasMaxLength(32);
            entity.Property(e => e.CreatedBy).HasMaxLength(32);
            entity.Property(e => e.CreatedDate)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.Email).HasMaxLength(256);
            entity.Property(e => e.LastLogin).HasPrecision(3);
            entity.Property(e => e.LockoutUntil).HasPrecision(3);
            entity.Property(e => e.MemberId).HasMaxLength(32);
            entity.Property(e => e.Mobile)
                .HasMaxLength(15)
                .HasDefaultValue("");
            entity.Property(e => e.ModifiedBy).HasMaxLength(32);
            entity.Property(e => e.ModifiedDate).HasPrecision(3);
            entity.Property(e => e.Name).HasMaxLength(150);
            entity.Property(e => e.PasswordHash).HasMaxLength(500);
            entity.Property(e => e.RoleKey).HasMaxLength(30);
            entity.Property(e => e.Status).HasMaxLength(20);

            entity.HasOne(d => d.Member).WithOne(p => p.User)
                .HasForeignKey<User>(d => d.MemberId)
                .HasConstraintName("FK_Users_Members");

            entity.HasOne(d => d.RoleKeyNavigation).WithMany(p => p.Users)
                .HasPrincipalKey(p => p.RoleKey)
                .HasForeignKey(d => d.RoleKey)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Users_Roles");
        });

        modelBuilder.Entity<UserLocation>(entity =>
        {
            entity.HasKey(e => new { e.UserId, e.LocationId });

            entity.ToTable("UserLocations", "auth");

            entity.Property(e => e.UserId).HasMaxLength(32);
            entity.Property(e => e.LocationId).HasMaxLength(32);
            entity.Property(e => e.CreatedDate)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())");

            entity.HasOne(d => d.Location).WithMany(p => p.UserLocations)
                .HasForeignKey(d => d.LocationId)
                .HasConstraintName("FK_UserLocations_Locations");

            entity.HasOne(d => d.User).WithMany(p => p.UserLocations)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("FK_UserLocations_Users");
        });

        modelBuilder.Entity<Visitor>(entity =>
        {
            entity.ToTable("Visitors", "operations");

            entity.HasIndex(e => new { e.LocationId, e.VisitDate }, "IX_Visitors_Location_Date");

            entity.HasIndex(e => e.PassCode, "UX_Visitors_PassCode")
                .IsUnique()
                .HasFilter("([PassCode]<>N'')");

            entity.Property(e => e.Id).HasMaxLength(32);
            entity.Property(e => e.CheckInAt).HasPrecision(3);
            entity.Property(e => e.CheckOutAt).HasPrecision(3);
            entity.Property(e => e.Company).HasMaxLength(200);
            entity.Property(e => e.CreatedBy).HasMaxLength(32);
            entity.Property(e => e.CreatedDate)
                .HasPrecision(3)
                .HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.Email)
                .HasMaxLength(256)
                .HasDefaultValue("");
            entity.Property(e => e.HostMemberId).HasMaxLength(32);
            entity.Property(e => e.LocationId).HasMaxLength(32);
            entity.Property(e => e.Mobile).HasMaxLength(15);
            entity.Property(e => e.ModifiedBy).HasMaxLength(32);
            entity.Property(e => e.ModifiedDate).HasPrecision(3);
            entity.Property(e => e.Name).HasMaxLength(150);
            entity.Property(e => e.NotifiedViaJson)
                .HasMaxLength(200)
                .HasDefaultValue("[]");
            entity.Property(e => e.PassCode)
                .HasMaxLength(20)
                .HasDefaultValue("");
            entity.Property(e => e.Purpose).HasMaxLength(200);
            entity.Property(e => e.Status).HasMaxLength(20);
            entity.Property(e => e.VisitTime).HasPrecision(0);

            entity.HasOne(d => d.HostMember).WithMany(p => p.Visitors)
                .HasForeignKey(d => d.HostMemberId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Visitors_Members");

            entity.HasOne(d => d.Location).WithMany(p => p.Visitors)
                .HasForeignKey(d => d.LocationId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Visitors_Locations");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
