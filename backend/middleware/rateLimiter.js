const rateLimitStore = {};

// Clean up store every 15 minutes to avoid memory leaks
setInterval(() => {
  const now = Date.now();
  for (const ip in rateLimitStore) {
    if (rateLimitStore[ip].resetTime < now) {
      delete rateLimitStore[ip];
    }
  }
}, 15 * 60 * 1000);

const rateLimiter = (options = {}) => {
  const windowMs = options.windowMs || 15 * 60 * 1000; // default 15 minutes
  const max = options.max || 10; // default 10 requests per windowMs
  const message = options.message || 'Too many attempts. Please try again after 15 minutes.';

  return (req, res, next) => {
    // Identify user's IP (supports headers if behind proxy/load-balancer)
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip';
    const now = Date.now();

    if (!rateLimitStore[ip] || rateLimitStore[ip].resetTime < now) {
      rateLimitStore[ip] = {
        count: 1,
        resetTime: now + windowMs
      };
      return next();
    }

    rateLimitStore[ip].count += 1;

    if (rateLimitStore[ip].count > max) {
      const retryAfterSeconds = Math.ceil((rateLimitStore[ip].resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      return res.status(429).json({ error: message, retryAfterSeconds });
    }

    next();
  };
};

module.exports = rateLimiter;
