using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore.Storage;

namespace officera.DataAccessLayer.Repositories
{
    public interface IUnitOfWork
    {
        IGeneralRepository<T>
           Repository<T>()
           where T : class;

        Task<int> CompleteAsync();

        Task<IDbContextTransaction>
            BeginTransactionAsync();
    }
}
