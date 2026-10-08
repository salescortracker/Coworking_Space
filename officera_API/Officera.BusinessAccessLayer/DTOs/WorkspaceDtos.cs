using System.Text.Json;

namespace officera.BusinessAccessLayer.DTOs
{
    public class OpeningHoursDto
    {
        public string Weekdays { get; set; } = string.Empty;
        public string Saturday { get; set; } = string.Empty;
        public string Sunday { get; set; } = string.Empty;
    }

    public class ReviewDto
    {
        public string Id { get; set; } = string.Empty;
        public string Author { get; set; } = string.Empty;
        public int Rating { get; set; }
        public string Text { get; set; } = string.Empty;
        public string Date { get; set; } = string.Empty;
    }

    /// <summary>Frontend: Location (core/models/location.model.ts).</summary>
    public class LocationDto : IEntityDto
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string City { get; set; } = string.Empty;
        public string State { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public string Pincode { get; set; } = string.Empty;
        public decimal Latitude { get; set; }
        public decimal Longitude { get; set; }
        public OpeningHoursDto OpeningHours { get; set; } = new();
        public List<string> Amenities { get; set; } = new();
        public List<JsonElement> Photos { get; set; } = new();
        public string Status { get; set; } = "ACTIVE";
        public string Description { get; set; } = string.Empty;
        public decimal Rating { get; set; }
        public int ReviewCount { get; set; }
        public List<ReviewDto> Reviews { get; set; } = new();
        public List<string> Transport { get; set; } = new();
        public List<string> SpaceTypes { get; set; } = new();
        public decimal StartingPrice { get; set; }
        public int TotalSeats { get; set; }
        public string Phone { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public decimal DistanceKm { get; set; }
    }

    public class MapRectDto
    {
        public decimal X { get; set; }
        public decimal Y { get; set; }
        public decimal W { get; set; }
        public decimal H { get; set; }
    }

    /// <summary>Frontend: Resource.</summary>
    public class ResourceDto : IEntityDto
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public string LocationId { get; set; } = string.Empty;
        public string Floor { get; set; } = string.Empty;
        public int Capacity { get; set; }
        public decimal Price { get; set; }
        public string PriceUnit { get; set; } = "hour";
        public List<string> Amenities { get; set; } = new();
        public List<JsonElement> Photos { get; set; } = new();
        public string Availability { get; set; } = string.Empty;
        public string CancellationRule { get; set; } = string.Empty;
        public string Status { get; set; } = "ACTIVE";
        public MapRectDto Map { get; set; } = new();
        public bool? Blocked { get; set; }
    }
}
