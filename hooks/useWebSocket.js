import { useEffect, useState } from 'react';

// This hook now uses Electron's IPC to receive real-time events from the main process.
export const useWebSocket = (event, onMessage) => {
  // In an Electron context, IPC is always available, so we can consider it "connected".
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    // Map event names to the appropriate Electron API handlers
    let cleanup;

    if (window.electronAPI) {
      switch (event) {
        case 'domain_event':
          if (typeof window.electronAPI.onDomainEvent === 'function') {
            cleanup = window.electronAPI.onDomainEvent(onMessage);
          }
          break;

        case 'stats_update':
        case 'stats_updated':
          if (typeof window.electronAPI.onStatsUpdated === 'function') {
            cleanup = window.electronAPI.onStatsUpdated(onMessage);
          }
          break;

        case 'new_log':
          if (typeof window.electronAPI.onNewLog === 'function') {
            cleanup = window.electronAPI.onNewLog(onMessage);
          }
          break;

        default:
          setIsConnected(false);
          break;
      }

      if (cleanup) {
        return cleanup;
      }
    } else {
      setIsConnected(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]); // React when event type changes

  return { isConnected };
};
