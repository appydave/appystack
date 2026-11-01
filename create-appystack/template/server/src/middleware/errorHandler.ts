import type { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger.js';
import { AppError } from '../helpers/AppError.js';
import { HTTP_STATUS } from '../helpers/httpStatus.js';

// Re-export so consumers can import AppError from either location.
export { AppError };

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  const statusCode = err instanceof AppError ? err.statusCode : HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const isOperational = err instanceof AppError ? err.isOperational : false;

  logger.error({ err, statusCode, isOperational }, err.message);

  res.status(statusCode).json({
    status: 'error',
    error: isOperational ? err.message : 'Internal server error',
    timestamp: new Date().toISOString(),
  });
}
