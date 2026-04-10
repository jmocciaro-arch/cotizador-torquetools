'use client';

// ============================================================================
// TorqueTools ERP — useOfflineData Hook
// Hook offline-first: Supabase online, IndexedDB cache offline
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { useOnlineStatus } from './use-online-status';
import {
  getProducts,
  getClients,
  getQuotes,
  saveProducts,
  saveClients,
  saveQuotes,
  type OfflineProduct,
  type OfflineClient,
  type OfflineQuote,
} from '@/lib/offline-store';

// Mapeo tabla → funciones de IndexedDB
const OFFLINE_GETTERS: Record<string, () => Promise<unknown[]>> = {
  products: getProducts,
  clients: getClients,
  quotes: getQuotes,
};

const OFFLINE_SAVERS: Record<string, (data: unknown[]) => Promise<void>> = {
  products: (data) => saveProducts(data as OfflineProduct[]),
  clients: (data) => saveClients(data as OfflineClient[]),
  quotes: (data) => saveQuotes(data as OfflineQuote[]),
};

interface OfflineDataState<T> {
  /** Los datos (de Supabase o IndexedDB) */
  data: T[];
  /** true mientras carga */
  loading: boolean;
  /** true si los datos vienen del cache offline */
  isOffline: boolean;
  /** Error si hubo alguno */
  error: string | null;
  /** Forzar recarga de datos */
  refetch: () => void;
}

interface UseOfflineDataOptions {
  /** Columnas para seleccionar (select de Supabase) */
  select?: string;
  /** Filtros key=value para el query */
  filters?: Record<string, string>;
  /** Ordenar por columna */
  orderBy?: string;
  /** Dirección de orden */
  orderDirection?: 'asc' | 'desc';
  /** Límite de resultados */
  limit?: number;
  /** No ejecutar automáticamente */
  enabled?: boolean;
}

export function useOfflineData<T = Record<string, unknown>>(
  table: string,
  options: UseOfflineDataOptions = {}
): OfflineDataState<T> {
  const { isOnline } = useOnlineStatus();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchIdRef = useRef(0);

  const {
    select = '*',
    filters,
    orderBy,
    orderDirection = 'asc',
    limit,
    enabled = true,
  } = options;

  // Intentar cargar desde IndexedDB (cache offline)
  const loadFromCache = useCallback(async (): Promise<T[]> => {
    const getter = OFFLINE_GETTERS[table];
    if (!getter) {
      console.warn(`[useOfflineData] No hay cache offline para tabla "${table}"`);
      return [];
    }
    const cached = await getter();
    return cached as T[];
  }, [table]);

  // Guardar en IndexedDB
  const saveToCache = useCallback(
    async (items: T[]) => {
      const saver = OFFLINE_SAVERS[table];
      if (saver) {
        await saver(items as unknown[]);
      }
    },
    [table]
  );

  // Función principal de fetch
  const fetchData = useCallback(async () => {
    if (!enabled) return;

    const fetchId = ++fetchIdRef.current;
    setLoading(true);
    setError(null);

    if (isOnline) {
      // === ONLINE: Intentar desde Supabase ===
      try {
        // Construir URL de Supabase REST
        // El componente padre debe configurar las env vars
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
          throw new Error('Variables de Supabase no configuradas');
        }

        let url = `${supabaseUrl}/rest/v1/${table}?select=${encodeURIComponent(select)}`;

        // Agregar filtros
        if (filters) {
          for (const [key, value] of Object.entries(filters)) {
            url += `&${key}=eq.${encodeURIComponent(value)}`;
          }
        }

        // Ordenamiento
        if (orderBy) {
          url += `&order=${orderBy}.${orderDirection}`;
        }

        // Límite
        if (limit) {
          url += `&limit=${limit}`;
        }

        const response = await fetch(url, {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();

        // Verificar que no es un fetch obsoleto
        if (fetchId !== fetchIdRef.current) return;

        setData(result);
        setIsOffline(false);
        setLoading(false);

        // Guardar en cache para uso offline
        await saveToCache(result);
      } catch (err) {
        // Si falla la red, cargar desde cache
        console.warn(`[useOfflineData] Error online para "${table}", usando cache:`, err);
        const cached = await loadFromCache();
        if (fetchId !== fetchIdRef.current) return;
        setData(cached);
        setIsOffline(true);
        setLoading(false);
        if (cached.length === 0) {
          setError('Sin datos en cache');
        }
      }
    } else {
      // === OFFLINE: Cargar desde IndexedDB ===
      try {
        const cached = await loadFromCache();
        if (fetchId !== fetchIdRef.current) return;
        setData(cached);
        setIsOffline(true);
        setLoading(false);
        if (cached.length === 0) {
          setError('Sin datos en cache — conectate a internet para descargar');
        }
      } catch (err) {
        if (fetchId !== fetchIdRef.current) return;
        setData([]);
        setIsOffline(true);
        setLoading(false);
        setError('Error leyendo datos offline');
        console.error(`[useOfflineData] Error offline para "${table}":`, err);
      }
    }
  }, [isOnline, table, select, filters, orderBy, orderDirection, limit, enabled, loadFromCache, saveToCache]);

  // Ejecutar fetch cuando cambian las dependencias
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refetch manual
  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, isOffline, error, refetch };
}
