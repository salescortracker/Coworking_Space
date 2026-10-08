using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using officera.BusinessAccessLayer.DTOs;
using officera.BusinessAccessLayer.Interfaces;
using officera.Shared.Common;

namespace officera_API.Controllers
{
    /// <summary>Organisation settings (Administration › Settings). Read is public because invoices and prices use the GST rate.</summary>
    [ApiController]
    [Route("api/[controller]")]
    [Produces("application/json")]
    public class ConfigurationController : ControllerBase
    {
        private readonly ISettingsService _settings;

        public ConfigurationController(ISettingsService settings)
        {
            _settings = settings;
        }

        [AllowAnonymous]
        [HttpPost("Get")]
        public async Task<ActionResult<ApiResponse<OrgSettingsDto>>> Get() =>
            Ok(ApiResponse<OrgSettingsDto>.Ok(await _settings.GetAsync()));

        [Authorize(Roles = RoleKeys.StaffRoles)]
        [HttpPost("Update")]
        public async Task<ActionResult<ApiResponse<OrgSettingsDto>>> Update([FromBody] OrgSettingsDto dto) =>
            Ok(ApiResponse<OrgSettingsDto>.Ok(await _settings.UpdateAsync(dto), "Settings saved"));
    }

    /// <summary>Homepage marketing content (Marketing Content › Homepage).</summary>
    [ApiController]
    [Route("api/[controller]")]
    [Produces("application/json")]
    public class HomepageController : ControllerBase
    {
        private readonly IHomepageContentService _content;

        public HomepageController(IHomepageContentService content)
        {
            _content = content;
        }

        [AllowAnonymous]
        [HttpPost("Get")]
        public async Task<ActionResult<ApiResponse<HomepageContentDto>>> Get() =>
            Ok(ApiResponse<HomepageContentDto>.Ok(await _content.GetAsync()));

        [Authorize(Roles = RoleKeys.StaffRoles)]
        [HttpPost("Update")]
        public async Task<ActionResult<ApiResponse<HomepageContentDto>>> Update([FromBody] HomepageContentDto dto) =>
            Ok(ApiResponse<HomepageContentDto>.Ok(await _content.UpdateAsync(dto), "Homepage updated"));
    }

    /// <summary>Dropdown reference data.</summary>
    [ApiController]
    [Route("api/[controller]")]
    [Produces("application/json")]
    public class LookupController : ControllerBase
    {
        private readonly ILookupService _lookups;

        public LookupController(ILookupService lookups)
        {
            _lookups = lookups;
        }

        /// <summary>Indian states with GST state codes.</summary>
        [AllowAnonymous]
        [HttpPost("GetStates")]
        public async Task<ActionResult<ApiResponse<List<StateDto>>>> GetStates() =>
            Ok(ApiResponse<List<StateDto>>.Ok(await _lookups.GetStatesAsync()));
    }

    /// <summary>Operator dashboard KPIs and charts calculated from the database.</summary>
    [ApiController]
    [Authorize(Roles = RoleKeys.StaffRoles)]
    [Route("api/[controller]")]
    [Produces("application/json")]
    public class DashboardController : ControllerBase
    {
        private readonly IDashboardService _dashboard;

        public DashboardController(IDashboardService dashboard)
        {
            _dashboard = dashboard;
        }

        [HttpPost("GetSummary")]
        public async Task<ActionResult<ApiResponse<DashboardSummaryDto>>> GetSummary([FromBody] DashboardRequest? request) =>
            Ok(ApiResponse<DashboardSummaryDto>.Ok(await _dashboard.GetSummaryAsync(request ?? new DashboardRequest())));
    }

    /// <summary>
    /// Reserves human-readable ids (BKG-0042 ...) so the app can show a new record immediately while it is saved.
    /// </summary>
    [ApiController]
    [Authorize]
    [Route("api/[controller]")]
    [Produces("application/json")]
    public class IdsController : ControllerBase
    {
        private readonly IIdSequenceService _ids;

        public IdsController(IIdSequenceService ids)
        {
            _ids = ids;
        }

        [HttpPost("Reserve")]
        public async Task<ActionResult<ApiResponse<Dictionary<string, List<string>>>>> Reserve([FromBody] ReserveIdsRequest request) =>
            Ok(ApiResponse<Dictionary<string, List<string>>>.Ok(await _ids.ReserveIdsAsync(request.Prefixes, request.Count)));
    }

    /// <summary>
    /// File uploads (multipart/form-data). Files are validated (extension, size, signature), renamed and stored
    /// under wwwroot/uploads/{category}. The response carries the URL path to use in the app.
    /// </summary>
    [ApiController]
    [Authorize]
    [Route("api/[controller]")]
    [Produces("application/json")]
    public class FileController : ControllerBase
    {
        private readonly IFileStorageService _storage;
        private readonly FileStorageOptions _options;

        public FileController(IFileStorageService storage, IOptions<FileStorageOptions> options)
        {
            _storage = storage;
            _options = options.Value;
        }

        /// <param name="files">One or more files (field name "files").</param>
        /// <param name="category">images | documents | profiles | attachments</param>
        [HttpPost("Upload")]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(50 * 1024 * 1024)]
        public async Task<ActionResult<ApiResponse<List<FileUploadResultDto>>>> Upload([FromForm] List<IFormFile> files, [FromForm] string category = FileCategories.Attachments)
        {
            if (files == null || files.Count == 0)
            {
                throw new ValidationException("Please choose at least one file.");
            }

            if (files.Count > _options.MaxFilesPerRequest)
            {
                throw new ValidationException($"You can upload at most {_options.MaxFilesPerRequest} files at a time.");
            }

            var results = new List<FileUploadResultDto>();
            foreach (var file in files)
            {
                await using var stream = file.OpenReadStream();
                results.Add(await _storage.SaveAsync(stream, file.FileName, file.Length, category));
            }

            return StatusCode(201, ApiResponse<List<FileUploadResultDto>>.Created(results, $"{results.Count} file(s) uploaded"));
        }
    }
}
