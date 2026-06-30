import fs from 'fs';
import path from 'path';
import { initializeApp, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';

export interface FirebaseAppConfig {
  projectId: string;
  firestoreDatabaseId?: string;
}

/**
 * Load Firebase configuration from file
 */
export function loadFirebaseConfig(configPath: string): FirebaseAppConfig | null {
  try {
    if (!fs.existsSync(configPath)) {
      console.warn(`Firebase config file not found at ${configPath}`);
      return null;
    }

    const configData = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(configData) as FirebaseAppConfig;
  } catch (err) {
    console.error('Error loading Firebase configuration:', err);
    return null;
  }
}

/**
 * Initialize Firebase Admin
 */
export function initializeFirebaseAdmin(config: FirebaseAppConfig): {
  app: App;
  db: Firestore;
  auth: Auth;
} {
  const app = initializeApp({
    projectId: config.projectId,
  });

  const db = config.firestoreDatabaseId
    ? getFirestore(app, config.firestoreDatabaseId)
    : getFirestore(app);

  const auth = getAuth(app);

  return { app, db, auth };
}
