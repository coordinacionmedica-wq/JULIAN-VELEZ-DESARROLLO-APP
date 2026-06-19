import { useMemo } from 'react';

/**
 * Custom hook para normalizar strings con caché.
 * Evita recalcular normalizaciones repetidas.
 * 
 * @param input - String a normalizar
 * @returns String normalizado (sin acentos, minúsculas, sin caracteres especiales)
 */
export const useNormalizeString = (input: string): string => {
  return useMemo(() => {
    if (!input) return '';
    return input
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Elimina acentos
      .replace(/[^a-z0-9\s]/g, '')     // Elimina caracteres especiales
      .replace(/\s+/g, ' ')             // Normaliza espacios
      .toLowerCase()
      .trim();
  }, [input]);
};

/**
 * Hook para capitalizar strings (primera letra mayúscula)
 * @param input - String a capitalizar
 * @returns String capitalizado
 */
export const useCapitalize = (input: string): string => {
  return useMemo(() => {
    if (!input) return '';
    return input.charAt(0).toUpperCase() + input.slice(1).toLowerCase();
  }, [input]);
};

/**
 * Cache manual para normalización intensiva
 * Útil cuando tienes muchos strings para normalizar
 */
export class StringNormalizationCache {
  private cache = new Map<string, string>();
  private maxSize = 1000;

  normalize(str: string): string {
    if (!str) return '';

    const cached = this.cache.get(str);
    if (cached) return cached;

    const normalized = str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .trim();

    // Mantener cache bajo control
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(str, normalized);
    return normalized;
  }

  clear() {
    this.cache.clear();
  }

  getStats() {
    return { size: this.cache.size, maxSize: this.maxSize };
  }
}

// Instancia global (singleton)
export const stringCache = new StringNormalizationCache();