using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace officera.Shared.Common
{
    /// <summary>
    /// JSON settings shared by the API and the JSON columns (AmenitiesJson, CommentsJson ...).
    /// camelCase, nulls omitted, DateTime always written as UTC ISO-8601 with "Z".
    /// </summary>
    public static class JsonHelper
    {
        public static readonly JsonSerializerOptions Options = Configure(new JsonSerializerOptions(JsonSerializerDefaults.Web));

        public static JsonSerializerOptions Configure(JsonSerializerOptions options)
        {
            options.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
            options.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
            if (!options.Converters.OfType<UtcDateTimeConverter>().Any())
            {
                options.Converters.Add(new UtcDateTimeConverter());
                options.Converters.Add(new NullableUtcDateTimeConverter());
            }
            return options;
        }

        public static string Serialize<T>(T value) => JsonSerializer.Serialize(value, Options);

        /// <summary>Deserializes a JSON column, returning <paramref name="fallback"/> for empty or invalid JSON.</summary>
        public static T Deserialize<T>(string? json, T fallback)
        {
            if (string.IsNullOrWhiteSpace(json))
            {
                return fallback;
            }

            try
            {
                return JsonSerializer.Deserialize<T>(json, Options) ?? fallback;
            }
            catch (JsonException)
            {
                return fallback;
            }
        }

        public static List<T> DeserializeList<T>(string? json) => Deserialize(json, new List<T>());
    }

    /// <summary>Reads any ISO date-time and normalises it to UTC; writes "yyyy-MM-ddTHH:mm:ss.fffZ".</summary>
    public sealed class UtcDateTimeConverter : JsonConverter<DateTime>
    {
        public override DateTime Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            var text = reader.GetString();
            if (string.IsNullOrWhiteSpace(text))
            {
                throw new JsonException("A date-time value is required.");
            }

            return DateTimeHelper.ParseUtc(text) ?? throw new JsonException($"'{text}' is not a valid date-time.");
        }

        public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options) =>
            writer.WriteStringValue(DateTimeHelper.ToIso(value));
    }

    public sealed class NullableUtcDateTimeConverter : JsonConverter<DateTime?>
    {
        public override DateTime? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            if (reader.TokenType == JsonTokenType.Null)
            {
                return null;
            }

            var text = reader.GetString();
            return string.IsNullOrWhiteSpace(text) ? null : DateTimeHelper.ParseUtc(text);
        }

        public override void Write(Utf8JsonWriter writer, DateTime? value, JsonSerializerOptions options)
        {
            if (value.HasValue)
            {
                writer.WriteStringValue(DateTimeHelper.ToIso(value.Value));
            }
            else
            {
                writer.WriteNullValue();
            }
        }
    }

    internal static class InvariantFormat
    {
        public static readonly CultureInfo Culture = CultureInfo.InvariantCulture;
    }
}
