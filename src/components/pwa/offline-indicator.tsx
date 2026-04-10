'use client';

// ============================================================================
// TorqueTools ERP — Offline Status Indicator
// Barra superior que muestra el estado de conexión y acciones pendientes
// ============================================================================

import { useEffect, useState, useCallback } from 'react';
import { useOnlineStatus } from '@/hooks/use-online-status';

export function OfflineIndicator() {
  const { isOnline, pendingCount } = useOnlineStatus();
  const [showReconnected, setShowReconnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const [visible, setVisible] = useState(false);

  // Manejar transiciones online/offline
  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
      setVisible(true);
      setShowReconnected(false);
    } else if (wasOffline && isOnline) {
      // Acabamos de volver online
      setShowReconnected(true);
      setIsSyncing(pendingCount > 0);

      // Ocultar después de 4 segundos si no hay acciones pendientes
      const timer = setTimeout(() => {
        if (pendingCount === 0) {
          setVisible(false);
          setWasOffline(false);
          setTimeout(() => setShowReconnected(false), 300);
        }
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline, pendingCount]);

  // Cuando se terminan las acciones pendientes, ocultar la barra
  useEffect(() => {
    if (showReconnected && pendingCount === 0) {
      setIsSyncing(false);
      const timer = setTimeout(() => {
        setVisible(false);
        setWasOffline(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showReconnected, pendingCount]);

  // No mostrar nada si estamos online y nunca estuvimos offline
  if (isOnline && !showReconnected && !visible) return null;

  const isOfflineMode = !isOnline;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        transform: visible || isOfflineMode ? 'translateY(0)' : 'translateY(-100%)',
        transition: 'transform 0.3s ease, background 0.3s ease',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          padding: '0.5rem 1rem',
          fontSize: '0.825rem',
          fontWeight: 500,
          fontFamily: 'Inter, -apple-system, sans-serif',
          background: isOfflineMode
            ? 'linear-gradient(135deg, #DC2626, #B91C1C)'
            : isSyncing
              ? 'linear-gradient(135deg, #F59E0B, #D97706)'
              : 'linear-gradient(135deg, #16A34A, #15803D)',
          color: 'white',
          textAlign: 'center',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* Indicador animado */}
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'white',
            animation: isOfflineMode || isSyncing ? 'blink 1.5s ease-in-out infinite' : 'none',
            opacity: isOfflineMode || isSyncing ? 1 : 0.8,
          }}
        />

        {/* Mensaje */}
        <span>
          {isOfflineMode && (
            <>
              Sin conexion — trabajando con datos guardados
              {pendingCount > 0 && (
                <span style={{ opacity: 0.85, marginLeft: '0.35rem' }}>
                  ({pendingCount} {pendingCount === 1 ? 'accion pendiente' : 'acciones pendientes'})
                </span>
              )}
            </>
          )}
          {showReconnected && isSyncing && (
            <>
              Conexion restaurada — sincronizando {pendingCount}{' '}
              {pendingCount === 1 ? 'accion' : 'acciones'}...
            </>
          )}
          {showReconnected && !isSyncing && 'Conexion restaurada — todo sincronizado'}
        </span>

        <style>{`
          @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
        `}</style>
      </div>
    </div>
  );
}
