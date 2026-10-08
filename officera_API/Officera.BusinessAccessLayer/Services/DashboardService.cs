using System.Globalization;
using officera.BusinessAccessLayer.DTOs;
using officera.BusinessAccessLayer.Interfaces;
using officera.DataAccessLayer.Entities;
using officera.DataAccessLayer.Repositories;
using officera.Shared.Common;

namespace officera.BusinessAccessLayer.Services
{
    /// <summary>
    /// Operator dashboard KPIs and charts, calculated from the database for the caller's locations
    /// (location managers are always limited to their assigned centres).
    /// </summary>
    public class DashboardService : IDashboardService
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly ICurrentUserService _currentUser;

        public DashboardService(IUnitOfWork unitOfWork, ICurrentUserService currentUser)
        {
            _unitOfWork = unitOfWork;
            _currentUser = currentUser;
        }

        public async Task<DashboardSummaryDto> GetSummaryAsync(DashboardRequest request)
        {
            var user = await _currentUser.GetContextAsync();
            if (!user.IsStaff || !(user.Can("dashboard.view") || user.Can("reports.view")))
            {
                throw new ForbiddenException();
            }

            var today = DateTimeHelper.TodayUtc;
            var to = DateTimeHelper.ParseDate(request.To) ?? today;
            var from = DateTimeHelper.ParseDate(request.From) ?? to.AddDays(-29);
            if (from > to)
            {
                throw new ValidationException("The start date must be before the end date.");
            }

            // Location scope: requested locations, narrowed to what a restricted user may see.
            var allLocations = (await _unitOfWork.Repository<Location>().FindAsync(l => true)).Select(l => l.Id).ToList();
            var scope = (request.LocationIds is { Count: > 0 } ? request.LocationIds : allLocations)
                .Where(id => user.CanAccessLocation(id))
                .Distinct()
                .ToList();

            var members = (await _unitOfWork.Repository<Member>().FindAsync(m => scope.Contains(m.LocationId))).ToList();
            var subs = (await _unitOfWork.Repository<Subscription>().FindAsync(s => scope.Contains(s.LocationId))).ToList();
            var bookings = (await _unitOfWork.Repository<Booking>().FindAsync(b => scope.Contains(b.LocationId) && b.Status != "CANCELLED")).ToList();
            var resources = (await _unitOfWork.Repository<Resource>().FindAsync(r => scope.Contains(r.LocationId) && r.Status == "ACTIVE")).ToList();
            var payments = (await _unitOfWork.Repository<Payment>().FindAsync(p => scope.Contains(p.LocationId))).ToList();
            var invoices = (await _unitOfWork.Repository<Invoice>().FindAsync(i => scope.Contains(i.LocationId) && (i.Status == "UNPAID" || i.Status == "OVERDUE"))).ToList();
            var tickets = (await _unitOfWork.Repository<Ticket>().FindAsync(t => scope.Contains(t.LocationId) && t.Status != "RESOLVED")).Count();
            var visitorsToday = (await _unitOfWork.Repository<Visitor>().FindAsync(v => scope.Contains(v.LocationId) && v.VisitDate == today)).Count();
            var leads = (await _unitOfWork.Repository<Lead>().FindAsync(l => scope.Contains(l.LocationId))).ToList();
            var plans = (await _unitOfWork.Repository<Plan>().FindAsync(p => true)).ToList();

            var monthStart = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var success = payments.Where(p => p.Status == "SUCCESS").ToList();
            var fromUtc = from.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            var toUtc = to.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc);

            var summary = new DashboardSummaryDto
            {
                TotalMembers = members.Count,
                ActiveMembers = members.Count(m => m.Status == "ACTIVE"),
                ActiveSubscriptions = subs.Count(s => s.Status == "ACTIVE"),
                TodaysBookings = bookings.Count(b => b.BookingDate == today),
                BookingsInRange = bookings.Count(b => b.BookingDate >= from && b.BookingDate <= to),
                TodaysVisitors = visitorsToday,
                OpenTickets = tickets,
                NewLeads = leads.Count(l => l.Status == "NEW"),
                MonthRevenue = success.Where(p => p.PaymentDate >= monthStart).Sum(p => p.Amount),
                RevenueInRange = success.Where(p => p.PaymentDate >= fromUtc && p.PaymentDate <= toUtc).Sum(p => p.Amount),
                Outstanding = invoices.Sum(i => i.Total - i.AmountPaid),
                OutstandingInvoices = invoices.Count,
                FailedPayments = payments.Count(p => p.Status == "FAILED"),
                ChurnRate = subs.Count == 0 ? 0 : Math.Round(subs.Count(s => s.Status is "CANCELLED" or "EXPIRED" || s.CancelAt != null) * 100m / subs.Count, 1),
                OccupancyNow = Occupancy(resources, bookings, today),
            };

            // Revenue for the last six calendar months (real collections only).
            for (var i = 5; i >= 0; i--)
            {
                var month = monthStart.AddMonths(-i);
                var next = month.AddMonths(1);
                summary.RevenueByMonth.Add(new ChartPointDto
                {
                    Label = month.ToString("MMM", CultureInfo.InvariantCulture),
                    Value = success.Where(p => p.PaymentDate >= month && p.PaymentDate < next).Sum(p => p.Amount),
                });
            }

            var typeLabels = new Dictionary<string, string> { ["HOT_DESK"] = "Hot Desk", ["DEDICATED_DESK"] = "Dedicated Desk", ["PRIVATE_OFFICE"] = "Private Office", ["MEETING_ROOM"] = "Meeting Room" };
            var resourceTypes = (await _unitOfWork.Repository<Resource>().FindAsync(r => scope.Contains(r.LocationId))).ToDictionary(r => r.Id, r => r.ResourceType);
            var inRange = bookings.Where(b => b.BookingDate >= from && b.BookingDate <= to).ToList();
            summary.BookingsByType = typeLabels.Select(t => new ChartPointDto
            {
                Label = t.Value,
                Value = inRange.Count(b => resourceTypes.TryGetValue(b.ResourceId, out var type) && type == t.Key),
            }).ToList();

            var live = subs.Where(s => s.Status is "ACTIVE" or "OVERDUE" or "PAUSED").ToList();
            summary.MembershipDistribution = plans
                .Select(p => new ChartPointDto { Label = p.Name, Value = live.Count(s => s.PlanId == p.Id) })
                .Where(x => x.Value > 0)
                .ToList();

            var rangeLeads = leads.Where(l => l.CreatedDate >= fromUtc && l.CreatedDate <= toUtc).ToList();
            int Reached(params string[] statuses) => rangeLeads.Count(l => statuses.Contains(l.Status));
            summary.LeadFunnel = new List<ChartPointDto>
            {
                new() { Label = "Enquiries", Value = rangeLeads.Count },
                new() { Label = "Contacted", Value = Reached("CONTACTED", "TOUR_SCHEDULED", "TOUR_DONE", "CONVERTED") },
                new() { Label = "Tours", Value = Reached("TOUR_SCHEDULED", "TOUR_DONE", "CONVERTED") },
                new() { Label = "Converted", Value = Reached("CONVERTED") },
            };

            return summary;
        }

        /// <summary>Share of active resource-hours (10:00, 13:00, 16:00 snapshots) booked today.</summary>
        private static int Occupancy(IReadOnlyCollection<Resource> resources, IEnumerable<Booking> bookings, DateOnly day)
        {
            if (resources.Count == 0)
            {
                return 0;
            }

            var todays = bookings.Where(b => b.BookingDate == day && (b.Status == "CONFIRMED" || b.Status == "PENDING" || b.Status == "COMPLETED")).ToList();
            var busy = 0;
            foreach (var hour in new[] { 10, 13, 16 })
            {
                var start = new TimeOnly(hour, 0);
                var end = new TimeOnly(hour + 1, 0);
                busy += resources.Count(r => todays.Any(b => b.ResourceId == r.Id && b.StartTime < end && start < b.EndTime));
            }

            return (int)Math.Round(busy * 100.0 / (resources.Count * 3));
        }
    }
}
