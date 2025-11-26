import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from './components/ui/Sidebar';
import { NewDashboard } from './components/Dashboard/NewDashboard';
import { Analytics } from './components/Analytics/Analytics';
import { ActivityLog } from './components/Logs/ActivityLog';
import { Rulesets } from './components/Lists/Rulesets';
import { Whitelist } from './components/Lists/Whitelist';
import { Blocklist } from './components/Lists/Blocklist';
import { Settings } from './components/Settings/Settings';
import { Documentation } from './components/Documentation/Documentation';
import { FirstRunWizard } from './components/ui/FirstRunWizard';
import { LanguageProvider, HashRouter, Routes, Route, Navigate } from './contexts/LanguageContext';
import { ToastProvider } from './contexts/ToastContext';
import { ErrorBoundary } from './components/ui/ErrorBoundary';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="flex min-h-screen bg-white text-black">
      <Sidebar />
      <main className="flex-1 w-full lg:ml-[240px] relative transition-all duration-300">
        <div className="min-h-screen bg-white p-4 pt-24 lg:pt-12 lg:p-12">
          {children}
        </div>
      </main>
    </div>
  );
};

const AppContent: React.FC = () => {
    const { data: config, refetch } = useQuery({
        queryKey: ['config'],
        queryFn: async () => {
            console.log('[Frontend] Fetching config from backend...');
            try {
                const result = await window.electronAPI.getConfig();
                console.log('[Frontend] ✓ Config fetched successfully');
                return result;
            } catch (error: any) {
                console.error('[Frontend] ✗ Failed to fetch config:', error.message);
                throw error;
            }
        },
    });

    if (config?.isFirstRun) {
        return <FirstRunWizard onComplete={() => refetch()} />;
    }

    return (
        <Layout>
            <Routes>
                <Route path="/" element={<NewDashboard />} />
                <Route path="/stats" element={<Analytics />} />
                <Route path="/logs" element={<ActivityLog />} />
                <Route path="/lists" element={<Rulesets />} />
                <Route path="/whitelist" element={<Whitelist />} />
                <Route path="/blocklist" element={<Blocklist />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/documentation" element={<Documentation />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Layout>
    );
};

const App: React.FC = () => {
  useEffect(() => {
    console.log('[Frontend] CalmWeb Frontend starting...');
    console.log('[Frontend] React version:', React.version);
    console.log('[Frontend] Environment:', import.meta.env.MODE);

    // Global error handler for unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('========================================');
      console.error('[Frontend] ✗ UNHANDLED PROMISE REJECTION');
      console.error('[Frontend] Reason:', event.reason);
      console.error('[Frontend] Promise:', event.promise);
      console.error('========================================');
    };

    // Global error handler for uncaught errors
    const handleError = (event: ErrorEvent) => {
      console.error('========================================');
      console.error('[Frontend] ✗ UNCAUGHT ERROR');
      console.error('[Frontend] Message:', event.message);
      console.error('[Frontend] Source:', event.filename);
      console.error('[Frontend] Line:', event.lineno, 'Column:', event.colno);
      console.error('[Frontend] Error:', event.error);
      console.error('========================================');
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    console.log('[Frontend] Global error handlers installed');

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  return (
    <ErrorBoundary>
      <HashRouter>
        <LanguageProvider>
          <ToastProvider>
              <AppContent />
          </ToastProvider>
        </LanguageProvider>
      </HashRouter>
    </ErrorBoundary>
  );
};

export default App;