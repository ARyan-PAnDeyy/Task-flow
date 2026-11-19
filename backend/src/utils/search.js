const { Op } = require('sequelize');
const sequelize = require('../config/database');

const isPostgres = sequelize.getDialect() === 'postgres';

/** Case-insensitive LIKE that works on both Postgres (ILIKE) and SQLite (LIKE). */
const likeOp = isPostgres ? Op.iLike : Op.like;

/**
 * Builds an OR condition matching `term` against each of the given columns.
 * Wildcards typed by the user are escaped on Postgres (backslash is its default
 * LIKE escape); SQLite has no default escape char, so the term is used as-is.
 */
function searchWhere(term, fields) {
  if (!term) return {};
  const safe = isPostgres ? term.replace(/[\\%_]/g, (c) => `\\${c}`) : term;
  return { [Op.or]: fields.map((f) => ({ [f]: { [likeOp]: `%${safe}%` } })) };
}

module.exports = { likeOp, searchWhere };
