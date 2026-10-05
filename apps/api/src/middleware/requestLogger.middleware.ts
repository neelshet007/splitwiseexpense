import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  // Never log high-frequency health checks or normal successful requests
  if (req.path === '/health') {
    return next();
  }

  const start = Date.now();

  res.on('finish', () => {
    // Completely silence normal 2xx and 3xx responses (zero logs during normal usage)
    if (res.statusCode < 400) {
      return;
    }

    const duration = Date.now() - start;
    const isServerError = res.statusCode >= 500;

    const meta = {
      method: req.method,
      path: req.baseUrl + req.path,
      statusCode: res.statusCode,
      durationMs: duration
    };

    if (isServerError) {
      logger.error('HTTP Server Error', meta);
    } else {
      logger.warn('HTTP Client Error', meta);
    }
  });

  next();
}
