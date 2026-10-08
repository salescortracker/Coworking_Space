using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using officera.BusinessAccessLayer.DTOs;
using officera.BusinessAccessLayer.Interfaces;
using officera.Shared.Common;

namespace officera_API.Controllers
{
    /// <summary>
    /// Standard POST endpoints for a signed-in module:
    /// POST api/{Module}/Get · GetById · Save · Update · Delete.
    /// Fine-grained rules (permission matrix, location scope, member ownership) are enforced in the business layer.
    /// </summary>
    [ApiController]
    [Authorize]
    [Route("api/[controller]")]
    [Produces("application/json")]
    public abstract class CrudControllerBase<TDto> : ControllerBase where TDto : class, IEntityDto
    {
        protected readonly ICrudService<TDto> Service;

        protected CrudControllerBase(ICrudService<TDto> service)
        {
            Service = service;
        }

        /// <summary>Search / filter / sort / paginate. PageSize 0 returns every row you may see.</summary>
        [HttpPost("Get")]
        public virtual async Task<ActionResult<ApiResponse<PagedResult<TDto>>>> Get([FromBody] PagedRequest? request) =>
            Ok(ApiResponse<PagedResult<TDto>>.Ok(await Service.GetAsync(request ?? new PagedRequest())));

        [HttpPost("GetById")]
        public virtual async Task<ActionResult<ApiResponse<TDto>>> GetById([FromBody] IdRequest request) =>
            Ok(ApiResponse<TDto>.Ok(await Service.GetByIdAsync(request.Id)));

        [HttpPost("Save")]
        public virtual async Task<ActionResult<ApiResponse<TDto>>> Save([FromBody] TDto dto)
        {
            var saved = await Service.SaveAsync(dto);
            return StatusCode(201, ApiResponse<TDto>.Created(saved));
        }

        [HttpPost("Update")]
        public virtual async Task<ActionResult<ApiResponse<TDto>>> Update([FromBody] TDto dto) =>
            Ok(ApiResponse<TDto>.Ok(await Service.UpdateAsync(dto), "Updated successfully"));

        [HttpPost("Delete")]
        public virtual async Task<ActionResult<ApiResponse>> Delete([FromBody] IdRequest request)
        {
            await Service.DeleteAsync(request.Id);
            return Ok(ApiResponse.Ok("Deleted successfully"));
        }
    }

    /// <summary>
    /// Same endpoints, but Get / GetById are open to the public website (the business layer limits anonymous
    /// callers to published / active rows). Save / Update / Delete still require a signed-in user.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Produces("application/json")]
    public abstract class PublicReadCrudControllerBase<TDto> : ControllerBase where TDto : class, IEntityDto
    {
        protected readonly ICrudService<TDto> Service;

        protected PublicReadCrudControllerBase(ICrudService<TDto> service)
        {
            Service = service;
        }

        [AllowAnonymous]
        [HttpPost("Get")]
        public virtual async Task<ActionResult<ApiResponse<PagedResult<TDto>>>> Get([FromBody] PagedRequest? request) =>
            Ok(ApiResponse<PagedResult<TDto>>.Ok(await Service.GetAsync(request ?? new PagedRequest())));

        [AllowAnonymous]
        [HttpPost("GetById")]
        public virtual async Task<ActionResult<ApiResponse<TDto>>> GetById([FromBody] IdRequest request) =>
            Ok(ApiResponse<TDto>.Ok(await Service.GetByIdAsync(request.Id)));

        [Authorize]
        [HttpPost("Save")]
        public virtual async Task<ActionResult<ApiResponse<TDto>>> Save([FromBody] TDto dto)
        {
            var saved = await Service.SaveAsync(dto);
            return StatusCode(201, ApiResponse<TDto>.Created(saved));
        }

        [Authorize]
        [HttpPost("Update")]
        public virtual async Task<ActionResult<ApiResponse<TDto>>> Update([FromBody] TDto dto) =>
            Ok(ApiResponse<TDto>.Ok(await Service.UpdateAsync(dto), "Updated successfully"));

        [Authorize]
        [HttpPost("Delete")]
        public virtual async Task<ActionResult<ApiResponse>> Delete([FromBody] IdRequest request)
        {
            await Service.DeleteAsync(request.Id);
            return Ok(ApiResponse.Ok("Deleted successfully"));
        }
    }
}
