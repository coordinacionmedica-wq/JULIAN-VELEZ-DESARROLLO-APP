import express, { Express, Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import {
  loadFirebaseConfig,
  initializeFirebaseAdmin,
} from './src/services/firebaseService';
import { loadSmtpConfig, createEmailTransporter, sendEmail } from './src/services/emailService';
import {
  checkDoctorByCedula,
  authenticateDoctor,
  registerDoctor,
} from './src/services/authService';
import {
  validateRequired,
  validateContentType,
} from './src/middleware/validation';
import { errorHandler, notFoundHandler } from './src/middleware/errorHandler';
import { logger } from './src/services/logger';
import { sendErrorResponse } from './src/services/api';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Type for Firebase services
interface FirebaseServices {
  db: any;
  auth: any;
}

let firebaseServices: FirebaseServices | null = null;

/**
 * Initialize Firebase services
 */
function initializeServices(): void {
  const configPath = path.join(__dirname, 'firebase-applet-config.json');
  const firebaseConfig = loadFirebaseConfig(configPath);

  if (!firebaseConfig) {
    logger.warn('Firebase configuration not loaded. Some features will be unavailable.');
    return;
  }

  try {
    const { db, auth } = initializeFirebaseAdmin(firebaseConfig);
    firebaseServices = { db, auth };
    logger.info('Firebase services initialized successfully');
  } catch (err) {
    logger.error('Failed to initialize Firebase services:', err);
  }
}

/**
 * Create and configure Express app
 */
function createApp(): Express {
  const app = express();

  // Security middleware
  app.use(helmet());

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
  });
  app.use(limiter);

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // Request logging middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    logger.debug(`${req.method} ${req.path}`);
    next();
  });

  return app;
}

/**
 * Setup API routes
 */
function setupApiRoutes(app: Express): void {
  const apiRouter = express.Router();

  // Doctor registration endpoint
  apiRouter.post(
    '/register-doctor',
    validateRequired(['doctorId', 'doctorData']),
    async (req: Request, res: Response) => {
      try {
        if (!firebaseServices) {
          return sendErrorResponse(res, 'Firebase not initialized', 500);
        }

        const { doctorId, doctorData, isUpdate } = req.body;

        const customToken = await registerDoctor(
          firebaseServices.db,
          firebaseServices.auth,
          doctorId,
          doctorData,
          isUpdate || false
        );

        res.json({ success: true, customToken });
      } catch (error) {
        logger.error('Registration error:', error);
        sendErrorResponse(res, error);
      }
    }
  );

  // Check if doctor exists
  apiRouter.post(
    '/check-doctor',
    validateRequired(['cedula']),
    async (req: Request, res: Response) => {
      try {
        if (!firebaseServices) {
          return sendErrorResponse(res, 'Firebase not initialized', 500);
        }

        const { cedula } = req.body;
        const result = await checkDoctorByCedula(firebaseServices.db, cedula);

        res.json({ success: true, ...result });
      } catch (error) {
        logger.error('Doctor check error:', error);
        sendErrorResponse(res, error);
      }
    }
  );

  // Doctor login endpoint
  apiRouter.post(
    '/login',
    validateRequired(['u', 'p']),
    async (req: Request, res: Response) => {
      try {
        if (!firebaseServices) {
          return sendErrorResponse(res, 'Firebase not initialized', 500);
        }

        const { u: username, p: password } = req.body;

        const loginResult = await authenticateDoctor(
          firebaseServices.db,
          firebaseServices.auth,
          username,
          password
        );

        res.json({ success: true, ...loginResult });
      } catch (error) {
        logger.error('Login error:', error);
        const message = error instanceof Error ? error.message : 'Login failed';
        res.status(401).json({ success: false, error: message });
      }
    }
  );

  // Email sending endpoint
  apiRouter.post(
    '/send-email',
    validateRequired(['to', 'subject'],),
    async (req: Request, res: Response) => {
      try {
        const smtpConfig = loadSmtpConfig();

        if (!smtpConfig) {
          logger.warn('SMTP not configured');
          return res.status(503).json({
            success: false,
            error: 'Email service not configured',
          });
        }

        const { to, subject, text, html } = req.body;
        const transporter = createEmailTransporter(smtpConfig);

        const messageId = await sendEmail(transporter, smtpConfig, {
          to,
          subject,
          text,
          html,
        });

        logger.info(`Email sent: ${messageId}`);
        res.json({ success: true, messageId });
      } catch (error) {
        logger.error('Email sending error:', error);
        sendErrorResponse(res, error);
      }
    }
  );

  app.use('/api', apiRouter);
}

/**
 * Setup static file serving
 */
async function setupStaticServing(app: Express): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    // Development: use Vite middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }
}

/**
 * Start the server
 */
async function startServer(): Promise<void> {
  const PORT = parseInt(process.env.PORT || '3000', 10);

  // Initialize Firebase
  initializeServices();

  // Create app
  const app = createApp();

  // Setup routes
  setupApiRoutes(app);

  // Setup static serving (should be last)
  await setupStaticServing(app);

  // Error handling middleware (should be last)
  app.use(notFoundHandler);
  app.use(errorHandler);

  // Start listening
  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Server running on http://localhost:${PORT}`);
  });
}

// Start server
startServer().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});
