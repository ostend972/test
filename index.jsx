import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.jsx';
import { ToastProvider } from './components/ui/Toast';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Configuration de retry avec backoff exponentiel
      retry: (failureCount, error) => {
        // Ne pas retrier sur les erreurs 4xx (erreurs client)
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        // Maximum 3 tentatives pour les autres erreurs
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      // Configuration des temps de cache
      staleTime: 5000, // Les données restent fraîches pendant 5 secondes
      gcTime: 10 * 60 * 1000, // Cache gardé 10 minutes après inutilisation

      // Comportement de refetch
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      refetchOnReconnect: true,

      // Désactiver les refetch automatiques en arrière-plan
      refetchInterval: false,
    },
    mutations: {
      // Retry pour les mutations (plus conservateur)
      retry: 1,
      retryDelay: 1000,
    },
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <App />
      </ToastProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
