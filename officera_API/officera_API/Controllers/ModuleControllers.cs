using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using officera.BusinessAccessLayer.DTOs;
using officera.BusinessAccessLayer.Interfaces;
using officera.Shared.Common;

namespace officera_API.Controllers
{
    // ---------------------------------------------------------------- Workspace (public catalogue)

    /// <summary>Locations – Workspace › Locations, public search and location pages.</summary>
    public class LocationController : PublicReadCrudControllerBase<LocationDto>
    {
        public LocationController(ILocationService service) : base(service) { }
    }

    /// <summary>Resources (desks, offices, meeting rooms) – Workspace › Resources, floor maps, booking wizard.</summary>
    public class ResourceController : PublicReadCrudControllerBase<ResourceDto>
    {
        public ResourceController(IResourceService service) : base(service) { }
    }

    /// <summary>Membership plans – Plans and Promotions, public pricing.</summary>
    public class PlanController : PublicReadCrudControllerBase<PlanDto>
    {
        public PlanController(IPlanService service) : base(service) { }
    }

    /// <summary>Community events – public events page and member community.</summary>
    public class EventController : PublicReadCrudControllerBase<EventDto>
    {
        public EventController(IEventService service) : base(service) { }
    }

    /// <summary>Blog posts – Marketing Content › Blog and public blog.</summary>
    public class BlogPostController : PublicReadCrudControllerBase<BlogPostDto>
    {
        public BlogPostController(IBlogPostService service) : base(service) { }
    }

    /// <summary>Gallery – Marketing Content › Gallery and public gallery.</summary>
    public class GalleryController : PublicReadCrudControllerBase<GalleryItemDto>
    {
        public GalleryController(IGalleryService service) : base(service) { }
    }

    /// <summary>Integrations – Configuration / Integrations (Super Admin). Anonymous callers only see which providers are active.</summary>
    public class IntegrationController : PublicReadCrudControllerBase<IntegrationDto>
    {
        private readonly IIntegrationService _integrations;

        public IntegrationController(IIntegrationService service) : base(service)
        {
            _integrations = service;
        }

        /// <summary>Runs a server-side connection test with the stored credentials.</summary>
        [Authorize(Roles = RoleKeys.SuperAdmin)]
        [HttpPost("Test")]
        public async Task<ActionResult<ApiResponse<ConnectionTestDto>>> Test([FromBody] IdRequest request) =>
            Ok(ApiResponse<ConnectionTestDto>.Ok(await _integrations.TestConnectionAsync(request.Id)));

        [Authorize(Roles = RoleKeys.SuperAdmin)]
        public override Task<ActionResult<ApiResponse<IntegrationDto>>> Save([FromBody] IntegrationDto dto) => base.Save(dto);

        [Authorize(Roles = RoleKeys.SuperAdmin)]
        public override Task<ActionResult<ApiResponse<IntegrationDto>>> Update([FromBody] IntegrationDto dto) => base.Update(dto);

        [Authorize(Roles = RoleKeys.SuperAdmin)]
        public override Task<ActionResult<ApiResponse>> Delete([FromBody] IdRequest request) => base.Delete(request);
    }

    // ---------------------------------------------------------------- People

    public class MemberController : CrudControllerBase<MemberDto>
    {
        public MemberController(IMemberService service) : base(service) { }
    }

    public class CompanyController : CrudControllerBase<CompanyDto>
    {
        public CompanyController(ICompanyService service) : base(service) { }
    }

    /// <summary>Staff users and member logins. Members can only read and edit their own profile.</summary>
    public class UserController : CrudControllerBase<UserDto>
    {
        public UserController(IUserService service) : base(service) { }
    }

    /// <summary>Roles and permission matrix (staff only).</summary>
    [Authorize(Roles = RoleKeys.StaffRoles)]
    public class RoleController : CrudControllerBase<RoleDto>
    {
        private readonly IRoleService _roles;

        public RoleController(IRoleService service) : base(service)
        {
            _roles = service;
        }

        /// <summary>The permission catalogue (rows of the permission matrix).</summary>
        [HttpPost("GetPermissions")]
        public async Task<ActionResult<ApiResponse<List<PermissionDto>>>> GetPermissions() =>
            Ok(ApiResponse<List<PermissionDto>>.Ok(await _roles.GetPermissionsAsync()));
    }

    // ---------------------------------------------------------------- Membership

    public class PromotionController : CrudControllerBase<PromotionDto>
    {
        public PromotionController(IPromotionService service) : base(service) { }
    }

    public class SubscriptionController : CrudControllerBase<SubscriptionDto>
    {
        public SubscriptionController(ISubscriptionService service) : base(service) { }
    }

    public class CreditTransactionController : CrudControllerBase<CreditTransactionDto>
    {
        public CreditTransactionController(ICreditTransactionService service) : base(service) { }
    }

    // ---------------------------------------------------------------- Bookings & finance

    public class BookingController : CrudControllerBase<BookingDto>
    {
        private readonly IBookingService _bookings;

        public BookingController(IBookingService service) : base(service)
        {
            _bookings = service;
        }

        /// <summary>Occupied slots without member details – availability grid and public search.</summary>
        [AllowAnonymous]
        [HttpPost("GetOccupancy")]
        public async Task<ActionResult<ApiResponse<List<OccupancySlotDto>>>> GetOccupancy([FromBody] OccupancyRequest? request) =>
            Ok(ApiResponse<List<OccupancySlotDto>>.Ok(await _bookings.GetOccupancyAsync(request ?? new OccupancyRequest())));
    }

    public class PaymentController : CrudControllerBase<PaymentDto>
    {
        private readonly IPaymentGatewayService _gateway;

        public PaymentController(IPaymentService service, IPaymentGatewayService gateway) : base(service)
        {
            _gateway = gateway;
        }

        /// <summary>The active payment gateway (from Configuration / Integrations), without secrets.</summary>
        [HttpPost("GetGateway")]
        public async Task<ActionResult<ApiResponse<PaymentGatewayInfo?>>> GetGateway() =>
            Ok(ApiResponse<PaymentGatewayInfo?>.Ok(await _gateway.GetActiveGatewayAsync()));
    }

    public class InvoiceController : CrudControllerBase<InvoiceDto>
    {
        public InvoiceController(IInvoiceService service) : base(service) { }
    }

    public class RefundController : CrudControllerBase<RefundDto>
    {
        public RefundController(IRefundService service) : base(service) { }
    }

    public class CreditNoteController : CrudControllerBase<CreditNoteDto>
    {
        public CreditNoteController(ICreditNoteService service) : base(service) { }
    }

    // ---------------------------------------------------------------- Operations

    public class VisitorController : CrudControllerBase<VisitorDto>
    {
        public VisitorController(IVisitorService service) : base(service) { }
    }

    public class AccessCredentialController : CrudControllerBase<AccessCredentialDto>
    {
        public AccessCredentialController(IAccessCredentialService service) : base(service) { }
    }

    public class AccessLogController : CrudControllerBase<AccessLogDto>
    {
        public AccessLogController(IAccessLogService service) : base(service) { }
    }

    /// <summary>Support tickets.</summary>
    public class SupportController : CrudControllerBase<TicketDto>
    {
        public SupportController(ITicketService service) : base(service) { }
    }

    public class NotificationController : CrudControllerBase<NotificationDto>
    {
        public NotificationController(INotificationDataService service) : base(service) { }
    }

    public class NotificationTemplateController : CrudControllerBase<NotificationTemplateDto>
    {
        public NotificationTemplateController(INotificationTemplateService service) : base(service) { }
    }

    public class NotificationLogController : CrudControllerBase<NotificationLogDto>
    {
        public NotificationLogController(INotificationLogService service) : base(service) { }
    }

    public class AuditLogController : CrudControllerBase<AuditLogDto>
    {
        public AuditLogController(IAuditLogService service) : base(service) { }
    }

    // ---------------------------------------------------------------- CRM & community

    /// <summary>CRM leads (staff). Website enquiries arrive through the anonymous Capture endpoint after OTP verification.</summary>
    [Authorize(Roles = RoleKeys.StaffRoles)]
    public class LeadController : CrudControllerBase<LeadDto>
    {
        private readonly ILeadService _leads;

        public LeadController(ILeadService service) : base(service)
        {
            _leads = service;
        }

        [AllowAnonymous]
        [EnableRateLimiting("auth")]
        [HttpPost("Capture")]
        public async Task<ActionResult<ApiResponse<LeadDto>>> Capture([FromBody] LeadCaptureRequest request) =>
            StatusCode(201, ApiResponse<LeadDto>.Created(await _leads.CaptureAsync(request), "Thank you! Our team will contact you shortly."));
    }

    public class PostController : CrudControllerBase<PostDto>
    {
        public PostController(IPostService service) : base(service) { }
    }

    public class PerkController : CrudControllerBase<PerkDto>
    {
        public PerkController(IPerkService service) : base(service) { }
    }
}
