using System.Linq.Expressions;
using Microsoft.Extensions.Logging;
using officera.BusinessAccessLayer.DTOs;
using officera.BusinessAccessLayer.Interfaces;
using officera.DataAccessLayer.Entities;
using officera.DataAccessLayer.Repositories;
using officera.Shared.Common;

namespace officera.BusinessAccessLayer.Services
{
    /// <summary>In-app notifications (bell menu, notification centre).</summary>
    public class NotificationDataService : CrudServiceBase<Notification, NotificationDto>, INotificationDataService
    {
        private static readonly string[] Categories = { "BOOKING", "PAYMENT", "MEMBERSHIP", "VISITOR", "SUPPORT", "SYSTEM" };

        public NotificationDataService(ServiceContext context) : base(context) { }

        protected override string EntityName => "Notification";
        protected override string ModuleKey => "notifications";
        protected override string IdPrefix => "NTF";
        protected override ReadAccess ReadAccess => ReadAccess.Authenticated;

        /// <summary>Every business event raises notifications as a side effect, whoever performs it.</summary>
        protected override bool AnyStaffCanCreate => true;

        protected override Expression<Func<Notification, bool>> IdEquals(string id) => e => e.Id == id;
        protected override string KeyOf(Notification entity) => entity.Id;
        protected override void SetKey(Notification entity, string id) => entity.Id = id;

        protected override Expression<Func<Notification, bool>>? MemberFilter(CurrentUserContext user)
        {
            var userId = user.UserId;
            return e => e.Audience == "MEMBER" && (e.UserId == null || e.UserId == userId);
        }

        /// <summary>Staff only see staff notifications (theirs or broadcast).</summary>
        public override async Task<PagedResult<NotificationDto>> GetAsync(PagedRequest request)
        {
            var user = await CurrentUser.GetContextAsync();
            var result = await base.GetAsync(request);
            if (user.IsStaff)
            {
                result.Items = result.Items.Where(n => n.Audience == "STAFF" && (n.UserId == null || n.UserId == user.UserId)).ToList();
                result.TotalCount = result.Items.Count;
            }

            return result;
        }

        protected override bool MemberCanCreate(Notification entity, CurrentUserContext user) => true;
        protected override bool MemberCanUpdate(Notification existing, CurrentUserContext user) => existing.UserId == null || existing.UserId == user.UserId;
        protected override bool AnyStaffCanUpdate => true;

        protected override void ApplyMemberUpdate(NotificationDto dto, Notification e, CurrentUserContext user) => e.IsRead = dto.Read;

        protected override IEnumerable<NotificationDto> DefaultOrder(IEnumerable<NotificationDto> items) => items.OrderByDescending(n => n.At);
        protected override IEnumerable<string?> SearchValues(NotificationDto dto) => new[] { dto.Title, dto.Message };

        protected override NotificationDto ToDto(Notification e) => new()
        {
            Id = e.Id,
            Audience = e.Audience,
            UserId = e.UserId,
            Category = e.Category,
            Title = e.Title,
            Message = e.Message,
            At = DateTimeHelper.ToIso(e.NotifiedAt),
            Read = e.IsRead,
            Link = e.Link,
        };

        protected override void MapToEntity(NotificationDto dto, Notification e, bool isNew)
        {
            e.Audience = dto.Audience;
            e.UserId = string.IsNullOrWhiteSpace(dto.UserId) ? null : dto.UserId;
            e.Category = dto.Category;
            e.Title = dto.Title;
            e.Message = dto.Message;
            e.NotifiedAt = isNew ? DateTime.UtcNow : DateTimeHelper.ParseUtc(dto.At) ?? e.NotifiedAt;
            e.IsRead = dto.Read;
            e.Link = dto.Link;
        }

        protected override Task ValidateAsync(NotificationDto dto, Notification? existing, CurrentUserContext user)
        {
            new ValidationHelper.Collector()
                .OneOf(dto.Audience, new[] { "MEMBER", "STAFF" }, "Audience")
                .OneOf(dto.Category, Categories, "Category")
                .Required(dto.Title, "Title")
                .Required(dto.Message, "Message")
                .ThrowIfInvalid();
            return Task.CompletedTask;
        }
    }

    public class NotificationTemplateService : CrudServiceBase<NotificationTemplate, NotificationTemplateDto>, INotificationTemplateService
    {
        public NotificationTemplateService(ServiceContext context) : base(context) { }

        protected override string EntityName => "Notification template";
        protected override string ModuleKey => "notifications";
        protected override string IdPrefix => "TPL";

        /// <summary>Templates are read by the notification centre while dispatching events from any portal.</summary>
        protected override ReadAccess ReadAccess => ReadAccess.Authenticated;

        protected override Expression<Func<NotificationTemplate, bool>> IdEquals(string id) => e => e.Id == id;
        protected override string KeyOf(NotificationTemplate entity) => entity.Id;
        protected override void SetKey(NotificationTemplate entity, string id) => entity.Id = id;

        protected override IEnumerable<string?> SearchValues(NotificationTemplateDto dto) => new[] { dto.Name, dto.Event, dto.Subject };
        protected override IEnumerable<NotificationTemplateDto> DefaultOrder(IEnumerable<NotificationTemplateDto> items) => items.OrderBy(t => t.Name);

        protected override NotificationTemplateDto ToDto(NotificationTemplate e) => new()
        {
            Id = e.Id,
            Name = e.Name,
            Event = e.EventName,
            Channel = e.Channel,
            Subject = e.Subject,
            Message = e.Message,
            Status = e.Status,
            UpdatedAt = DateTimeHelper.ToIso(e.ModifiedDate ?? e.CreatedDate),
        };

        protected override void MapToEntity(NotificationTemplateDto dto, NotificationTemplate e, bool isNew)
        {
            e.Name = dto.Name.Trim();
            e.EventName = dto.Event;
            e.Channel = dto.Channel;
            e.Subject = dto.Subject ?? string.Empty;
            e.Message = dto.Message;
            e.Status = dto.Status;
        }

        protected override async Task ValidateAsync(NotificationTemplateDto dto, NotificationTemplate? existing, CurrentUserContext user)
        {
            new ValidationHelper.Collector()
                .Required(dto.Name, "Name")
                .Required(dto.Event, "Event")
                .OneOf(dto.Channel, new[] { "EMAIL", "SMS", "PUSH" }, "Channel")
                .Required(dto.Message, "Message").MaxLength(dto.Message, 4000, "Message")
                .Must(dto.Channel != "EMAIL" || !string.IsNullOrWhiteSpace(dto.Subject), "E-mail templates need a subject.")
                .OneOf(dto.Status, new[] { "ACTIVE", "INACTIVE" }, "Status")
                .ThrowIfInvalid();

            var name = dto.Name.Trim();
            if ((await Repository.FindAsync(t => t.Name == name && (existing == null || t.Id != existing.Id))).Any())
            {
                throw new ConflictException("A template with this name already exists.");
            }
        }
    }

    /// <summary>Delivery log (one row per channel per notification).</summary>
    public class NotificationLogService : CrudServiceBase<NotificationLog, NotificationLogDto>, INotificationLogService
    {
        public NotificationLogService(ServiceContext context) : base(context) { }

        protected override string EntityName => "Notification log";
        protected override string ModuleKey => "notifications";
        protected override string IdPrefix => "NLG";
        protected override bool AnyStaffCanCreate => true;
        protected override bool AllowDelete => false;

        protected override Expression<Func<NotificationLog, bool>> IdEquals(string id) => e => e.Id == id;
        protected override string KeyOf(NotificationLog entity) => entity.Id;
        protected override void SetKey(NotificationLog entity, string id) => entity.Id = id;

        protected override Expression<Func<NotificationLog, bool>>? LocationFilter(IReadOnlyCollection<string> locationIds) =>
            e => e.LocationId == null || locationIds.Contains(e.LocationId);

        protected override string? LocationOf(NotificationLog entity) => entity.LocationId;

        /// <summary>Members' actions log deliveries, but members never read the log.</summary>
        protected override bool MemberCanCreate(NotificationLog entity, CurrentUserContext user) => true;

        protected override IEnumerable<string?> SearchValues(NotificationLogDto dto) => new[] { dto.Event, dto.TemplateName, dto.Recipient, dto.Provider };
        protected override IEnumerable<NotificationLogDto> DefaultOrder(IEnumerable<NotificationLogDto> items) => items.OrderByDescending(l => l.At);

        protected override NotificationLogDto ToDto(NotificationLog e) => new()
        {
            Id = e.Id,
            Event = e.EventName,
            TemplateName = e.TemplateName,
            Channel = e.Channel,
            Recipient = e.Recipient,
            At = DateTimeHelper.ToIso(e.LoggedAt),
            Status = e.Status,
            Provider = e.Provider,
            LocationId = e.LocationId,
        };

        protected override void MapToEntity(NotificationLogDto dto, NotificationLog e, bool isNew)
        {
            e.EventName = dto.Event;
            e.TemplateName = dto.TemplateName;
            e.Channel = dto.Channel;
            e.Recipient = dto.Recipient;
            e.LoggedAt = DateTimeHelper.ParseUtc(dto.At) ?? DateTime.UtcNow;
            e.Status = dto.Status;
            e.Provider = dto.Provider;
            e.LocationId = string.IsNullOrWhiteSpace(dto.LocationId) ? null : dto.LocationId;
        }

        protected override Task ValidateAsync(NotificationLogDto dto, NotificationLog? existing, CurrentUserContext user)
        {
            new ValidationHelper.Collector()
                .Required(dto.Event, "Event")
                .OneOf(dto.Channel, new[] { "EMAIL", "SMS", "PUSH" }, "Channel")
                .OneOf(dto.Status, new[] { "DELIVERED", "FAILED", "QUEUED" }, "Status")
                .ThrowIfInvalid();
            return Task.CompletedTask;
        }
    }

    /// <summary>Audit trail. User, role, IP and device are taken from the request, never from the browser payload.</summary>
    public class AuditLogService : CrudServiceBase<AuditLog, AuditLogDto>, IAuditLogService
    {
        private static readonly string[] Actions = { "CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT", "EXPORT", "APPROVE", "STATUS_CHANGE" };

        public AuditLogService(ServiceContext context) : base(context) { }

        protected override string EntityName => "Audit log";
        protected override string ModuleKey => "audit";
        protected override string IdPrefix => "AUD";
        protected override ReadAccess ReadAccess => ReadAccess.Permission;
        protected override bool AnyStaffCanCreate => true;
        protected override bool AllowDelete => false;

        protected override Expression<Func<AuditLog, bool>> IdEquals(string id) => e => e.Id == id;
        protected override string KeyOf(AuditLog entity) => entity.Id;
        protected override void SetKey(AuditLog entity, string id) => entity.Id = id;

        protected override bool MemberCanCreate(AuditLog entity, CurrentUserContext user) => true;
        protected override IEnumerable<string?> SearchValues(AuditLogDto dto) => new[] { dto.User, dto.Module, dto.Entity, dto.EntityId, dto.Description };
        protected override IEnumerable<AuditLogDto> DefaultOrder(IEnumerable<AuditLogDto> items) => items.OrderByDescending(a => a.At);

        public override Task<AuditLogDto> UpdateAsync(AuditLogDto dto) => throw new ForbiddenException("Audit records cannot be changed.");

        protected override AuditLogDto ToDto(AuditLog e) => new()
        {
            Id = e.Id,
            User = e.UserName,
            Role = e.RoleName,
            Action = e.Action,
            Module = e.Module,
            Entity = e.Entity,
            EntityId = e.EntityId,
            At = DateTimeHelper.ToIso(e.LoggedAt),
            Ip = e.IpAddress,
            Device = e.Device,
            Description = e.Description,
        };

        protected override void MapToEntity(AuditLogDto dto, AuditLog e, bool isNew)
        {
            e.Action = dto.Action;
            e.Module = dto.Module;
            e.Entity = dto.Entity;
            e.EntityId = dto.EntityId;
            e.Description = dto.Description;
            e.LoggedAt = DateTime.UtcNow;
            e.UserId = CurrentUser.UserId;
            e.IpAddress = CurrentUser.IpAddress ?? string.Empty;
            e.Device = ClaimsHelper.DeviceFromUserAgent(CurrentUser.UserAgent);
        }

        protected override Task OnSavingAsync(AuditLog entity, AuditLogDto dto, bool isNew, CurrentUserContext user)
        {
            entity.UserName = string.IsNullOrEmpty(user.Name) ? "System" : user.Name;
            entity.RoleName = RoleLabels.For(user.Role);
            return Task.CompletedTask;
        }

        protected override Task ValidateAsync(AuditLogDto dto, AuditLog? existing, CurrentUserContext user)
        {
            new ValidationHelper.Collector()
                .OneOf(dto.Action, Actions, "Action")
                .Required(dto.Module, "Module")
                .Required(dto.Entity, "Entity")
                .Required(dto.Description, "Description")
                .ThrowIfInvalid();
            return Task.CompletedTask;
        }
    }

    public static class RoleLabels
    {
        public static string For(string? role) => role switch
        {
            RoleKeys.SuperAdmin => "Super Admin",
            RoleKeys.LocationManager => "Location Manager",
            RoleKeys.FrontDesk => "Front Desk",
            RoleKeys.Finance => "Finance",
            RoleKeys.Member => "Member",
            _ => "System",
        };
    }

    /// <summary>
    /// Server-side notification dispatch used by flows that run on the server (sign-up, website enquiries):
    /// creates the in-app notification, sends through the active e-mail / SMS providers and logs every delivery.
    /// </summary>
    public class NotificationService : INotificationService
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly IIdSequenceService _ids;
        private readonly IEmailService _email;
        private readonly ISmsService _sms;
        private readonly ILogger<NotificationService> _logger;

        public NotificationService(IUnitOfWork unitOfWork, IIdSequenceService ids, IEmailService email, ISmsService sms, ILogger<NotificationService> logger)
        {
            _unitOfWork = unitOfWork;
            _ids = ids;
            _email = email;
            _sms = sms;
            _logger = logger;
        }

        public async Task<bool> SendDirectAsync(string eventName, string? email, string? mobile, string subject, string text, string? locationId)
        {
            var results = new List<(string Channel, string Recipient, DeliveryResult Result)>();
            if (!string.IsNullOrWhiteSpace(email))
            {
                results.Add(("EMAIL", email, await SafeSendAsync(() => _email.SendAsync(email, subject, text))));
            }

            if (!string.IsNullOrWhiteSpace(mobile))
            {
                results.Add(("SMS", mobile, await SafeSendAsync(() => _sms.SendAsync(mobile, text))));
            }

            var ids = new List<string>();
            foreach (var _ in results)
            {
                ids.Add(await _ids.NextIdAsync("NLG"));
            }

            for (var i = 0; i < results.Count; i++)
            {
                var (channel, recipient, result) = results[i];
                await _unitOfWork.Repository<NotificationLog>().AddAsync(new NotificationLog
                {
                    Id = ids[i],
                    EventName = eventName,
                    TemplateName = $"{eventName} – {channel}",
                    Channel = channel,
                    Recipient = recipient,
                    LoggedAt = DateTime.UtcNow,
                    Status = result.Sent ? "DELIVERED" : result.Error != null ? "FAILED" : "QUEUED",
                    Provider = result.Provider,
                    LocationId = locationId,
                });
            }

            await _unitOfWork.CompleteAsync();
            return results.Any(r => r.Result.Sent);
        }

        private async Task<DeliveryResult> SafeSendAsync(Func<Task<DeliveryResult>> send)
        {
            try
            {
                return await send();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Direct message delivery failed");
                return new DeliveryResult(false, "Provider error", ex.Message);
            }
        }

        public async Task DispatchAsync(NotificationMessage message)
        {
            var templates = (await _unitOfWork.Repository<NotificationTemplate>().FindAsync(t => t.Status == "ACTIVE")).ToList();
            var notificationId = await _ids.NextIdAsync("NTF");
            var logIds = new List<string>();
            foreach (var _ in message.Channels)
            {
                logIds.Add(await _ids.NextIdAsync("NLG"));
            }

            await _unitOfWork.Repository<Notification>().AddAsync(new Notification
            {
                Id = notificationId,
                Audience = message.Audience,
                UserId = message.UserId,
                Category = message.Category,
                Title = message.Title,
                Message = message.Message,
                NotifiedAt = DateTime.UtcNow,
                Link = message.Link,
            });

            var index = 0;
            foreach (var channel in message.Channels)
            {
                var template = templates.FirstOrDefault(t => t.EventName.StartsWith(message.Event, StringComparison.OrdinalIgnoreCase) && t.Channel == channel);
                DeliveryResult result;
                string recipient;
                try
                {
                    switch (channel)
                    {
                        case "EMAIL" when !string.IsNullOrEmpty(message.Email):
                            recipient = message.Email!;
                            result = await _email.SendAsync(recipient, template?.Subject is { Length: > 0 } s ? s : message.Title, message.Message);
                            break;
                        case "SMS" when !string.IsNullOrEmpty(message.Mobile):
                            recipient = message.Mobile!;
                            result = await _sms.SendAsync(recipient, message.Message);
                            break;
                        case "PUSH":
                            recipient = message.UserId ?? "broadcast";
                            result = new DeliveryResult(true, "In-app");
                            break;
                        default:
                            recipient = "—";
                            result = new DeliveryResult(false, "No recipient");
                            break;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Delivery of {Event} over {Channel} failed", message.Event, channel);
                    recipient = channel == "EMAIL" ? message.Email ?? "—" : message.Mobile ?? "—";
                    result = new DeliveryResult(false, "Provider error", ex.Message);
                }

                await _unitOfWork.Repository<NotificationLog>().AddAsync(new NotificationLog
                {
                    Id = logIds[index++],
                    EventName = message.Event,
                    TemplateName = template?.Name ?? $"{message.Event} – {channel}",
                    Channel = channel,
                    Recipient = recipient,
                    LoggedAt = DateTime.UtcNow,
                    Status = result.Sent ? "DELIVERED" : result.Error != null ? "FAILED" : "QUEUED",
                    Provider = result.Provider,
                    LocationId = message.LocationId,
                });
            }

            await _unitOfWork.CompleteAsync();
        }
    }
}
