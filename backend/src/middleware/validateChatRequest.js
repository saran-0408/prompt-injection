const { z } = require('zod');

const chatRequestSchema = z.object({
  message: z.string({
    required_error: 'Message is required and must be provided',
    invalid_type_error: 'Message must be a string'
  })
  .trim()
  .min(1, 'Message cannot be empty or solely whitespace')
  .max(5000, 'Message cannot exceed 5000 characters')
});

function validateChatRequest(req, res, next) {
  // Check if body is missing altogether
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({
      requestId: req.id,
      error: 'Invalid request body: expected JSON object with a message field'
    });
  }

  const result = chatRequestSchema.safeParse(req.body);

  if (!result.success) {
    const errorDetails = result.error.errors.map(err => err.message);
    return res.status(400).json({
      requestId: req.id,
      error: errorDetails[0] || 'Invalid message',
      details: errorDetails
    });
  }

  // Attach sanitized and trimmed message to request
  req.validatedMessage = result.data.message;
  next();
}

module.exports = validateChatRequest;
