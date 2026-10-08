using System.Linq.Expressions;
using officera.BusinessAccessLayer.DTOs;
using officera.BusinessAccessLayer.Interfaces;
using officera.DataAccessLayer.Entities;
using officera.Shared.Common;

namespace officera.BusinessAccessLayer.Services
{
    public static class SpaceTypes
    {
        public static readonly string[] Resource = { "HOT_DESK", "DEDICATED_DESK", "PRIVATE_OFFICE", "MEETING_ROOM" };
        public static readonly string[] All = { "HOT_DESK", "DEDICATED_DESK", "PRIVATE_OFFICE", "MEETING_ROOM", "DAY_PASS" };
    }

    /// <summary>Locations (Workspace → Locations, public search, location selector).</summary>
    public class LocationService : CrudServiceBase<Location, LocationDto>, ILocationService
    {
        private static readonly string[] Statuses = { "ACTIVE", "INACTIVE", "COMING_SOON" };

        public LocationService(ServiceContext context) : base(context) { }

        protected override string EntityName => "Location";
        protected override string ModuleKey => "locations";
        protected override string IdPrefix => "LOC";
        protected override ReadAccess ReadAccess => ReadAccess.Public;

        protected override Expression<Func<Location, bool>> IdEquals(string id) => e => e.Id == id;
        protected override string KeyOf(Location entity) => entity.Id;
        protected override void SetKey(Location entity, string id) => entity.Id = id;

        /// <summary>Inactive centres are hidden from the public website and members.</summary>
        protected override Expression<Func<Location, bool>>? PublicFilter => e => e.Status != "INACTIVE";

        protected override Expression<Func<Location, bool>>? MemberFilter(CurrentUserContext user)
        {
            var memberId = user.MemberId;
            return e => e.Status != "INACTIVE" || e.Members.Any(m => m.Id == memberId);
        }

        protected override Expression<Func<Location, bool>>? LocationFilter(IReadOnlyCollection<string> locationIds) => e => locationIds.Contains(e.Id);
        protected override string? LocationOf(Location entity) => entity.Id;

        protected override IEnumerable<string?> SearchValues(LocationDto dto) => new[] { dto.Id, dto.Name, dto.City, dto.Address, dto.State };
        protected override IEnumerable<LocationDto> DefaultOrder(IEnumerable<LocationDto> items) => items.OrderBy(l => l.City).ThenBy(l => l.Name);

        protected override LocationDto ToDto(Location e) => ToDto(e, new List<LocationReview>());

        private static LocationDto ToDto(Location e, IEnumerable<LocationReview> reviews) => new()
        {
            Id = e.Id,
            Name = e.Name,
            City = e.City,
            State = e.State,
            Address = e.Address,
            Pincode = e.Pincode,
            Latitude = e.Latitude,
            Longitude = e.Longitude,
            OpeningHours = new OpeningHoursDto { Weekdays = e.HoursWeekdays, Saturday = e.HoursSaturday, Sunday = e.HoursSunday },
            Amenities = JsonHelper.DeserializeList<string>(e.AmenitiesJson),
            Photos = PhotoList.Parse(e.PhotosJson),
            Status = e.Status,
            Description = e.Description,
            Rating = e.Rating,
            ReviewCount = e.ReviewCount,
            Reviews = reviews.OrderByDescending(r => r.ReviewDate).Select(r => new ReviewDto
            {
                Id = r.Id,
                Author = r.Author,
                Rating = r.Rating,
                Text = r.ReviewText,
                Date = DateTimeHelper.ToDateString(r.ReviewDate),
            }).ToList(),
            Transport = JsonHelper.DeserializeList<string>(e.TransportJson),
            SpaceTypes = JsonHelper.DeserializeList<string>(e.SpaceTypesJson),
            StartingPrice = e.StartingPrice,
            TotalSeats = e.TotalSeats,
            Phone = e.Phone,
            Email = e.Email,
            DistanceKm = e.DistanceKm,
        };

        protected override async Task<List<LocationDto>> ToDtosAsync(IReadOnlyList<Location> entities)
        {
            var ids = entities.Select(e => e.Id).ToList();
            var reviews = (await Repo<LocationReview>().FindAsync(r => ids.Contains(r.LocationId))).ToLookup(r => r.LocationId);
            return entities.Select(e => ToDto(e, reviews[e.Id])).ToList();
        }

        protected override void MapToEntity(LocationDto dto, Location e, bool isNew)
        {
            e.Name = dto.Name.Trim();
            e.City = dto.City.Trim();
            e.State = dto.State.Trim();
            e.Address = dto.Address.Trim();
            e.Pincode = dto.Pincode.Trim();
            e.Latitude = dto.Latitude;
            e.Longitude = dto.Longitude;
            e.HoursWeekdays = dto.OpeningHours?.Weekdays ?? string.Empty;
            e.HoursSaturday = dto.OpeningHours?.Saturday ?? string.Empty;
            e.HoursSunday = dto.OpeningHours?.Sunday ?? string.Empty;
            e.AmenitiesJson = JsonHelper.Serialize(dto.Amenities ?? new());
            e.PhotosJson = JsonHelper.Serialize(dto.Photos ?? new());
            e.Status = dto.Status;
            e.Description = dto.Description ?? string.Empty;
            e.TransportJson = JsonHelper.Serialize(dto.Transport ?? new());
            e.SpaceTypesJson = JsonHelper.Serialize(dto.SpaceTypes ?? new());
            e.StartingPrice = dto.StartingPrice;
            e.TotalSeats = dto.TotalSeats;
            e.Phone = dto.Phone ?? string.Empty;
            e.Email = dto.Email ?? string.Empty;
            e.DistanceKm = dto.DistanceKm;
            e.Rating = dto.Rating;
            e.ReviewCount = dto.ReviewCount;
        }

        protected override async Task ValidateAsync(LocationDto dto, Location? existing, CurrentUserContext user)
        {
            new ValidationHelper.Collector()
                .Required(dto.Name, "Name").MaxLength(dto.Name, 150, "Name")
                .Required(dto.City, "City")
                .Required(dto.State, "State")
                .Required(dto.Address, "Address")
                .Must(ValidationHelper.IsPincode(dto.Pincode), "Pincode must be 6 digits.")
                .OneOf(dto.Status, Statuses, "Status")
                .Email(dto.Email, "Email", required: false)
                .Min(dto.StartingPrice, 0, "Starting price")
                .Min(dto.TotalSeats, 0, "Total seats")
                .Range(dto.Latitude, -90, 90, "Latitude")
                .Range(dto.Longitude, -180, 180, "Longitude")
                .Must((dto.SpaceTypes ?? new()).All(t => SpaceTypes.All.Contains(t)), "Space types contain an unknown value.")
                .Must((dto.Reviews ?? new()).All(r => r.Rating is >= 1 and <= 5), "Review ratings must be between 1 and 5.")
                .ThrowIfInvalid();

            var name = dto.Name.Trim();
            var duplicate = (await Repository.FindAsync(l => l.Name == name && (existing == null || l.Id != existing.Id))).Any();
            if (duplicate)
            {
                throw new ConflictException($"A location named '{name}' already exists.");
            }
        }

        protected override async Task OnSavingAsync(Location entity, LocationDto dto, bool isNew, CurrentUserContext user)
        {
            var reviewRepo = Repo<LocationReview>();
            var current = (await reviewRepo.FindAsync(r => r.LocationId == entity.Id)).ToDictionary(r => r.Id);
            var incoming = dto.Reviews ?? new List<ReviewDto>();

            foreach (var stale in current.Values.Where(r => incoming.All(i => i.Id != r.Id)))
            {
                reviewRepo.Remove(stale);
            }

            foreach (var review in incoming)
            {
                if (!string.IsNullOrEmpty(review.Id) && current.TryGetValue(review.Id, out var row))
                {
                    row.Author = review.Author;
                    row.Rating = review.Rating;
                    row.ReviewText = review.Text;
                    row.ReviewDate = DateTimeHelper.ParseDate(review.Date) ?? row.ReviewDate;
                    continue;
                }

                await reviewRepo.AddAsync(new LocationReview
                {
                    // Child rows never call the sequence service: it commits, and this runs inside the parent's unit of work.
                    Id = IdHelper.IsValid(review.Id, "REV") ? review.Id : $"REV-{Guid.NewGuid():N}"[..20].ToUpperInvariant(),
                    LocationId = entity.Id,
                    Author = review.Author,
                    Rating = review.Rating,
                    ReviewText = review.Text,
                    ReviewDate = DateTimeHelper.ParseDate(review.Date) ?? DateTimeHelper.TodayUtc,
                });
            }

            // Rating and review count are derived from the stored reviews.
            if (incoming.Count > 0)
            {
                entity.ReviewCount = incoming.Count;
                entity.Rating = Math.Round((decimal)incoming.Average(r => r.Rating), 1);
            }
        }
    }

    /// <summary>Bookable resources (desks, offices, meeting rooms) and their floor-map placement.</summary>
    public class ResourceService : CrudServiceBase<Resource, ResourceDto>, IResourceService
    {
        private static readonly string[] Statuses = { "ACTIVE", "MAINTENANCE", "INACTIVE" };
        private static readonly string[] PriceUnits = { "hour", "day", "month" };

        public ResourceService(ServiceContext context) : base(context) { }

        protected override string EntityName => "Resource";
        protected override string ModuleKey => "resources";
        protected override string IdPrefix => "RES";
        protected override ReadAccess ReadAccess => ReadAccess.Public;

        protected override Expression<Func<Resource, bool>> IdEquals(string id) => e => e.Id == id;
        protected override string KeyOf(Resource entity) => entity.Id;
        protected override void SetKey(Resource entity, string id) => entity.Id = id;

        protected override Expression<Func<Resource, bool>>? PublicFilter => e => e.Status != "INACTIVE" && e.Location.Status != "INACTIVE";
        protected override Expression<Func<Resource, bool>>? LocationFilter(IReadOnlyCollection<string> locationIds) => e => locationIds.Contains(e.LocationId);
        protected override string? LocationOf(Resource entity) => entity.LocationId;

        protected override IEnumerable<string?> SearchValues(ResourceDto dto) => new[] { dto.Id, dto.Name, dto.Code, dto.Floor };
        protected override IEnumerable<ResourceDto> DefaultOrder(IEnumerable<ResourceDto> items) => items.OrderBy(r => r.LocationId).ThenBy(r => r.Code);

        protected override ResourceDto ToDto(Resource e) => new()
        {
            Id = e.Id,
            Name = e.Name,
            Code = e.Code,
            Type = e.ResourceType,
            LocationId = e.LocationId,
            Floor = e.Floor,
            Capacity = e.Capacity,
            Price = e.Price,
            PriceUnit = e.PriceUnit,
            Amenities = JsonHelper.DeserializeList<string>(e.AmenitiesJson),
            Photos = PhotoList.Parse(e.PhotosJson),
            Availability = e.Availability,
            CancellationRule = e.CancellationRule,
            Status = e.Status,
            Map = new MapRectDto { X = e.MapX, Y = e.MapY, W = e.MapW, H = e.MapH },
            Blocked = e.IsBlocked ? true : null,
        };

        protected override void MapToEntity(ResourceDto dto, Resource e, bool isNew)
        {
            e.Name = dto.Name.Trim();
            e.Code = dto.Code.Trim().ToUpperInvariant();
            e.ResourceType = dto.Type;
            e.LocationId = dto.LocationId;
            e.Floor = dto.Floor ?? string.Empty;
            e.Capacity = dto.Capacity;
            e.Price = dto.Price;
            e.PriceUnit = dto.PriceUnit;
            e.AmenitiesJson = JsonHelper.Serialize(dto.Amenities ?? new());
            e.PhotosJson = JsonHelper.Serialize(dto.Photos ?? new());
            e.Availability = dto.Availability ?? string.Empty;
            e.CancellationRule = dto.CancellationRule ?? string.Empty;
            e.Status = dto.Status;
            e.MapX = dto.Map?.X ?? 0;
            e.MapY = dto.Map?.Y ?? 0;
            e.MapW = dto.Map?.W ?? 10;
            e.MapH = dto.Map?.H ?? 10;
            e.IsBlocked = dto.Blocked == true;
        }

        protected override async Task ValidateAsync(ResourceDto dto, Resource? existing, CurrentUserContext user)
        {
            new ValidationHelper.Collector()
                .Required(dto.Name, "Name")
                .Required(dto.Code, "Code").MaxLength(dto.Code, 30, "Code")
                .OneOf(dto.Type, SpaceTypes.Resource, "Type")
                .Required(dto.LocationId, "Location")
                .Must(dto.Capacity > 0, "Capacity must be at least 1.")
                .Min(dto.Price, 0, "Price")
                .OneOf(dto.PriceUnit, PriceUnits, "Price unit")
                .OneOf(dto.Status, Statuses, "Status")
                .ThrowIfInvalid();

            if (!(await Repo<Location>().FindAsync(l => l.Id == dto.LocationId)).Any())
            {
                throw new ValidationException("The selected location does not exist.");
            }

            var code = dto.Code.Trim().ToUpperInvariant();
            if ((await Repository.FindAsync(r => r.LocationId == dto.LocationId && r.Code == code && (existing == null || r.Id != existing.Id))).Any())
            {
                throw new ConflictException($"Resource code '{code}' is already used at this location.");
            }
        }
    }
}
