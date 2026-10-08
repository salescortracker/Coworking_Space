using officera.BusinessAccessLayer.Services;
using officera.Shared.Common;

namespace officera.TestCases
{
    /// <summary>Unit tests for the shared helpers and security primitives (no HTTP, no database).</summary>
    public class UnitTest1
    {
        [Theory]
        [InlineData("9876543210", true)]
        [InlineData("+91 98765 43210", true)]
        [InlineData("9123456780", true)]
        [InlineData("5876543210", false)]
        [InlineData("98765", false)]
        public void Mobile_Validation(string mobile, bool expected) => Assert.Equal(expected, ValidationHelper.IsMobile(mobile));

        [Theory]
        [InlineData("a@b.co", true)]
        [InlineData("not-an-email", false)]
        [InlineData("x@y", false)]
        public void Email_Validation(string email, bool expected) => Assert.Equal(expected, ValidationHelper.IsEmail(email));

        [Theory]
        [InlineData("36AABCO1234F1Z5", true)]
        [InlineData("36AABCO1234F1Y5", false)]
        public void Gstin_Validation(string gstin, bool expected) => Assert.Equal(expected, ValidationHelper.IsGstin(gstin));

        [Theory]
        [InlineData("Str0ng@Pass", true)]
        [InlineData("weakpass", false)]
        [InlineData("NoSymbol123", false)]
        public void Password_Policy(string password, bool expected) => Assert.Equal(expected, ValidationHelper.IsStrongPassword(password));

        [Fact]
        public void PasswordService_HashesAndVerifies_NeverStoresPlainText()
        {
            var service = new PasswordService();
            var hash = service.Hash("Secret@123");
            Assert.NotEqual("Secret@123", hash);
            Assert.True(service.Verify(hash, "Secret@123"));
            Assert.False(service.Verify(hash, "secret@123"));
            Assert.True(ValidationHelper.IsStrongPassword(service.GenerateTemporaryPassword()));
        }

        [Fact]
        public void FileHelper_RejectsPathTraversal()
        {
            var root = Path.GetTempPath();
            Assert.Throws<ValidationException>(() => FileHelper.SafeCombine(root, Path.Combine("..", "..", "windows", "win.ini")));
            Assert.StartsWith(Path.GetFullPath(root), FileHelper.SafeCombine(root, Path.Combine("uploads", "a.png")));
        }

        [Fact]
        public void FileHelper_ChecksSignatures()
        {
            Assert.True(FileHelper.HasValidSignature(".pdf", "%PDF-1.4"u8));
            Assert.False(FileHelper.HasValidSignature(".png", "%PDF-1.4"u8));
            Assert.False(FileHelper.IsAllowedExtension(FileCategories.Images, ".svg"));
        }

        [Fact]
        public void IdHelper_FormatsAndValidates()
        {
            Assert.Equal("BKG-0042", IdHelper.Format("BKG", 42));
            Assert.True(IdHelper.IsValid("BKG-0042", "BKG"));
            Assert.False(IdHelper.IsValid("PAY-0042", "BKG"));
            Assert.False(IdHelper.IsValid("BKG-00'; DROP", "BKG"));
        }

        [Fact]
        public void PagedResult_PagesAndCounts()
        {
            var items = Enumerable.Range(1, 23).ToList();
            var page = PagedResult<int>.Create(items, new PagedRequest { PageNumber = 3, PageSize = 10 });
            Assert.Equal(new[] { 21, 22, 23 }, page.Items);
            Assert.Equal(23, page.TotalCount);
            Assert.Equal(3, page.TotalPages);
        }

        [Fact]
        public void DateTimeHelper_RoundTripsFrontendFormats()
        {
            Assert.Equal("2026-10-08", DateTimeHelper.ToDateString(DateTimeHelper.ParseDate("2026-10-08T10:00:00Z")!.Value));
            Assert.Equal("09:30", DateTimeHelper.ToTimeString(DateTimeHelper.ParseTime("9:30")!.Value));
            Assert.EndsWith("Z", DateTimeHelper.ToIso(new DateTime(2026, 10, 8, 4, 30, 0, DateTimeKind.Unspecified)));
        }

        [Fact]
        public void FinancialYear_FollowsIndianApril_To_March()
        {
            Assert.Equal("26-27", FinanceRules.FinancialYear(new DateOnly(2026, 4, 1)));
            Assert.Equal("25-26", FinanceRules.FinancialYear(new DateOnly(2026, 3, 31)));
        }

        [Fact]
        public void AccessState_FollowsSubscriptionStatus()
        {
            var today = new DateOnly(2026, 10, 8);
            Assert.Equal("EXPIRED", MembershipRules.AccessState(null, today));
            Assert.Equal("ACTIVE", MembershipRules.AccessState(new officera.DataAccessLayer.Entities.Subscription { Status = "ACTIVE", EndDate = today.AddDays(5) }, today));
            Assert.Equal("SUSPENDED", MembershipRules.AccessState(new officera.DataAccessLayer.Entities.Subscription { Status = "PAUSED", EndDate = today }, today));
            Assert.Equal("SUSPENDED", MembershipRules.AccessState(new officera.DataAccessLayer.Entities.Subscription { Status = "OVERDUE", GraceUntil = today.AddDays(-1), EndDate = today }, today));
        }
    }
}
