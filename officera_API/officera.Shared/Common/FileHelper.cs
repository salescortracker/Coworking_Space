namespace officera.Shared.Common
{
    /// <summary>
    /// Upload validation shared by the file API: extension allow-list, content sniffing,
    /// safe generated names and path-traversal protection.
    /// </summary>
    public static class FileHelper
    {
        public static readonly IReadOnlyDictionary<string, string[]> AllowedExtensions = new Dictionary<string, string[]>
        {
            [FileCategories.Images] = new[] { ".jpg", ".jpeg", ".png", ".webp" },
            [FileCategories.Profiles] = new[] { ".jpg", ".jpeg", ".png", ".webp" },
            [FileCategories.Documents] = new[] { ".pdf" },
            [FileCategories.Attachments] = new[] { ".jpg", ".jpeg", ".png", ".webp", ".pdf" },
        };

        private static readonly Dictionary<string, string> ContentTypes = new()
        {
            [".jpg"] = "image/jpeg",
            [".jpeg"] = "image/jpeg",
            [".png"] = "image/png",
            [".webp"] = "image/webp",
            [".pdf"] = "application/pdf",
        };

        public static bool IsAllowedExtension(string category, string extension) =>
            AllowedExtensions.TryGetValue(category, out var list) && list.Contains(extension.ToLowerInvariant());

        public static string ContentTypeFor(string extension) =>
            ContentTypes.TryGetValue(extension.ToLowerInvariant(), out var type) ? type : "application/octet-stream";

        /// <summary>
        /// Checks the file signature ("magic bytes") so a renamed executable cannot pass as an image or PDF.
        /// </summary>
        public static bool HasValidSignature(string extension, ReadOnlySpan<byte> header)
        {
            switch (extension.ToLowerInvariant())
            {
                case ".jpg":
                case ".jpeg":
                    return header.Length >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF;
                case ".png":
                    return header.Length >= 8 && header[..8].SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A });
                case ".webp":
                    return header.Length >= 12
                        && header[..4].SequenceEqual("RIFF"u8)
                        && header.Slice(8, 4).SequenceEqual("WEBP"u8);
                case ".pdf":
                    return header.Length >= 5 && header[..5].SequenceEqual("%PDF-"u8);
                default:
                    return false;
            }
        }

        /// <summary>Random file name that keeps only the (validated) extension of the original.</summary>
        public static string GenerateSafeFileName(string extension) =>
            $"{Guid.NewGuid():N}{extension.ToLowerInvariant()}";

        /// <summary>Display-safe version of the original name (no path parts or control characters).</summary>
        public static string SanitizeOriginalName(string? name)
        {
            var file = Path.GetFileName(name ?? string.Empty);
            var invalid = Path.GetInvalidFileNameChars();
            var cleaned = new string(file.Where(c => !invalid.Contains(c) && !char.IsControl(c)).ToArray()).Trim();
            if (cleaned.Length > 200)
            {
                cleaned = cleaned[^200..];
            }
            return string.IsNullOrWhiteSpace(cleaned) ? "file" : cleaned;
        }

        /// <summary>Resolves <paramref name="relative"/> inside <paramref name="root"/> and refuses anything that escapes it.</summary>
        public static string SafeCombine(string root, string relative)
        {
            var fullRoot = Path.GetFullPath(root);
            var full = Path.GetFullPath(Path.Combine(fullRoot, relative));
            var rootWithSep = fullRoot.EndsWith(Path.DirectorySeparatorChar) ? fullRoot : fullRoot + Path.DirectorySeparatorChar;
            if (!full.StartsWith(rootWithSep, StringComparison.OrdinalIgnoreCase))
            {
                throw new ValidationException("Invalid file path.");
            }
            return full;
        }

        public static string FormatSize(long bytes) =>
            bytes >= 1_000_000 ? $"{bytes / 1_000_000d:0.#} MB" : $"{Math.Max(1, bytes / 1000)} KB";
    }
}
