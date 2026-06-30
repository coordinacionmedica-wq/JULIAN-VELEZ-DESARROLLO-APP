import nodemailer, { Transporter } from 'nodemailer';
import { EmailRequest } from './api';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
}

/**
 * Load SMTP configuration from environment variables
 */
export function loadSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return {
    host,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user,
    pass,
    fromName: process.env.SMTP_FROM_NAME || 'ESE Hospital Roldanillo',
    fromEmail: process.env.SMTP_FROM_EMAIL || user,
  };
}

/**
 * Create a nodemailer transporter from SMTP config
 */
export function createEmailTransporter(config: SmtpConfig): Transporter {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
}

/**
 * Send an email with the given configuration
 */
export async function sendEmail(
  transporter: Transporter,
  config: SmtpConfig,
  request: EmailRequest
): Promise<string> {
  const info = await transporter.sendMail({
    from: `"${config.fromName}" <${config.fromEmail}>`,
    to: request.to,
    subject: request.subject,
    text: request.text,
    html: request.html,
  });

  return info.messageId || '';
}
