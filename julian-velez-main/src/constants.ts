import { VarSlotConfig } from "./types";

export const MASTER_ADMIN = { u: '761798', p: '761798' };
export const MASTER_READER = { u: 'demo' };

export const DEFAULT_VARS: VarSlotConfig = {
  m: { 'M': 6, '10m': 6, '11m': 6, '12m': 4, '13m': 6, '14m': 6, '15m': 5, '16m': 6, 'D1': 0, 'PT': 0 },
  t: { 'T': 6, '10t': 6, '11t': 6, '12t': 4, '13t': 6, '14t': 6, '15t': 5, '16t': 6, 'CX2': 2, 'D2': 0, 'PT': 0 },
  n: { 'N': 12, '11-10n': 12, '13n': 12, '14n': 6, '16n': 12, '13-10-11n': 12, '13n-16n': 12, 'D3': 0, 'PT': 0 }
};

export const DAY_NAMES = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
export const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export const STORAGE_KEYS = {
  STAFF: 'sys_staff_v27',
  VARS: 'sys_vars_v27',
  SESSION: 'sys_sess_v27',
  DATA_PREFIX: 'DATA_V27_'
};
