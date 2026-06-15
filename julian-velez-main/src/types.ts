export type SlotType = 'm' | 't' | 'n';
export type DoctorRole = 
  | 'Médico Rural' 
  | 'Médico General' 
  | 'Médico Especialista' 
  | 'Enfermero Jefe' 
  | 'Auxiliar Enfermería' 
  | 'Interno' 
  | 'Triage' 
  | 'Laboratorio' 
  | 'Odontólogo'
  | 'Especialista'
  | 'Fisioterapeuta'
  | 'Rayos X'
  | 'Médico Obstetra/Ginecólogo'
  | 'Jefe de Partos';

export interface Doctor {
  id: number;
  nombre: string;
  apellidos?: string;
  cedula?: string;
  registroMedico?: string;
  email?: string;
  telefono?: string;
  cat: 'Planta' | 'CTA' | 'APS' | 'Rural' | 'Disponibilidad';
  rol: DoctorRole;
  st: 'activo' | 'inactivo';
  contacto?: string;
  username?: string;
  password?: string;
  permissions?: string[];
  passwordLastChanged?: number;
  createdAt?: number;
}

export type ShiftMap = Record<number, string>; // day -> sigla

export interface DoctorShifts {
  m: ShiftMap;
  t: ShiftMap;
  n: ShiftMap;
}

export type MonthlyData = Record<number, DoctorShifts>; // doctorId -> shifts

export interface AuditEntry {
  id: number;
  timestamp: number;
  targetMonth: number;
  targetYear: number;
  doctorId: number;
  doctorName: string;
  doctorContact?: string;
  day: number;
  slot: SlotType;
  oldSigla: string;
  newSigla: string;
  adminName: string;
}

export interface VarSlotConfig {
  m: Record<string, number>;
  t: Record<string, number>;
  n: Record<string, number>;
}

export interface UserSession {
  r: 'admin' | 'read' | 'doctor' | 'root';
  n: string;
  doctorId?: number;
}

export interface ShiftRequest {
  id: number;
  timestamp: number;
  doctorId: number;
  doctorName: string;
  day: number;
  slot: SlotType;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  targetMonth: number;
  targetYear: number;
}

export interface RuralAvailability {
  id: string;
  doctorId: number;
  doctorName: string;
  callDateTime: number;
  hospitalArrivalTime: string; 
  activity: string;
  patientName: string;
  patientId: string;
  diagnosis: string;
  acceptancePlace: string;
  calledBy: string;
  terminationDateTime: number;
  totalHours: number;
  timestamp: number;
  targetMonth: number;
  targetYear: number;
}

export interface AvailabilityCall {
  id: string;
  timestamp: number;
  doctorId: number;
  doctorName: string;
  callerName: string;
  service: string;
  slot: SlotType;
  day: number;
  month: number;
  year: number;
}

export interface TrainingActivity {
  id: string;
  month: number;
  year: number;
  activityName: string;
  day: number;
  place: string;
  modality: 'presencial' | 'virtual' | 'mixta';
  hours: number;
  targetGroup: string;
  responsible: string;
  targetPopulation: string;
  files: {
    preTest?: string; // filename or url
    training?: string;
    attendance?: string;
    postTest?: string;
  };
  attendees: number[]; // doctorIds
  status: 'programada' | 'realizada' | 'cancelada';
  timestamp: number;
}

export interface ServiceMapping {
  id: string;
  name: string;
  siglas: string[]; // Many-to-one mapping possible
}
