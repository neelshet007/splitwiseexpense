import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  // If response has already started streaming, delegate to default express error handler
  if (res.headersSent) {
    return next(err);
  }

  // 1. Handled App Errors
  if (err instanceof AppError) {
    logger.warn(`AppError: ${err.message}`, {
      code: err.code,
      statusCode: err.statusCode,
      details: err.details,
      path: req.originalUrl
    });

    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {})
      }
    });
  }

  // 2. Zod Validation Errors
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message
    }));

    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: err.errors[0]?.message || 'Validation failed',
        details
      }
    });
  }

  // 3. Unhandled Server Exceptions
  logger.error(`Unhandled Exception: ${err.message}`, {
    stack: err.stack,
    path: req.originalUrl,
    method: req.method
  });

  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: env.isProduction ? 'An unexpected internal error occurred' : err.message
    }
  });
}
