'use strict';

function notFound(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.', requestId: req.requestId } });
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  const status = Number.isInteger(error.statusCode) ? error.statusCode : Number.isInteger(error.status) ? error.status : 500;
  const code = error.code && typeof error.code === 'string' ? error.code : status === 400 ? 'BAD_REQUEST' : status === 413 ? 'PAYLOAD_TOO_LARGE' : 'INTERNAL_ERROR';
  if (status >= 500) {
    process.stderr.write(JSON.stringify({ level: 'error', requestId: req.requestId, code, name: error.name || 'Error' }) + '\n');
  }
  const message = status >= 500 ? 'An internal server error occurred.' : status === 413 ? 'Request body is too large.' : status === 400 && !error.statusCode ? 'Request body is invalid.' : error.message;
  return res.status(status).json({ error: { code, message, requestId: req.requestId } });
}

module.exports = { errorHandler, notFound };
