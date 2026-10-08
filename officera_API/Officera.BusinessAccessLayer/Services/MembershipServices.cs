using System.Linq.Expressions;
using officera.BusinessAccessLayer.DTOs;
using officera.BusinessAccessLayer.Interfaces;
using officera.DataAccessLayer.Entities;
using officera.Shared.Common;

namespace officera.BusinessAccessLayer.Services
{
    public static class MembershipRules
    {
        public static readonly string[] PlanTypes = { "DAY_PASS", "HOT_DESK", "DEDICATED_DESK", "PRIVATE_OFFICE" };
        public static readonly string[] BillingCycles = { "DAILY", "MONTHLY", "QUARTERLY", "YEARLY" };
        public static readonly string[] SubscriptionStatuses = { "ACTIVE", "PAUSED", "CANCELLED", "EXPIRED", "OVERDUE", "SUSPENDED", "PENDING_PAYMENT" };

        /// <summary>Statuses that still count as a live subscriber of a plan.</summary>
        public static readonly string[] LiveStatuses = { "ACTIVE", "OVERDUE", "PAUSED", "SUSPENDED", "PENDING_PAYMENT" };

        /// <summary>Access rule (FR-5.1 / 5.2), same as accessStateFor() in member-account.service.ts.</summary>
        public static string AccessState(Subscription? sub, DateOnly today)
        {
            if (sub == null)
            {
                return "EXPIRED";
            }

            return sub.Status switch
            {
                "ACTIVE" => sub.EndDate < today && !sub.AutoRenew ? "EXPIRED" : "ACTIVE",
                "OVERDUE" => sub.GraceUntil.HasValue && sub.GraceUntil.Value < today ? "SUSPENDED" : "OVERDUE",
                "PAUSED" or "SUSPENDED" => "SUSPENDED",
                _ => "EXPIRED",
            };
        }

        /// <summary>Most relevant subscription for a member (active first, then most recent).</summary>
        public static Subscription? Current(IEnumerable<Subscription> subs)
        {
            var order = new[] { "ACTIVE", "OVERDUE", "PAUSED", "SUSPENDED", "PENDING_PAYMENT", "EXPIRED", "CANCELLED" };
            return subs.OrderBy(s => Array.IndexOf(order, s.Status)).ThenByDescending(s => s.CreatedDate).FirstOrDefault();
        }
    }

    /// <summary>Membership plans (Plans & Promotions, public pricing).</summary>
    public class PlanService : CrudServiceBase<Plan, PlanDto>, IPlanService
    {
        public PlanService(ServiceContext context) : base(context) { }

        protected override string EntityName => "Plan";
        protected override string ModuleKey => "plans";
        protected override string IdPrefix => "PLN";
        protected override ReadAccess ReadAccess => ReadAccess.Public;

        protected override Expression<Func<Plan, bool>> IdEquals(string id) => e => e.Id == id;
        protected override string KeyOf(Plan entity) => entity.Id;
        protected override void SetKey(Plan entity, string id) => entity.Id = id;

        /// <summary>The checkout flow on the member side writes back the subscriber count; the server recalculates it instead.</summary>
        protected override bool MemberCanUpdate(Plan existing, CurrentUserContext user) => true;
        protected override void ApplyMemberUpdate(PlanDto dto, Plan existing, CurrentUserContext user) { }

        protected override IEnumerable<string?> SearchValues(PlanDto dto) => new[] { dto.Id, dto.Name, dto.Type };
        protected override IEnumerable<PlanDto> DefaultOrder(IEnumerable<PlanDto> items) => items.OrderBy(p => p.Price);

        protected override PlanDto ToDto(Plan e) => new()
        {
            Id = e.Id,
            Name = e.Name,
            Type = e.PlanType,
            Price = e.Price,
            BillingCycle = e.BillingCycle,
            RoomHours = e.RoomHours,
            GuestPasses = e.GuestPasses,
            Credits = e.Credits,
            SecurityDeposit = e.SecurityDeposit,
            Description = e.Description,
            Benefits = JsonHelper.DeserializeList<string>(e.BenefitsJson),
            AccessHours = e.AccessHours,
            Status = e.Status,
            Popular = e.IsPopular ? true : null,
            Subscribers = e.Subscribers,
        };

        protected override void MapToEntity(PlanDto dto, Plan e, bool isNew)
        {
            e.Name = dto.Name.Trim();
            e.PlanType = dto.Type;
            e.Price = dto.Price;
            e.BillingCycle = dto.BillingCycle;
            e.RoomHours = dto.RoomHours;
            e.GuestPasses = dto.GuestPasses;
            e.Credits = dto.Credits;
            e.SecurityDeposit = dto.SecurityDeposit;
            e.Description = dto.Description ?? string.Empty;
            e.BenefitsJson = JsonHelper.Serialize(dto.Benefits ?? new());
            e.AccessHours = dto.AccessHours ?? string.Empty;
            e.Status = dto.Status;
            e.IsPopular = dto.Popular == true;
            if (isNew)
            {
                e.Subscribers = 0;
            }
        }

        protected override async Task ValidateAsync(PlanDto dto, Plan? existing, CurrentUserContext user)
        {
            if (user.IsMember)
            {
                return;
            }

            new ValidationHelper.Collector()
                .Required(dto.Name, "Plan name").MaxLength(dto.Name, 150, "Plan name")
                .OneOf(dto.Type, MembershipRules.PlanTypes, "Plan type")
                .OneOf(dto.BillingCycle, MembershipRules.BillingCycles, "Billing cycle")
                .OneOf(dto.Status, new[] { "ACTIVE", "INACTIVE" }, "Status")
                .Min(dto.Price, 0, "Price")
                .Min(dto.RoomHours, 0, "Room hours")
                .Min(dto.GuestPasses, 0, "Guest passes")
                .Min(dto.Credits, 0, "Credits")
                .Min(dto.SecurityDeposit, 0, "Security deposit")
                .ThrowIfInvalid();

            var name = dto.Name.Trim();
            if ((await Repository.FindAsync(p => p.Name == name && (existing == null || p.Id != existing.Id))).Any())
            {
                throw new ConflictException($"A plan named '{name}' already exists.");
            }
        }

        protected override async Task OnDeletingAsync(Plan entity)
        {
            if ((await Repo<Subscription>().FindAsync(s => s.PlanId == entity.Id)).Any())
            {
                throw new ConflictException("This plan has subscriptions. Deactivate it instead of deleting it.");
            }
        }
    }

    /// <summary>Promo codes. Members see active codes (checkout validation) and can only register one use.</summary>
    public class PromotionService : CrudServiceBase<Promotion, PromotionDto>, IPromotionService
    {
        public PromotionService(ServiceContext context) : base(context) { }

        protected override string EntityName => "Promotion";
        protected override string ModuleKey => "plans";
        protected override string IdPrefix => "PRM";

        protected override Expression<Func<Promotion, bool>> IdEquals(string id) => e => e.Id == id;
        protected override string KeyOf(Promotion entity) => entity.Id;
        protected override void SetKey(Promotion entity, string id) => entity.Id = id;

        protected override Expression<Func<Promotion, bool>>? MemberFilter(CurrentUserContext user) => e => e.Status == "ACTIVE";

        protected override bool MemberCanUpdate(Promotion existing, CurrentUserContext user) => existing.Status == "ACTIVE";

        protected override void ApplyMemberUpdate(PromotionDto dto, Promotion e, CurrentUserContext user)
        {
            if (dto.Used == e.Used + 1 && e.Used < e.UsageLimit && e.Expiry >= DateTimeHelper.TodayUtc)
            {
                e.Used += 1;
            }
        }

        protected override IEnumerable<string?> SearchValues(PromotionDto dto) => new[] { dto.Id, dto.Code, dto.Description };

        protected override PromotionDto ToDto(Promotion e) => new()
        {
            Id = e.Id,
            Code = e.Code,
            Description = e.Description,
            DiscountType = e.DiscountType,
            Discount = e.Discount,
            Expiry = DateTimeHelper.ToDateString(e.Expiry),
            UsageLimit = e.UsageLimit,
            Used = e.Used,
            Status = e.Status,
            AppliesTo = e.AppliesTo,
        };

        protected override void MapToEntity(PromotionDto dto, Promotion e, bool isNew)
        {
            e.Code = dto.Code.Trim().ToUpperInvariant();
            e.Description = dto.Description ?? string.Empty;
            e.DiscountType = dto.DiscountType;
            e.Discount = dto.Discount;
            e.Expiry = DateTimeHelper.RequireDate(dto.Expiry, "Expiry");
            e.UsageLimit = dto.UsageLimit;
            e.Used = Math.Max(0, dto.Used);
            e.Status = dto.Status;
            e.AppliesTo = dto.AppliesTo;
        }

        protected override async Task ValidateAsync(PromotionDto dto, Promotion? existing, CurrentUserContext user)
        {
            if (user.IsMember)
            {
                return;
            }

            new ValidationHelper.Collector()
                .Required(dto.Code, "Code").MaxLength(dto.Code, 30, "Code")
                .OneOf(dto.DiscountType, new[] { "PERCENT", "FLAT" }, "Discount type")
                .OneOf(dto.Status, new[] { "ACTIVE", "INACTIVE", "EXPIRED" }, "Status")
                .OneOf(dto.AppliesTo, new[] { "ALL", "PLANS", "BOOKINGS" }, "Applies to")
                .Must(dto.Discount > 0, "Discount must be greater than zero.")
                .Must(dto.DiscountType != "PERCENT" || dto.Discount <= 100, "A percentage discount cannot exceed 100%.")
                .Must(dto.UsageLimit > 0, "Usage limit must be at least 1.")
                .Must(DateTimeHelper.ParseDate(dto.Expiry) != null, "Expiry must be a valid date.")
                .ThrowIfInvalid();

            var code = dto.Code.Trim().ToUpperInvariant();
            if ((await Repository.FindAsync(p => p.Code == code && (existing == null || p.Id != existing.Id))).Any())
            {
                throw new ConflictException($"Promo code '{code}' already exists.");
            }
        }
    }

    /// <summary>Member subscriptions (Subscriptions & Credits, member membership page).</summary>
    public class SubscriptionService : CrudServiceBase<Subscription, SubscriptionDto>, ISubscriptionService
    {
        public SubscriptionService(ServiceContext context) : base(context) { }

        protected override string EntityName => "Subscription";
        protected override string ModuleKey => "subscriptions";
        protected override string IdPrefix => "SUB";

        protected override Expression<Func<Subscription, bool>> IdEquals(string id) => e => e.Id == id;
        protected override string KeyOf(Subscription entity) => entity.Id;
        protected override void SetKey(Subscription entity, string id) => entity.Id = id;

        protected override Expression<Func<Subscription, bool>>? MemberFilter(CurrentUserContext user)
        {
            var memberId = user.MemberId;
            return e => e.MemberId == memberId;
        }

        protected override Expression<Func<Subscription, bool>>? LocationFilter(IReadOnlyCollection<string> locationIds) => e => locationIds.Contains(e.LocationId);
        protected override string? LocationOf(Subscription entity) => entity.LocationId;

        protected override bool MemberCanCreate(Subscription entity, CurrentUserContext user) => entity.MemberId == user.MemberId;
        protected override bool MemberCanUpdate(Subscription existing, CurrentUserContext user) => existing.MemberId == user.MemberId;

        protected override void ApplyMemberUpdate(SubscriptionDto dto, Subscription e, CurrentUserContext user)
        {
            var memberId = e.MemberId;
            MapToEntity(dto, e, false);
            e.MemberId = memberId;
        }

        protected override IEnumerable<string?> SearchValues(SubscriptionDto dto) => new[] { dto.Id, dto.MemberId, dto.PlanId, dto.Status };
        protected override IEnumerable<SubscriptionDto> DefaultOrder(IEnumerable<SubscriptionDto> items) => items.OrderByDescending(s => s.CreatedAt);

        protected override SubscriptionDto ToDto(Subscription e) => new()
        {
            Id = e.Id,
            MemberId = e.MemberId,
            PlanId = e.PlanId,
            LocationId = e.LocationId,
            Status = e.Status,
            StartDate = DateTimeHelper.ToDateString(e.StartDate),
            EndDate = DateTimeHelper.ToDateString(e.EndDate),
            BillingCycle = e.BillingCycle,
            Price = e.Price,
            RoomHoursTotal = e.RoomHoursTotal,
            RoomHoursUsed = e.RoomHoursUsed,
            GuestPassesTotal = e.GuestPassesTotal,
            GuestPassesUsed = e.GuestPassesUsed,
            CreditsTotal = e.CreditsTotal,
            CreditsUsed = e.CreditsUsed,
            SecurityDeposit = e.SecurityDeposit,
            AutoRenew = e.AutoRenew,
            PaymentRetries = e.PaymentRetries,
            GraceUntil = DateTimeHelper.ToDateString(e.GraceUntil),
            PausedUntil = DateTimeHelper.ToDateString(e.PausedUntil),
            CancelAt = DateTimeHelper.ToDateString(e.CancelAt),
            CancelReason = e.CancelReason,
            ScheduledChange = e.ScheduledPlanId == null
                ? null
                : new ScheduledChangeDto { PlanId = e.ScheduledPlanId, Effective = DateTimeHelper.ToDateString(e.ScheduledEffective) ?? string.Empty },
            CreatedAt = DateTimeHelper.ToIso(e.CreatedDate),
        };

        protected override void MapToEntity(SubscriptionDto dto, Subscription e, bool isNew)
        {
            e.MemberId = dto.MemberId;
            e.PlanId = dto.PlanId;
            e.LocationId = dto.LocationId;
            e.Status = dto.Status;
            e.StartDate = DateTimeHelper.RequireDate(dto.StartDate, "Start date");
            e.EndDate = DateTimeHelper.RequireDate(dto.EndDate, "End date");
            e.BillingCycle = dto.BillingCycle;
            e.Price = dto.Price;
            e.RoomHoursTotal = dto.RoomHoursTotal;
            e.RoomHoursUsed = Math.Max(0, dto.RoomHoursUsed);
            e.GuestPassesTotal = dto.GuestPassesTotal;
            e.GuestPassesUsed = Math.Max(0, dto.GuestPassesUsed);
            e.CreditsTotal = Math.Max(0, dto.CreditsTotal);
            e.CreditsUsed = Math.Max(0, dto.CreditsUsed);
            e.SecurityDeposit = dto.SecurityDeposit;
            e.AutoRenew = dto.AutoRenew;
            e.PaymentRetries = Math.Max(0, dto.PaymentRetries);
            e.GraceUntil = DateTimeHelper.ParseDate(dto.GraceUntil);
            e.PausedUntil = DateTimeHelper.ParseDate(dto.PausedUntil);
            e.CancelAt = DateTimeHelper.ParseDate(dto.CancelAt);
            e.CancelReason = dto.CancelReason;
            e.ScheduledPlanId = string.IsNullOrWhiteSpace(dto.ScheduledChange?.PlanId) ? null : dto.ScheduledChange!.PlanId;
            e.ScheduledEffective = e.ScheduledPlanId == null ? null : DateTimeHelper.ParseDate(dto.ScheduledChange!.Effective);
        }

        protected override async Task ValidateAsync(SubscriptionDto dto, Subscription? existing, CurrentUserContext user)
        {
            var start = DateTimeHelper.ParseDate(dto.StartDate);
            var end = DateTimeHelper.ParseDate(dto.EndDate);
            new ValidationHelper.Collector()
                .Required(dto.MemberId, "Member")
                .Required(dto.PlanId, "Plan")
                .Required(dto.LocationId, "Location")
                .OneOf(dto.Status, MembershipRules.SubscriptionStatuses, "Status")
                .OneOf(dto.BillingCycle, MembershipRules.BillingCycles, "Billing cycle")
                .Must(start != null && end != null, "Start and end dates are required.")
                .Must(start == null || end == null || end >= start, "End date cannot be before the start date.")
                .Min(dto.Price, 0, "Price")
                .Must(dto.CreditsUsed <= dto.CreditsTotal || dto.CreditsTotal == 0, "Credits used cannot exceed the credits allocated.")
                .ThrowIfInvalid();

            if (!(await Repo<Plan>().FindAsync(p => p.Id == dto.PlanId)).Any())
            {
                throw new ValidationException("The selected plan does not exist.");
            }

            if (!(await Repo<Member>().FindAsync(m => m.Id == dto.MemberId)).Any())
            {
                throw new ValidationException("The selected member does not exist.");
            }
        }

        /// <summary>Plan.Subscribers is derived from the live subscriptions, never trusted from the browser.</summary>
        protected override async Task OnSavedAsync(Subscription entity, bool isNew, CurrentUserContext user)
        {
            var planIds = new[] { entity.PlanId };
            foreach (var plan in await Repo<Plan>().FindAsync(p => planIds.Contains(p.Id)))
            {
                var live = MembershipRules.LiveStatuses;
                plan.Subscribers = (await Repository.FindAsync(s => s.PlanId == plan.Id && live.Contains(s.Status))).Count();
            }

            await UnitOfWork.CompleteAsync();
        }
    }

    /// <summary>Booking-credit ledger.</summary>
    public class CreditTransactionService : CrudServiceBase<CreditTransaction, CreditTransactionDto>, ICreditTransactionService
    {
        private static readonly string[] Types = { "ALLOCATED", "USED", "REFUNDED", "ADJUSTED", "EXPIRED" };

        public CreditTransactionService(ServiceContext context) : base(context) { }

        protected override string EntityName => "Credit transaction";
        protected override string ModuleKey => "subscriptions";
        protected override string IdPrefix => "CRT";
        protected override bool AllowDelete => false;

        protected override Expression<Func<CreditTransaction, bool>> IdEquals(string id) => e => e.Id == id;
        protected override string KeyOf(CreditTransaction entity) => entity.Id;
        protected override void SetKey(CreditTransaction entity, string id) => entity.Id = id;

        protected override Expression<Func<CreditTransaction, bool>>? MemberFilter(CurrentUserContext user)
        {
            var memberId = user.MemberId;
            return e => e.MemberId == memberId;
        }

        protected override Expression<Func<CreditTransaction, bool>>? LocationFilter(IReadOnlyCollection<string> locationIds) =>
            e => locationIds.Contains(e.Member.LocationId);

        protected override bool MemberCanCreate(CreditTransaction entity, CurrentUserContext user) =>
            entity.MemberId == user.MemberId && entity.TransactionType != "ADJUSTED";

        protected override IEnumerable<string?> SearchValues(CreditTransactionDto dto) => new[] { dto.Id, dto.MemberId, dto.Reference, dto.Note };
        protected override IEnumerable<CreditTransactionDto> DefaultOrder(IEnumerable<CreditTransactionDto> items) => items.OrderByDescending(c => c.Date);

        protected override CreditTransactionDto ToDto(CreditTransaction e) => new()
        {
            Id = e.Id,
            MemberId = e.MemberId,
            Date = DateTimeHelper.ToIso(e.TransactionDate),
            Type = e.TransactionType,
            Amount = e.Amount,
            Reference = e.Reference,
            Note = e.Note,
        };

        protected override void MapToEntity(CreditTransactionDto dto, CreditTransaction e, bool isNew)
        {
            e.MemberId = dto.MemberId;
            e.TransactionDate = DateTimeHelper.ParseUtc(dto.Date) ?? DateTime.UtcNow;
            e.TransactionType = dto.Type;
            e.Amount = dto.Amount;
            e.Reference = dto.Reference ?? string.Empty;
            e.Note = dto.Note ?? string.Empty;
        }

        protected override async Task ValidateAsync(CreditTransactionDto dto, CreditTransaction? existing, CurrentUserContext user)
        {
            new ValidationHelper.Collector()
                .Required(dto.MemberId, "Member")
                .OneOf(dto.Type, Types, "Type")
                .Must(dto.Amount != 0, "Amount cannot be zero.")
                .ThrowIfInvalid();

            if (!(await Repo<Member>().FindAsync(m => m.Id == dto.MemberId)).Any())
            {
                throw new ValidationException("The selected member does not exist.");
            }
        }
    }
}
