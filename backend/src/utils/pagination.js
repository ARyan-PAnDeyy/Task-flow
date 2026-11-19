const MAX_LIMIT = 100;

/** Reads ?page & ?limit (already validated) and returns Sequelize limit/offset. */
function getPagination(query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 10, 1), MAX_LIMIT);
  return { page, limit, offset: (page - 1) * limit };
}

/** Builds the standard paginated response envelope. */
function paginated(rows, count, { page, limit }) {
  return {
    data: rows,
    pagination: {
      page,
      limit,
      total: count,
      totalPages: Math.ceil(count / limit) || 1,
    },
  };
}

/** Parses "field:dir" into a Sequelize order clause, restricted to an allow-list. */
function getSort(sort, allowed, fallback = [['createdAt', 'DESC']]) {
  if (!sort) return fallback;
  const [field, dir = 'asc'] = String(sort).split(':');
  if (!allowed.includes(field)) return fallback;
  return [[field, dir.toLowerCase() === 'desc' ? 'DESC' : 'ASC']];
}

module.exports = { getPagination, paginated, getSort };
