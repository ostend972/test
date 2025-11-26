import React, { useEffect, useState } from 'react';
import { useLanguage, Link, useLocation } from '../../contexts/LanguageContext';
import { UpdateInfo } from '../../types';
import { UpdateModal } from './UpdateModal';
import { useQuery } from '@tanstack/react-query';

const NavItem = ({ to, label, active, onClick }: { to: string; label: string; active: boolean; onClick?: () => void }) => (
  <Link
    to={to}
    onClick={onClick}
    className={`flex items-center px-6 py-3 mb-1 transition-all duration-300 text-sm tracking-wide ${
      active
        ? 'text-black font-medium border-l-2 border-black pl-[22px]'
        : 'text-secondary hover:text-black'
    }`}
  >
    {label}
  </Link>
);

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const { t } = useLanguage();
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [appVersion, setAppVersion] = useState('v2.0.0');
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Fetch Proxy Status for Sidebar Indicator
  const { data: proxyStatus } = useQuery({
    queryKey: ['proxyStatus'],
    queryFn: () => window.electronAPI.getProxyStatus(),
    refetchInterval: 2000,
  });

  useEffect(() => {
    const checkUpdates = async () => {
        try {
            const info = await window.electronAPI.checkForUpdates();
            setAppVersion(`v${info.currentVersion || '1.0.0'}`);

            if (info.available) {
                const config = await window.electronAPI.getConfig();
                if (config.autoUpdate) {
                    console.log('Auto-updating silently...');
                    // Auto-download in background
                    await window.electronAPI.downloadUpdate();
                    // The 'update-downloaded' event will trigger installation
                } else {
                    setUpdateInfo(info);
                    setShowUpdateModal(true);
                }
            }
        } catch (error) {
            console.error("Failed to check for updates:", error);
        }
    };

    checkUpdates();

    // Listen for update-downloaded event (for auto-update mode)
    window.electronAPI.onUpdateDownloaded(async (downloadInfo: any) => {
      const config = await window.electronAPI.getConfig();
      if (config.autoUpdate) {
        // Auto-install when download completes
        await window.electronAPI.installUpdate();
      }
    });
  }, []);

  const handleInstallUpdate = async () => {
    if (updateInfo) {
        await window.electronAPI.installUpdate();
        setShowUpdateModal(false);
    }
  };

  // Close sidebar when route changes on mobile
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location]);

  const isActive = proxyStatus?.status === 'active';

  return (
    <>
      {/* Mobile Hamburger Button */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-border z-40 flex items-center px-4 justify-between">
        <div className="text-xl font-bold tracking-tight text-black">CalmWeb<span className="text-blue-600">.</span></div>
        <button 
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="p-2 text-black hover:bg-gray-100 rounded-md"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {isMobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        w-[240px] h-screen fixed left-0 top-0 flex flex-col bg-white border-r border-transparent z-50 transition-transform duration-300 ease-in-out
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} 
        lg:translate-x-0 lg:border-r-0 lg:shadow-none shadow-2xl
      `}>
        <div className="p-8 mb-2 hidden lg:block">
          <div className="text-2xl font-bold tracking-tight text-black">CalmWeb<span className="text-blue-600">.</span></div>
        </div>
        
        {/* Spacing for mobile header */}
        <div className="h-20 lg:hidden"></div>

        <div className="flex-1 overflow-y-auto">
          <nav className="space-y-1">
            <NavItem to="/" label={t('sidebar.dashboard')} active={location.pathname === '/'} onClick={() => setIsMobileOpen(false)} />
            <NavItem to="/stats" label={t('sidebar.analytics')} active={location.pathname === '/stats'} onClick={() => setIsMobileOpen(false)} />
            <NavItem to="/logs" label={t('sidebar.logs')} active={location.pathname === '/logs'} onClick={() => setIsMobileOpen(false)} />
            <NavItem to="/lists" label={t('sidebar.rulesets')} active={location.pathname === '/lists'} onClick={() => setIsMobileOpen(false)} />
            <NavItem to="/blocklist" label={t('sidebar.blocklist')} active={location.pathname === '/blocklist'} onClick={() => setIsMobileOpen(false)} />
            <NavItem to="/whitelist" label={t('sidebar.whitelist')} active={location.pathname === '/whitelist'} onClick={() => setIsMobileOpen(false)} />
            <NavItem to="/settings" label={t('sidebar.settings')} active={location.pathname === '/settings'} onClick={() => setIsMobileOpen(false)} />
          </nav>
        </div>

        <div className="p-8">
          {/* Minimized Update Notification */}
          {updateInfo && !showUpdateModal && (
            <button 
              onClick={() => setShowUpdateModal(true)}
              className="flex items-center gap-2 w-full mb-4 px-3 py-2 bg-black text-white rounded-sm text-xs font-medium hover:bg-gray-800 transition-colors animate-fade-in"
            >
               <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
               </svg>
               {t('sidebar.update_available')} ({updateInfo.version})
            </button>
          )}
          
          <Link 
            to="/documentation" 
            className={`flex items-center gap-2 mb-4 text-xs text-secondary hover:text-black transition-colors ${location.pathname === '/documentation' ? 'text-black font-medium' : ''}`}
            onClick={() => setIsMobileOpen(false)}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            {t('sidebar.documentation')}
          </Link>

          <div className="flex items-center gap-3 mb-4">
            <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className={`text-xs font-medium uppercase tracking-wider ${isActive ? 'text-secondary' : 'text-red-500'}`}>
                {isActive ? t('sidebar.protected') : t('sidebar.paused')}
            </span>
          </div>
          <div className="text-[10px] text-gray-400 font-mono">
             {t('sidebar.version')} {appVersion}
          </div>
        </div>
      </aside>

      {showUpdateModal && updateInfo && (
        <UpdateModal 
            info={updateInfo} 
            onClose={() => setShowUpdateModal(false)} 
            onInstall={handleInstallUpdate}
        />
      )}
    </>
  );
};