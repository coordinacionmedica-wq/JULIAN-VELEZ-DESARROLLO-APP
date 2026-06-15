import { VarSlotConfig, DoctorRole } from "./types";

export const MASTER_ADMIN = { u: '761798', p: '761798' };
export const MASTER_READER = { u: 'demo' };

export const DEFAULT_VARS: VarSlotConfig = {
  m: { 'M': 6, '10m': 6, '11m': 6, '12m': 4, '13m': 6, '14m': 6, '15m': 5, '16m': 6, 'D1': 0, 'TierraB': 0, 'PT': 0, 'P': 0, 'COMPENSA': 0 },
  t: { 'T': 6, '10t': 6, '11t': 6, '12t': 4, '13t': 6, '14t': 6, '15t': 5, '16t': 6, 'CX2': 2, 'D2': 0, 'PT': 0, 'P': 0, 'COMPENSA': 0 },
  n: { 'N': 12, '11-10n': 12, '13n': 12, '14n': 6, '16n': 12, '13-10-11n': 12, '13n-16n': 12, 'D3': 0, 'PT': 0, 'P': 0, 'COMPENSA': 0 }
};

export const DAY_NAMES = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
export const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export const STORAGE_KEYS = {
  STAFF: 'sys_staff_v27',
  VARS: 'sys_vars_v27',
  SESSION: 'sys_sess_v27',
  DATA_PREFIX: 'DATA_V27_'
};

// ── Permission System ──────────────────────────────────────────────────────────

export const PERMISSION_LABELS: Record<string, { label: string; description: string; icon: string }> = {
  solicitar_turno:    { label: 'Solicitar cambio de turno',   description: 'Puede enviar solicitudes de cambio de turno al coordinador',                icon: '🔄' },
  call_availability:  { label: 'Disponibilidad rural',        description: 'Puede registrar actividades de llamados y disponibilidad rural',           icon: '📍' },
  ver_pic:            { label: 'Módulo de capacitaciones',    description: 'Acceso al módulo PIC de capacitaciones y actividades formativas',         icon: '🎓' },
  ver_guias:          { label: 'Guías y documentos',          description: 'Acceso a guías clínicas, manuales y documentos institucionales',          icon: '📋' },
  ver_protocolo_rojo: { label: 'Código Rojo (Obstetricia)',   description: 'Acceso al protocolo de atención de emergencia obstétrica Código Rojo',   icon: '🔴' },
  ver_protocolo_azul: { label: 'Código Azul (RCP / Paro)',    description: 'Acceso al protocolo de Código Azul y reanimación cardiopulmonar',       icon: '🔵' },
};

export const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS);

export const DEFAULT_ROLE_PERMISSIONS: Record<DoctorRole | string, string[]> = {
  'Médico General':             ['solicitar_turno', 'call_availability', 'ver_pic', 'ver_guias', 'ver_protocolo_rojo', 'ver_protocolo_azul'],
  'Médico Rural':               ['solicitar_turno', 'call_availability', 'ver_pic', 'ver_guias', 'ver_protocolo_azul'],
  'Médico Especialista':        ['solicitar_turno', 'ver_pic', 'ver_guias', 'ver_protocolo_rojo', 'ver_protocolo_azul'],
  'Especialista':               ['solicitar_turno', 'ver_pic', 'ver_guias', 'ver_protocolo_rojo', 'ver_protocolo_azul'],
  'Médico Obstetra/Ginecólogo': ['solicitar_turno', 'ver_pic', 'ver_guias', 'ver_protocolo_rojo', 'ver_protocolo_azul'],
  'Enfermero Jefe':             ['ver_pic', 'ver_guias', 'ver_protocolo_rojo', 'ver_protocolo_azul'],
  'Jefe de Partos':             ['ver_pic', 'ver_guias', 'ver_protocolo_rojo'],
  'Auxiliar Enfermería':        ['ver_pic', 'ver_guias'],
  'Interno':                    ['solicitar_turno', 'ver_pic', 'ver_guias', 'ver_protocolo_azul'],
  'Triage':                     ['ver_pic', 'ver_guias', 'ver_protocolo_azul'],
  'Odontólogo':                 ['solicitar_turno', 'ver_pic', 'ver_guias'],
  'Laboratorio':                ['ver_pic', 'ver_guias'],
  'Fisioterapeuta':             ['ver_pic', 'ver_guias'],
  'Rayos X':                   ['ver_pic', 'ver_guias'],
};
