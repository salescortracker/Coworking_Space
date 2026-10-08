using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using officera.TestCases.Infrastructure;

namespace officera.TestCases
{
    /// <summary>Login, JWT validation and role authorization through the HTTP pipeline.</summary>
    [Collection(ApiCollection.Name)]
    public class AuthenticationTests
    {
        private readonly OfficeraApiFactory _factory;

        public AuthenticationTests(ApiFixture fixture)
        {
            _factory = fixture.Factory;
        }

        [Fact]
        public async Task ValidLogin_ReturnsJwtUserAndPermissions()
        {
            var token = await _factory.TokenAsync(OfficeraApiFactory.AdminEmail, OfficeraApiFactory.AdminPassword);
            Assert.False(string.IsNullOrWhiteSpace(token));

            var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);
            Assert.Equal("USR-0001", jwt.Claims.First(c => c.Type == "uid").Value);
            Assert.Equal("SUPER_ADMIN", jwt.Claims.First(c => c.Type == ClaimTypes.Role).Value);

            var me = await (await _factory.Authorized(token).PostAsync("/api/Auth/Me", null)).DataAsync();
            Assert.Equal(OfficeraApiFactory.AdminEmail, me.GetProperty("user").GetProperty("email").GetString());
            Assert.True(me.GetProperty("permissions").GetArrayLength() > 0);
        }

        [Fact]
        public async Task InvalidPassword_Returns401_WithAttemptsLeft_AndNoToken()
        {
            using var client = _factory.CreateClient();
            var res = await client.PostAsJsonAsync("/api/Auth/Login", new { email = "inactive@test.local", password = "Wrong@Pass1" });
            Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
            var data = await res.DataAsync();
            Assert.Equal("INVALID_CREDENTIALS", data.GetProperty("code").GetString());
            Assert.True(data.GetProperty("attemptsLeft").GetInt32() < 5);
        }

        [Fact]
        public async Task UnknownEmail_Returns401()
        {
            using var client = _factory.CreateClient();
            var res = await client.PostAsJsonAsync("/api/Auth/Login", new { email = "nobody@test.local", password = "Whatever@1" });
            Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
        }

        [Fact]
        public async Task EmptyCredentials_Returns400()
        {
            using var client = _factory.CreateClient();
            var res = await client.PostAsJsonAsync("/api/Auth/Login", new { email = "", password = "" });
            Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        }

        [Fact]
        public async Task ProtectedApi_WithoutToken_Returns401()
        {
            using var client = _factory.CreateClient();
            var res = await client.PostAsJsonAsync("/api/Member/Get", new { pageSize = 0 });
            Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
        }

        [Fact]
        public async Task ProtectedApi_WithTamperedToken_Returns401()
        {
            var token = await _factory.TokenAsync(OfficeraApiFactory.AdminEmail, OfficeraApiFactory.AdminPassword);
            var tampered = token[..^4] + (token.EndsWith("AAAA") ? "BBBB" : "AAAA");
            var res = await _factory.Authorized(tampered).PostAsJsonAsync("/api/Member/Get", new { pageSize = 0 });
            Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
        }

        [Fact]
        public async Task ProtectedApi_WithExpiredToken_Returns401()
        {
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(OfficeraApiFactory.JwtKey));
            var expired = new JwtSecurityToken(
                issuer: "https://officera.test",
                audience: "https://officera.test",
                claims: new[] { new Claim("uid", "USR-0001"), new Claim(ClaimTypes.Role, "SUPER_ADMIN") },
                notBefore: DateTime.UtcNow.AddHours(-3),
                expires: DateTime.UtcNow.AddHours(-2),
                signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
            var res = await _factory.Authorized(new JwtSecurityTokenHandler().WriteToken(expired)).PostAsJsonAsync("/api/Member/Get", new { pageSize = 0 });
            Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
        }

        [Fact]
        public async Task TokenForDeactivatedUser_IsRejected()
        {
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(OfficeraApiFactory.JwtKey));
            var token = new JwtSecurityToken(
                issuer: "https://officera.test",
                audience: "https://officera.test",
                claims: new[] { new Claim("uid", "USR-0003"), new Claim(ClaimTypes.Role, "FRONT_DESK") },
                expires: DateTime.UtcNow.AddMinutes(10),
                signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
            var res = await _factory.Authorized(new JwtSecurityTokenHandler().WriteToken(token)).PostAsJsonAsync("/api/Booking/Get", new { pageSize = 0 });
            Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
        }

        [Fact]
        public async Task Member_CannotReadAuditLogs_OrCreateLocations()
        {
            var member = await _factory.MemberClientAsync();
            Assert.Equal(HttpStatusCode.Forbidden, (await member.PostAsJsonAsync("/api/AuditLog/Get", new { pageSize = 0 })).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await member.PostAsJsonAsync("/api/Location/Save", new { name = "x" })).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await member.PostAsJsonAsync("/api/Role/Get", new { pageSize = 0 })).StatusCode);
        }

        [Fact]
        public async Task Member_CannotGrantThemselvesAdminRole()
        {
            var member = await _factory.MemberClientAsync();
            var me = (await (await member.PostAsJsonAsync("/api/User/Get", new { pageSize = 0 })).DataAsync()).GetProperty("items")[0];
            var body = System.Text.Json.Nodes.JsonNode.Parse(me.GetRawText())!.AsObject();
            body["role"] = "SUPER_ADMIN";
            body["status"] = "ACTIVE";

            var updated = await (await member.PostAsJsonAsync("/api/User/Update", body)).DataAsync();
            Assert.Equal("MEMBER", updated.GetProperty("role").GetString());
        }

        [Fact]
        public async Task Member_OnlySeesOwnMemberRecord()
        {
            var member = await _factory.MemberClientAsync();
            var page = await (await member.PostAsJsonAsync("/api/Member/Get", new { pageSize = 0 })).DataAsync();
            Assert.All(page.GetProperty("items").EnumerateArray(), m => Assert.Equal("MEM-0001", m.GetProperty("id").GetString()));
        }

        [Fact]
        public async Task PublicCatalogue_IsReadableWithoutToken()
        {
            using var client = _factory.CreateClient();
            var res = await client.PostAsJsonAsync("/api/Location/Get", new { pageSize = 0 });
            Assert.Equal(HttpStatusCode.OK, res.StatusCode);
            Assert.True((await res.DataAsync()).GetProperty("totalCount").GetInt32() >= 1);
        }
    }
}
