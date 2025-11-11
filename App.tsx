import React, { useState, useEffect } from 'react';
import { useConfigStore } from './stores/configStore';
import { Dashboard } from './components/Dashboard/Dashboard';
import { WhitelistManager } from './components/Lists/WhitelistManager';
import { BlocklistManager } from './components/Lists/BlocklistManager';
import { StatusIndicator } from './components/Dashboard/StatusIndicator';
import { EmergencyButton } from './components/Emergency/EmergencyButton';
import { SettingsPage } from './components/Settings/SettingsPage';
import { LogPage } from './components/Logs/LogPage';

type Tab = 'dashboard' | 'whitelist' | 'blocklist' | 'settings' | 'logs';

const App: React.FC = () => {
  const { isLargeFont, toggleLargeFont } = useConfigStore();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  useEffect(() => {
    // Using a class on the root element is more robust
    document.documentElement.classList.toggle('large-font-active', isLargeFont);
  }, [isLargeFont]);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'whitelist':
        return <WhitelistManager />;
      case 'blocklist':
        return <BlocklistManager />;
      case 'settings':
        return <SettingsPage />;
      case 'logs':
        return <LogPage />;
      default:
        return <div className="bg-white p-6 rounded-lg shadow-sm border border-border-color"><p>Contenu pour "{activeTab}" à implémenter.</p></div>;
    }
  };

  const NavItem: React.FC<{ tabName: Tab; label: string }> = ({ tabName, label }) => (
    <button
      onClick={() => setActiveTab(tabName)}
      className={`px-4 py-2 font-semibold rounded-md transition-colors ${
        activeTab === tabName
          ? 'bg-primary text-white'
          : 'text-text-subtle hover:bg-primary/10 hover:text-primary'
      }`}
      aria-current={activeTab === tabName ? 'page' : undefined}
    >
      {label}
    </button>
  );

  return (
    <>
      <style>{`
        :root { font-size: 16px; }
        .large-font-active { font-size: 24px; }
      `}</style>
      <div className="font-sans antialiased min-h-screen">
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-20">
              <div className="flex items-center space-x-4">
                 <img src="logo.png" alt="CalmWeb Logo" className="h-12" />
              </div>
              <div className="flex items-center space-x-6">
                <StatusIndicator />
                <EmergencyButton />
              </div>
            </div>
             <nav className="flex space-x-4 border-t border-border-color py-2 overflow-x-auto">
                <NavItem tabName="dashboard" label="Tableau de bord" />
                <NavItem tabName="whitelist" label="Liste Blanche" />
                <NavItem tabName="blocklist" label="Liste Noire" />
                <NavItem tabName="settings" label="Configuration" />
                <NavItem tabName="logs" label="Logs" />
             </nav>
          </div>
        </header>

        <main className="container mx-auto p-4 sm:p-6 lg:p-8">
          {renderContent()}
        </main>

        <footer className="fixed bottom-4 right-4">
          <button
            onClick={toggleLargeFont}
            className="h-14 w-14 bg-white border-2 border-primary text-primary rounded-full shadow-lg flex items-center justify-center font-bold text-lg focus:outline-none focus:ring-4 focus:ring-primary/50"
            title={isLargeFont ? "Réduire la police" : "Agrandir la police"}
            aria-pressed={isLargeFont}
          >
            A
          </button>
        </footer>
      </div>
    </>
  );
};

export default App;
