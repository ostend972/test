import { useEffect, useState } from 'react';
import { RealtimeEvent } from '../types';

declare global {
  interface Window {
    electronAPI?: {
      onDomainEvent: (callback: (data: any) => void) => () => void;
    };
  }
}

export const useWebSocket = <T extends RealtimeEvent>(event: string, onMessage: (data: T) => void) => {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Utiliser l'API Electron si disponible
    if (window.electronAPI && window.electronAPI.onDomainEvent) {
      setIsConnected(true);

      const cleanup = window.electronAPI.onDomainEvent((data: T) => {
        onMessage(data);
      });

      return () => {
        if (cleanup) cleanup();
      };
    } else {
      setIsConnected(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);

  return { isConnected };
};
