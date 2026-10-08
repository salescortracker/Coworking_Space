using System;
using System.Collections.Generic;

namespace officera.DataAccessLayer.Entities;

public partial class RolePermission
{
    public string RoleId { get; set; } = null!;

    public string PermissionKey { get; set; } = null!;

    public DateTime CreatedDate { get; set; }

    public virtual Permission PermissionKeyNavigation { get; set; } = null!;

    public virtual Role Role { get; set; } = null!;
}
