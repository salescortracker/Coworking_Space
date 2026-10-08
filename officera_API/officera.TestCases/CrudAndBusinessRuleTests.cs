using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using officera.TestCases.Infrastructure;

namespace officera.TestCases
{
    /// <summary>Controller → Service → UnitOfWork/Repository → OfficeraContext round trips and the business rules enforced by the API.</summary>
    [Collection(ApiCollection.Name)]
    public class CrudAndBusinessRuleTests
    {
        private readonly OfficeraApiFactory _factory;

        public CrudAndBusinessRuleTests(ApiFixture fixture)
        {
            _factory = fixture.Factory;
        }

        private static object NewLocation(string name) => new
        {
            name,
            city = "Bengaluru",
            state = "Karnataka",
            address = "12 Residency Road",
            pincode = "560025",
            openingHours = new { weekdays = "8 AM – 9 PM", saturday = "9 AM – 6 PM", sunday = "Closed" },
            amenities = new[] { "High-speed Wi-Fi" },
            photos = new object[] { 11, "/uploads/images/a.jpg" },
            status = "ACTIVE",
            description = "",
            spaceTypes = new[] { "HOT_DESK" },
            startingPrice = 400,
            totalSeats = 30,
            phone = "",
            email = "",
        };

        [Fact]
        public async Task Location_Create_Get_Update_Delete()
        {
            var admin = await _factory.AdminClientAsync();
            var name = "CRUD Centre " + Guid.NewGuid().ToString("N")[..6];

            var created = await admin.PostAsJsonAsync("/api/Location/Save", NewLocation(name));
            Assert.Equal(HttpStatusCode.Created, created.StatusCode);
            var dto = await created.DataAsync();
            var id = dto.GetProperty("id").GetString()!;
            Assert.StartsWith("LOC-", id);
            Assert.Equal(2, dto.GetProperty("photos").GetArrayLength());

            var fetched = await (await admin.PostAsJsonAsync("/api/Location/GetById", new { id })).DataAsync();
            Assert.Equal(name, fetched.GetProperty("name").GetString());

            var body = System.Text.Json.Nodes.JsonNode.Parse(fetched.GetRawText())!.AsObject();
            body["city"] = "Mysuru";
            var updated = await (await admin.PostAsJsonAsync("/api/Location/Update", body)).DataAsync();
            Assert.Equal("Mysuru", updated.GetProperty("city").GetString());

            Assert.Equal(HttpStatusCode.OK, (await admin.PostAsJsonAsync("/api/Location/Delete", new { id })).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, (await admin.PostAsJsonAsync("/api/Location/GetById", new { id })).StatusCode);
        }

        [Fact]
        public async Task Location_DuplicateName_Returns409()
        {
            var admin = await _factory.AdminClientAsync();
            var name = "Dup Centre " + Guid.NewGuid().ToString("N")[..6];
            Assert.Equal(HttpStatusCode.Created, (await admin.PostAsJsonAsync("/api/Location/Save", NewLocation(name))).StatusCode);
            Assert.Equal(HttpStatusCode.Conflict, (await admin.PostAsJsonAsync("/api/Location/Save", NewLocation(name))).StatusCode);
        }

        [Fact]
        public async Task Location_MissingRequiredFields_Returns400WithErrors()
        {
            var admin = await _factory.AdminClientAsync();
            var res = await admin.PostAsJsonAsync("/api/Location/Save", new { name = "", city = "", state = "", address = "", pincode = "12", status = "ACTIVE" });
            Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
            var body = await res.Content.ReadFromJsonAsync<JsonElement>();
            Assert.True(body.GetProperty("errors").GetArrayLength() >= 3);
        }

        [Fact]
        public async Task GetById_UnknownId_Returns404()
        {
            var admin = await _factory.AdminClientAsync();
            Assert.Equal(HttpStatusCode.NotFound, (await admin.PostAsJsonAsync("/api/Resource/GetById", new { id = "RES-9999" })).StatusCode);
        }

        [Fact]
        public async Task Get_SupportsSearchFilterAndPaging()
        {
            var admin = await _factory.AdminClientAsync();
            var page = await (await admin.PostAsJsonAsync("/api/Location/Get", new { pageNumber = 1, pageSize = 1, search = "Test Centre", filters = new { status = "ACTIVE" } })).DataAsync();
            Assert.Equal(1, page.GetProperty("pageSize").GetInt32());
            Assert.True(page.GetProperty("items").GetArrayLength() <= 1);
            Assert.True(page.GetProperty("totalCount").GetInt32() >= 1);
        }

        private static object Booking(string member, string date, string start, string end) => new
        {
            memberId = member,
            locationId = "LOC-0001",
            resourceId = "RES-0001",
            date,
            startTime = start,
            endTime = end,
            seats = 4,
            amount = 1180,
            creditsUsed = 0,
            balanceDue = 1180,
            status = "CONFIRMED",
            paymentStatus = "PAID",
            paymentMethod = "UPI",
        };

        [Fact]
        public async Task Booking_DoubleBookingSameSlot_IsRejected()
        {
            var member = await _factory.MemberClientAsync();
            var admin = await _factory.AdminClientAsync();
            var date = DateTime.UtcNow.AddDays(20).ToString("yyyy-MM-dd");

            Assert.Equal(HttpStatusCode.Created, (await member.PostAsJsonAsync("/api/Booking/Save", Booking("MEM-0001", date, "10:00", "12:00"))).StatusCode);
            // Another booking overlapping 11:00-13:00 on the same room.
            Assert.Equal(HttpStatusCode.Conflict, (await admin.PostAsJsonAsync("/api/Booking/Save", Booking("MEM-0002", date, "11:00", "13:00"))).StatusCode);
            // Back-to-back is fine.
            Assert.Equal(HttpStatusCode.Created, (await admin.PostAsJsonAsync("/api/Booking/Save", Booking("MEM-0002", date, "12:00", "13:00"))).StatusCode);
        }

        [Fact]
        public async Task Booking_EndBeforeStart_Returns400()
        {
            var member = await _factory.MemberClientAsync();
            var date = DateTime.UtcNow.AddDays(21).ToString("yyyy-MM-dd");
            Assert.Equal(HttpStatusCode.BadRequest, (await member.PostAsJsonAsync("/api/Booking/Save", Booking("MEM-0001", date, "14:00", "13:00"))).StatusCode);
        }

        [Fact]
        public async Task Member_CannotBookForAnotherMember()
        {
            var member = await _factory.MemberClientAsync();
            var date = DateTime.UtcNow.AddDays(22).ToString("yyyy-MM-dd");
            Assert.Equal(HttpStatusCode.Forbidden, (await member.PostAsJsonAsync("/api/Booking/Save", Booking("MEM-0002", date, "09:00", "10:00"))).StatusCode);
        }

        [Fact]
        public async Task Occupancy_ShowsOtherMembersSlots_WithoutPersonalData()
        {
            var admin = await _factory.AdminClientAsync();
            var date = DateTime.UtcNow.AddDays(23).ToString("yyyy-MM-dd");
            Assert.Equal(HttpStatusCode.Created, (await admin.PostAsJsonAsync("/api/Booking/Save", Booking("MEM-0002", date, "15:00", "16:00"))).StatusCode);

            using var anonymous = _factory.CreateClient();
            var slots = await (await anonymous.PostAsJsonAsync("/api/Booking/GetOccupancy", new { from = date, to = date })).DataAsync();
            var slot = slots.EnumerateArray().Single(s => s.GetProperty("startTime").GetString() == "15:00");
            Assert.False(slot.TryGetProperty("memberId", out _));
        }

        [Fact]
        public async Task Invoice_NumberIsIssuedByServer_Sequentially()
        {
            var admin = await _factory.AdminClientAsync();
            object Invoice() => new
            {
                number = "CLIENT-SUPPLIED",
                date = DateTime.UtcNow.ToString("yyyy-MM-dd"),
                dueDate = DateTime.UtcNow.AddDays(7).ToString("yyyy-MM-dd"),
                memberId = "MEM-0002",
                locationId = "LOC-0001",
                customerName = "Other Member",
                billingAddress = "",
                placeOfSupply = "Telangana",
                intraState = true,
                lines = new[] { new { description = "Room A booking", sac = "997212", qty = 1, rate = 1000, amount = 1000 } },
                subtotal = 1000,
                cgst = 90,
                sgst = 90,
                igst = 0,
                tax = 180,
                total = 1180,
                amountPaid = 0,
                status = "UNPAID",
            };

            var first = (await (await admin.PostAsJsonAsync("/api/Invoice/Save", Invoice())).DataAsync()).GetProperty("number").GetString()!;
            var second = (await (await admin.PostAsJsonAsync("/api/Invoice/Save", Invoice())).DataAsync()).GetProperty("number").GetString()!;
            Assert.StartsWith("OFC/", first);
            Assert.NotEqual("CLIENT-SUPPLIED", first);
            Assert.Equal(int.Parse(first[^5..]) + 1, int.Parse(second[^5..]));
        }

        [Fact]
        public async Task Invoice_TotalsMustAddUp()
        {
            var admin = await _factory.AdminClientAsync();
            var res = await admin.PostAsJsonAsync("/api/Invoice/Save", new
            {
                date = DateTime.UtcNow.ToString("yyyy-MM-dd"),
                dueDate = DateTime.UtcNow.ToString("yyyy-MM-dd"),
                memberId = "MEM-0002",
                locationId = "LOC-0001",
                customerName = "X",
                lines = new[] { new { description = "x", sac = "", qty = 1, rate = 100, amount = 100 } },
                subtotal = 100,
                cgst = 9,
                sgst = 9,
                igst = 0,
                tax = 18,
                total = 999,
                status = "UNPAID",
            });
            Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        }

        [Fact]
        public async Task AuditLog_UserAndRoleComeFromToken_NotFromPayload()
        {
            var member = await _factory.MemberClientAsync();
            var saved = await (await member.PostAsJsonAsync("/api/AuditLog/Save", new
            {
                user = "Someone Else",
                role = "Super Admin",
                action = "UPDATE",
                module = "Profile",
                entity = "Member",
                entityId = "MEM-0001",
                ip = "1.2.3.4",
                description = "Updated profile",
            })).DataAsync();
            Assert.Equal("Test Member", saved.GetProperty("user").GetString());
            Assert.Equal("Member", saved.GetProperty("role").GetString());
            Assert.NotEqual("1.2.3.4", saved.GetProperty("ip").GetString());
        }

        [Fact]
        public async Task Dashboard_IsCalculatedFromDatabase_AndStaffOnly()
        {
            var admin = await _factory.AdminClientAsync();
            var summary = await (await admin.PostAsJsonAsync("/api/Dashboard/GetSummary", new { })).DataAsync();
            Assert.True(summary.GetProperty("totalMembers").GetInt32() >= 2);
            Assert.Equal(6, summary.GetProperty("revenueByMonth").GetArrayLength());

            var member = await _factory.MemberClientAsync();
            Assert.Equal(HttpStatusCode.Forbidden, (await member.PostAsJsonAsync("/api/Dashboard/GetSummary", new { })).StatusCode);
        }

        [Fact]
        public async Task Settings_ArePublic_ButOnlyStaffCanUpdate()
        {
            using var anonymous = _factory.CreateClient();
            var settings = await (await anonymous.PostAsJsonAsync("/api/Configuration/Get", new { })).DataAsync();
            Assert.Equal(18m, settings.GetProperty("gstRate").GetDecimal());

            var member = await _factory.MemberClientAsync();
            Assert.Equal(HttpStatusCode.Forbidden, (await member.PostAsJsonAsync("/api/Configuration/Update", settings)).StatusCode);
        }

        [Fact]
        public async Task Integration_SecretIsEncrypted_AndNeverReturned()
        {
            var admin = await _factory.AdminClientAsync();
            var saved = await (await admin.PostAsJsonAsync("/api/Integration/Save", new
            {
                category = "SMS",
                providerKey = "TWILIO",
                displayName = "Twilio test",
                environment = "SANDBOX",
                enabled = true,
                active = true,
                status = "UNTESTED",
                config = new Dictionary<string, string> { ["accountSid"] = "AC123" },
                secrets = new Dictionary<string, object>(),
                tests = Array.Empty<object>(),
                secretInputs = new Dictionary<string, string> { ["authToken"] = "super-secret-token-9876" },
            })).DataAsync();

            var json = saved.GetRawText();
            Assert.DoesNotContain("super-secret-token-9876", json);
            Assert.True(saved.GetProperty("secrets").GetProperty("authToken").GetProperty("isSet").GetBoolean());
            Assert.EndsWith("9876", saved.GetProperty("secrets").GetProperty("authToken").GetProperty("hint").GetString());

            // Non-admins only learn which provider is active, never its settings.
            var member = await _factory.MemberClientAsync();
            var visible = await (await member.PostAsJsonAsync("/api/Integration/Get", new { pageSize = 0 })).DataAsync();
            var twilio = visible.GetProperty("items").EnumerateArray().First(i => i.GetProperty("providerKey").GetString() == "TWILIO");
            Assert.Empty(twilio.GetProperty("config").EnumerateObject());
        }
    }
}
