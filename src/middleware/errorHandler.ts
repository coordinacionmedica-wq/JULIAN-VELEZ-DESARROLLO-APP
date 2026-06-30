import { Request, Response, NextFunction } from 'express';
import { sendErrorResponse } from '../services';

/**
 * Express error handling middleware
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error('Unhandled error:', err);
  sendErrorResponse(res, err.message);
}

/**
 * Express 404 handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.path}`,
  });
}
