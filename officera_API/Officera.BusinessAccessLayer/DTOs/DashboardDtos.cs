namespace officera.BusinessAccessLayer.DTOs
{
    public class DashboardRequest
    {
        public List<string>? LocationIds { get; set; }
        public string? From { get; set; }
        public string? To { get; set; }
    }

    public class ChartPointDto
    {
        public string Label { get; set; } = string.Empty;
        public decimal Value { get; set; }
    }

    /// <summary>KPI cards and charts for the operator dashboard, calculated from the database.</summary>
    public class DashboardSummaryDto
    {
        public int TotalMembers { get; set; }
        public int ActiveMembers { get; set; }
        public int ActiveSubscriptions { get; set; }
        public int TodaysBookings { get; set; }
        public int BookingsInRange { get; set; }
        public int TodaysVisitors { get; set; }
        public int OpenTickets { get; set; }
        public int NewLeads { get; set; }
        public decimal MonthRevenue { get; set; }
        public decimal RevenueInRange { get; set; }
        public decimal Outstanding { get; set; }
        public int OutstandingInvoices { get; set; }
        public int FailedPayments { get; set; }
        public decimal ChurnRate { get; set; }
        public int OccupancyNow { get; set; }
        public List<ChartPointDto> RevenueByMonth { get; set; } = new();
        public List<ChartPointDto> BookingsByType { get; set; } = new();
        public List<ChartPointDto> MembershipDistribution { get; set; } = new();
        public List<ChartPointDto> LeadFunnel { get; set; } = new();
    }
}
