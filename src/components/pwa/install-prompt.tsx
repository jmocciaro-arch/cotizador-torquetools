'use client';

// ============================================================================
// Mocciaro Soft — Install PWA Banner
// Banner para instalar la app como PWA
// ============================================================================

import { useEffect, useState } from 'react';
import { showInstallPrompt, onPWAEvent } from '@/lib/pwa';

const DISMISS_KEY = 'torquetools-install-dismissed';

export function InstallPrompt() {
  const [canInstall, setCanInstall] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // Verificar si ya fue descartado
    const wasDismissed = localStorage.getItem(DISMISS_KEY);
    if (wasDismissed) return;
    setDismissed(false);

    // Escuchar cuando el install prompt esté disponible
    const cleanup = onPWAEvent('install-prompt-available', () => {
      setCanInstall(true);
    });

    // Escuchar si la app fue instalada
    const cleanupInstalled = onPWAEvent('app-installed', () => {
      setCanInstall(false);
    });

    return () => {
      cleanup();
      cleanupInstalled();
    };
  }, []);

  const handleInstall = async () => {
    setInstalling(true);
    const accepted = await showInstallPrompt();
    setInstalling(false);
    if (accepted) {
      setCanInstall(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(DISMISS_KEY, 'true');
  };

  if (!canInstall || dismissed) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9998,
        padding: '0 1rem 1rem',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          maxWidth: '480px',
          margin: '0 auto',
          background: '#1A1D24',
          border: '1px solid rgba(255, 102, 0, 0.3)',
          borderRadius: '16px',
          padding: '1rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          boxShadow: '0 -4px 24px rgba(0, 0, 0, 0.5)',
          pointerEvents: 'auto',
          animation: 'slideUp 0.4s ease-out',
        }}
      >
        {/* Icono */}
        <div
          style={{
            width: '44px',
            height: '44px',
            background: '#FF6600',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: '1.1rem',
            fontWeight: 900,
            color: 'white',
          }}
        >
          TT
        </div>

        {/* Texto */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              color: '#E5E7EB',
              fontSize: '0.9rem',
              fontWeight: 600,
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            Instala TorqueTools
          </p>
          <p
            style={{
              color: '#6B7280',
              fontSize: '0.8rem',
              margin: '0.15rem 0 0',
              lineHeight: 1.3,
            }}
          >
            Acceso rapido desde tu pantalla de inicio
          </p>
        </div>

        {/* Botones */}
        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
          <button
            onClick={handleDismiss}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#6B7280',
              fontSize: '0.8rem',
              cursor: 'pointer',
              padding: '0.4rem 0.6rem',
              borderRadius: '8px',
              transition: 'color 0.2s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.color = '#9CA3AF')}
            onMouseOut={(e) => (e.currentTarget.style.color = '#6B7280')}
          >
            Ahora no
          </button>
          <button
            onClick={handleInstall}
            disabled={installing}
            style={{
              background: '#FF6600',
              border: 'none',
              color: 'white',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: installing ? 'wait' : 'pointer',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              transition: 'background 0.2s',
              opacity: installing ? 0.7 : 1,
            }}
            onMouseOver={(e) => {
              if (!installing) e.currentTarget.style.background = '#E65C00';
            }}
            onMouseOut={(e) => (e.currentTarget.style.background = '#FF6600')}
          >
            {installing ? 'Instalando...' : 'Instalar'}
          </button>
        </div>

        <style>{`
          @keyframes slideUp {
            from {
              transform: translateY(100%);
              opacity: 0;
            }
            to {
              transform: translateY(0);
              opacity: 1;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
