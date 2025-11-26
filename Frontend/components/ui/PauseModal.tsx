
import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

interface PauseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPause: (duration: number) => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({ isOpen, onClose, onPause }) => {
  const { t } = useLanguage();

  if (!isOpen) return null;

  const options = [
      { label: t('pause_modal.min_5'), value: 5 * 60 * 1000 },
      { label: t('pause_modal.min_30'), value: 30 * 60 * 1000 },
      { label: t('pause_modal.hour_1'), value: 60 * 60 * 1000 },
      { label: t('pause_modal.until_resume'), value: 0 },
  ];

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/20 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-md p-8 shadow-2xl border border-border rounded-sm relative transition-colors">
        <h2 className="text-xl font-light text-black mb-2 text-center">{t('pause_modal.title')}</h2>
        <p className="text-secondary mb-6 text-sm text-center">{t('pause_modal.desc')}</p>
        
        <div className="flex flex-col gap-3 mb-6">
            {options.map(opt => (
                <button
                    key={opt.value}
                    onClick={() => onPause(opt.value)}
                    className="w-full py-3 px-4 border border-gray-200 hover:border-black hover:bg-gray-50 text-black transition-all rounded-sm text-sm font-medium"
                >
                    {opt.label}
                </button>
            ))}
        </div>

        <button 
            onClick={onClose}
            className="w-full py-2 text-secondary hover:text-black transition-colors text-sm"
        >
            {t('pause_modal.cancel')}
        </button>
      </div>
    </div>
  );
};
