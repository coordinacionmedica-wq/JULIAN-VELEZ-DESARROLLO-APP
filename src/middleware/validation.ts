import { Request, Response, NextFunction } from 'express';

/**
 * Validates required fields in request body
 */
export function validateRequired(fields: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const missing = fields.filter((field) => !req.body[field]);

    if (missing.length > 0) {
      res.status(400).json({
        success: false,
        error: `Missing required fields: ${missing.join(', ')}`,
      });
      return;
    }

    next();
  };
}

/**
 * Validates that Content-Type is application/json
 */
export function validateContentType(req: Request, res: Response, next: NextFunction): void {
  const contentType = req.headers['content-type'];

  if (!contentType?.includes('application/json')) {
    res.status(400).json({
      success: false,
      error: 'Content-Type must be application/json',
    });
    return;
  }

  next();
}
