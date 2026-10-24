'use strict';

function validate(schema, source = 'body') {
  return (req, res, next) => {
    const parsed = schema.safeParse(req[source]);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request fields are invalid.',
          issues: parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), code: issue.code })),
          requestId: req.requestId
        }
      });
    }
    Object.defineProperty(req, source, { value: parsed.data, writable: true, configurable: true, enumerable: true });
    return next();
  };
}

module.exports = { validate };
