'use client';

// ============================================================================
// TorqueTools ERP — Background Sync Manager
// Componente invisible que gestiona sincronización offline/online
// ============================================================================

import { useEffect, useRef, useCallback } from 'react';
import { useOnlineStatus } from '@/hooks/use-online-status';
import {
  syncPendingActions,
  saveProducts,
  saveClients,
  getPendingActionsCount,
} from '@/lib/offline-store';
import { onPWAEvent } from '@/lib/pwa';

// Intervalo de refresco de datos offline (30 minutos)
const CACHE_REFRESH_INTERVAL = 30 * 60 * 1000;

interface SyncManagerProps {
  /** URL base de la API de Supabase */
  supabaseUrl?: string;
  /** Clave anónima de Supabase */
  supabaseAnonKey?: string;
  /** Callback cuando se muestra un toast/notificación */
  onToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

export function SyncManager({
  supabaseUrl,
  supabaseAnonKey,
  onToast,
}: SyncManagerProps) {
  const { isOnline } = useOnlineStatus();
  const wasOfflineRef = useRef(false);
  const cacheIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isSyncingRef = useRef(false);

  // Función para mostrar toast (fallback a console.log)
  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'info') => {
      if (onToast) {
        onToast(message, type);
      } else {
        console.log(`[SyncManager] [${type}] ${message}`);
      }
    },
    [onToast]
  );

  // Sincronizar acciones pendientes
  const doSync = useCallback(async () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;

    try {
      const count = await getPendingActionsCount();
      if (count === 0) {
        isSyncingRef.current = false;
        return;
      }

      showToast(`Sincronizando ${count} ${count === 1 ? 'accion' : 'acciones'} pendientes...`, 'info');

      const result = await syncPendingActions();

      if (result.synced > 0) {
        showToast(
          `${result.synced} ${result.synced === 1 ? 'accion sincronizada' : 'acciones sincronizadas'} correctamente`,
          'success'
        );
      }

      if (result.failed > 0) {
        showToast(
          `${result.failed} ${result.failed === 1 ? 'accion fallo' : 'acciones fallaron'} al sincronizar`,
          'error'
        );
      }
    } catch (error) {
      console.error('[SyncManager] Error sincronizando:', error);
      showToast('Error al sincronizar datos', 'error');
    } finally {
      isSyncingRef.current = false;
    }
  }, [showToast]);

  // Cachear datos frescos cuando estamos online
  const refreshOfflineCache = useCallback(async () => {
    if (!supabaseUrl || !supabaseAnonKey) return;

    try {
      const headers = {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      };

      // Cachear productos
      const productsRes = await fetch(`${supabaseUrl}/rest/v1/products?select=*`, {
        headers,
      });
      if (productsRes.ok) {
        const products = await productsRes.json();
        await saveProducts(products);
        console.log(`[SyncManager] ${products.length} productos cacheados`);
      }

      // Cachear clientes
      const clientsRes = await fetch(`${supabaseUrl}/rest/v1/clients?select=*`, {
        headers,
      });
      if (clientsRes.ok) {
        const clients = await clientsRes.json();
        await saveClients(clients);
        console.log(`[SyncManager] ${clients.length} clientes cacheados`);
      }
    } catch (error) {
      // Silenciar errores de cache refresh — no es crítico
      console.warn('[SyncManager] Error refrescando cache offline:', error);
    }
  }, [supabaseUrl, supabaseAnonKey]);

  // Detectar transición offline → online
  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true;
      return;
    }

    if (wasOfflineRef.current && isOnline) {
      wasOfflineRef.current = false;
      // Volvimos online: sincronizar + refrescar cache
      doSync();
      refreshOfflineCache();
    }
  }, [isOnline, doSync, refreshOfflineCache]);

  // Escuchar mensajes de sync del Service Worker
  useEffect(() => {
    const cleanup = onPWAEvent('sync-complete', (detail: unknown) => {
      const data = detail as { synced?: number };
      if (data?.synced && data.synced > 0) {
        showToast(
          `Service Worker sincronizo ${data.synced} ${data.synced === 1 ? 'accion' : 'acciones'}`,
          'success'
        );
      }
    });

    return cleanup;
  }, [showToast]);

  // Refrescar cache periódicamente cuando estamos online
  useEffect(() => {
    if (!isOnline) {
      if (cacheIntervalRef.current) {
        clearInterval(cacheIntervalRef.current);
        cacheIntervalRef.current = null;
      }
      return;
    }

    // Refrescar al montar si estamos online
    refreshOfflineCache();

    // Configurar intervalo de refresco
    cacheIntervalRef.current = setInterval(refreshOfflineCache, CACHE_REFRESH_INTERVAL);

    return () => {
      if (cacheIntervalRef.current) {
        clearInterval(cacheIntervalRef.current);
      }
    };
  }, [isOnline, refreshOfflineCache]);

  // Componente invisible — no renderiza nada
  return null;
}
