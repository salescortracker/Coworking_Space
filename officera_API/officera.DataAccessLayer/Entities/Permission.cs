using System;
using System.Collections.Generic;

namespace officera.DataAccessLayer.Entities;

public partial class Permission
{
    public string PermissionKey { get; set; } = null!;

    public string Module { get; set; } = null!;

    public string ModuleKey { get; set; } = null!;

    public string Action { get; set; } = null!;

    public string Label { get; set; } = null!;

    public int SortOrder { get; set; }

    public virtual ICollection<RolePermission> RolePermissions { get; set; } = new List<RolePermission>();
}
