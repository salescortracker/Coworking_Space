using officera.BusinessAccessLayer.DTOs;
using officera.Shared.Common;

namespace officera.BusinessAccessLayer.Interfaces
{
    /// <summary>Standard operations behind POST /api/{Module}/Get | GetById | Save | Update | Delete.</summary>
    public interface ICrudService<TDto> where TDto : class, IEntityDto
    {
        Task<PagedResult<TDto>> GetAsync(PagedRequest request);
        Task<TDto> GetByIdAsync(string id);
        Task<TDto> SaveAsync(TDto dto);
        Task<TDto> UpdateAsync(TDto dto);
        Task DeleteAsync(string id);
    }

    public interface ILocationService : ICrudService<LocationDto> { }
    public interface IResourceService : ICrudService<ResourceDto> { }
    public interface ICompanyService : ICrudService<CompanyDto> { }
    public interface IMemberService : ICrudService<MemberDto> { }
    public interface IUserService : ICrudService<UserDto> { }

    public interface IRoleService : ICrudService<RoleDto>
    {
        Task<List<PermissionDto>> GetPermissionsAsync();
    }

    public interface IPlanService : ICrudService<PlanDto> { }
    public interface IPromotionService : ICrudService<PromotionDto> { }
    public interface ISubscriptionService : ICrudService<SubscriptionDto> { }
    public interface ICreditTransactionService : ICrudService<CreditTransactionDto> { }

    public interface IBookingService : ICrudService<BookingDto>
    {
        /// <summary>Occupied slots (no member details) used for availability and public search.</summary>
        Task<List<OccupancySlotDto>> GetOccupancyAsync(OccupancyRequest request);
    }

    public interface IPaymentService : ICrudService<PaymentDto> { }
    public interface IInvoiceService : ICrudService<InvoiceDto> { }
    public interface IRefundService : ICrudService<RefundDto> { }
    public interface ICreditNoteService : ICrudService<CreditNoteDto> { }
    public interface IVisitorService : ICrudService<VisitorDto> { }
    public interface IAccessCredentialService : ICrudService<AccessCredentialDto> { }
    public interface IAccessLogService : ICrudService<AccessLogDto> { }
    public interface ITicketService : ICrudService<TicketDto> { }
    public interface INotificationDataService : ICrudService<NotificationDto> { }
    public interface INotificationTemplateService : ICrudService<NotificationTemplateDto> { }
    public interface INotificationLogService : ICrudService<NotificationLogDto> { }
    public interface IAuditLogService : ICrudService<AuditLogDto> { }

    public interface ILeadService : ICrudService<LeadDto>
    {
        /// <summary>Anonymous website enquiry, accepted only with a verified mobile OTP.</summary>
        Task<LeadDto> CaptureAsync(LeadCaptureRequest request);
    }

    public interface IPostService : ICrudService<PostDto> { }
    public interface IEventService : ICrudService<EventDto> { }
    public interface IPerkService : ICrudService<PerkDto> { }
    public interface IBlogPostService : ICrudService<BlogPostDto> { }
    public interface IGalleryService : ICrudService<GalleryItemDto> { }

    public interface IIntegrationService : ICrudService<IntegrationDto>
    {
        /// <summary>Runs a server-side connection test and stores the result.</summary>
        Task<ConnectionTestDto> TestConnectionAsync(string id);

        /// <summary>Decrypted configuration of the active, enabled provider for a category (server use only).</summary>
        Task<ActiveProviderConfig?> GetActiveProviderAsync(string category);
    }

    /// <summary>Active provider settings resolved for the integration services. Never returned by an API.</summary>
    public sealed class ActiveProviderConfig
    {
        public string IntegrationId { get; init; } = string.Empty;
        public string ProviderKey { get; init; } = string.Empty;
        public string DisplayName { get; init; } = string.Empty;
        public string Environment { get; init; } = string.Empty;
        public IReadOnlyDictionary<string, string> Config { get; init; } = new Dictionary<string, string>();
        public IReadOnlyDictionary<string, string> Secrets { get; init; } = new Dictionary<string, string>();

        public string Get(string key) =>
            Config.TryGetValue(key, out var v) ? v : Secrets.TryGetValue(key, out var s) ? s : string.Empty;
    }
}
