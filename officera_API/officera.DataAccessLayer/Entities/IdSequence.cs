using System;
using System.Collections.Generic;

namespace officera.DataAccessLayer.Entities;

public partial class IdSequence
{
    public string Prefix { get; set; } = null!;

    public int LastValue { get; set; }

    public byte[] RowVersion { get; set; } = null!;
}
