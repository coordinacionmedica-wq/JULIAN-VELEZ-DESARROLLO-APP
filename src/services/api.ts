import { Firestore } from 'firebase-admin/firestore';
import { Auth } from 'firebase-admin/auth';
import { Response } from 'express';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  messageId?: string;
}

export interface DoctorRegistrationRequest {
  doctorId: number;
  doctorData: Record<string, unknown>;
  isUpdate: boolean;
}

export interface DoctorCheckRequest {
  cedula: string;
}

export interface DoctorLoginRequest {
  u: string; // username
  p: string; // password
}

export interface EmailRequest {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

/**
 * Validates that database is initialized
 */
export function validateDatabaseInitialization(db: Firestore | null): boolean {
  return db !== null;
}

/**
 * Sends a standardized API response
 */
export function sendResponse<T>(
  res: Response,
  success: boolean,
  data?: T | string,
  statusCode: number = success ? 200 : 500
): void {
  if (typeof data === 'string' && !success) {
    res.status(statusCode).json({ success: false, error: data });
  } else if (typeof data === 'string' && success) {
    res.status(statusCode).json({ success: true, messageId: data });
  } else {
    res.status(statusCode).json({ success, data });
  }
}

/**
 * Handles standard error response
 */
export function sendErrorResponse(
  res: Response,
  error: unknown,
  statusCode: number = 500
): void {
  const message = error instanceof Error ? error.message : String(error);
  res.status(statusCode).json({ success: false, error: message });
}
