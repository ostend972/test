
import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../../contexts/LanguageContext';

export const Rulesets: React.FC = () => {
  const queryClient = useQueryClient();
  const { t, locale } = useLanguage();

  const { data: blockSources, isLoading: blocksLoading } = useQuery({
    queryKey: ['blocklistSources'],
    queryFn: () => window.electronAPI.getBlocklistSources(),
  });

  const { data: whiteSources, isLoading: whitesLoading } = useQuery({
    queryKey: ['whitelistSources'],
    queryFn: () => window.electronAPI.getWhitelistSources(),
  });

  const toggleBlockMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      await window.electronAPI.toggleBlocklistSource(id, enabled);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocklistSources'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const toggleWhiteMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      await window.electronAPI.toggleWhitelistSource(id, enabled);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whitelistSources'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      await window.electronAPI.updateBlocklists(); // Assume this updates all
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocklistSources'] });
      queryClient.invalidateQueries({ queryKey: ['whitelistSources'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  if (blocksLoading || whitesLoading) return <div className="flex justify-center p-12 text-secondary font-light">{t('rulesets.loading')}</div>;

  const totalEnabled = (blockSources?.filter(s => s.enabled).length || 0) + (whiteSources?.filter(s => s.enabled).length || 0);
  const totalRules = (blockSources?.filter(s => s.enabled).reduce((acc, curr) => acc + curr.domainCount, 0) || 0) +
                     (whiteSources?.filter(s => s.enabled).reduce((acc, curr) => acc + curr.domainCount, 0) || 0);

  const Table = ({ sources, onToggle }: { sources: any[], onToggle: any }) => (
    <div className="w-full overflow-x-auto border border-border rounded-sm bg-white mb-12 transition-colors">
        <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
                <tr className="border-b border-border bg-subtle transition-colors">
                    <th className="p-4 text-xs font-medium text-secondary uppercase tracking-wider w-16 text-center">{t('rulesets.table.state')}</th>
                    <th className="p-4 text-xs font-medium text-secondary uppercase tracking-wider">{t('rulesets.table.source')}</th>
                    <th className="p-4 text-xs font-medium text-secondary uppercase tracking-wider">{t('rulesets.table.category')}</th>
                    <th className="p-4 text-xs font-medium text-secondary uppercase tracking-wider text-right">{t('rulesets.table.rule_count')}</th>
                    <th className="p-4 text-xs font-medium text-secondary uppercase tracking-wider text-right">{t('rulesets.table.last_update')}</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-border">
                {sources?.map((source) => (
                    <tr key={source.id} className={`transition-colors hover:bg-gray-50 ${!source.enabled ? 'opacity-60 bg-gray-50' : 'bg-white'}`}>
                        <td className="p-4 text-center">
                            <button 
                                onClick={() => onToggle({ id: source.id, enabled: !source.enabled })}
                                className={`w-5 h-5 rounded-full border transition-colors relative flex items-center justify-center ${
                                    source.enabled 
                                        ? 'bg-black border-black' 
                                        : 'bg-white border-gray-300 hover:border-black'
                                }`}
                                aria-label={source.enabled ? "Disable" : "Enable"}
                            >
                                {source.enabled && (
                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                            </button>
                        </td>
                        <td className="p-4">
                            <p className="text-sm font-medium text-black">{source.name}</p>
                            <p className="text-xs text-secondary truncate max-w-xs font-mono mt-0.5 opacity-70">{source.url}</p>
                        </td>
                        <td className="p-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                {source.category}
                            </span>
                        </td>
                        <td className="p-4 text-sm text-right font-mono text-secondary">
                            {source.domainCount.toLocaleString(locale)}
                        </td>
                        <td className="p-4 text-sm text-right text-secondary whitespace-nowrap">
                            {new Date(source.lastUpdate).toLocaleDateString(locale)} 
                            <span className="text-xs ml-1 opacity-50">{new Date(source.lastUpdate).toLocaleTimeString(locale, {hour:'2-digit', minute:'2-digit'})}</span>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto animate-fade-in pb-12 w-full">
      <header className="flex flex-col items-center justify-center mb-12 lg:mb-16 text-center px-4">
        <h1 className="text-3xl md:text-5xl font-light tracking-tight text-black mb-4 transition-colors">{t('rulesets.title')}</h1>
        <p className="text-secondary text-base md:text-lg font-light transition-colors">{t('rulesets.subtitle')}</p>
      </header>

      {/* Summary & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center mb-8 pb-6 border-b border-border gap-4 transition-colors">
        <div>
            <h2 className="text-xl font-normal text-black transition-colors">{t('rulesets.title')}</h2>
            <p className="text-sm text-secondary mt-1 transition-colors">
                {t('rulesets.summary', { enabled: totalEnabled, count: totalRules.toLocaleString(locale) })}
            </p>
        </div>
        <button 
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
            className="flex items-center gap-2 px-5 py-2 border border-black rounded-full text-sm font-medium text-black hover:bg-black hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto justify-center"
        >
            {updateMutation.isPending ? (
                <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('rulesets.updating')}
                </>
            ) : (
                <>{t('rulesets.update_all')}</>
            )}
        </button>
      </div>

      <h3 className="text-lg font-medium mb-4 text-black transition-colors">{t('rulesets.blocklists_title')}</h3>
      <Table sources={blockSources || []} onToggle={toggleBlockMutation.mutate} />

      <h3 className="text-lg font-medium mb-4 text-black transition-colors">{t('rulesets.whitelists_title')}</h3>
      <Table sources={whiteSources || []} onToggle={toggleWhiteMutation.mutate} />
      
      <div className="mt-8 p-6 bg-subtle rounded-sm border border-border transition-colors">
        <h3 className="text-sm font-medium text-black mb-2 transition-colors">{t('rulesets.about_title')}</h3>
        <p className="text-sm text-secondary leading-relaxed transition-colors">
            {t('rulesets.about_desc')}
        </p>
      </div>
    </div>
  );
};
