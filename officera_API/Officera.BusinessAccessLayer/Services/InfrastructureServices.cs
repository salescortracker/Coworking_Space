using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Net.Mail;
using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using officera.BusinessAccessLayer.DTOs;
using officera.BusinessAccessLayer.Interfaces;
using officera.DataAccessLayer.Entities;
using officera.DataAccessLayer.Repositories;
using officera.Shared.Common;

namespace officera.BusinessAccessLayer.Services
{
    /// <summary>
    /// Stores uploads under wwwroot/uploads/{images|documents|profiles|attachments} with a generated file name,
    /// after checking extension, size and file signature. Metadata goes to config.UploadedFiles.
    /// </summary>
    public class FileStorageService : IFileStorageService
    {
        private readonly IWebHostEnvironment _environment;
        private readonly IUnitOfWork _unitOfWork;
        private readonly ICurrentUserService _currentUser;
        private readonly FileStorageOptions _options;
        private readonly ILogger<FileStorageService> _logger;

        public FileStorageService(IWebHostEnvironment environment, IUnitOfWork unitOfWork, ICurrentUserService currentUser, IOptions<FileStorageOptions> options, ILogger<FileStorageService> logger)
        {
            _environment = environment;
            _unitOfWork = unitOfWork;
            _currentUser = currentUser;
            _options = options.Value;
            _logger = logger;
        }

        public async Task<FileUploadResultDto> SaveAsync(Stream content, string originalName, long length, string category)
        {
            category = (category ?? string.Empty).Trim().ToLowerInvariant();
            if (!FileCategories.All.Contains(category))
            {
                throw new ValidationException($"Unknown upload category '{category}'. Use one of: {string.Join(", ", FileCategories.All)}.");
            }

            var safeName = FileHelper.SanitizeOriginalName(originalName);
            var extension = Path.GetExtension(safeName).ToLowerInvariant();
            if (!FileHelper.IsAllowedExtension(category, extension))
            {
                throw new ValidationException($"{safeName}: file type not allowed. Allowed: {string.Join(", ", FileHelper.AllowedExtensions[category])}.");
            }

            var limit = category switch
            {
                FileCategories.Profiles => _options.MaxProfileImageBytes,
                FileCategories.Documents => _options.MaxDocumentBytes,
                _ => extension == ".pdf" ? _options.MaxDocumentBytes : _options.MaxImageBytes,
            };
            if (length <= 0)
            {
                throw new ValidationException($"{safeName} is empty.");
            }

            if (length > limit)
            {
                throw new ValidationException($"{safeName} is {FileHelper.FormatSize(length)}; the limit is {FileHelper.FormatSize(limit)}.");
            }

            var header = new byte[16];
            var read = await content.ReadAsync(header.AsMemory(0, header.Length));
            if (!FileHelper.HasValidSignature(extension, header.AsSpan(0, read)))
            {
                throw new ValidationException($"{safeName} does not look like a valid {extension.TrimStart('.').ToUpperInvariant()} file.");
            }

            var webRoot = _environment.WebRootPath ?? Path.Combine(_environment.ContentRootPath, "wwwroot");
            var storedName = FileHelper.GenerateSafeFileName(extension);
            var relative = Path.Combine(_options.UploadFolder, category, storedName);
            var fullPath = FileHelper.SafeCombine(webRoot, relative);
            Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);

            await using (var target = new FileStream(fullPath, FileMode.CreateNew, FileAccess.Write, FileShare.None))
            {
                await target.WriteAsync(header.AsMemory(0, read));
                await content.CopyToAsync(target);
            }

            var id = Guid.NewGuid();
            var url = "/" + relative.Replace('\\', '/');
            await _unitOfWork.Repository<UploadedFile>().AddAsync(new UploadedFile
            {
                Id = id,
                OriginalName = safeName,
                StoredName = storedName,
                RelativePath = url,
                ContentType = FileHelper.ContentTypeFor(extension),
                SizeBytes = length,
                Category = category,
                UploadedBy = _currentUser.UserId,
                UploadedAt = DateTime.UtcNow,
            });
            await _unitOfWork.CompleteAsync();
            _logger.LogInformation("Stored upload {FileId} ({Category}, {Size} bytes) for {UserId}", id, category, length, _currentUser.UserId);

            return new FileUploadResultDto { Id = id.ToString("N"), Name = safeName, Size = length, Type = FileHelper.ContentTypeFor(extension), Url = url };
        }
    }

    /// <summary>E-mail through the active EMAIL integration. SMTP and SendGrid are implemented; other providers report "not supported".</summary>
    public class EmailService : IEmailService
    {
        private readonly IIntegrationService _integrations;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<EmailService> _logger;

        public EmailService(IIntegrationService integrations, IHttpClientFactory httpClientFactory, ILogger<EmailService> logger)
        {
            _integrations = integrations;
            _httpClientFactory = httpClientFactory;
            _logger = logger;
        }

        public async Task<DeliveryResult> SendAsync(string to, string subject, string body)
        {
            var provider = await _integrations.GetActiveProviderAsync(IntegrationCategories.Email);
            if (provider == null)
            {
                return DeliveryResult.NoProvider("e-mail");
            }

            try
            {
                switch (provider.ProviderKey)
                {
                    case "SMTP":
                    {
                        using var client = new SmtpClient(provider.Get("host"), int.TryParse(provider.Get("port"), out var port) ? port : 587)
                        {
                            EnableSsl = provider.Get("encryption") != "None",
                            Credentials = string.IsNullOrEmpty(provider.Get("username")) ? null : new NetworkCredential(provider.Get("username"), provider.Get("password")),
                        };
                        using var mail = new MailMessage(new MailAddress(provider.Get("fromEmail"), provider.Get("fromName")), new MailAddress(to))
                        {
                            Subject = subject,
                            Body = body,
                        };
                        await client.SendMailAsync(mail);
                        return new DeliveryResult(true, provider.DisplayName);
                    }

                    case "SENDGRID":
                    {
                        var http = _httpClientFactory.CreateClient("integrations");
                        using var req = new HttpRequestMessage(HttpMethod.Post, "https://api.sendgrid.com/v3/mail/send")
                        {
                            Content = JsonContent.Create(new
                            {
                                personalizations = new[] { new { to = new[] { new { email = to } } } },
                                from = new { email = provider.Get("fromEmail"), name = provider.Get("fromName") },
                                subject,
                                content = new[] { new { type = "text/plain", value = body } },
                            }),
                        };
                        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", provider.Get("apiKey"));
                        using var res = await http.SendAsync(req);
                        return res.IsSuccessStatusCode
                            ? new DeliveryResult(true, provider.DisplayName)
                            : new DeliveryResult(false, provider.DisplayName, $"SendGrid returned {(int)res.StatusCode}");
                    }

                    default:
                        return new DeliveryResult(false, $"{provider.DisplayName} (sending not implemented yet)");
                }
            }
            catch (Exception ex) when (ex is SmtpException or HttpRequestException or InvalidOperationException or FormatException)
            {
                _logger.LogError(ex, "E-mail through {Provider} failed", provider.ProviderKey);
                return new DeliveryResult(false, provider.DisplayName, ex.Message);
            }
        }
    }

    /// <summary>SMS through the active SMS integration. MSG91 and Twilio are implemented.</summary>
    public class SmsService : ISmsService
    {
        private readonly IIntegrationService _integrations;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<SmsService> _logger;

        public SmsService(IIntegrationService integrations, IHttpClientFactory httpClientFactory, ILogger<SmsService> logger)
        {
            _integrations = integrations;
            _httpClientFactory = httpClientFactory;
            _logger = logger;
        }

        public async Task<DeliveryResult> SendAsync(string mobile, string text)
        {
            var provider = await _integrations.GetActiveProviderAsync(IntegrationCategories.Sms);
            if (provider == null)
            {
                return DeliveryResult.NoProvider("SMS");
            }

            var number = ValidationHelper.NormalizeMobile(mobile);
            var http = _httpClientFactory.CreateClient("integrations");
            try
            {
                switch (provider.ProviderKey)
                {
                    case "TWILIO":
                    {
                        var sid = provider.Get("accountSid");
                        var form = new Dictionary<string, string> { ["To"] = "+91" + number, ["Body"] = text };
                        if (!string.IsNullOrEmpty(provider.Get("messagingServiceSid")))
                        {
                            form["MessagingServiceSid"] = provider.Get("messagingServiceSid");
                        }
                        else
                        {
                            form["From"] = provider.Get("fromNumber");
                        }

                        using var req = new HttpRequestMessage(HttpMethod.Post, $"https://api.twilio.com/2010-04-01/Accounts/{Uri.EscapeDataString(sid)}/Messages.json")
                        {
                            Content = new FormUrlEncodedContent(form),
                        };
                        req.Headers.Authorization = new AuthenticationHeaderValue("Basic", Convert.ToBase64String(Encoding.UTF8.GetBytes($"{sid}:{provider.Get("authToken")}")));
                        using var res = await http.SendAsync(req);
                        return res.IsSuccessStatusCode ? new DeliveryResult(true, provider.DisplayName) : new DeliveryResult(false, provider.DisplayName, $"Twilio returned {(int)res.StatusCode}");
                    }

                    case "MSG91":
                    {
                        using var req = new HttpRequestMessage(HttpMethod.Post, "https://control.msg91.com/api/v5/flow")
                        {
                            Content = JsonContent.Create(new
                            {
                                template_id = provider.Get("otpTemplateId"),
                                sender = provider.Get("senderId"),
                                recipients = new[] { new { mobiles = "91" + number, message = text } },
                            }),
                        };
                        req.Headers.Add("authkey", provider.Get("authKey"));
                        using var res = await http.SendAsync(req);
                        return res.IsSuccessStatusCode ? new DeliveryResult(true, provider.DisplayName) : new DeliveryResult(false, provider.DisplayName, $"MSG91 returned {(int)res.StatusCode}");
                    }

                    default:
                        return new DeliveryResult(false, $"{provider.DisplayName} (sending not implemented yet)");
                }
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
            {
                _logger.LogError(ex, "SMS through {Provider} failed", provider.ProviderKey);
                return new DeliveryResult(false, provider.DisplayName, ex.Message);
            }
        }
    }

    /// <summary>Active payment gateway. Razorpay order creation is implemented; the checkout screen still has to load the gateway's checkout script.</summary>
    public class PaymentGatewayService : IPaymentGatewayService
    {
        private readonly IIntegrationService _integrations;
        private readonly IHttpClientFactory _httpClientFactory;

        public PaymentGatewayService(IIntegrationService integrations, IHttpClientFactory httpClientFactory)
        {
            _integrations = integrations;
            _httpClientFactory = httpClientFactory;
        }

        public async Task<PaymentGatewayInfo?> GetActiveGatewayAsync()
        {
            var p = await _integrations.GetActiveProviderAsync(IntegrationCategories.Payment);
            return p == null ? null : new PaymentGatewayInfo(p.ProviderKey, p.DisplayName, p.Environment, PublicKeyOf(p));
        }

        public async Task<GatewayOrder> CreateOrderAsync(decimal amount, string currency, string receipt)
        {
            var p = await _integrations.GetActiveProviderAsync(IntegrationCategories.Payment)
                ?? throw new ValidationException("No payment gateway is active. Configure one in Configuration / Integrations.");

            if (p.ProviderKey != "RAZORPAY")
            {
                throw new ValidationException($"Online orders for {p.DisplayName} are not implemented yet.");
            }

            var http = _httpClientFactory.CreateClient("integrations");
            using var req = new HttpRequestMessage(HttpMethod.Post, "https://api.razorpay.com/v1/orders")
            {
                Content = JsonContent.Create(new { amount = (long)Math.Round(amount * 100), currency, receipt }),
            };
            req.Headers.Authorization = new AuthenticationHeaderValue("Basic", Convert.ToBase64String(Encoding.UTF8.GetBytes($"{p.Get("keyId")}:{p.Get("keySecret")}")));
            using var res = await http.SendAsync(req);
            if (!res.IsSuccessStatusCode)
            {
                throw new ValidationException($"Razorpay refused the order ({(int)res.StatusCode}).");
            }

            var body = await res.Content.ReadFromJsonAsync<Dictionary<string, object>>();
            return new GatewayOrder(p.ProviderKey, body?["id"]?.ToString() ?? string.Empty, amount, currency, PublicKeyOf(p));
        }

        private static string? PublicKeyOf(ActiveProviderConfig p) => p.ProviderKey switch
        {
            "RAZORPAY" => p.Get("keyId"),
            "STRIPE" => p.Get("publishableKey"),
            "CASHFREE" => p.Get("appId"),
            _ => null,
        };
    }

    /// <summary>iCalendar invites for bookings.</summary>
    public class CalendarService : ICalendarService
    {
        public string BuildIcs(string uid, string summary, string location, DateTime startUtc, DateTime endUtc, string description)
        {
            static string Fmt(DateTime d) => DateTime.SpecifyKind(d, DateTimeKind.Utc).ToString("yyyyMMdd'T'HHmmss'Z'");
            static string Esc(string s) => s.Replace("\\", "\\\\").Replace(",", "\\,").Replace(";", "\\;").Replace("\n", "\\n");
            return string.Join("\r\n", new[]
            {
                "BEGIN:VCALENDAR",
                "VERSION:2.0",
                "PRODID:-//Officera//Booking//EN",
                "BEGIN:VEVENT",
                $"UID:{uid}@officera",
                $"DTSTAMP:{Fmt(DateTime.UtcNow)}",
                $"DTSTART:{Fmt(startUtc)}",
                $"DTEND:{Fmt(endUtc)}",
                $"SUMMARY:{Esc(summary)}",
                $"LOCATION:{Esc(location)}",
                $"DESCRIPTION:{Esc(description)}",
                "END:VEVENT",
                "END:VCALENDAR",
            });
        }
    }
}
