namespace officera.Shared.Common
{
    /// <summary>
    /// Request body for every POST /api/{Module}/Get endpoint (search, filter, sort, paging).
    /// PageSize = 0 returns every row the caller is allowed to see (capped by <see cref="MaxUnpagedRows"/>).
    /// </summary>
    public class PagedRequest
    {
        public const int MaxPageSize = 500;
        public const int MaxUnpagedRows = 10000;

        public int PageNumber { get; set; } = 1;
        public int PageSize { get; set; } = 10;
        public string? Search { get; set; }
        public string? SortBy { get; set; }
        /// <summary>"asc" or "desc".</summary>
        public string? SortDirection { get; set; }
        /// <summary>Exact-match filters on DTO properties, e.g. { "status": "ACTIVE", "locationId": "LOC-0001" }.</summary>
        public Dictionary<string, string>? Filters { get; set; }
        /// <summary>Restricts location-bound records to these locations (global location selector).</summary>
        public List<string>? LocationIds { get; set; }

        public int NormalizedPageNumber => PageNumber < 1 ? 1 : PageNumber;

        public int NormalizedPageSize => PageSize <= 0 ? MaxUnpagedRows : Math.Min(PageSize, MaxPageSize);
    }

    public class PagedResult<T>
    {
        public List<T> Items { get; set; } = new();
        public int TotalCount { get; set; }
        public int PageNumber { get; set; } = 1;
        public int PageSize { get; set; }
        public int TotalPages { get; set; }

        public static PagedResult<T> Create(IReadOnlyCollection<T> all, PagedRequest request)
        {
            var size = request.NormalizedPageSize;
            var page = request.NormalizedPageNumber;
            var items = all.Skip((page - 1) * size).Take(size).ToList();
            return new PagedResult<T>
            {
                Items = items,
                TotalCount = all.Count,
                PageNumber = page,
                PageSize = request.PageSize <= 0 ? all.Count : size,
                TotalPages = size == 0 ? 0 : (int)Math.Ceiling(all.Count / (double)size),
            };
        }
    }

    /// <summary>Body for GetById / Delete endpoints.</summary>
    public class IdRequest
    {
        public string Id { get; set; } = string.Empty;
    }
}
