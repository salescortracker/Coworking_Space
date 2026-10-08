namespace officera.BusinessAccessLayer.DTOs
{
    /// <summary>Frontend: Member.</summary>
    public class MemberDto : IEntityDto
    {
        public string Id { get; set; } = string.Empty;
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Mobile { get; set; } = string.Empty;
        public string? CompanyId { get; set; }
        public string Designation { get; set; } = string.Empty;
        public string LocationId { get; set; } = string.Empty;
        public string Status { get; set; } = "PENDING";
        public string JoinDate { get; set; } = string.Empty;
        public bool DirectoryVisible { get; set; }
        public string Bio { get; set; } = string.Empty;
        public List<string> Skills { get; set; } = new();
        public string? LeadId { get; set; }
        public string? Photo { get; set; }
        public decimal? ReferralCredit { get; set; }
        public bool? ProfileCompleted { get; set; }
        public string? CreatedAt { get; set; }
    }

    /// <summary>Frontend: Company.</summary>
    public class CompanyDto : IEntityDto
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Gstin { get; set; } = string.Empty;
        public string BillingAddress { get; set; } = string.Empty;
        public string State { get; set; } = string.Empty;
        public string Industry { get; set; } = string.Empty;
        public string Size { get; set; } = string.Empty;
        public string Website { get; set; } = string.Empty;
        public string LocationId { get; set; } = string.Empty;
        public string? PrimaryContactId { get; set; }
    }

    /// <summary>Frontend: User. Never carries a password or hash.</summary>
    public class UserDto : IEntityDto
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Mobile { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public List<string> LocationIds { get; set; } = new();
        public string Status { get; set; } = "ACTIVE";
        public string? MemberId { get; set; }
        public string? LastLogin { get; set; }
        public string? CreatedAt { get; set; }
        /// <summary>Set while the account is locked after too many failed sign-ins.</summary>
        public string? LockedUntil { get; set; }
    }

    /// <summary>Frontend: RoleDefinition.</summary>
    public class RoleDto : IEntityDto
    {
        public string Id { get; set; } = string.Empty;
        public string Key { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public List<string> Permissions { get; set; } = new();
        public bool System { get; set; }
    }

    /// <summary>Frontend: Permission.</summary>
    public class PermissionDto
    {
        public string Key { get; set; } = string.Empty;
        public string Module { get; set; } = string.Empty;
        public string Action { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
    }
}
