using System;
using System.Collections.Generic;

namespace officera.DataAccessLayer.Entities;

public partial class OrgSetting
{
    public int Id { get; set; }

    public string LegalName { get; set; } = null!;

    public string Gstin { get; set; } = null!;

    public string Address { get; set; } = null!;

    public string State { get; set; } = null!;

    public string StateCode { get; set; } = null!;

    public string Pan { get; set; } = null!;

    public string Email { get; set; } = null!;

    public string Phone { get; set; } = null!;

    public decimal GstRate { get; set; }

    public int SlotLockMinutes { get; set; }

    public int FreeCancellationHours { get; set; }

    public int TicketEscalationHours { get; set; }

    public string PaymentRetryDays { get; set; } = null!;

    public int GracePeriodDays { get; set; }

    public int BookingReminderMinutes { get; set; }

    public int RenewalReminderDays { get; set; }

    public int MaxLoginAttempts { get; set; }

    public int LockoutMinutes { get; set; }

    public string Currency { get; set; } = null!;

    public string Timezone { get; set; } = null!;

    public string? CreatedBy { get; set; }

    public DateTime CreatedDate { get; set; }

    public string? ModifiedBy { get; set; }

    public DateTime? ModifiedDate { get; set; }
}
