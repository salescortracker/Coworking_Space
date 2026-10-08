using System.Net;
using System.Net.Http.Headers;
using officera.TestCases.Infrastructure;

namespace officera.TestCases
{
    /// <summary>POST /api/File/Upload: content validation, size limits and safe storage under wwwroot/uploads.</summary>
    [Collection(ApiCollection.Name)]
    public class FileUploadTests
    {
        private static readonly byte[] PngHeader = { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0x0D, 0x49, 0x48, 0x44, 0x52 };
        private readonly OfficeraApiFactory _factory;

        public FileUploadTests(ApiFixture fixture)
        {
            _factory = fixture.Factory;
        }

        private static MultipartFormDataContent Form(string category, params (string Name, byte[] Bytes, string Type)[] files)
        {
            var form = new MultipartFormDataContent();
            foreach (var (name, bytes, type) in files)
            {
                var part = new ByteArrayContent(bytes);
                part.Headers.ContentType = new MediaTypeHeaderValue(type);
                form.Add(part, "files", name);
            }

            form.Add(new StringContent(category), "category");
            return form;
        }

        private static byte[] Png(int size = 64)
        {
            var bytes = new byte[size];
            PngHeader.CopyTo(bytes, 0);
            return bytes;
        }

        [Fact]
        public async Task ValidImage_IsStoredWithGeneratedName_AndServed()
        {
            var client = await _factory.AdminClientAsync();
            var res = await client.PostAsync("/api/File/Upload", Form("images", ("../../evil name.png", Png(), "image/png")));
            Assert.Equal(HttpStatusCode.Created, res.StatusCode);

            var file = (await res.DataAsync())[0];
            var url = file.GetProperty("url").GetString()!;
            Assert.StartsWith("/uploads/images/", url);
            Assert.DoesNotContain("evil", url);
            Assert.DoesNotContain("..", url);
            Assert.Equal("evil name.png", file.GetProperty("name").GetString());
            Assert.True(File.Exists(Path.Combine(_factory.WebRoot, url.TrimStart('/').Replace('/', Path.DirectorySeparatorChar))));

            using var anonymous = _factory.CreateClient();
            var served = await anonymous.GetAsync(url);
            Assert.Equal(HttpStatusCode.OK, served.StatusCode);
            Assert.Equal("nosniff", served.Headers.GetValues("X-Content-Type-Options").Single());
        }

        [Fact]
        public async Task MultipleFiles_AreAllStored()
        {
            var client = await _factory.AdminClientAsync();
            var res = await client.PostAsync("/api/File/Upload", Form("attachments", ("a.png", Png(), "image/png"), ("b.pdf", "%PDF-1.7 test"u8.ToArray(), "application/pdf")));
            Assert.Equal(HttpStatusCode.Created, res.StatusCode);
            Assert.Equal(2, (await res.DataAsync()).GetArrayLength());
        }

        [Fact]
        public async Task InvalidExtension_IsRejected()
        {
            var client = await _factory.AdminClientAsync();
            var res = await client.PostAsync("/api/File/Upload", Form("images", ("tool.exe", new byte[] { 0x4D, 0x5A, 0, 0 }, "application/octet-stream")));
            Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        }

        [Fact]
        public async Task RenamedFile_WithWrongSignature_IsRejected()
        {
            var client = await _factory.AdminClientAsync();
            var res = await client.PostAsync("/api/File/Upload", Form("images", ("photo.png", "not really a png"u8.ToArray(), "image/png")));
            Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        }

        [Fact]
        public async Task OversizedProfilePhoto_IsRejected()
        {
            var client = await _factory.MemberClientAsync();
            var res = await client.PostAsync("/api/File/Upload", Form("profiles", ("me.png", Png(3 * 1024 * 1024), "image/png")));
            Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        }

        [Fact]
        public async Task MissingFile_IsRejected()
        {
            var client = await _factory.AdminClientAsync();
            var res = await client.PostAsync("/api/File/Upload", Form("images"));
            Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        }

        [Fact]
        public async Task UnknownCategory_IsRejected()
        {
            var client = await _factory.AdminClientAsync();
            var res = await client.PostAsync("/api/File/Upload", Form("../secrets", ("a.png", Png(), "image/png")));
            Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        }

        [Fact]
        public async Task Upload_RequiresSignIn()
        {
            using var anonymous = _factory.CreateClient();
            var res = await anonymous.PostAsync("/api/File/Upload", Form("images", ("a.png", Png(), "image/png")));
            Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
        }
    }
}
