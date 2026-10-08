using System.Text.Json;

namespace officera.BusinessAccessLayer.DTOs
{
    /// <summary>Every CRUD DTO is addressed by its business id (LOC-0001 ...).</summary>
    public interface IEntityDto
    {
        string Id { get; set; }
    }

    /// <summary>Comment on a ticket, lead or community post (frontend: Comment).</summary>
    public class CommentDto
    {
        public string Id { get; set; } = string.Empty;
        public string Author { get; set; } = string.Empty;
        public string? AuthorRole { get; set; }
        public string Text { get; set; } = string.Empty;
        public string At { get; set; } = string.Empty;
    }

    /// <summary>Timeline / activity entry (frontend: TimelineEntry).</summary>
    public class TimelineEntryDto
    {
        public string Id { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string At { get; set; } = string.Empty;
        public string? Actor { get; set; }
        public string? Tone { get; set; }
        public string? Icon { get; set; }
    }

    /// <summary>File reference (frontend: Attachment). Url points to the file served from wwwroot/uploads.</summary>
    public class AttachmentDto
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public long Size { get; set; }
        public string Type { get; set; } = string.Empty;
        public string? Url { get; set; }
    }

    /// <summary>Dropdown option.</summary>
    public class LookupItemDto
    {
        public string Value { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
    }

    /// <summary>
    /// Photos are either a catalogue seed number (built-in workspace photography) or the URL of an uploaded image.
    /// They are kept as raw JSON values so both forms round-trip unchanged.
    /// </summary>
    public static class PhotoList
    {
        public static List<JsonElement> Parse(string? json) => officera.Shared.Common.JsonHelper.DeserializeList<JsonElement>(json);
    }
}
