using System.Globalization;
using System.Linq.Expressions;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using officera.BusinessAccessLayer.DTOs;
using officera.BusinessAccessLayer.Interfaces;
using officera.DataAccessLayer.Entities;
using officera.Shared.Common;

namespace officera.BusinessAccessLayer.Services
{
    /// <summary>Image references are a catalogue seed number or an uploaded image URL.</summary>
    internal static class ImageRef
    {
        public static JsonElement ToJson(string? stored)
        {
            var value = string.IsNullOrWhiteSpace(stored) ? "1" : stored.Trim();
            return int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var seed)
                ? JsonSerializer.SerializeToElement(seed)
                : JsonSerializer.SerializeToElement(value);
        }

        public static string FromJson(JsonElement? value, string fallback) => value switch
        {
            { ValueKind: JsonValueKind.Number } v => v.GetRawText(),
            { ValueKind: JsonValueKind.String } v when !string.IsNullOrWhiteSpace(v.GetString()) => v.GetString()!.Trim(),
            _ => fallback,
        };
    }

    /// <summary>CRM leads. Staff manage them; the public website creates them through <see cref="CaptureAsync"/>.</summary>
    public class LeadService : CrudServiceBase<Lead, LeadDto>, ILeadService
    {
        private static readonly string[] Sources = { "BOOK_NOW", "CALLBACK", "TOUR", "WEBSITE", "WALK_IN", "REFERRAL", "PARTNER" };
        private static readonly string[] Statuses = { "NEW", "CONTACTED", "TOUR_SCHEDULED", "TOUR_DONE", "CONVERTED", "LOST" };
        private readonly IOtpService _otp;
        private readonly INotificationService _notifications;

        public LeadService(ServiceContext context, IOtpService otp, INotificationService notifications) : base(context)
        {
            _otp = otp;
            _notifications = notifications;
        }

        protected override string EntityName => "Lead";
        protected override string ModuleKey => "leads";
        protected override string IdPrefix => "LEAD";

        protected override Expression<Func<Lead, bool>> IdEquals(string id) => e => e.Id == id;
        protected override string KeyOf(Lead entity) => entity.Id;
        protected override void SetKey(Lead entity, string id) => entity.Id = id;

        protected override Expression<Func<Lead, bool>>? LocationFilter(IReadOnlyCollection<string> locationIds) => e => locationIds.Contains(e.LocationId);
        protected override string? LocationOf(Lead entity) => entity.LocationId;

        protected override IEnumerable<string?> SearchValues(LeadDto dto) => new[] { dto.Id, dto.Name, dto.Mobile, dto.Email, dto.Requirement };
        protected override IEnumerable<LeadDto> DefaultOrder(IEnumerable<LeadDto> items) => items.OrderByDescending(l => l.CreatedAt);

        protected override LeadDto ToDto(Lead e) => new()
        {
            Id = e.Id,
            Name = e.Name,
            Mobile = e.Mobile,
            Email = e.Email,
            Source = e.Source,
            LocationId = e.LocationId,
            Requirement = e.Requirement,
            SpaceType = e.SpaceType,
            Seats = e.Seats,
            PreferredDate = DateTimeHelper.ToDateString(e.PreferredDate),
            PreferredTime = e.PreferredTime,
            Visitors = e.Visitors,
            Status = e.Status,
            OwnerId = e.OwnerId,
            FollowUpDate = DateTimeHelper.ToDateString(e.FollowUpDate),
            MobileVerified = e.MobileVerified,
            CreatedAt = DateTimeHelper.ToIso(e.CreatedDate),
            UpdatedAt = DateTimeHelper.ToIso(e.ModifiedDate ?? e.CreatedDate),
            Notes = JsonHelper.DeserializeList<CommentDto>(e.NotesJson),
            Comments = JsonHelper.DeserializeList<CommentDto>(e.CommentsJson),
            Activities = JsonHelper.DeserializeList<TimelineEntryDto>(e.ActivitiesJson),
            LostReason = e.LostReason,
            MemberId = e.MemberId,
        };

        protected override void MapToEntity(LeadDto dto, Lead e, bool isNew)
        {
            e.Name = dto.Name.Trim();
            e.Mobile = ValidationHelper.NormalizeMobile(dto.Mobile);
            e.Email = string.IsNullOrWhiteSpace(dto.Email) ? null : dto.Email.Trim().ToLowerInvariant();
            e.Source = dto.Source;
            e.LocationId = dto.LocationId;
            e.Requirement = dto.Requirement ?? string.Empty;
            e.SpaceType = dto.SpaceType;
            e.Seats = dto.Seats;
            e.PreferredDate = DateTimeHelper.ParseDate(dto.PreferredDate);
            e.PreferredTime = dto.PreferredTime;
            e.Visitors = dto.Visitors;
            e.Status = dto.Status;
            e.OwnerId = string.IsNullOrWhiteSpace(dto.OwnerId) ? null : dto.OwnerId;
            e.FollowUpDate = DateTimeHelper.ParseDate(dto.FollowUpDate);
            e.MobileVerified = dto.MobileVerified;
            e.NotesJson = JsonHelper.Serialize(dto.Notes ?? new());
            e.CommentsJson = JsonHelper.Serialize(dto.Comments ?? new());
            e.ActivitiesJson = JsonHelper.Serialize(dto.Activities ?? new());
            e.LostReason = dto.LostReason;
            e.MemberId = string.IsNullOrWhiteSpace(dto.MemberId) ? null : dto.MemberId;
        }

        protected override async Task ValidateAsync(LeadDto dto, Lead? existing, CurrentUserContext user)
        {
            new ValidationHelper.Collector()
                .Required(dto.Name, "Name").MaxLength(dto.Name, 150, "Name")
                .Mobile(dto.Mobile, "Mobile")
                .Email(dto.Email, "Email", required: false)
                .OneOf(dto.Source, Sources, "Source")
                .OneOf(dto.Status, Statuses, "Status")
                .Required(dto.LocationId, "Location")
                .Must(dto.Status != "LOST" || !string.IsNullOrWhiteSpace(dto.LostReason), "A reason is required when marking a lead as lost.")
                .ThrowIfInvalid();

            if (!(await Repo<Location>().FindAsync(l => l.Id == dto.LocationId)).Any())
            {
                throw new ValidationException("The selected location does not exist.");
            }

            if (!string.IsNullOrWhiteSpace(dto.OwnerId) && !(await Repo<User>().FindAsync(u => u.Id == dto.OwnerId && u.RoleKey != RoleKeys.Member)).Any())
            {
                throw new ValidationException("Lead owner must be a staff user.");
            }
        }

        public async Task<LeadDto> CaptureAsync(LeadCaptureRequest request)
        {
            new ValidationHelper.Collector()
                .Required(request.Name, "Name").MaxLength(request.Name, 150, "Name")
                .Mobile(request.Mobile, "Mobile")
                .Email(request.Email, "Email", required: false)
                .OneOf(request.Source, Sources, "Source")
                .Required(request.LocationId, "Location")
                .Required(request.Requirement, "Requirement").MaxLength(request.Requirement, 500, "Requirement")
                // The contact form is the only enquiry accepted without an OTP; it is stored as "mobile not verified".
                .Must(request.Source == "WEBSITE" || !string.IsNullOrWhiteSpace(request.VerificationId), "Please verify your mobile number first.")
                .ThrowIfInvalid();

            var location = (await Repo<Location>().FindAsync(l => l.Id == request.LocationId && l.Status != "INACTIVE")).FirstOrDefault()
                ?? throw new ValidationException("The selected location does not exist.");

            var mobile = ValidationHelper.NormalizeMobile(request.Mobile);
            var verified = !string.IsNullOrWhiteSpace(request.VerificationId);
            if (verified)
            {
                await _otp.ConsumeAsync(request.VerificationId, mobile, OtpPurposes.Enquiry);
            }

            var labels = new Dictionary<string, string>
            {
                ["BOOK_NOW"] = "Book Now", ["CALLBACK"] = "Request Callback", ["TOUR"] = "Schedule Tour", ["WEBSITE"] = "Contact form",
                ["WALK_IN"] = "Walk-in", ["REFERRAL"] = "Referral", ["PARTNER"] = "Partner",
            };
            var label = labels[request.Source];
            var now = DateTimeHelper.ToIso(DateTime.UtcNow);
            var activities = new List<TimelineEntryDto>
            {
                new() { Id = $"LA-{Guid.NewGuid():N}"[..14], Title = "Lead created", Description = verified ? $"Submitted via {label} · mobile verified by OTP" : $"Submitted via {label}", At = now, Tone = "info", Icon = "plus" },
            };
            if (request.Source == "TOUR")
            {
                activities.Add(new TimelineEntryDto
                {
                    Id = $"LA-{Guid.NewGuid():N}"[..14],
                    Title = "Tour scheduled",
                    Description = $"{request.PreferredDate} at {request.PreferredTime} for {request.Visitors ?? 1} visitor(s)",
                    At = now,
                    Tone = "warning",
                    Icon = "calendar",
                });
            }

            var id = await Ids.NextIdAsync(IdPrefix);
            var lead = new Lead
            {
                Id = id,
                Name = request.Name.Trim(),
                Mobile = mobile,
                Email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim().ToLowerInvariant(),
                Source = request.Source,
                LocationId = location.Id,
                Requirement = request.Requirement.Trim(),
                SpaceType = request.SpaceType,
                Seats = request.Seats,
                PreferredDate = DateTimeHelper.ParseDate(request.PreferredDate),
                PreferredTime = request.PreferredTime,
                Visitors = request.Visitors,
                Status = request.Source == "TOUR" ? "TOUR_SCHEDULED" : "NEW",
                FollowUpDate = DateTimeHelper.ParseDate(request.PreferredDate),
                MobileVerified = verified,
                NotesJson = "[]",
                CommentsJson = "[]",
                ActivitiesJson = JsonHelper.Serialize(activities),
            };

            await Repository.AddAsync(lead);
            await UnitOfWork.CompleteAsync();
            Logger.LogInformation("Website lead {LeadId} captured via {Source} for {LocationId}", id, request.Source, location.Id);

            var shortName = location.Name.Replace("Officera ", string.Empty);
            await _notifications.DispatchAsync(new NotificationMessage
            {
                Event = "New Lead",
                Audience = "STAFF",
                Category = "SYSTEM",
                Title = $"New lead · {label}",
                Message = $"{lead.Name} – {lead.Requirement} at {shortName}",
                Link = $"/admin/leads/{id}",
                LocationId = location.Id,
                Channels = new[] { "EMAIL", "PUSH" },
            });

            if (request.Source == "TOUR")
            {
                await _notifications.DispatchAsync(new NotificationMessage
                {
                    Event = "Tour Confirmation",
                    Audience = "STAFF",
                    Category = "SYSTEM",
                    Title = "Tour confirmation sent",
                    Message = $"Tour for {lead.Name} on {request.PreferredDate} {request.PreferredTime} confirmed by SMS.",
                    Mobile = mobile,
                    LocationId = location.Id,
                    Channels = new[] { "SMS" },
                });
            }

            return ToDto(lead);
        }
    }

    /// <summary>Community feed posts and announcements.</summary>
    public class PostService : CrudServiceBase<Post, PostDto>, IPostService
    {
        public PostService(ServiceContext context) : base(context) { }

        protected override string EntityName => "Post";
        protected override string ModuleKey => "community";
        protected override string IdPrefix => "PST";
        protected override ReadAccess ReadAccess => ReadAccess.Authenticated;

        protected override Expression<Func<Post, bool>> IdEquals(string id) => e => e.Id == id;
        protected override string KeyOf(Post entity) => entity.Id;
        protected override void SetKey(Post entity, string id) => entity.Id = id;

        protected override Expression<Func<Post, bool>>? MemberFilter(CurrentUserContext user)
        {
            var memberId = user.MemberId;
            return e => e.Status == "PUBLISHED" || e.AuthorMemberId == memberId;
        }

        protected override bool MemberCanCreate(Post entity, CurrentUserContext user) => entity.AuthorMemberId == user.MemberId && entity.PostType == "POST";

        protected override bool MemberCanUpdate(Post existing, CurrentUserContext user) => existing.Status == "PUBLISHED" || existing.AuthorMemberId == user.MemberId;

        /// <summary>Members can like and comment on any post, but only edit the text of their own.</summary>
        protected override void ApplyMemberUpdate(PostDto dto, Post e, CurrentUserContext user)
        {
            var me = user.MemberId ?? string.Empty;
            var likedBy = JsonHelper.DeserializeList<string>(e.LikedByJson);
            var wantsLike = (dto.LikedBy ?? new()).Contains(me);
            likedBy.Remove(me);
            if (wantsLike)
            {
                likedBy.Add(me);
            }

            e.LikedByJson = JsonHelper.Serialize(likedBy);
            e.Likes = likedBy.Count;

            var existingComments = JsonHelper.DeserializeList<CommentDto>(e.CommentsJson);
            var added = (dto.Comments ?? new()).Where(c => existingComments.All(x => x.Id != c.Id)).ToList();
            existingComments.AddRange(added.Select(c => new CommentDto
            {
                Id = c.Id,
                Author = string.IsNullOrEmpty(user.Name) ? c.Author : user.Name,
                AuthorRole = c.AuthorRole,
                Text = c.Text,
                At = DateTimeHelper.ToIso(DateTime.UtcNow),
            }));
            e.CommentsJson = JsonHelper.Serialize(existingComments);

            if (e.AuthorMemberId == me)
            {
                e.Content = dto.Content;
            }
        }

        protected override IEnumerable<string?> SearchValues(PostDto dto) => new[] { dto.AuthorName, dto.Content };
        protected override IEnumerable<PostDto> DefaultOrder(IEnumerable<PostDto> items) => items.OrderByDescending(p => p.Pinned == true).ThenByDescending(p => p.At);

        protected override PostDto ToDto(Post e) => new()
        {
            Id = e.Id,
            AuthorName = e.AuthorName,
            AuthorRole = e.AuthorRole,
            AuthorMemberId = e.AuthorMemberId,
            Type = e.PostType,
            Content = e.Content,
            At = DateTimeHelper.ToIso(e.PostedAt),
            Likes = e.Likes,
            LikedBy = JsonHelper.DeserializeList<string>(e.LikedByJson),
            Comments = JsonHelper.DeserializeList<CommentDto>(e.CommentsJson),
            LocationId = e.LocationId,
            Status = e.Status,
            Pinned = e.IsPinned ? true : null,
        };

        protected override void MapToEntity(PostDto dto, Post e, bool isNew)
        {
            e.AuthorName = dto.AuthorName;
            e.AuthorRole = dto.AuthorRole ?? string.Empty;
            e.AuthorMemberId = string.IsNullOrWhiteSpace(dto.AuthorMemberId) ? null : dto.AuthorMemberId;
            e.PostType = dto.Type;
            e.Content = dto.Content;
            e.PostedAt = isNew ? DateTime.UtcNow : DateTimeHelper.ParseUtc(dto.At) ?? e.PostedAt;
            var likedBy = (dto.LikedBy ?? new()).Distinct().ToList();
            e.LikedByJson = JsonHelper.Serialize(likedBy);
            e.Likes = likedBy.Count;
            e.CommentsJson = JsonHelper.Serialize(dto.Comments ?? new());
            e.LocationId = string.IsNullOrWhiteSpace(dto.LocationId) ? null : dto.LocationId;
            e.Status = dto.Status;
            e.IsPinned = dto.Pinned == true;
        }

        protected override Task ValidateAsync(PostDto dto, Post? existing, CurrentUserContext user)
        {
            new ValidationHelper.Collector()
                .Required(dto.Content, "Post").MaxLength(dto.Content, 4000, "Post")
                .Required(dto.AuthorName, "Author")
                .OneOf(dto.Type, new[] { "POST", "ANNOUNCEMENT" }, "Type")
                .OneOf(dto.Status, new[] { "PUBLISHED", "HIDDEN" }, "Status")
                .ThrowIfInvalid();
            return Task.CompletedTask;
        }
    }

    /// <summary>Community events. Public events appear on the website; members RSVP.</summary>
    public class EventService : CrudServiceBase<Event, EventDto>, IEventService
    {
        public EventService(ServiceContext context) : base(context) { }

        protected override string EntityName => "Event";
        protected override string ModuleKey => "community";
        protected override string IdPrefix => "EVT";
        protected override ReadAccess ReadAccess => ReadAccess.Public;

        protected override Expression<Func<Event, bool>> IdEquals(string id) => e => e.Id == id;
        protected override string KeyOf(Event entity) => entity.Id;
        protected override void SetKey(Event entity, string id) => entity.Id = id;

        protected override Expression<Func<Event, bool>>? PublicFilter => e => e.IsPublic && e.Status == "PUBLISHED";
        protected override Expression<Func<Event, bool>>? MemberFilter(CurrentUserContext user) => e => e.Status != "DRAFT";
        protected override Expression<Func<Event, bool>>? LocationFilter(IReadOnlyCollection<string> locationIds) => e => locationIds.Contains(e.LocationId);
        protected override string? LocationOf(Event entity) => entity.LocationId;

        protected override bool MemberCanUpdate(Event existing, CurrentUserContext user) => existing.Status == "PUBLISHED";

        /// <summary>RSVP: a member can only add or remove themselves, within capacity.</summary>
        protected override void ApplyMemberUpdate(EventDto dto, Event e, CurrentUserContext user)
        {
            var me = user.MemberId ?? string.Empty;
            var attendees = JsonHelper.DeserializeList<string>(e.AttendeesJson);
            var going = (dto.Attendees ?? new()).Contains(me);
            attendees.Remove(me);
            if (going)
            {
                if (attendees.Count >= e.Capacity)
                {
                    throw new ConflictException("This event is full.");
                }
                attendees.Add(me);
            }

            e.AttendeesJson = JsonHelper.Serialize(attendees);
        }

        protected override IEnumerable<string?> SearchValues(EventDto dto) => new[] { dto.Title, dto.Category, dto.Venue, dto.Host };
        protected override IEnumerable<EventDto> DefaultOrder(IEnumerable<EventDto> items) => items.OrderBy(e => e.Date).ThenBy(e => e.StartTime);

        protected override EventDto ToDto(Event e) => new()
        {
            Id = e.Id,
            Title = e.Title,
            Category = e.Category,
            Date = DateTimeHelper.ToDateString(e.EventDate),
            StartTime = DateTimeHelper.ToTimeString(e.StartTime),
            EndTime = DateTimeHelper.ToTimeString(e.EndTime),
            LocationId = e.LocationId,
            Venue = e.Venue,
            Description = e.Description,
            Capacity = e.Capacity,
            Attendees = JsonHelper.DeserializeList<string>(e.AttendeesJson),
            IsPublic = e.IsPublic,
            Status = e.Status,
            Host = e.Host,
            ImageSeed = ImageRef.ToJson(e.ImageSeed),
        };

        protected override void MapToEntity(EventDto dto, Event e, bool isNew)
        {
            e.Title = dto.Title.Trim();
            e.Category = dto.Category;
            e.EventDate = DateTimeHelper.RequireDate(dto.Date, "Date");
            e.StartTime = DateTimeHelper.RequireTime(dto.StartTime, "Start time");
            e.EndTime = DateTimeHelper.RequireTime(dto.EndTime, "End time");
            e.LocationId = dto.LocationId;
            e.Venue = dto.Venue ?? string.Empty;
            e.Description = dto.Description ?? string.Empty;
            e.Capacity = dto.Capacity;
            e.AttendeesJson = JsonHelper.Serialize((dto.Attendees ?? new()).Distinct().ToList());
            e.IsPublic = dto.IsPublic;
            e.Status = dto.Status;
            e.Host = dto.Host ?? string.Empty;
            e.ImageSeed = ImageRef.FromJson(dto.ImageSeed, isNew ? "61" : e.ImageSeed);
        }

        protected override Task ValidateAsync(EventDto dto, Event? existing, CurrentUserContext user)
        {
            if (user.IsMember)
            {
                return Task.CompletedTask;
            }

            var start = DateTimeHelper.ParseTime(dto.StartTime);
            var end = DateTimeHelper.ParseTime(dto.EndTime);
            new ValidationHelper.Collector()
                .Required(dto.Title, "Title").MaxLength(dto.Title, 200, "Title")
                .Required(dto.Category, "Category")
                .Required(dto.LocationId, "Location")
                .Must(DateTimeHelper.ParseDate(dto.Date) != null, "Date is required.")
                .Must(start != null && end != null && end > start, "End time must be after the start time.")
                .Must(dto.Capacity > 0, "Capacity must be at least 1.")
                .Must((dto.Attendees?.Count ?? 0) <= dto.Capacity, "Capacity cannot be lower than the number of attendees.")
                .OneOf(dto.Status, new[] { "PUBLISHED", "DRAFT", "CANCELLED" }, "Status")
                .ThrowIfInvalid();
            return Task.CompletedTask;
        }
    }

    /// <summary>Member perks from partners.</summary>
    public class PerkService : CrudServiceBase<Perk, PerkDto>, IPerkService
    {
        public PerkService(ServiceContext context) : base(context) { }

        protected override string EntityName => "Perk";
        protected override string ModuleKey => "community";
        protected override string IdPrefix => "PRK";
        protected override ReadAccess ReadAccess => ReadAccess.Authenticated;

        protected override Expression<Func<Perk, bool>> IdEquals(string id) => e => e.Id == id;
        protected override string KeyOf(Perk entity) => entity.Id;
        protected override void SetKey(Perk entity, string id) => entity.Id = id;

        protected override Expression<Func<Perk, bool>>? MemberFilter(CurrentUserContext user) => e => e.Status == "ACTIVE";
        protected override bool MemberCanUpdate(Perk existing, CurrentUserContext user) => existing.Status == "ACTIVE";

        /// <summary>A member's only change is redeeming the perk once (+1).</summary>
        protected override void ApplyMemberUpdate(PerkDto dto, Perk e, CurrentUserContext user)
        {
            if (dto.Redemptions == e.Redemptions + 1 && e.Expiry >= DateTimeHelper.TodayUtc)
            {
                e.Redemptions += 1;
            }
        }

        protected override IEnumerable<string?> SearchValues(PerkDto dto) => new[] { dto.Partner, dto.Offer, dto.Category };

        protected override PerkDto ToDto(Perk e) => new()
        {
            Id = e.Id,
            Partner = e.Partner,
            Category = e.Category,
            Offer = e.Offer,
            Description = e.Description,
            Discount = e.Discount,
            Code = e.Code,
            Expiry = DateTimeHelper.ToDateString(e.Expiry),
            Terms = e.Terms,
            Status = e.Status,
            Redemptions = e.Redemptions,
        };

        protected override void MapToEntity(PerkDto dto, Perk e, bool isNew)
        {
            e.Partner = dto.Partner.Trim();
            e.Category = dto.Category;
            e.Offer = dto.Offer;
            e.Description = dto.Description ?? string.Empty;
            e.Discount = dto.Discount ?? string.Empty;
            e.Code = dto.Code ?? string.Empty;
            e.Expiry = DateTimeHelper.RequireDate(dto.Expiry, "Expiry");
            e.Terms = dto.Terms ?? string.Empty;
            e.Status = dto.Status;
            e.Redemptions = Math.Max(0, dto.Redemptions);
        }

        protected override Task ValidateAsync(PerkDto dto, Perk? existing, CurrentUserContext user)
        {
            if (user.IsMember)
            {
                return Task.CompletedTask;
            }

            new ValidationHelper.Collector()
                .Required(dto.Partner, "Partner")
                .Required(dto.Category, "Category")
                .Required(dto.Offer, "Offer")
                .Must(DateTimeHelper.ParseDate(dto.Expiry) != null, "Expiry must be a valid date.")
                .OneOf(dto.Status, new[] { "ACTIVE", "INACTIVE" }, "Status")
                .ThrowIfInvalid();
            return Task.CompletedTask;
        }
    }

    /// <summary>Blog (Marketing Content → Blog, public /blog).</summary>
    public class BlogPostService : CrudServiceBase<BlogPost, BlogPostDto>, IBlogPostService
    {
        public BlogPostService(ServiceContext context) : base(context) { }

        protected override string EntityName => "Blog post";
        protected override string ModuleKey => "content";
        protected override string IdPrefix => "BLG";
        protected override ReadAccess ReadAccess => ReadAccess.Public;

        protected override Expression<Func<BlogPost, bool>> IdEquals(string id) => e => e.Id == id;
        protected override string KeyOf(BlogPost entity) => entity.Id;
        protected override void SetKey(BlogPost entity, string id) => entity.Id = id;

        protected override Expression<Func<BlogPost, bool>>? PublicFilter => e => e.Status == "PUBLISHED";

        protected override IEnumerable<string?> SearchValues(BlogPostDto dto) => new[] { dto.Title, dto.Excerpt, dto.Author, dto.Category };
        protected override IEnumerable<BlogPostDto> DefaultOrder(IEnumerable<BlogPostDto> items) => items.OrderByDescending(b => b.PublishedAt);

        protected override BlogPostDto ToDto(BlogPost e) => new()
        {
            Id = e.Id,
            Title = e.Title,
            Excerpt = e.Excerpt,
            Body = JsonHelper.DeserializeList<string>(e.BodyJson),
            Author = e.Author,
            Category = e.Category,
            PublishedAt = DateTimeHelper.ToDateString(e.PublishedAt),
            ReadMinutes = e.ReadMinutes,
            Status = e.Status,
            ImageSeed = ImageRef.ToJson(e.ImageSeed),
        };

        protected override void MapToEntity(BlogPostDto dto, BlogPost e, bool isNew)
        {
            e.Title = dto.Title.Trim();
            e.Excerpt = dto.Excerpt ?? string.Empty;
            e.BodyJson = JsonHelper.Serialize(dto.Body ?? new());
            e.Author = dto.Author;
            e.Category = dto.Category;
            e.PublishedAt = DateTimeHelper.ParseDate(dto.PublishedAt) ?? DateTimeHelper.TodayUtc;
            e.ReadMinutes = Math.Max(1, dto.ReadMinutes);
            e.Status = dto.Status;
            e.ImageSeed = ImageRef.FromJson(dto.ImageSeed, isNew ? "71" : e.ImageSeed);
        }

        protected override Task ValidateAsync(BlogPostDto dto, BlogPost? existing, CurrentUserContext user)
        {
            new ValidationHelper.Collector()
                .Required(dto.Title, "Title").MaxLength(dto.Title, 200, "Title")
                .Required(dto.Author, "Author")
                .Required(dto.Category, "Category")
                .OneOf(dto.Status, new[] { "PUBLISHED", "DRAFT" }, "Status")
                .ThrowIfInvalid();
            return Task.CompletedTask;
        }
    }

    /// <summary>Gallery (Marketing Content → Gallery, public /gallery).</summary>
    public class GalleryService : CrudServiceBase<GalleryItem, GalleryItemDto>, IGalleryService
    {
        private static readonly string[] Categories = { "Workspace", "Meeting Rooms", "Events", "Amenities" };

        public GalleryService(ServiceContext context) : base(context) { }

        protected override string EntityName => "Gallery item";
        protected override string ModuleKey => "content";
        protected override string IdPrefix => "GAL";
        protected override ReadAccess ReadAccess => ReadAccess.Public;

        protected override Expression<Func<GalleryItem, bool>> IdEquals(string id) => e => e.Id == id;
        protected override string KeyOf(GalleryItem entity) => entity.Id;
        protected override void SetKey(GalleryItem entity, string id) => entity.Id = id;

        protected override Expression<Func<GalleryItem, bool>>? PublicFilter => e => e.Status == "PUBLISHED";
        protected override string? LocationOf(GalleryItem entity) => entity.LocationId;

        protected override IEnumerable<string?> SearchValues(GalleryItemDto dto) => new[] { dto.Title, dto.Category };

        protected override GalleryItemDto ToDto(GalleryItem e) => new()
        {
            Id = e.Id,
            Title = e.Title,
            LocationId = e.LocationId,
            Category = e.Category,
            Seed = ImageRef.ToJson(e.Seed),
            Status = e.Status,
        };

        protected override void MapToEntity(GalleryItemDto dto, GalleryItem e, bool isNew)
        {
            e.Title = dto.Title.Trim();
            e.LocationId = dto.LocationId;
            e.Category = dto.Category;
            e.Seed = ImageRef.FromJson(dto.Seed, isNew ? "80" : e.Seed);
            e.Status = dto.Status;
        }

        protected override Task ValidateAsync(GalleryItemDto dto, GalleryItem? existing, CurrentUserContext user)
        {
            new ValidationHelper.Collector()
                .Required(dto.Title, "Title")
                .Required(dto.LocationId, "Location")
                .OneOf(dto.Category, Categories, "Category")
                .OneOf(dto.Status, new[] { "PUBLISHED", "HIDDEN" }, "Status")
                .ThrowIfInvalid();
            return Task.CompletedTask;
        }
    }
}
