const ApiError = require('../utils/ApiError');

/**
 * Validates req[source] against a Joi schema. On success the sanitized value
 * replaces the original (unknown keys stripped, types coerced).
 */
const validate =
  (schema, source = 'body') =>
  (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });
    if (error) {
      const details = error.details.map((d) => ({ field: d.path.join('.'), message: d.message.replace(/"/g, '') }));
      return next(ApiError.badRequest('Validation failed', details));
    }
    // req.query is a getter in Express 5, so assign onto a separate property.
    if (source === 'query') req.validatedQuery = value;
    else req[source] = value;
    return next();
  };

module.exports = validate;
