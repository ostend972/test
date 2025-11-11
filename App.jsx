import React, { useState, useEffect } from 'react';
import { useConfigStore } from './stores/configStore.js';
import { Dashboard } from './components/Dashboard/Dashboard.jsx';
import { WhitelistManager } from './components/Lists/WhitelistManager.jsx';
import { BlocklistManager } from './components/Lists/BlocklistManager.jsx';
import { StatusIndicator } from './components/Dashboard/StatusIndicator.jsx';
import { EmergencyButton } from './components/Emergency/EmergencyButton.jsx';
import { SettingsPage } from './components/Settings/SettingsPage.jsx';
import { LogPage } from './components/Logs/LogPage.jsx';

const App = () => {
  const { isLargeFont, toggleLargeFont } = useConfigStore();
  const [activeTab, setActiveTab] = useState('dashboard');

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

  const NavItem = ({ tabName, label }) => (
    <button
      onClick={() => setActiveTab(tabName)}
      className={`px-3 sm:px-4 py-2 text-sm sm:text-base font-semibold rounded-md transition-colors whitespace-nowrap ${
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
            <div className="flex justify-between items-center h-16 sm:h-20">
              <div className="flex items-center space-x-2 sm:space-x-4">
                 <img src="logo.png" alt="CalmWeb Logo" className="h-10 sm:h-12" />
              </div>
              <div className="flex items-center space-x-3 sm:space-x-6">
                <StatusIndicator />
                <EmergencyButton />
              </div>
            </div>
             <nav className="flex space-x-2 sm:space-x-4 border-t border-border-color py-2 overflow-x-auto">
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

        <footer className="fixed bottom-2 right-2 sm:bottom-4 sm:right-4">
          <button
            onClick={toggleLargeFont}
            className="h-12 w-12 sm:h-14 sm:w-14 bg-white border-2 border-primary text-primary rounded-full shadow-lg flex items-center justify-center font-bold text-base sm:text-lg focus:outline-none focus:ring-4 focus:ring-primary/50 hover:bg-primary hover:text-white transition-colors"
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
