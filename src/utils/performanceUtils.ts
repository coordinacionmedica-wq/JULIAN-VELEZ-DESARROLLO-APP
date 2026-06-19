/**
 * Utilidades para optimización de performance
 */

/**
 * Debounce function para evitar múltiples llamadas rápidas
 * Útil para búsquedas, guardado automático, etc.
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function para limitar llamadas a un máximo por tiempo
 * Útil para eventos de scroll, resize, etc.
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function (...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Memoization simple para funciones puras
 */
export function memoize<T extends (...args: any[]) => any>(func: T): T {
  const cache = new Map();

  return ((...args: any[]) => {
    const key = JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key);
    }

    const result = func(...args);
    cache.set(key, result);

    // Limitar tamaño del caché
    if (cache.size > 100) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }

    return result;
  }) as T;
}

/**
 * Medir tiempo de ejecución (dev only)
 */
export function measurePerformance<T>(
  name: string,
  func: () => T
): T {
  if (process.env.NODE_ENV === 'development') {
    const start = performance.now();
    const result = func();
    const end = performance.now();
    console.log(`⏱️  ${name}: ${(end - start).toFixed(2)}ms`);
    return result;
  }
  return func();
}

/**
 * Medir tiempo de una función async
 */
export async function measureAsyncPerformance<T>(
  name: string,
  func: () => Promise<T>
): Promise<T> {
  if (process.env.NODE_ENV === 'development') {
    const start = performance.now();
    const result = await func();
    const end = performance.now();
    console.log(`⏱️  ${name}: ${(end - start).toFixed(2)}ms`);
    return result;
  }
  return func();
}

/**
 * Batch updates para múltiples operaciones
 * Reduce re-renders en React
 */
export async function batchOperations<T>(
  operations: Array<() => Promise<T>>,
  batchSize: number = 5
): Promise<T[]> {
  const results: T[] = [];

  for (let i = 0; i < operations.length; i += batchSize) {
    const batch = operations.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(op => op()));
    results.push(...batchResults);
  }

  return results;
}

/**
 * Retro compatible con compartir datos entre pestañas
 */
export class SharedCache {
  private static instance: SharedCache;
  private data = new Map<string, any>();

  static getInstance(): SharedCache {
    if (!SharedCache.instance) {
      SharedCache.instance = new SharedCache();
    }
    return SharedCache.instance;
  }

  set(key: string, value: any, ttl?: number): void {
    this.data.set(key, { value, timestamp: Date.now(), ttl });
    if (ttl) {
      setTimeout(() => this.data.delete(key), ttl);
    }
  }

  get(key: string): any {
    const entry = this.data.get(key);
    if (!entry) return null;

    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      this.data.delete(key);
      return null;
    }

    return entry.value;
  }

  clear(): void {
    this.data.clear();
  }
}

export const sharedCache = SharedCache.getInstance();