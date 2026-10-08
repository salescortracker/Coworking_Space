using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Text;
using System.Threading.Tasks;

namespace officera.DataAccessLayer.Repositories
{
    public interface IGeneralRepository<T>
        where T : class
    {
        Task<IEnumerable<T>> GetAllAsync();

        Task<T> GetByIdAsync(object id);

        Task<IEnumerable<T>>
            FindAsync(
            Expression<Func<T, bool>> predicate);

        Task AddAsync(T entity);

        void Update(T entity);

        void Remove(T entity);
    }
}
