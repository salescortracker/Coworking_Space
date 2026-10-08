using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace officera.Shared.Common
{
    /// <summary>
    /// Common envelope returned by every Officera API endpoint.
    /// </summary>
    public class ApiResponse<T>
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
        public T? Data { get; set; }
        public List<string> Errors { get; set; } = new();
        public int StatusCode { get; set; } = 200;

        public static ApiResponse<T> Ok(T data, string message = "Success") =>
            new() { Success = true, Message = message, Data = data, StatusCode = 200 };

        public static ApiResponse<T> Created(T data, string message = "Created successfully") =>
            new() { Success = true, Message = message, Data = data, StatusCode = 201 };

        public static ApiResponse<T> Fail(string message, int statusCode = 400, IEnumerable<string>? errors = null) =>
            new() { Success = false, Message = message, StatusCode = statusCode, Errors = errors?.ToList() ?? new List<string>() };
    }

    /// <summary>
    /// Non-generic response used for operations that return no data (delete, logout ...).
    /// </summary>
    public class ApiResponse : ApiResponse<object>
    {
        public static ApiResponse Ok(string message = "Success") =>
            new() { Success = true, Message = message, StatusCode = 200 };

        public static new ApiResponse Fail(string message, int statusCode = 400, IEnumerable<string>? errors = null) =>
            new() { Success = false, Message = message, StatusCode = statusCode, Errors = errors?.ToList() ?? new List<string>() };
    }
}
