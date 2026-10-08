using Microsoft.EntityFrameworkCore.Storage;
using officera.DataAccessLayer.Data;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace officera.DataAccessLayer.Repositories
{
    public class UnitOfWork : IUnitOfWork
    {
        private readonly OfficeraContext _context;

        private readonly Dictionary<Type, object>
            _repositories = new();

        public UnitOfWork(
            OfficeraContext context)
        {
            _context = context;
        }

        public IGeneralRepository<T>
            Repository<T>()
            where T : class
        {
            if (_repositories.ContainsKey(typeof(T)))
            {
                return
                    (IGeneralRepository<T>)
                    _repositories[typeof(T)];
            }

            var repository =
                new GeneralRepository<T>(_context);

            _repositories.Add(
                typeof(T),
                repository);

            return repository;
        }

        public async Task<int>
            CompleteAsync()
        {
            return await
                _context.SaveChangesAsync();
        }

        public async Task<IDbContextTransaction>
            BeginTransactionAsync()
        {
            return await
                _context.Database
                    .BeginTransactionAsync();
        }
    }
}
