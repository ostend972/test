
import React, { useState, useEffect } from 'react';
import { UpdateInfo } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';

interface UpdateModalProps {
  info: UpdateInfo;
  onClose: () => void;
  onInstall: () => void;
}

type UpdateStatus = 'idle' | 'downloading' | 'ready' | 'installing';

export const UpdateModal: React.FC<UpdateModalProps> = ({ info, onClose, onInstall }) => {
  const { t } = useLanguage();
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [progress, setProgress] = useState(0);

  // Listen to real download progress from Backend
  useEffect(() => {
    // Note: ipcRenderer.on() doesn't return a cleanup function
    // These listeners will persist, which is OK for a modal that appears rarely
    // Listen for download progress
    window.electronAPI.onUpdateDownloadProgress((progressInfo: any) => {
      setProgress(Math.round(progressInfo.percent));
    });

    // Listen for download complete
    window.electronAPI.onUpdateDownloaded(() => {
      setProgress(100);
      setStatus('ready');
    });

    // Listen for errors
    window.electronAPI.onUpdateError((error: string) => {
      console.error('Update error:', error);
      setStatus('idle');
      setProgress(0);
    });
  }, []);

  const handleDownload = async () => {
    setStatus('downloading');
    setProgress(0);

    try {
      // Trigger real download from Backend
      await window.electronAPI.downloadUpdate();
    } catch (error) {
      console.error('Failed to start download:', error);
      setStatus('idle');
      setProgress(0);
    }
  };

  const handleInstall = () => {
    setStatus('installing');
    onInstall();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-md p-8 shadow-2xl border border-border rounded-sm relative transition-colors">
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center mb-4 transition-colors">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </div>
          
          <h2 className="text-2xl font-light text-black mb-2 transition-colors">{t('update_modal.title')}</h2>
          <p className="text-secondary mb-6 transition-colors">{t('update_modal.version_found', { version: info.version })}</p>
          
          {/* Changelog Area - Only hide during download if needed, but keeping it provides context */}
          {status === 'idle' && (
            <div className="w-full bg-subtle p-4 rounded-sm text-left mb-6 max-h-48 overflow-y-auto border border-border transition-colors">
               <h4 className="text-xs font-bold uppercase tracking-wider text-black mb-2 transition-colors">{t('update_modal.changelog')}</h4>
               <pre className="text-xs text-secondary whitespace-pre-wrap font-sans transition-colors">{info.changelog}</pre>
            </div>
          )}

          {/* Progress Bar Section */}
          {(status === 'downloading' || status === 'ready' || status === 'installing') && (
            <div className="w-full mb-8 mt-4">
               <div className="flex justify-between text-xs text-secondary mb-2 uppercase tracking-wider font-medium transition-colors">
                  <span>{status === 'installing' ? t('update_modal.installing') : status === 'ready' ? t('update_modal.ready') : t('update_modal.downloading')}</span>
                  <span>{status === 'ready' ? '100%' : `${progress}%`}</span>
               </div>
               <div className="w-full bg-gray-100 rounded-full h-2 transition-colors">
                  <div 
                    className="bg-black h-2 rounded-full transition-all duration-200 ease-out" 
                    style={{ width: `${progress}%` }}
                  ></div>
               </div>
            </div>
          )}

          <div className="flex gap-3 w-full">
            <button 
              onClick={onClose}
              className="flex-1 py-2.5 px-4 border border-gray-200 text-secondary hover:text-black hover:border-black transition-colors text-sm font-medium rounded-full"
            >
              {t('update_modal.later')}
            </button>
            
            {status === 'idle' && (
               <button 
                 onClick={handleDownload}
                 className="flex-1 py-2.5 px-4 bg-black text-white border border-black hover:bg-gray-800 transition-colors text-sm font-medium rounded-full"
               >
                 {t('update_modal.download')}
               </button>
            )}

            {(status === 'downloading') && (
               <button 
                 disabled
                 className="flex-1 py-2.5 px-4 bg-gray-100 text-gray-400 border border-transparent text-sm font-medium rounded-full cursor-not-allowed transition-colors"
               >
                 {t('update_modal.downloading')}
               </button>
            )}

            {(status === 'ready' || status === 'installing') && (
               <button 
                 onClick={handleInstall}
                 disabled={status === 'installing'}
                 className="flex-1 py-2.5 px-4 bg-black text-white border border-black hover:bg-gray-800 transition-colors text-sm font-medium rounded-full disabled:opacity-70 flex justify-center items-center gap-2"
               >
                 {status === 'installing' && (
                   <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                     <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                     <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                   </svg>
                 )}
                 {status === 'installing' ? t('update_modal.installing') : t('update_modal.install')}
               </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};