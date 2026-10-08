using Microsoft.EntityFrameworkCore;
using officera.DataAccessLayer.Data;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Text;
using System.Threading.Tasks;

namespace officera.DataAccessLayer.Repositories
{
    public class GeneralRepository<T>
          : IGeneralRepository<T>
          where T : class
    {
        private readonly OfficeraContext _context;

        private readonly DbSet<T> _dbSet;

        public GeneralRepository(
            OfficeraContext context)
        {
            _context = context;

            _dbSet = context.Set<T>();
        }

        public async Task<IEnumerable<T>>
            GetAllAsync()
        {
            return await _dbSet.ToListAsync();
        }

        public async Task<T>
            GetByIdAsync(object id)
        {
            return await _dbSet.FindAsync(id);
        }

        public async Task<IEnumerable<T>>
            FindAsync(
            Expression<Func<T, bool>> predicate)
        {
            return await _dbSet
                .Where(predicate)
                .ToListAsync();
        }

        public async Task AddAsync(T entity)
        {
            await _dbSet.AddAsync(entity);
        }

        public void Update(T entity)
        {
            _dbSet.Update(entity);
        }

        public void Remove(T entity)
        {
            _dbSet.Remove(entity);
        }
    }
}
