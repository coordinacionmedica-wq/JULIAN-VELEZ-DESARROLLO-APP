import { VarSlotConfig, DoctorRole } from "./types";

export const MASTER_ADMIN = { u: '761798', p: '761798' };
export const MASTER_READER = { u: 'demo' };

export const DEFAULT_VARS: VarSlotConfig = {
  m: {
    'M': 6, '10m': 6, '11m': 6, '12m': 4, '13m': 6, '14m': 6, '15m': 5, '16m': 6,
    'D1': 0, 'TierraB': 0, 'PT': 0, 'P': 0, 'COMPENSA': 0, 'CAP': 0, 'L': 0,
    '-24': -24, '-18': -18, '-12': -12, '-8': -8, '-7': -7, '-6': -6, '-5': -5,
    '-4': -4, '-3': -3, '-2': -2, '-1': -1, '1': 1, '7': 7, '8': 8, '9': 9,
    '10': 10, '11': 11, '12': 12, '15': 15, '10-16m': 6, '10m-16m': 6, '10n': 12,
    '10n-16n': 12, '10n-19n': 12, '11-10-16n': 12, '11-10n': 12, '11m-15m': 6,
    '11n': 12, '12m..': 3, '12m3': 3, '12m4': 4, '12m5': 5, '12m6': 6, '12m7': 7,
    '12mCa': 4, '12mR': 4, '12tR': 3, '13,10,19n': 12, '13-10-11n': 12, '13-16m': 6,
    '13m/4': 4, '13m-16m': 6, '13m-18m': 6, '13m-19m': 6, '13n-16n': 12, '14-16t': 6,
    '14m-15m': 5, '14m-16m': 6, '14n': 6, '14t-16t': 6, '16': 16, '16-19m': 6,
    '16-19n': 12, '16m-13m': 5, '16m-14m': 6, '16m-19m': 5, '16n': 12, '16t-13t': 5,
    '17': 6, '17R': 4, '17TR': 5, '18': 18, '18m': 6, '19-16m': 6, '19m': 6,
    '19m1': 6, '2': 2, '24': 24, '29': 29, '3': 3, '3280': 4, '3280..': 3,
    '3280AV': 4, '3280AVC': 4, '3280IAJ': 4, '3280Rey': 4, '3280X': 5, '4': 4,
    '5': 5, '6': 6, '8m': 4, '8mx': 4, 'ACLS-SV': 4, 'admin': 4, 'Admin 5': 5,
    'Ancian': 4, 'APS': 4, 'ARO': 4, 'ARO5': 5, 'ARO6': 6, 'Asun': 4, 'Asun20': 4,
    'Asun30': 4, 'Asun5': 5, 'audienc': 4, 'Audit': 8, 'AuditM': 5, 'AudV': 8,
    'B/vista': 4, 'Belgica': 4, 'Bri.Snt.Rta': 4, 'Brigada': 4, 'Buenavista': 4,
    'Caceres': 4, 'Cajamarca': 4, 'Candelaria': 4, 'Capaci': 4, 'Cascarillo': 4,
    'Cirhuelo': 4, 'Cirugia': 5, 'Cole': 4, 'colegio': 4, 'congreso': 4, 'CX': 4,
    'CX2': 2, 'CX4': 4, 'CX5': 5, 'D2': 0, 'D20': 0, 'D3': 0, 'D4': 0, 'ECO': 5,
    'ECO30': 4, 'ECO4D': 4, 'ECO5': 5, 'El Palmar': 4, 'espejo': 4, 'F': 4,
    'GO': 4, 'Guayabal': 4, 'Higue': 4, 'Hobo': 4, 'hogar': 4, 'Inducc': 4,
    'irrupa': 4, 'Isugu': 4, 'limones': 4, 'Mamogra': 4, 'Mateg': 4, 'Montañuela': 4,
    'NEPS': 4, 'NEPS30': 4, 'Neps4': 4, 'Neps5': 5, 'Ortoped': 5, 'padrino': 5,
    'Palmar': 4, 'Paramillo': 4, 'Parcelas': 4, 'Partos': 5, 'PED': 5, 'PROA': 4,
    'PtoQuin': 4, 'Px': 5, 'PyP3': 3, 'PyP4': 4, 'PyP5': 5, 'PyP6': 6, 'R.Med': 2,
    'RCM2': 2, 'RCM2/Ad': 5, 'RCM3': 3, 'RCM4': 4, 'RCM5': 5, 'RCV4': 4, 'Remolino': 4,
    'Retiro': 4, 'Rey4': 4, 'RuralAps': 4, 'S. Boliv': 4, 'S.Ana': 4, 'S.Rita': 4,
    'S.Seb': 4, 'S.Seb3': 3, 'Seb/Aud': 4, 'Sisidro': 4, 'Soledad': 4, 'SSA': 4,
    'Sseb3': 3, 'Sseb4': 4, 'Sseb5': 5, 'Taller Gnv': 6, 'taller': 4, 'taller..': 4,
    'TCm': 5, 'TCt': 4, 'URO': 5, 'Vacacio': 6, 'Vrural': 4, 'X5': 5, 'X6': 6,
    'X8': 8, 'XM4': 4, 'XM5': 5, 'XM6': 6, 'Xturno': 6, 'XX': 24
  },
  t: {
    'T': 6, '10t': 6, '11t': 6, '12t': 4, '13t': 6, '14t': 6, '15t': 5, '16t': 6,
    'CX2': 2, 'D2': 0, 'PT': 0, 'P': 0, 'COMPENSA': 0, 'CAP': 0, 'L': 0,
    '-24': -24, '-18': -18, '-12': -12, '-8': -8, '-7': -7, '-6': -6, '-5': -5,
    '-4': -4, '-3': -3, '-2': -2, '-1': -1, '7': 7, '8': 8, '9': 9, '10': 10,
    '11': 11, '12': 12, '15': 15, '10-16t': 6, '10t-16t': 6, '10t-16t1': 7,
    '16t-13t': 5, '17': 6, 'Admin': 4,
    'Admin5': 5, 'Ancian': 4, 'Ancianato': 4, 'ARO': 4, 'Asun': 4, 'Audit': 8,
    'B/vista': 4, 'Belgica': 4, 'Bri.Snt.Rta': 4, 'Brigada': 4, 'Buenavista': 4,
    'Caceres': 4, 'Cajamarca': 4, 'Candelaria': 4, 'Cascarillo': 4, 'Cirhuelo': 4,
    'CX': 4, 'CX4': 4, 'CX5': 5, 'D1': 0, 'D3': 0, 'D4': 0, 'ECO': 5, 'F': 4,
    'GO': 4, 'Guayabal': 4, 'Higue': 4, 'Hobo': 4, 'hogar': 4, 'Inducc': 4,
    'irrupa': 4, 'Isugu': 4, 'limones': 4, 'NEPS': 4, 'NEPS30': 4, 'Neps4': 4,
    'Neps5': 5, 'Ortoped': 5, 'Palmar': 4, 'Paramillo': 4, 'Parcelas': 4, 'PED': 5,
    'PROA': 4, 'PtoQuin': 4, 'Px': 5, 'PyP3': 3, 'PyP4': 4, 'PyP5': 5, 'PyP6': 6,
    'R.Med': 2, 'RCM2': 2, 'RCM3': 3, 'RCM4': 4, 'RCM5': 5, 'RCV4': 4, 'Remolino': 4,
    'Retiro': 4, 'RuralAps': 4, 'S. Boliv': 4, 'S.Ana': 4, 'S.Rita': 4, 'S.Seb': 4,
    'S.Seb3': 3, 'Seb/Aud': 4, 'Sisidro': 4, 'Soledad': 4, 'SSA': 4, 'Sseb3': 3,
    'Sseb4': 4, 'Sseb5': 5, 'taller': 4, 'taller..': 4, 'TCt': 4, 'URO': 5,
    'Vrural': 4, 'X5': 5, 'X6': 6, 'X8': 8, 'XM4': 4, 'XM5': 5, 'XM6': 6, 'XX': 24
  },
  n: {
    'N': 12, '11-10n': 12, '13n': 12, '14n': 6, '16n': 12, '13-10-11n': 12,
    '13n-16n': 12, 'D3': 0, 'PT': 0, 'P': 0, 'COMPENSA': 0, 'CAP': 0, 'L': 0,
    '-24': -24, '-18': -18, '-12': -12, '-8': -8, '-7': -7, '-6': -6, '-5': -5,
    '-4': -4, '-3': -3, '-2': -2, '-1': -1, '1': 1, '7': 7, '8': 8, '9': 9,
    '10': 10, '11': 11, '12': 12, '15': 15, '10n': 12, '10n-16n': 12, '10n-19n': 12,
    '11n': 12,
    '16': 16, '16-19n': 12, '17': 6, '18': 18, '19m': 6, '2': 2, '24': 24,
    '29': 29, '3': 3, '4': 4, '5': 5, '6': 6, 'NEPS': 4, 'NEPS30': 4, 'Neps4': 4,
    'Neps5': 5, 'Ortoped': 5, 'PED': 5, 'Px': 5, 'PyP3': 3, 'PyP4': 4, 'PyP5': 5,
    'PyP6': 6, 'R.Med': 2, 'RCM2': 2, 'RCM3': 3, 'RCM4': 4, 'RCM5': 5, 'RCV4': 4,
    'RuralAps': 4, 'S. Boliv': 4, 'S.Ana': 4, 'S.Rita': 4, 'S.Seb': 4, 'S.Seb3': 3,
    'Seb/Aud': 4, 'Sisidro': 4, 'Soledad': 4, 'SSA': 4, 'Sseb3': 3, 'Sseb4': 4,
    'Sseb5': 5, 'Vrural': 4, 'X5': 5, 'X6': 6, 'X8': 8, 'XM4': 4, 'XM5': 5,
    'XM6': 6, 'XX': 24
  }
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
