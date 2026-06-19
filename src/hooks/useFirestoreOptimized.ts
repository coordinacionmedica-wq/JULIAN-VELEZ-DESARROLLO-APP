import { useEffect, useState, useCallback } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, DocumentData, Query } from 'firebase/firestore';

interface UseFirestoreQueryOptions {
  cacheTime?: number; // milliseconds
  enabled?: boolean;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// Cache global compartido entre componentes
const queryCache = new Map<string, CacheEntry<any>>();

/**
 * Hook optimizado para queries de Firestore con caché automático
 * @param collectionName - Nombre de la colección
 * @param conditions - Array de condiciones [field, operator, value]
 * @param options - Opciones de caché y habilitación
 * @returns { data, loading, error }
 */
export const useFirestoreQuery = <T extends DocumentData>(
  collectionName: string,
  conditions: [string, '<' | '==' | '>' | '>=' | '<=' | '!=' | 'array-contains', any][] = [],
  options: UseFirestoreQueryOptions = {}
) => {
  const { cacheTime = 5 * 60 * 1000, enabled = true } = options;
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Crear clave de caché única basada en query
  const cacheKey = `${collectionName}:${JSON.stringify(conditions)}`;

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    // Verificar caché
    const cached = queryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cacheTime) {
      setData(cached.data);
      return;
    }

    setLoading(true);
    try {
      let q: Query;
      const collRef = collection(db, collectionName);

      if (conditions.length > 0) {
        const whereConditions = conditions.map(([field, op, value]) =>
          where(field, op as any, value)
        );
        q = query(collRef, ...whereConditions);
      } else {
        q = query(collRef);
      }

      const snapshot = await getDocs(q);
      const results = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as T[];

      // Guardar en caché
      queryCache.set(cacheKey, {
        data: results,
        timestamp: Date.now()
      });

      setData(results);
      setError(null);
    } catch (err) {
      console.error(`Error fetching ${collectionName}:`, err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [collectionName, conditions, cacheKey, cacheTime, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
};

/**
 * Limpia el caché de queries
 */
export const clearFirestoreCache = () => {
  queryCache.clear();
};

/**
 * Hook para obtener un documento específico
 */
export const useFirestoreDoc = <T extends DocumentData>(
  collectionName: string,
  docId: string | null,
  options: UseFirestoreQueryOptions = {}
) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!docId) {
      setData(null);
      return;
    }

    const fetchDoc = async () => {
      setLoading(true);
      try {
        const { getDoc, doc } = await import('firebase/firestore');
        const docRef = doc(db, collectionName, docId);
        const snapshot = await getDoc(docRef);
        
        if (snapshot.exists()) {
          setData({ id: snapshot.id, ...snapshot.data() } as T);
          setError(null);
        } else {
          setData(null);
        }
      } catch (err) {
        console.error(`Error fetching ${collectionName}/${docId}:`, err);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    };

    fetchDoc();
  }, [collectionName, docId]);

  return { data, loading, error };
};