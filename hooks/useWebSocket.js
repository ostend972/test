import { useEffect, useState } from 'react';

// This hook now uses Electron's IPC to receive real-time events from the main process.
export const useWebSocket = (event, onMessage) => {
  // In an Electron context, IPC is always available, so we can consider it "connected".
  const [isConnected, setIsConnected] = useState(true);
  
  useEffect(() => {
    // The `window.electronAPI.onDomainEvent` function is exposed by preload.js
    // It sets up a listener for events from the main process and returns a cleanup function.
    if (window.electronAPI && typeof window.electronAPI.onDomainEvent === 'function') {
      const cleanup = window.electronAPI.onDomainEvent(onMessage);
      
      return () => {
        cleanup();
      };
    } else {
        console.warn('Electron API for real-time events not found. Running in non-Electron environment?');
        setIsConnected(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // onMessage is excluded to prevent re-subscribing on every render

  return { isConnected };
};
