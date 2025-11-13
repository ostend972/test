import { useEffect, useState, useRef } from 'react';

// This hook now uses Electron's IPC to receive real-time events from the main process.
export const useWebSocket = (event, onMessage) => {
  // In an Electron context, IPC is always available, so we can consider it "connected".
  const [isConnected, setIsConnected] = useState(true);
  const onMessageRef = useRef(onMessage);

  // Toujours garder la référence à jour
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    // The `window.electronAPI.onDomainEvent` function is exposed by preload.js
    // It sets up a listener for events from the main process and returns a cleanup function.
    if (window.electronAPI && typeof window.electronAPI.onDomainEvent === 'function') {
      // Utiliser la référence pour toujours avoir le callback le plus récent
      const cleanup = window.electronAPI.onDomainEvent((data) => {
        onMessageRef.current(data);
      });

      return () => {
        cleanup();
      };
    } else {
        console.warn('Electron API for real-time events not found. Running in non-Electron environment?');
        setIsConnected(false);
    }
  }, [event]);

  return { isConnected };
};
