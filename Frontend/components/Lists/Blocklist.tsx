
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../../contexts/LanguageContext';
import { ConfirmationModal } from '../ui/ConfirmationModal';
import { useToast } from '../../contexts/ToastContext';

export const Blocklist: React.FC = () => {
  const [newDomain, setNewDomain] = useState('');
  const [isError, setIsError] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { t, locale } = useLanguage();
  const { showToast } = useToast();

  const { data: blocklist, isLoading } = useQuery({
    queryKey: ['blocklist'],
    queryFn: () => window.electronAPI.getBlocklist(),
  });

  const addMutation = useMutation({
    mutationFn: async (domain: string) => {
      await window.electronAPI.addToBlocklist(domain);
    },
    onSuccess: () => {
      setNewDomain('');
      queryClient.invalidateQueries({ queryKey: ['blocklist'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      showToast(t('toasts.success_add'));
    },
    onError: () => showToast(t('toasts.error_generic'), 'error')
  });

  const removeMutation = useMutation({
    mutationFn: async (domain: string) => {
      await window.electronAPI.removeFromBlocklist(domain);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocklist'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      setItemToDelete(null);
      showToast(t('toasts.success_remove'));
    },
    onError: () => showToast(t('toasts.error_generic'), 'error')
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim()) {
        setIsError(true);
        return;
    }
    // Basic domain validation regex
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/;
    if(!domainRegex.test(newDomain)) {
        setIsError(true);
        return;
    }

    setIsError(false);
    addMutation.mutate(newDomain.trim());
  };

  return (
    <div className="max-w-6xl mx-auto animate-fade-in pb-12 w-full">
      <header className="flex flex-col items-center justify-center mb-12 lg:mb-16 text-center px-4">
        <h1 className="text-3xl md:text-5xl font-light tracking-tight text-black mb-4 transition-colors">{t('blocklist.title')}</h1>
        <p className="text-secondary text-base md:text-lg font-light transition-colors">{t('blocklist.subtitle')}</p>
      </header>

      {/* Add Domain Form */}
      <div className="max-w-2xl mx-auto mb-16 px-4">
        <form onSubmit={handleSubmit} className="relative">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center border-b border-black py-2 transition-colors gap-2 sm:gap-0">
                <input 
                    type="text" 
                    value={newDomain}
                    onChange={(e) => {
                        setNewDomain(e.target.value);
                        setIsError(false);
                    }}
                    placeholder={t('blocklist.placeholder')}
                    className="appearance-none bg-transparent border-none w-full text-black mr-3 py-1 px-2 leading-tight focus:outline-none font-light text-xl placeholder-gray-300 transition-colors text-center sm:text-left"
                />
                <button 
                    type="submit"
                    disabled={addMutation.isPending}
                    className="flex-shrink-0 bg-black hover:bg-gray-800 border-black hover:border-gray-800 text-sm border-4 text-white py-2 sm:py-1 px-6 rounded-full transition-all disabled:opacity-50 mt-2 sm:mt-0"
                >
                    {addMutation.isPending ? t('blocklist.adding') : t('blocklist.add')}
                </button>
            </div>
            {isError && <p className="absolute top-full mt-2 text-red-500 text-xs text-center sm:text-left w-full">{t('blocklist.error_domain')}</p>}
        </form>
      </div>

      {/* Blocklist Table */}
      <div className="w-full overflow-x-auto border border-border rounded-sm bg-white transition-colors">
        <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
                <tr className="border-b border-border bg-subtle transition-colors">
                    <th className="p-4 text-xs font-medium text-secondary uppercase tracking-wider">{t('blocklist.table.domain')}</th>
                    <th className="p-4 text-xs font-medium text-secondary uppercase tracking-wider">{t('blocklist.table.source')}</th>
                    <th className="p-4 text-xs font-medium text-secondary uppercase tracking-wider text-right">{t('blocklist.table.date_added')}</th>
                    <th className="p-4 text-xs font-medium text-secondary uppercase tracking-wider text-right w-24">{t('blocklist.table.action')}</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-border">
                {isLoading ? (
                    <tr><td colSpan={4} className="p-8 text-center text-secondary">{t('blocklist.loading')}</td></tr>
                ) : blocklist?.length === 0 ? (
                    <tr><td colSpan={4} className="p-8 text-center text-secondary">{t('blocklist.empty')}</td></tr>
                ) : (
                    blocklist?.map((entry) => (
                        <tr key={entry.id} className="hover:bg-gray-50 transition-colors group bg-white">
                            <td className="p-4 text-sm font-medium text-black">{entry.domain}</td>
                            <td className="p-4">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                    entry.source === 'system' ? 'bg-gray-100 text-gray-600' : 'bg-black text-white'
                                }`}>
                                    {entry.source}
                                </span>
                            </td>
                            <td className="p-4 text-sm text-right text-secondary font-mono text-xs">
                                {new Date(entry.created_at).toLocaleDateString(locale)}
                            </td>
                            <td className="p-4 text-right">
                                {entry.source === 'user' && (
                                    <button 
                                        onClick={() => setItemToDelete(entry.domain)}
                                        className="text-gray-400 hover:text-red-600 transition-colors p-1"
                                        title="Remove"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                )}
                                {entry.source === 'system' && (
                                    <span className="text-xs text-gray-300 italic">{t('blocklist.locked')}</span>
                                )}
                            </td>
                        </tr>
                    ))
                )}
            </tbody>
        </table>
      </div>

      <ConfirmationModal
        isOpen={!!itemToDelete}
        message={t('confirmation.delete_domain', { domain: itemToDelete || '' })}
        onConfirm={() => itemToDelete && removeMutation.mutate(itemToDelete)}
        onCancel={() => setItemToDelete(null)}
      />
    </div>
  );
};
