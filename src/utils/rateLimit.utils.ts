import setRateLimit from 'express-rate-limit';

// Rate limit middleware
const rateLimitMiddleware = setRateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: 'You have exceeded your 30 requests per minute limit.',
  handler: function (req, res) {
    return res.status(429).json({
      success: false,
      message: this.message,
    });
  },
  headers: true,
  skipSuccessfulRequests: true,
});

export default rateLimitMiddleware;
