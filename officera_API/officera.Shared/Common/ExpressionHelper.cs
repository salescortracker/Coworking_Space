using System.Linq.Expressions;

namespace officera.Shared.Common
{
    /// <summary>Combines repository predicates so access scopes can be layered (role scope AND location scope AND id).</summary>
    public static class ExpressionHelper
    {
        public static Expression<Func<T, bool>> True<T>() => _ => true;

        public static Expression<Func<T, bool>> False<T>() => _ => false;

        public static Expression<Func<T, bool>> And<T>(this Expression<Func<T, bool>> left, Expression<Func<T, bool>> right)
        {
            var parameter = left.Parameters[0];
            var body = Expression.AndAlso(left.Body, new ReplaceParameter(right.Parameters[0], parameter).Visit(right.Body)!);
            return Expression.Lambda<Func<T, bool>>(body, parameter);
        }

        public static Expression<Func<T, bool>> Or<T>(this Expression<Func<T, bool>> left, Expression<Func<T, bool>> right)
        {
            var parameter = left.Parameters[0];
            var body = Expression.OrElse(left.Body, new ReplaceParameter(right.Parameters[0], parameter).Visit(right.Body)!);
            return Expression.Lambda<Func<T, bool>>(body, parameter);
        }

        private sealed class ReplaceParameter : ExpressionVisitor
        {
            private readonly ParameterExpression _from;
            private readonly ParameterExpression _to;

            public ReplaceParameter(ParameterExpression from, ParameterExpression to)
            {
                _from = from;
                _to = to;
            }

            protected override Expression VisitParameter(ParameterExpression node) => node == _from ? _to : base.VisitParameter(node);
        }
    }
}
