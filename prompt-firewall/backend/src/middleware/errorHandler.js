const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  const requestId = req.id || 'unknown';

  // Handle CORS policy rejections
  if (err.message && err.message.includes('CORS')) {
    logger.warn(`CORS access blocked for request ${requestId} from origin: ${req.headers.origin || 'unknown'}`);
    return res.status(403).json({
      requestId,
      error: 'Cross-Origin Resource Sharing (CORS) error: origin not permitted'
    });
  }

  // Handle malformed JSON body errors from express.json()
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    logger.warn(`Malformed JSON payload rejected for request ${requestId}`);
    return res.status(400).json({
      requestId,
      error: 'Malformed JSON payload: please check your request body syntax'
    });
  }

  // Handle entity too large (payload oversized)
  if (err.type === 'entity.too.large') {
    logger.warn(`Oversized request body rejected for request ${requestId}`);
    return res.status(413).json({
      requestId,
      error: 'Payload Too Large: request body exceeds permissible size limits'
    });
  }

  const statusCode = err.status || err.statusCode || 500;
  logger.error(`Internal error processing request ${requestId}: ${err.message}`);

  // Safe client response - never leak stack trace or internal secrets
  const clientResponse = {
    requestId,
    error: statusCode >= 500 ? 'Internal Server Error' : err.message
  };

  if (err.code) {
    clientResponse.code = err.code;
  }

  res.status(statusCode).json(clientResponse);
}

module.exports = errorHandler;
