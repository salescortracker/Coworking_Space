namespace officera.BusinessAccessLayer.DTOs
{
    /// <summary>Frontend: Visitor.</summary>
    public class VisitorDto : IEntityDto
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Mobile { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? Company { get; set; }
        public string HostMemberId { get; set; } = string.Empty;
        public string LocationId { get; set; } = string.Empty;
        public string VisitDate { get; set; } = string.Empty;
        public string VisitTime { get; set; } = string.Empty;
        public string Purpose { get; set; } = string.Empty;
        public string Status { get; set; } = "EXPECTED";
        public string PassCode { get; set; } = string.Empty;
        public bool PhotoCaptured { get; set; }
        public bool HostNotified { get; set; }
        public string? CheckInAt { get; set; }
        public string? CheckOutAt { get; set; }
        public string? CreatedAt { get; set; }
        public List<string> NotifiedVia { get; set; } = new();
    }

    /// <summary>Frontend: AccessCredential.</summary>
    public class AccessCredentialDto : IEntityDto
    {
        public string Id { get; set; } = string.Empty;
        public string HolderId { get; set; } = string.Empty;
        public string HolderName { get; set; } = string.Empty;
        public string HolderType { get; set; } = "MEMBER";
        public string LocationId { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
        public string Status { get; set; } = "ACTIVE";
        public string IssuedAt { get; set; } = string.Empty;
        public string ValidUntil { get; set; } = string.Empty;
        public string AccessHours { get; set; } = string.Empty;
        public string? RevokedReason { get; set; }
    }

    /// <summary>Frontend: AccessLog.</summary>
    public class AccessLogDto : IEntityDto
    {
        public string Id { get; set; } = string.Empty;
        public string Person { get; set; } = string.Empty;
        public string PersonType { get; set; } = "MEMBER";
        public string PersonId { get; set; } = string.Empty;
        public string LocationId { get; set; } = string.Empty;
        public string Door { get; set; } = string.Empty;
        public string At { get; set; } = string.Empty;
        public string Direction { get; set; } = "IN";
        public string Status { get; set; } = "GRANTED";
        public string? Reason { get; set; }
    }

    /// <summary>Frontend: Ticket.</summary>
    public class TicketDto : IEntityDto
    {
        public string Id { get; set; } = string.Empty;
        public string MemberId { get; set; } = string.Empty;
        public string LocationId { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string Subject { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Priority { get; set; } = "MEDIUM";
        public string Status { get; set; } = "OPEN";
        public string? AssignedTo { get; set; }
        public string? CreatedAt { get; set; }
        public string? UpdatedAt { get; set; }
        public string? ResolvedAt { get; set; }
        public bool Escalated { get; set; }
        public string? EscalatedTo { get; set; }
        public List<AttachmentDto> Attachments { get; set; } = new();
        public List<CommentDto> Comments { get; set; } = new();
        public List<TimelineEntryDto> Timeline { get; set; } = new();
    }

    /// <summary>Frontend: AppNotification.</summary>
    public class NotificationDto : IEntityDto
    {
        public string Id { get; set; } = string.Empty;
        public string Audience { get; set; } = "MEMBER";
        public string? UserId { get; set; }
        public string Category { get; set; } = "SYSTEM";
        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string At { get; set; } = string.Empty;
        public bool Read { get; set; }
        public string? Link { get; set; }
    }

    /// <summary>Frontend: NotificationTemplate.</summary>
    public class NotificationTemplateDto : IEntityDto
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Event { get; set; } = string.Empty;
        public string Channel { get; set; } = "EMAIL";
        public string Subject { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string Status { get; set; } = "ACTIVE";
        public string? UpdatedAt { get; set; }
    }

    /// <summary>Frontend: NotificationLog.</summary>
    public class NotificationLogDto : IEntityDto
    {
        public string Id { get; set; } = string.Empty;
        public string Event { get; set; } = string.Empty;
        public string TemplateName { get; set; } = string.Empty;
        public string Channel { get; set; } = "EMAIL";
        public string Recipient { get; set; } = string.Empty;
        public string At { get; set; } = string.Empty;
        public string Status { get; set; } = "QUEUED";
        public string? Provider { get; set; }
        public string? LocationId { get; set; }
    }

    /// <summary>Frontend: AuditLog. User, role, IP and device are always filled by the server.</summary>
    public class AuditLogDto : IEntityDto
    {
        public string Id { get; set; } = string.Empty;
        public string User { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string Action { get; set; } = string.Empty;
        public string Module { get; set; } = string.Empty;
        public string Entity { get; set; } = string.Empty;
        public string EntityId { get; set; } = string.Empty;
        public string At { get; set; } = string.Empty;
        public string Ip { get; set; } = string.Empty;
        public string Device { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
    }
}
