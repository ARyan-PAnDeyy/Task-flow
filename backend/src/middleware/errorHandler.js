const { ValidationError, UniqueConstraintError, ForeignKeyConstraintError } = require('sequelize');
const multer = require('multer');
const config = require('../config');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

function notFound(req, res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let error = err;

  if (err instanceof UniqueConstraintError) {
    error = ApiError.conflict(err.errors?.[0]?.message || 'Duplicate value');
  } else if (err instanceof ForeignKeyConstraintError) {
    error = ApiError.badRequest('Referenced resource does not exist');
  } else if (err instanceof ValidationError) {
    error = ApiError.badRequest(
      'Validation failed',
      err.errors.map((e) => ({ field: e.path, message: e.message }))
    );
  } else if (err instanceof multer.MulterError) {
    error = ApiError.badRequest(
      err.code === 'LIMIT_FILE_SIZE' ? `File exceeds ${config.maxFileSizeMb}MB limit` : err.message
    );
  } else if (err.type === 'entity.parse.failed') {
    error = ApiError.badRequest('Malformed JSON body');
  } else if (!(err instanceof ApiError)) {
    logger.error(err.stack || err);
    error = new ApiError(500, 'Internal server error');
  }

  const body = { success: false, message: error.message };
  if (error.details) body.errors = error.details;
  if (!config.isProd && error.statusCode === 500) body.stack = err.stack;

  res.status(error.statusCode).json(body);
}

module.exports = { notFound, errorHandler };
