
import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

interface ConfirmationModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel 
}) => {
  const { t } = useLanguage();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/20 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-md p-8 shadow-2xl border border-border rounded-sm relative transition-colors">
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4 transition-colors">
            <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          
          <h2 className="text-xl font-light text-black mb-2 transition-colors">{title || t('confirmation.title')}</h2>
          <p className="text-secondary mb-8 text-sm leading-relaxed transition-colors">{message}</p>
          
          <div className="flex gap-3 w-full">
            <button 
              onClick={onCancel}
              className="flex-1 py-2.5 px-4 border border-gray-200 text-secondary hover:text-black hover:border-black transition-colors text-sm font-medium rounded-full"
            >
              {t('confirmation.cancel')}
            </button>
            <button 
              onClick={onConfirm}
              className="flex-1 py-2.5 px-4 bg-red-600 text-white border border-red-600 hover:bg-red-700 hover:border-red-700 transition-colors text-sm font-medium rounded-full"
            >
              {t('confirmation.delete')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};