'use client';

// ============================================================================
// TorqueTools ERP — useOnlineStatus Hook
// Hook de React para monitorear el estado de conexión y acciones pendientes
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { getPendingActionsCount } from '@/lib/offline-store';

interface OnlineStatusState {
  /** true si hay conexión a internet */
  isOnline: boolean;
  /** Cantidad de acciones pendientes de sincronizar */
  pendingCount: number;
}

export function useOnlineStatus(): OnlineStatusState {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState<number>(0);

  // Actualizar el conteo de acciones pendientes
  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await getPendingActionsCount();
      setPendingCount(count);
    } catch {
      // IndexedDB puede no estar disponible en SSR
      setPendingCount(0);
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Al volver online, refrescar el conteo (se sincronizarán pronto)
      refreshPendingCount();
    };

    const handleOffline = () => {
      setIsOnline(false);
      refreshPendingCount();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Polling del conteo de pendientes cada 5 segundos
    const interval = setInterval(refreshPendingCount, 5000);

    // Conteo inicial
    refreshPendingCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [refreshPendingCount]);

  return { isOnline, pendingCount };
}
