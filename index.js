import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.jsx';

const queryClient = new QueryClient();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

// Utiliser createElement au lieu de JSX
root.render(
  React.createElement(React.StrictMode, null,
    React.createElement(QueryClientProvider, { client: queryClient },
      React.createElement(App, null)
    )
  )
);
