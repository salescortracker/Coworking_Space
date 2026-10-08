using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using officera.BusinessAccessLayer.Interfaces;
using officera.DataAccessLayer.Entities;
using officera.DataAccessLayer.Repositories;
using officera.Shared.Common;

namespace officera.BusinessAccessLayer.Services
{
    /// <summary>
    /// Hands out human-readable ids (BKG-0042) from config.IdSequences. The row carries a ROWVERSION, so two
    /// concurrent reservations can never receive the same numbers: the loser of the race reloads and retries.
    /// The browser reserves a few ids per prefix in advance so it can show the new record immediately.
    /// </summary>
    public class IdSequenceService : IIdSequenceService
    {
        /// <summary>Prefixes the API issues ids for. Anything else is rejected.</summary>
        public static readonly IReadOnlySet<string> KnownPrefixes = new HashSet<string>
        {
            "LOC", "REV", "RES", "MEM", "COM", "USR", "ROL", "PLN", "PRM", "SUB", "CRT", "BKG", "PAY", "INV", "RFD", "CN",
            "VIS", "ACR", "LOG", "TKT", "AUD", "NTF", "TPL", "NLG", "LEAD", "PST", "EVT", "PRK", "BLG", "GAL", "INT",
        };

        private const int MaxAttempts = 8;
        private readonly IUnitOfWork _unitOfWork;
        private readonly ILogger<IdSequenceService> _logger;

        public IdSequenceService(IUnitOfWork unitOfWork, ILogger<IdSequenceService> logger)
        {
            _unitOfWork = unitOfWork;
            _logger = logger;
        }

        public async Task<string> NextIdAsync(string prefix)
        {
            var value = await ReserveAsync(prefix, 1);
            return IdHelper.Format(prefix, value);
        }

        public async Task<Dictionary<string, List<string>>> ReserveIdsAsync(IEnumerable<string> prefixes, int count)
        {
            count = Math.Clamp(count, 1, 20);
            var result = new Dictionary<string, List<string>>();
            foreach (var prefix in prefixes.Distinct())
            {
                if (!KnownPrefixes.Contains(prefix))
                {
                    throw new ValidationException($"Unknown id prefix '{prefix}'.");
                }

                var first = await ReserveAsync(prefix, count);
                result[prefix] = Enumerable.Range(first, count).Select(v => IdHelper.Format(prefix, v)).ToList();
            }

            return result;
        }

        /// <summary>Reserves <paramref name="count"/> consecutive values and returns the first one.</summary>
        public async Task<int> ReserveAsync(string prefix, int count)
        {
            var repository = _unitOfWork.Repository<IdSequence>();
            for (var attempt = 1; ; attempt++)
            {
                var sequence = (await repository.FindAsync(s => s.Prefix == prefix)).FirstOrDefault();
                var isNew = sequence == null;
                if (sequence == null)
                {
                    sequence = new IdSequence { Prefix = prefix, LastValue = 0 };
                    await repository.AddAsync(sequence);
                }

                var first = sequence.LastValue + 1;
                sequence.LastValue += count;

                try
                {
                    await _unitOfWork.CompleteAsync();
                    return first;
                }
                catch (DbUpdateException ex) when (attempt < MaxAttempts)
                {
                    // Another request won the race: discard our change, reload the current value and try again.
                    _logger.LogDebug(ex, "Id sequence {Prefix} contention, retry {Attempt}", prefix, attempt);
                    foreach (var entry in ex.Entries)
                    {
                        if (isNew)
                        {
                            entry.State = EntityState.Detached;
                        }
                        else
                        {
                            await entry.ReloadAsync();
                        }
                    }
                }
            }
        }
    }
}
