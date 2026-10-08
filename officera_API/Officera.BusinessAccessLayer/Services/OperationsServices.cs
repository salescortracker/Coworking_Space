using System.Linq.Expressions;
using officera.BusinessAccessLayer.DTOs;
using officera.BusinessAccessLayer.Interfaces;
using officera.DataAccessLayer.Entities;
using officera.Shared.Common;

namespace officera.BusinessAccessLayer.Services
{
    /// <summary>Visitor passes (member visitors page, front desk).</summary>
    public class VisitorService : CrudServiceBase<Visitor, VisitorDto>, IVisitorService
    {
        private static readonly string[] Statuses = { "EXPECTED", "CHECKED_IN", "CHECKED_OUT", "EXPIRED", "CANCELLED" };

        public VisitorService(ServiceContext context) : base(context) { }

        protected override string EntityName => "Visitor";
        protected override string ModuleKey => "visitors";
        protected override string IdPrefix => "VIS";

        protected override Expression<Func<Visitor, bool>> IdEquals(string id) => e => e.Id == id;
        protected override string KeyOf(Visitor entity) => entity.Id;
        protected override void SetKey(Visitor entity, string id) => entity.Id = id;

        protected override Expression<Func<Visitor, bool>>? MemberFilter(CurrentUserContext user)
        {
            var memberId = user.MemberId;
            return e => e.HostMemberId == memberId;
        }

        protected override Expression<Func<Visitor, bool>>? LocationFilter(IReadOnlyCollection<string> locationIds) => e => locationIds.Contains(e.LocationId);
        protected override string? LocationOf(Visitor entity) => entity.LocationId;

        protected override bool MemberCanCreate(Visitor entity, CurrentUserContext user) => entity.HostMemberId == user.MemberId;
        protected override bool MemberCanUpdate(Visitor existing, CurrentUserContext user) => existing.HostMemberId == user.MemberId;

        /// <summary>Hosts can edit or cancel their invitation; check-in/out is a front desk action.</summary>
        protected override void ApplyMemberUpdate(VisitorDto dto, Visitor e, CurrentUserContext user)
        {
            var status = e.Status;
            var host = e.HostMemberId;
            var checkIn = e.CheckInAt;
            var checkOut = e.CheckOutAt;
            MapToEntity(dto, e, false);
            e.HostMemberId = host;
            e.CheckInAt = checkIn;
            e.CheckOutAt = checkOut;
            e.Status = dto.Status == "CANCELLED" && status == "EXPECTED" ? "CANCELLED" : status;
        }

        protected override IEnumerable<string?> SearchValues(VisitorDto dto) => new[] { dto.Id, dto.Name, dto.Mobile, dto.Email, dto.Company, dto.PassCode };
        protected override IEnumerable<VisitorDto> DefaultOrder(IEnumerable<VisitorDto> items) => items.OrderByDescending(v => v.VisitDate).ThenBy(v => v.VisitTime);

        protected override VisitorDto ToDto(Visitor e) => new()
        {
            Id = e.Id,
            Name = e.Name,
            Mobile = e.Mobile,
            Email = e.Email,
            Company = e.Company,
            HostMemberId = e.HostMemberId,
            LocationId = e.LocationId,
            VisitDate = DateTimeHelper.ToDateString(e.VisitDate),
            VisitTime = DateTimeHelper.ToTimeString(e.VisitTime),
            Purpose = e.Purpose,
            Status = e.Status,
            PassCode = e.PassCode,
            PhotoCaptured = e.PhotoCaptured,
            HostNotified = e.HostNotified,
            CheckInAt = DateTimeHelper.ToIso(e.CheckInAt),
            CheckOutAt = DateTimeHelper.ToIso(e.CheckOutAt),
            CreatedAt = DateTimeHelper.ToIso(e.CreatedDate),
            NotifiedVia = JsonHelper.DeserializeList<string>(e.NotifiedViaJson),
        };

        protected override void MapToEntity(VisitorDto dto, Visitor e, bool isNew)
        {
            e.Name = dto.Name.Trim();
            e.Mobile = ValidationHelper.NormalizeMobile(dto.Mobile);
            e.Email = dto.Email ?? string.Empty;
            e.Company = dto.Company;
            e.HostMemberId = dto.HostMemberId;
            e.LocationId = dto.LocationId;
            e.VisitDate = DateTimeHelper.RequireDate(dto.VisitDate, "Visit date");
            e.VisitTime = DateTimeHelper.RequireTime(dto.VisitTime, "Visit time");
            e.Purpose = dto.Purpose ?? string.Empty;
            e.Status = dto.Status;
            e.PassCode = (dto.PassCode ?? string.Empty).Trim().ToUpperInvariant();
            e.PhotoCaptured = dto.PhotoCaptured;
            e.HostNotified = dto.HostNotified;
            e.CheckInAt = DateTimeHelper.ParseUtc(dto.CheckInAt);
            e.CheckOutAt = DateTimeHelper.ParseUtc(dto.CheckOutAt);
            e.NotifiedViaJson = JsonHelper.Serialize(dto.NotifiedVia ?? new());
        }

        protected override async Task ValidateAsync(VisitorDto dto, Visitor? existing, CurrentUserContext user)
        {
            new ValidationHelper.Collector()
                .Required(dto.Name, "Visitor name").MaxLength(dto.Name, 150, "Visitor name")
                .Mobile(dto.Mobile, "Mobile")
                .Email(dto.Email, "Email", required: false)
                .Required(dto.HostMemberId, "Host member")
                .Required(dto.LocationId, "Location")
                .Must(DateTimeHelper.ParseDate(dto.VisitDate) != null, "Visit date is required.")
                .Must(DateTimeHelper.ParseTime(dto.VisitTime) != null, "Visit time is required.")
                .OneOf(dto.Status, Statuses, "Status")
                .ThrowIfInvalid();

            if (existing == null && DateTimeHelper.ParseDate(dto.VisitDate) < DateTimeHelper.TodayUtc.AddDays(-1))
            {
                throw new ValidationException("Visits cannot be scheduled in the past.");
            }

            var code = (dto.PassCode ?? string.Empty).Trim().ToUpperInvariant();
            if (code.Length > 0 && (await Repository.FindAsync(v => v.PassCode == code && (existing == null || v.Id != existing.Id))).Any())
            {
                throw new ConflictException("This visitor pass code is already in use.");
            }
        }
    }

    /// <summary>Member / staff QR access credentials (Access Control).</summary>
    public class AccessCredentialService : CrudServiceBase<AccessCredential, AccessCredentialDto>, IAccessCredentialService
    {
        public AccessCredentialService(ServiceContext context) : base(context) { }

        protected override string EntityName => "Access credential";
        protected override string ModuleKey => "access";
        protected override string IdPrefix => "ACR";

        protected override Expression<Func<AccessCredential, bool>> IdEquals(string id) => e => e.Id == id;
        protected override string KeyOf(AccessCredential entity) => entity.Id;
        protected override void SetKey(AccessCredential entity, string id) => entity.Id = id;

        protected override Expression<Func<AccessCredential, bool>>? MemberFilter(CurrentUserContext user)
        {
            var memberId = user.MemberId;
            return e => e.HolderId == memberId;
        }

        protected override Expression<Func<AccessCredential, bool>>? LocationFilter(IReadOnlyCollection<string> locationIds) => e => locationIds.Contains(e.LocationId);
        protected override string? LocationOf(AccessCredential entity) => entity.LocationId;

        protected override bool MemberCanCreate(AccessCredential entity, CurrentUserContext user) => entity.HolderId == user.MemberId && entity.HolderType == "MEMBER";
        protected override bool MemberCanUpdate(AccessCredential existing, CurrentUserContext user) => existing.HolderId == user.MemberId;

        /// <summary>
        /// Membership flows keep the QR credential in line with the subscription. When that sync comes from the
        /// member's own browser the status is recomputed here from the stored subscription, so a member can never
        /// re-enable a credential that was revoked for a paused or overdue plan.
        /// </summary>
        protected override async Task OnSavingAsync(AccessCredential entity, AccessCredentialDto dto, bool isNew, CurrentUserContext user)
        {
            if (!user.IsMember || entity.HolderType != "MEMBER")
            {
                return;
            }

            var subs = await Repo<Subscription>().FindAsync(s => s.MemberId == entity.HolderId);
            var state = MembershipRules.AccessState(MembershipRules.Current(subs), DateTimeHelper.TodayUtc);
            entity.Status = state is "ACTIVE" or "OVERDUE" ? "ACTIVE" : state == "EXPIRED" ? "EXPIRED" : "REVOKED";
            entity.RevokedReason = state == "SUSPENDED" ? "Plan paused / suspended" : state == "EXPIRED" ? "No active plan" : null;
        }

        protected override IEnumerable<string?> SearchValues(AccessCredentialDto dto) => new[] { dto.Id, dto.HolderName, dto.Code };

        protected override AccessCredentialDto ToDto(AccessCredential e) => new()
        {
            Id = e.Id,
            HolderId = e.HolderId,
            HolderName = e.HolderName,
            HolderType = e.HolderType,
            LocationId = e.LocationId,
            Code = e.Code,
            Status = e.Status,
            IssuedAt = DateTimeHelper.ToIso(e.IssuedAt),
            ValidUntil = DateTimeHelper.ToDateString(e.ValidUntil),
            AccessHours = e.AccessHours,
            RevokedReason = e.RevokedReason,
        };

        protected override void MapToEntity(AccessCredentialDto dto, AccessCredential e, bool isNew)
        {
            e.HolderId = dto.HolderId;
            e.HolderName = dto.HolderName;
            e.HolderType = dto.HolderType;
            e.LocationId = dto.LocationId;
            e.Code = dto.Code.Trim().ToUpperInvariant();
            e.Status = dto.Status;
            e.IssuedAt = DateTimeHelper.ParseUtc(dto.IssuedAt) ?? DateTime.UtcNow;
            e.ValidUntil = DateTimeHelper.RequireDate(dto.ValidUntil, "Valid until");
            e.AccessHours = dto.AccessHours ?? string.Empty;
            e.RevokedReason = dto.RevokedReason;
        }

        protected override async Task ValidateAsync(AccessCredentialDto dto, AccessCredential? existing, CurrentUserContext user)
        {
            new ValidationHelper.Collector()
                .Required(dto.HolderId, "Holder")
                .Required(dto.HolderName, "Holder name")
                .OneOf(dto.HolderType, new[] { "MEMBER", "VISITOR", "STAFF" }, "Holder type")
                .Required(dto.Code, "Code")
                .OneOf(dto.Status, new[] { "ACTIVE", "REVOKED", "EXPIRED" }, "Status")
                .Must(DateTimeHelper.ParseDate(dto.ValidUntil) != null, "Valid until must be a date.")
                .ThrowIfInvalid();

            var code = dto.Code.Trim().ToUpperInvariant();
            if ((await Repository.FindAsync(c => c.Code == code && (existing == null || c.Id != existing.Id))).Any())
            {
                throw new ConflictException("This access code is already issued.");
            }
        }
    }

    /// <summary>Door access log. Append-only: written by QR scans, check-ins and check-outs.</summary>
    public class AccessLogService : CrudServiceBase<AccessLog, AccessLogDto>, IAccessLogService
    {
        public AccessLogService(ServiceContext context) : base(context) { }

        protected override string EntityName => "Access log";
        protected override string ModuleKey => "access";
        protected override string IdPrefix => "LOG";
        protected override bool AnyStaffCanCreate => true;
        protected override bool AllowDelete => false;

        protected override Expression<Func<AccessLog, bool>> IdEquals(string id) => e => e.Id == id;
        protected override string KeyOf(AccessLog entity) => entity.Id;
        protected override void SetKey(AccessLog entity, string id) => entity.Id = id;

        protected override Expression<Func<AccessLog, bool>>? MemberFilter(CurrentUserContext user)
        {
            var memberId = user.MemberId;
            return e => e.PersonId == memberId;
        }

        protected override Expression<Func<AccessLog, bool>>? LocationFilter(IReadOnlyCollection<string> locationIds) => e => locationIds.Contains(e.LocationId);
        protected override string? LocationOf(AccessLog entity) => entity.LocationId;

        protected override bool MemberCanCreate(AccessLog entity, CurrentUserContext user) => entity.PersonId == user.MemberId;

        protected override IEnumerable<string?> SearchValues(AccessLogDto dto) => new[] { dto.Id, dto.Person, dto.Door, dto.Reason };
        protected override IEnumerable<AccessLogDto> DefaultOrder(IEnumerable<AccessLogDto> items) => items.OrderByDescending(l => l.At);

        protected override AccessLogDto ToDto(AccessLog e) => new()
        {
            Id = e.Id,
            Person = e.Person,
            PersonType = e.PersonType,
            PersonId = e.PersonId,
            LocationId = e.LocationId,
            Door = e.Door,
            At = DateTimeHelper.ToIso(e.LoggedAt),
            Direction = e.Direction,
            Status = e.Status,
            Reason = e.Reason,
        };

        protected override void MapToEntity(AccessLogDto dto, AccessLog e, bool isNew)
        {
            e.Person = dto.Person;
            e.PersonType = dto.PersonType;
            e.PersonId = dto.PersonId;
            e.LocationId = dto.LocationId;
            e.Door = dto.Door;
            e.LoggedAt = DateTimeHelper.ParseUtc(dto.At) ?? DateTime.UtcNow;
            e.Direction = dto.Direction;
            e.Status = dto.Status;
            e.Reason = dto.Reason;
        }

        protected override Task ValidateAsync(AccessLogDto dto, AccessLog? existing, CurrentUserContext user)
        {
            new ValidationHelper.Collector()
                .Required(dto.Person, "Person")
                .OneOf(dto.PersonType, new[] { "MEMBER", "VISITOR", "STAFF" }, "Person type")
                .Required(dto.LocationId, "Location")
                .Required(dto.Door, "Door")
                .OneOf(dto.Direction, new[] { "IN", "OUT" }, "Direction")
                .OneOf(dto.Status, new[] { "GRANTED", "DENIED" }, "Status")
                .ThrowIfInvalid();
            return Task.CompletedTask;
        }
    }

    /// <summary>Support tickets with comments, attachments and timeline.</summary>
    public class TicketService : CrudServiceBase<Ticket, TicketDto>, ITicketService
    {
        private static readonly string[] Priorities = { "LOW", "MEDIUM", "HIGH", "URGENT" };
        private static readonly string[] Statuses = { "OPEN", "IN_PROGRESS", "RESOLVED" };

        public TicketService(ServiceContext context) : base(context) { }

        protected override string EntityName => "Ticket";
        protected override string ModuleKey => "support";
        protected override string IdPrefix => "TKT";

        protected override Expression<Func<Ticket, bool>> IdEquals(string id) => e => e.Id == id;
        protected override string KeyOf(Ticket entity) => entity.Id;
        protected override void SetKey(Ticket entity, string id) => entity.Id = id;

        protected override Expression<Func<Ticket, bool>>? MemberFilter(CurrentUserContext user)
        {
            var memberId = user.MemberId;
            return e => e.MemberId == memberId;
        }

        protected override Expression<Func<Ticket, bool>>? LocationFilter(IReadOnlyCollection<string> locationIds) => e => locationIds.Contains(e.LocationId);
        protected override string? LocationOf(Ticket entity) => entity.LocationId;

        protected override bool MemberCanCreate(Ticket entity, CurrentUserContext user) => entity.MemberId == user.MemberId;
        protected override bool MemberCanUpdate(Ticket existing, CurrentUserContext user) => existing.MemberId == user.MemberId;

        /// <summary>Members add comments/attachments and may reopen or close their ticket; assignment and escalation stay with staff.</summary>
        protected override void ApplyMemberUpdate(TicketDto dto, Ticket e, CurrentUserContext user)
        {
            e.AttachmentsJson = JsonHelper.Serialize(dto.Attachments ?? new());
            e.CommentsJson = JsonHelper.Serialize(dto.Comments ?? new());
            e.TimelineJson = JsonHelper.Serialize(dto.Timeline ?? new());
            if (Statuses.Contains(dto.Status))
            {
                e.Status = dto.Status;
                e.ResolvedAt = dto.Status == "RESOLVED" ? DateTimeHelper.ParseUtc(dto.ResolvedAt) ?? DateTime.UtcNow : null;
            }
        }

        protected override IEnumerable<string?> SearchValues(TicketDto dto) => new[] { dto.Id, dto.Subject, dto.Category, dto.Description };
        protected override IEnumerable<TicketDto> DefaultOrder(IEnumerable<TicketDto> items) => items.OrderByDescending(t => t.CreatedAt);

        protected override TicketDto ToDto(Ticket e) => new()
        {
            Id = e.Id,
            MemberId = e.MemberId,
            LocationId = e.LocationId,
            Category = e.Category,
            Subject = e.Subject,
            Description = e.Description,
            Priority = e.Priority,
            Status = e.Status,
            AssignedTo = e.AssignedTo,
            CreatedAt = DateTimeHelper.ToIso(e.CreatedDate),
            UpdatedAt = DateTimeHelper.ToIso(e.ModifiedDate ?? e.CreatedDate),
            ResolvedAt = DateTimeHelper.ToIso(e.ResolvedAt),
            Escalated = e.Escalated,
            EscalatedTo = e.EscalatedTo,
            Attachments = JsonHelper.DeserializeList<AttachmentDto>(e.AttachmentsJson),
            Comments = JsonHelper.DeserializeList<CommentDto>(e.CommentsJson),
            Timeline = JsonHelper.DeserializeList<TimelineEntryDto>(e.TimelineJson),
        };

        protected override void MapToEntity(TicketDto dto, Ticket e, bool isNew)
        {
            e.MemberId = dto.MemberId;
            e.LocationId = dto.LocationId;
            e.Category = dto.Category;
            e.Subject = dto.Subject.Trim();
            e.Description = dto.Description ?? string.Empty;
            e.Priority = dto.Priority;
            e.Status = dto.Status;
            e.AssignedTo = string.IsNullOrWhiteSpace(dto.AssignedTo) ? null : dto.AssignedTo;
            e.ResolvedAt = DateTimeHelper.ParseUtc(dto.ResolvedAt);
            e.Escalated = dto.Escalated;
            e.EscalatedTo = dto.EscalatedTo;
            e.AttachmentsJson = JsonHelper.Serialize(dto.Attachments ?? new());
            e.CommentsJson = JsonHelper.Serialize(dto.Comments ?? new());
            e.TimelineJson = JsonHelper.Serialize(dto.Timeline ?? new());
        }

        protected override async Task ValidateAsync(TicketDto dto, Ticket? existing, CurrentUserContext user)
        {
            new ValidationHelper.Collector()
                .Required(dto.MemberId, "Member")
                .Required(dto.LocationId, "Location")
                .Required(dto.Category, "Category")
                .Required(dto.Subject, "Subject").MaxLength(dto.Subject, 200, "Subject")
                .MaxLength(dto.Description, 4000, "Description")
                .OneOf(dto.Priority, Priorities, "Priority")
                .OneOf(dto.Status, Statuses, "Status")
                .ThrowIfInvalid();

            if (!string.IsNullOrWhiteSpace(dto.AssignedTo) && !user.IsMember
                && !(await Repo<User>().FindAsync(u => u.Id == dto.AssignedTo && u.RoleKey != RoleKeys.Member)).Any())
            {
                throw new ValidationException("Tickets can only be assigned to staff users.");
            }
        }
    }
}
