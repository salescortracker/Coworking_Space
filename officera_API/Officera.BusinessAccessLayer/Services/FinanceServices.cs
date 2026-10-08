using System.Linq.Expressions;
using officera.BusinessAccessLayer.DTOs;
using officera.BusinessAccessLayer.Interfaces;
using officera.DataAccessLayer.Entities;
using officera.Shared.Common;

namespace officera.BusinessAccessLayer.Services
{
    public static class FinanceRules
    {
        public static readonly string[] PaymentMethods = { "UPI", "CARD", "NET_BANKING", "CREDITS" };
        public static readonly string[] BookingStatuses = { "CONFIRMED", "PENDING", "COMPLETED", "CANCELLED", "EXPIRED" };
        public static readonly string[] BookingPaymentStatuses = { "PAID", "PENDING", "FAILED", "REFUNDED", "NOT_REQUIRED" };
        public static readonly string[] BlockingBookingStatuses = { "CONFIRMED", "PENDING" };
        public static readonly string[] PaymentStatuses = { "SUCCESS", "PENDING", "FAILED", "REFUNDED" };
        public static readonly string[] PaymentTypes = { "SUBSCRIPTION", "BOOKING", "DEPOSIT", "DAY_PASS", "RENEWAL" };
        public static readonly string[] InvoiceStatuses = { "PAID", "UNPAID", "OVERDUE", "CANCELLED", "PARTIALLY_PAID" };

        /// <summary>Indian financial year label, e.g. 26-27 for any date between 1 Apr 2026 and 31 Mar 2027.</summary>
        public static string FinancialYear(DateOnly date)
        {
            var start = date.Month >= 4 ? date.Year : date.Year - 1;
            return $"{start % 100:00}-{(start + 1) % 100:00}";
        }
    }

    /// <summary>Bookings with the double-booking rule enforced on the server.</summary>
    public class BookingService : CrudServiceBase<Booking, BookingDto>, IBookingService
    {
        public BookingService(ServiceContext context) : base(context) { }

        protected override string EntityName => "Booking";
        protected override string ModuleKey => "bookings";
        protected override string IdPrefix => "BKG";

        protected override Expression<Func<Booking, bool>> IdEquals(string id) => e => e.Id == id;
        protected override string KeyOf(Booking entity) => entity.Id;
        protected override void SetKey(Booking entity, string id) => entity.Id = id;

        protected override Expression<Func<Booking, bool>>? MemberFilter(CurrentUserContext user)
        {
            var memberId = user.MemberId;
            return e => e.MemberId == memberId;
        }

        protected override Expression<Func<Booking, bool>>? LocationFilter(IReadOnlyCollection<string> locationIds) => e => locationIds.Contains(e.LocationId);
        protected override string? LocationOf(Booking entity) => entity.LocationId;

        protected override bool MemberCanCreate(Booking entity, CurrentUserContext user) => entity.MemberId == user.MemberId;
        protected override bool MemberCanUpdate(Booking existing, CurrentUserContext user) => existing.MemberId == user.MemberId;

        protected override void ApplyMemberUpdate(BookingDto dto, Booking e, CurrentUserContext user)
        {
            var memberId = e.MemberId;
            MapToEntity(dto, e, false);
            e.MemberId = memberId;
        }

        protected override IEnumerable<string?> SearchValues(BookingDto dto) => new[] { dto.Id, dto.MemberId, dto.ResourceId, dto.Status };
        protected override IEnumerable<BookingDto> DefaultOrder(IEnumerable<BookingDto> items) => items.OrderByDescending(b => b.Date).ThenBy(b => b.StartTime);

        protected override BookingDto ToDto(Booking e) => new()
        {
            Id = e.Id,
            MemberId = e.MemberId,
            CompanyId = e.CompanyId,
            LocationId = e.LocationId,
            ResourceId = e.ResourceId,
            Date = DateTimeHelper.ToDateString(e.BookingDate),
            StartTime = DateTimeHelper.ToTimeString(e.StartTime),
            EndTime = DateTimeHelper.ToTimeString(e.EndTime),
            Seats = e.Seats,
            Amount = e.Amount,
            CreditsUsed = e.CreditsUsed,
            BalanceDue = e.BalanceDue,
            Status = e.Status,
            PaymentStatus = e.PaymentStatus,
            PaymentMethod = e.PaymentMethod,
            PaymentId = e.PaymentId,
            Notes = e.Notes,
            CreatedAt = DateTimeHelper.ToIso(e.CreatedDate),
            CancelledAt = DateTimeHelper.ToIso(e.CancelledAt),
            CancelReason = e.CancelReason,
        };

        protected override void MapToEntity(BookingDto dto, Booking e, bool isNew)
        {
            e.MemberId = dto.MemberId;
            e.CompanyId = string.IsNullOrWhiteSpace(dto.CompanyId) ? null : dto.CompanyId;
            e.LocationId = dto.LocationId;
            e.ResourceId = dto.ResourceId;
            e.BookingDate = DateTimeHelper.RequireDate(dto.Date, "Date");
            e.StartTime = DateTimeHelper.RequireTime(dto.StartTime, "Start time");
            e.EndTime = DateTimeHelper.RequireTime(dto.EndTime, "End time");
            e.Seats = dto.Seats;
            e.Amount = dto.Amount;
            e.CreditsUsed = dto.CreditsUsed;
            e.BalanceDue = dto.BalanceDue;
            e.Status = dto.Status;
            e.PaymentStatus = dto.PaymentStatus;
            e.PaymentMethod = string.IsNullOrWhiteSpace(dto.PaymentMethod) ? null : dto.PaymentMethod;
            e.PaymentId = string.IsNullOrWhiteSpace(dto.PaymentId) ? null : dto.PaymentId;
            e.Notes = dto.Notes;
            e.CancelledAt = DateTimeHelper.ParseUtc(dto.CancelledAt);
            e.CancelReason = dto.CancelReason;
        }

        protected override async Task ValidateAsync(BookingDto dto, Booking? existing, CurrentUserContext user)
        {
            var date = DateTimeHelper.ParseDate(dto.Date);
            var start = DateTimeHelper.ParseTime(dto.StartTime);
            var end = DateTimeHelper.ParseTime(dto.EndTime);
            new ValidationHelper.Collector()
                .Required(dto.MemberId, "Member")
                .Required(dto.ResourceId, "Resource")
                .Required(dto.LocationId, "Location")
                .Must(date != null, "Date must be a valid date.")
                .Must(start != null && end != null, "Start and end times are required (HH:mm).")
                .Must(start == null || end == null || end > start, "End time must be after the start time.")
                .Must(dto.Seats > 0, "Seats must be at least 1.")
                .Min(dto.Amount, 0, "Amount")
                .Min(dto.CreditsUsed, 0, "Credits used")
                .Min(dto.BalanceDue, 0, "Balance due")
                .OneOf(dto.Status, FinanceRules.BookingStatuses, "Status")
                .OneOf(dto.PaymentStatus, FinanceRules.BookingPaymentStatuses, "Payment status")
                .Must(string.IsNullOrEmpty(dto.PaymentMethod) || FinanceRules.PaymentMethods.Contains(dto.PaymentMethod), "Payment method is not valid.")
                .ThrowIfInvalid();

            var resource = (await Repo<Resource>().FindAsync(r => r.Id == dto.ResourceId)).FirstOrDefault()
                ?? throw new ValidationException("The selected resource does not exist.");
            if (resource.LocationId != dto.LocationId)
            {
                throw new ValidationException("The resource does not belong to the selected location.");
            }

            if (!(await Repo<Member>().FindAsync(m => m.Id == dto.MemberId)).Any())
            {
                throw new ValidationException("The selected member does not exist.");
            }

            var changesSlot = existing == null
                || existing.ResourceId != dto.ResourceId
                || existing.BookingDate != date
                || existing.StartTime != start
                || existing.EndTime != end
                || !FinanceRules.BlockingBookingStatuses.Contains(existing.Status);

            if (FinanceRules.BlockingBookingStatuses.Contains(dto.Status) && changesSlot)
            {
                if (resource.Status != "ACTIVE" || resource.IsBlocked)
                {
                    throw new ConflictException($"{resource.Name} is not available for booking.");
                }

                if (resource.ResourceType is "MEETING_ROOM" or "PRIVATE_OFFICE" && dto.Seats > resource.Capacity)
                {
                    throw new ValidationException($"{resource.Name} seats up to {resource.Capacity} people.");
                }

                var blocking = FinanceRules.BlockingBookingStatuses;
                var excludeId = existing?.Id ?? dto.Id;
                var clash = (await Repository.FindAsync(b =>
                        b.ResourceId == dto.ResourceId
                        && b.BookingDate == date
                        && blocking.Contains(b.Status)
                        && b.Id != excludeId
                        && b.StartTime < end
                        && start < b.EndTime))
                    .Any();
                if (clash)
                {
                    throw new ConflictException($"{resource.Name} was just booked for this time. Please pick another slot.");
                }
            }
        }

        public async Task<List<OccupancySlotDto>> GetOccupancyAsync(OccupancyRequest request)
        {
            var from = DateTimeHelper.ParseDate(request.From) ?? DateTimeHelper.TodayUtc.AddDays(-35);
            var to = DateTimeHelper.ParseDate(request.To) ?? DateTimeHelper.TodayUtc.AddDays(90);
            if (to < from || to.DayNumber - from.DayNumber > 400)
            {
                throw new ValidationException("The date range must be valid and at most 400 days long.");
            }

            var blocking = FinanceRules.BlockingBookingStatuses;
            var locationId = request.LocationId;
            var rows = await Repository.FindAsync(b =>
                b.BookingDate >= from && b.BookingDate <= to
                && (blocking.Contains(b.Status) || b.Status == "COMPLETED")
                && (locationId == null || b.LocationId == locationId));

            return rows.Select(b => new OccupancySlotDto
            {
                ResourceId = b.ResourceId,
                LocationId = b.LocationId,
                Date = DateTimeHelper.ToDateString(b.BookingDate),
                StartTime = DateTimeHelper.ToTimeString(b.StartTime),
                EndTime = DateTimeHelper.ToTimeString(b.EndTime),
            }).ToList();
        }
    }

    public class PaymentService : CrudServiceBase<Payment, PaymentDto>, IPaymentService
    {
        public PaymentService(ServiceContext context) : base(context) { }

        protected override string EntityName => "Payment";
        protected override string ModuleKey => "payments";
        protected override string IdPrefix => "PAY";
        protected override bool AllowDelete => false;

        protected override Expression<Func<Payment, bool>> IdEquals(string id) => e => e.Id == id;
        protected override string KeyOf(Payment entity) => entity.Id;
        protected override void SetKey(Payment entity, string id) => entity.Id = id;

        protected override Expression<Func<Payment, bool>>? MemberFilter(CurrentUserContext user)
        {
            var memberId = user.MemberId;
            return e => e.MemberId == memberId;
        }

        protected override Expression<Func<Payment, bool>>? LocationFilter(IReadOnlyCollection<string> locationIds) => e => locationIds.Contains(e.LocationId);
        protected override string? LocationOf(Payment entity) => entity.LocationId;

        protected override bool MemberCanCreate(Payment entity, CurrentUserContext user) => entity.MemberId == user.MemberId;
        protected override bool MemberCanUpdate(Payment existing, CurrentUserContext user) => existing.MemberId == user.MemberId;

        protected override void ApplyMemberUpdate(PaymentDto dto, Payment e, CurrentUserContext user)
        {
            var memberId = e.MemberId;
            MapToEntity(dto, e, false);
            e.MemberId = memberId;
        }

        protected override IEnumerable<string?> SearchValues(PaymentDto dto) => new[] { dto.Id, dto.MemberId, dto.Description, dto.GatewayRef };
        protected override IEnumerable<PaymentDto> DefaultOrder(IEnumerable<PaymentDto> items) => items.OrderByDescending(p => p.Date);

        protected override PaymentDto ToDto(Payment e) => new()
        {
            Id = e.Id,
            MemberId = e.MemberId,
            LocationId = e.LocationId,
            Date = DateTimeHelper.ToIso(e.PaymentDate),
            Type = e.PaymentType,
            Description = e.Description,
            Amount = e.Amount,
            Method = e.Method,
            Status = e.Status,
            GatewayRef = e.GatewayRef,
            InvoiceId = e.InvoiceId,
            BookingId = e.BookingId,
            SubscriptionId = e.SubscriptionId,
            RetryCount = e.RetryCount,
            FailureReason = e.FailureReason,
        };

        protected override void MapToEntity(PaymentDto dto, Payment e, bool isNew)
        {
            e.MemberId = dto.MemberId;
            e.LocationId = dto.LocationId;
            e.PaymentDate = DateTimeHelper.ParseUtc(dto.Date) ?? DateTime.UtcNow;
            e.PaymentType = dto.Type;
            e.Description = dto.Description ?? string.Empty;
            e.Amount = dto.Amount;
            e.Method = dto.Method;
            e.Status = dto.Status;
            e.GatewayRef = dto.GatewayRef ?? string.Empty;
            e.InvoiceId = string.IsNullOrWhiteSpace(dto.InvoiceId) ? null : dto.InvoiceId;
            e.BookingId = string.IsNullOrWhiteSpace(dto.BookingId) ? null : dto.BookingId;
            e.SubscriptionId = string.IsNullOrWhiteSpace(dto.SubscriptionId) ? null : dto.SubscriptionId;
            e.RetryCount = Math.Max(0, dto.RetryCount);
            e.FailureReason = dto.FailureReason;
        }

        protected override async Task ValidateAsync(PaymentDto dto, Payment? existing, CurrentUserContext user)
        {
            new ValidationHelper.Collector()
                .Required(dto.MemberId, "Member")
                .Required(dto.LocationId, "Location")
                .OneOf(dto.Type, FinanceRules.PaymentTypes, "Payment type")
                .OneOf(dto.Method, FinanceRules.PaymentMethods, "Payment method")
                .OneOf(dto.Status, FinanceRules.PaymentStatuses, "Status")
                .Min(dto.Amount, 0, "Amount")
                .ThrowIfInvalid();

            if (!(await Repo<Member>().FindAsync(m => m.Id == dto.MemberId)).Any())
            {
                throw new ValidationException("The selected member does not exist.");
            }
        }
    }

    /// <summary>GST invoices. Invoice numbers are issued by the server (OFC/yy-yy/00001) so they stay unique and gap-free per year.</summary>
    public class InvoiceService : CrudServiceBase<Invoice, InvoiceDto>, IInvoiceService
    {
        public InvoiceService(ServiceContext context) : base(context) { }

        protected override string EntityName => "Invoice";
        protected override string ModuleKey => "invoices";
        protected override string IdPrefix => "INV";
        protected override bool AllowDelete => false;

        protected override Expression<Func<Invoice, bool>> IdEquals(string id) => e => e.Id == id;
        protected override string KeyOf(Invoice entity) => entity.Id;
        protected override void SetKey(Invoice entity, string id) => entity.Id = id;

        protected override Expression<Func<Invoice, bool>>? MemberFilter(CurrentUserContext user)
        {
            var memberId = user.MemberId;
            return e => e.MemberId == memberId;
        }

        protected override Expression<Func<Invoice, bool>>? LocationFilter(IReadOnlyCollection<string> locationIds) => e => locationIds.Contains(e.LocationId);
        protected override string? LocationOf(Invoice entity) => entity.LocationId;

        protected override bool MemberCanCreate(Invoice entity, CurrentUserContext user) => entity.MemberId == user.MemberId;
        protected override bool MemberCanUpdate(Invoice existing, CurrentUserContext user) => existing.MemberId == user.MemberId;

        protected override void ApplyMemberUpdate(InvoiceDto dto, Invoice e, CurrentUserContext user)
        {
            var memberId = e.MemberId;
            var number = e.InvoiceNumber;
            MapToEntity(dto, e, false);
            e.MemberId = memberId;
            e.InvoiceNumber = number;
        }

        protected override IEnumerable<string?> SearchValues(InvoiceDto dto) => new[] { dto.Id, dto.Number, dto.CustomerName, dto.CompanyName, dto.CustomerGstin };
        protected override IEnumerable<InvoiceDto> DefaultOrder(IEnumerable<InvoiceDto> items) => items.OrderByDescending(i => i.Date).ThenByDescending(i => i.Number);

        public override async Task<InvoiceDto> SaveAsync(InvoiceDto dto)
        {
            // Reserve the number before the unit of work starts tracking the new invoice.
            var date = DateTimeHelper.ParseDate(dto.Date) ?? DateTimeHelper.TodayUtc;
            var fy = FinanceRules.FinancialYear(date);
            var seq = await Ids.ReserveAsync($"INVNO-{fy}", 1);
            dto.Number = $"OFC/{fy}/{seq:00000}";
            return await base.SaveAsync(dto);
        }

        protected override InvoiceDto ToDto(Invoice e) => ToDto(e, Array.Empty<InvoiceLine>());

        private static InvoiceDto ToDto(Invoice e, IEnumerable<InvoiceLine> lines) => new()
        {
            Id = e.Id,
            Number = e.InvoiceNumber,
            Date = DateTimeHelper.ToDateString(e.InvoiceDate),
            DueDate = DateTimeHelper.ToDateString(e.DueDate),
            MemberId = e.MemberId,
            LocationId = e.LocationId,
            CustomerName = e.CustomerName,
            CompanyName = e.CompanyName,
            CustomerGstin = e.CustomerGstin,
            BillingAddress = e.BillingAddress,
            PlaceOfSupply = e.PlaceOfSupply,
            IntraState = e.IntraState,
            Lines = lines.OrderBy(l => l.LineNumber).Select(l => new InvoiceLineDto
            {
                Description = l.Description,
                Sac = l.Sac,
                Qty = l.Qty,
                Rate = l.Rate,
                Amount = l.Amount,
            }).ToList(),
            Subtotal = e.Subtotal,
            Cgst = e.Cgst,
            Sgst = e.Sgst,
            Igst = e.Igst,
            Tax = e.Tax,
            Total = e.Total,
            AmountPaid = e.AmountPaid,
            Status = e.Status,
            PaymentId = e.PaymentId,
            EmailedAt = DateTimeHelper.ToIso(e.EmailedAt),
        };

        protected override async Task<List<InvoiceDto>> ToDtosAsync(IReadOnlyList<Invoice> entities)
        {
            var ids = entities.Select(e => e.Id).ToList();
            var lines = (await Repo<InvoiceLine>().FindAsync(l => ids.Contains(l.InvoiceId))).ToLookup(l => l.InvoiceId);
            return entities.Select(e => ToDto(e, lines[e.Id])).ToList();
        }

        protected override void MapToEntity(InvoiceDto dto, Invoice e, bool isNew)
        {
            if (isNew)
            {
                e.InvoiceNumber = dto.Number;
            }

            e.InvoiceDate = DateTimeHelper.RequireDate(dto.Date, "Invoice date");
            e.DueDate = DateTimeHelper.RequireDate(dto.DueDate, "Due date");
            e.MemberId = dto.MemberId;
            e.LocationId = dto.LocationId;
            e.CustomerName = dto.CustomerName;
            e.CompanyName = dto.CompanyName;
            e.CustomerGstin = string.IsNullOrWhiteSpace(dto.CustomerGstin) ? null : dto.CustomerGstin.ToUpperInvariant();
            e.BillingAddress = dto.BillingAddress ?? string.Empty;
            e.PlaceOfSupply = dto.PlaceOfSupply ?? string.Empty;
            e.IntraState = dto.IntraState;
            e.Subtotal = dto.Subtotal;
            e.Cgst = dto.Cgst;
            e.Sgst = dto.Sgst;
            e.Igst = dto.Igst;
            e.Tax = dto.Tax;
            e.Total = dto.Total;
            e.AmountPaid = dto.AmountPaid;
            e.Status = dto.Status;
            e.PaymentId = string.IsNullOrWhiteSpace(dto.PaymentId) ? null : dto.PaymentId;
            e.EmailedAt = DateTimeHelper.ParseUtc(dto.EmailedAt);
        }

        protected override async Task ValidateAsync(InvoiceDto dto, Invoice? existing, CurrentUserContext user)
        {
            new ValidationHelper.Collector()
                .Required(dto.MemberId, "Member")
                .Required(dto.LocationId, "Location")
                .Required(dto.CustomerName, "Customer name")
                .Must(DateTimeHelper.ParseDate(dto.Date) != null, "Invoice date is required.")
                .Must(DateTimeHelper.ParseDate(dto.DueDate) != null, "Due date is required.")
                .OneOf(dto.Status, FinanceRules.InvoiceStatuses, "Status")
                .Gstin(dto.CustomerGstin, "Customer GSTIN")
                .Must(dto.Lines is { Count: > 0 }, "An invoice needs at least one line.")
                .Must(Math.Abs(dto.Tax - (dto.Cgst + dto.Sgst + dto.Igst)) <= 1, "Tax must equal CGST + SGST + IGST.")
                .Must(Math.Abs(dto.Total - (dto.Subtotal + dto.Tax)) <= 1, "Total must equal subtotal + tax.")
                .Min(dto.AmountPaid, 0, "Amount paid")
                .ThrowIfInvalid();

            if (!(await Repo<Member>().FindAsync(m => m.Id == dto.MemberId)).Any())
            {
                throw new ValidationException("The selected member does not exist.");
            }
        }

        protected override async Task OnSavingAsync(Invoice entity, InvoiceDto dto, bool isNew, CurrentUserContext user)
        {
            var repo = Repo<InvoiceLine>();
            if (!isNew)
            {
                foreach (var line in await repo.FindAsync(l => l.InvoiceId == entity.Id))
                {
                    repo.Remove(line);
                }
            }

            var number = 1;
            foreach (var line in dto.Lines ?? new())
            {
                await repo.AddAsync(new InvoiceLine
                {
                    InvoiceId = entity.Id,
                    LineNumber = number++,
                    Description = line.Description,
                    Sac = line.Sac ?? string.Empty,
                    Qty = line.Qty,
                    Rate = line.Rate,
                    Amount = line.Amount,
                });
            }
        }
    }

    public class RefundService : CrudServiceBase<Refund, RefundDto>, IRefundService
    {
        private static readonly string[] Statuses = { "REQUESTED", "APPROVED", "PROCESSED", "REJECTED" };

        public RefundService(ServiceContext context) : base(context) { }

        protected override string EntityName => "Refund";
        protected override string ModuleKey => "refunds";
        protected override string IdPrefix => "RFD";
        protected override bool AllowDelete => false;

        protected override Expression<Func<Refund, bool>> IdEquals(string id) => e => e.Id == id;
        protected override string KeyOf(Refund entity) => entity.Id;
        protected override void SetKey(Refund entity, string id) => entity.Id = id;

        protected override Expression<Func<Refund, bool>>? MemberFilter(CurrentUserContext user)
        {
            var memberId = user.MemberId;
            return e => e.MemberId == memberId;
        }

        protected override Expression<Func<Refund, bool>>? LocationFilter(IReadOnlyCollection<string> locationIds) => e => locationIds.Contains(e.LocationId);
        protected override string? LocationOf(Refund entity) => entity.LocationId;

        /// <summary>Members can only request a refund (booking cancellation); approval is a finance action.</summary>
        protected override bool MemberCanCreate(Refund entity, CurrentUserContext user) => entity.MemberId == user.MemberId && entity.Status == "REQUESTED";

        /// <summary>Raising a refund is part of cancelling a booking, which any booking operator may do.</summary>
        protected override bool AnyStaffCanCreate => true;

        protected override IEnumerable<string?> SearchValues(RefundDto dto) => new[] { dto.Id, dto.PaymentId, dto.MemberId, dto.Reason };
        protected override IEnumerable<RefundDto> DefaultOrder(IEnumerable<RefundDto> items) => items.OrderByDescending(r => r.RequestedAt);

        protected override RefundDto ToDto(Refund e) => new()
        {
            Id = e.Id,
            PaymentId = e.PaymentId,
            MemberId = e.MemberId,
            LocationId = e.LocationId,
            Amount = e.Amount,
            Reason = e.Reason,
            Status = e.Status,
            RequestedAt = DateTimeHelper.ToIso(e.RequestedAt),
            ProcessedAt = DateTimeHelper.ToIso(e.ProcessedAt),
        };

        protected override void MapToEntity(RefundDto dto, Refund e, bool isNew)
        {
            e.PaymentId = dto.PaymentId;
            e.MemberId = dto.MemberId;
            e.LocationId = dto.LocationId;
            e.Amount = dto.Amount;
            e.Reason = dto.Reason ?? string.Empty;
            e.Status = dto.Status;
            e.RequestedAt = DateTimeHelper.ParseUtc(dto.RequestedAt) ?? DateTime.UtcNow;
            e.ProcessedAt = DateTimeHelper.ParseUtc(dto.ProcessedAt);
        }

        protected override async Task ValidateAsync(RefundDto dto, Refund? existing, CurrentUserContext user)
        {
            new ValidationHelper.Collector()
                .Required(dto.PaymentId, "Payment")
                .Required(dto.MemberId, "Member")
                .OneOf(dto.Status, Statuses, "Status")
                .Min(dto.Amount, 0, "Amount")
                .ThrowIfInvalid();

            var payment = (await Repo<Payment>().FindAsync(p => p.Id == dto.PaymentId)).FirstOrDefault()
                ?? throw new ValidationException("The payment being refunded does not exist.");
            if (dto.Amount > payment.Amount)
            {
                throw new ValidationException("A refund cannot exceed the original payment.");
            }

            if (existing != null && existing.Status != dto.Status && !user.IsSuperAdmin && !user.Can("refunds.approve"))
            {
                throw new ForbiddenException("Only finance can approve or reject refunds.");
            }
        }
    }

    public class CreditNoteService : CrudServiceBase<CreditNote, CreditNoteDto>, ICreditNoteService
    {
        public CreditNoteService(ServiceContext context) : base(context) { }

        protected override string EntityName => "Credit note";
        protected override string ModuleKey => "invoices";
        protected override string IdPrefix => "CN";
        protected override bool AllowDelete => false;

        protected override Expression<Func<CreditNote, bool>> IdEquals(string id) => e => e.Id == id;
        protected override string KeyOf(CreditNote entity) => entity.Id;
        protected override void SetKey(CreditNote entity, string id) => entity.Id = id;

        protected override Expression<Func<CreditNote, bool>>? MemberFilter(CurrentUserContext user)
        {
            var memberId = user.MemberId;
            return e => e.MemberId == memberId;
        }

        protected override Expression<Func<CreditNote, bool>>? LocationFilter(IReadOnlyCollection<string> locationIds) => e => locationIds.Contains(e.LocationId);
        protected override string? LocationOf(CreditNote entity) => entity.LocationId;

        protected override bool MemberCanCreate(CreditNote entity, CurrentUserContext user) => entity.MemberId == user.MemberId;
        protected override bool AnyStaffCanCreate => true;

        public override async Task<CreditNoteDto> SaveAsync(CreditNoteDto dto)
        {
            var date = DateTimeHelper.ParseDate(dto.Date) ?? DateTimeHelper.TodayUtc;
            var seq = await Ids.ReserveAsync($"CNNO-{FinanceRules.FinancialYear(date)}", 1);
            dto.Number = $"OFC/CN/{FinanceRules.FinancialYear(date)}/{seq:0000}";
            return await base.SaveAsync(dto);
        }

        protected override IEnumerable<string?> SearchValues(CreditNoteDto dto) => new[] { dto.Id, dto.Number, dto.InvoiceId, dto.Reason };
        protected override IEnumerable<CreditNoteDto> DefaultOrder(IEnumerable<CreditNoteDto> items) => items.OrderByDescending(c => c.Date);

        protected override CreditNoteDto ToDto(CreditNote e) => new()
        {
            Id = e.Id,
            Number = e.NoteNumber,
            InvoiceId = e.InvoiceId,
            MemberId = e.MemberId,
            LocationId = e.LocationId,
            Amount = e.Amount,
            Reason = e.Reason,
            Date = DateTimeHelper.ToDateString(e.NoteDate),
            Status = e.Status,
        };

        protected override void MapToEntity(CreditNoteDto dto, CreditNote e, bool isNew)
        {
            if (isNew)
            {
                e.NoteNumber = dto.Number;
            }

            e.InvoiceId = dto.InvoiceId;
            e.MemberId = dto.MemberId;
            e.LocationId = dto.LocationId;
            e.Amount = dto.Amount;
            e.Reason = dto.Reason ?? string.Empty;
            e.NoteDate = DateTimeHelper.ParseDate(dto.Date) ?? DateTimeHelper.TodayUtc;
            e.Status = dto.Status;
        }

        protected override async Task ValidateAsync(CreditNoteDto dto, CreditNote? existing, CurrentUserContext user)
        {
            new ValidationHelper.Collector()
                .Required(dto.InvoiceId, "Invoice")
                .Required(dto.MemberId, "Member")
                .OneOf(dto.Status, new[] { "ISSUED", "APPLIED", "VOID" }, "Status")
                .Min(dto.Amount, 0, "Amount")
                .ThrowIfInvalid();

            var invoice = (await Repo<Invoice>().FindAsync(i => i.Id == dto.InvoiceId)).FirstOrDefault()
                ?? throw new ValidationException("The invoice does not exist.");
            if (dto.Amount > invoice.Total)
            {
                throw new ValidationException("A credit note cannot exceed the invoice total.");
            }
        }
    }
}
