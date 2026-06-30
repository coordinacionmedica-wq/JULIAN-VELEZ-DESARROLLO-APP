import { Firestore } from 'firebase-admin/firestore';
import { Auth } from 'firebase-admin/auth';
import { DoctorLoginRequest, DoctorCheckRequest, DoctorRegistrationRequest } from './api';

export interface DoctorData {
  id: number;
  nombre: string;
  username?: string;
  cedula?: string;
  st: 'activo' | 'inactivo';
  passwordLastChanged?: number;
}

export interface CheckDoctorResponse {
  exists: boolean;
  id?: number;
  username?: string;
  nombre?: string;
}

export interface LoginResponse {
  customToken: string;
  session: {
    r: 'doctor';
    n: string;
    doctorId: number;
  };
  passwordLastChanged?: number;
}

/**
 * Check if a doctor exists by cedula
 */
export async function checkDoctorByCedula(
  db: Firestore,
  cedula: string
): Promise<CheckDoctorResponse> {
  const query = await db.collection('doctors').where('cedula', '==', cedula).get();
  
  if (query.empty) {
    return { exists: false };
  }

  const data = query.docs[0].data() as DoctorData;
  return {
    exists: true,
    id: data.id,
    username: data.username,
    nombre: data.nombre,
  };
}

/**
 * Authenticate doctor with username and password
 */
export async function authenticateDoctor(
  db: Firestore,
  auth: Auth,
  username: string,
  password: string
): Promise<LoginResponse> {
  const query = await db
    .collection('doctors')
    .where('username', '==', username)
    .where('password', '==', password)
    .get();

  if (query.empty) {
    throw new Error('Credenciales incorrectas');
  }

  const data = query.docs[0].data() as DoctorData;

  if (data.st !== 'activo') {
    throw new Error('Usuario inactivo');
  }

  const doctorId = data.id.toString();
  const customToken = await auth.createCustomToken(doctorId);

  return {
    customToken,
    session: {
      r: 'doctor',
      n: data.nombre,
      doctorId: data.id,
    },
    passwordLastChanged: data.passwordLastChanged,
  };
}

/**
 * Register or update a doctor
 */
export async function registerDoctor(
  db: Firestore,
  auth: Auth,
  doctorId: number,
  doctorData: Record<string, unknown>,
  isUpdate: boolean
): Promise<string> {
  const docRef = db.collection('doctors').doc(doctorId.toString());

  if (isUpdate) {
    // Double check it doesn't already have a username to prevent spoofing
    const existingDoc = await docRef.get();
    if (existingDoc.exists && existingDoc.data()?.username) {
      throw new Error('La cuenta ya está activada');
    }
    await docRef.update(doctorData);
  } else {
    await docRef.set(doctorData);
  }

  // Generate Custom Token for Firebase Auth
  const customToken = await auth.createCustomToken(doctorId.toString());
  return customToken;
}
