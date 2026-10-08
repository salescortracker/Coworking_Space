using System;
using System.Collections.Generic;

namespace officera.DataAccessLayer.Entities;

public partial class State
{
    public string StateCode { get; set; } = null!;

    public string Name { get; set; } = null!;

    public int SortOrder { get; set; }

    public bool IsActive { get; set; }
}
