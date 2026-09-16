import { ApiError } from '../utils/apiError.js';
import { env } from '../config/env.js';

export function notFound(req, _res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

export function errorHandler(err, req, res, _next) {
  let status = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  if (err.name === 'ValidationError') { status = 422; message = Object.values(err.errors).map((e) => e.message).join(', '); }
  if (err.code === 11000) { status = 409; message = `Duplicate value for ${Object.keys(err.keyPattern || {}).join(', ')}`; }
  if (err.name === 'CastError') { status = 400; message = `Invalid ${err.path}`; }
  if (err.name === 'MulterError') {
    const oversized = ['LIMIT_FILE_SIZE', 'LIMIT_FIELD_VALUE', 'LIMIT_FIELD_COUNT', 'LIMIT_FILE_COUNT', 'LIMIT_PART_COUNT'].includes(err.code);
    status = oversized ? 413 : 400;
    message = err.code === 'LIMIT_FILE_SIZE'
      ? 'Uploaded file exceeds the permitted size.'
      : oversized
        ? 'Multipart request exceeds the permitted limits.'
        : 'Invalid multipart upload request.';
  }
  if (err.type === 'entity.too.large') { status = 413; message = 'Request body exceeds the permitted size.'; }
  res.status(status).json({ success: false, message, requestId: req.id, details: err.details, ...(env.NODE_ENV !== 'production' && { stack: err.stack }) });
}
