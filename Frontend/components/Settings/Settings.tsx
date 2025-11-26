
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Config } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { Language } from '../../locales/translations';
import { useToast } from '../../contexts/ToastContext';

const Toggle = ({ label, checked, onChange, description }: { label: string, checked: boolean, onChange: (val: boolean) => void, description?: string }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between py-6 border-b border-border last:border-0 transition-colors gap-4 sm:gap-0">
    <div>
      <h3 className="text-sm font-medium text-black">{label}</h3>
      {description && <p className="text-xs text-secondary mt-1 max-w-md">{description}</p>}
    </div>
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
        checked ? 'bg-black' : 'bg-gray-200'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  </div>
);

const Select = ({ label, value, onChange, options }: { label: string, value: string, onChange: (val: string) => void, options: { label: string, value: string }[] }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between py-6 border-b border-border last:border-0 transition-colors gap-4 sm:gap-0">
    <h3 className="text-sm font-medium text-black">{label}</h3>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="form-select block w-full sm:w-48 pl-3 pr-10 py-2 text-sm border-border focus:outline-none focus:ring-black focus:border-black rounded-sm bg-subtle text-black transition-colors"
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

const Input = ({ label, value, onChange, type = "text" }: { label: string, value: string | number, onChange: (val: string) => void, type?: string }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between py-6 border-b border-border last:border-0 transition-colors gap-4 sm:gap-0">
    <h3 className="text-sm font-medium text-black">{label}</h3>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="block w-full sm:w-48 pl-3 pr-3 py-2 text-sm border-b border-border focus:border-black focus:outline-none bg-transparent text-left sm:text-right text-black placeholder-gray-400 transition-colors"
    />
  </div>
);

// Testing Section Component
const TestSection: React.FC = () => {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [testInput, setTestInput] = useState('');
  const [testType, setTestType] = useState<'domain' | 'url' | 'ip' | 'port'>('domain');
  const [testResult, setTestResult] = useState<{ blocked: boolean; reason?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [quickDomain, setQuickDomain] = useState('');

  const handleTest = async () => {
    if (!testInput.trim()) {
      showToast(t('settings.test.error_empty'), 'error');
      return;
    }

    setIsLoading(true);
    setTestResult(null);

    try {
      const result = await window.electronAPI.testBlock(testInput.trim(), testType);
      setTestResult(result);
    } catch (error) {
      showToast(t('toasts.error_generic'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAdd = async (type: 'whitelist' | 'blocklist') => {
    if (!quickDomain.trim()) {
      showToast(t('settings.test.error_empty'), 'error');
      return;
    }

    try {
      const result = type === 'whitelist'
        ? await window.electronAPI.quickAddWhitelist(quickDomain.trim())
        : await window.electronAPI.quickAddBlocklist(quickDomain.trim());

      if (result.success) {
        showToast(t(type === 'whitelist' ? 'settings.test.added_whitelist' : 'settings.test.added_blocklist'));
        setQuickDomain('');
        queryClient.invalidateQueries({ queryKey: ['whitelist'] });
        queryClient.invalidateQueries({ queryKey: ['blocklist'] });
      } else {
        showToast(result.error || t('toasts.error_generic'), 'error');
      }
    } catch (error) {
      showToast(t('toasts.error_generic'), 'error');
    }
  };

  return (
    <section>
      <h2 className="text-xl font-normal mb-6 pb-2 border-b border-black text-black transition-colors">
        {t('settings.test.title')}
      </h2>

      {/* Test Blocking */}
      <div className="bg-subtle border border-border rounded-sm p-6 mb-6">
        <h3 className="text-sm font-medium text-black mb-4">{t('settings.test.check_title')}</h3>
        <p className="text-xs text-secondary mb-4">{t('settings.test.check_desc')}</p>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <select
            value={testType}
            onChange={(e) => setTestType(e.target.value as any)}
            className="form-select px-3 py-2 text-sm border border-border rounded-sm bg-white text-black focus:outline-none focus:border-black"
          >
            <option value="domain">{t('settings.test.type_domain')}</option>
            <option value="url">{t('settings.test.type_url')}</option>
            <option value="ip">{t('settings.test.type_ip')}</option>
            <option value="port">{t('settings.test.type_port')}</option>
          </select>

          <input
            type="text"
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            placeholder={
              testType === 'domain' ? 'example.com' :
              testType === 'url' ? 'https://example.com/path' :
              testType === 'ip' ? '192.168.1.1' :
              '8080'
            }
            className="flex-1 px-3 py-2 text-sm border border-border rounded-sm bg-white text-black focus:outline-none focus:border-black"
            onKeyDown={(e) => e.key === 'Enter' && handleTest()}
          />

          <button
            onClick={handleTest}
            disabled={isLoading}
            className="px-5 py-2 bg-black text-white rounded-full text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {isLoading ? t('settings.test.testing') : t('settings.test.test_btn')}
          </button>
        </div>

        {testResult && (
          <div className={`p-4 rounded-sm border ${testResult.blocked ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
            <div className="flex items-center gap-2">
              {testResult.blocked ? (
                <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <span className={`font-medium ${testResult.blocked ? 'text-red-700' : 'text-green-700'}`}>
                {testResult.blocked ? t('settings.test.result_blocked') : t('settings.test.result_allowed')}
              </span>
            </div>
            <p className={`text-sm mt-1 ${testResult.blocked ? 'text-red-600' : 'text-green-600'}`}>
              {testResult.reason}
            </p>
          </div>
        )}
      </div>

      {/* Quick Add */}
      <div className="bg-subtle border border-border rounded-sm p-6">
        <h3 className="text-sm font-medium text-black mb-4">{t('settings.test.quick_title')}</h3>
        <p className="text-xs text-secondary mb-4">{t('settings.test.quick_desc')}</p>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={quickDomain}
            onChange={(e) => setQuickDomain(e.target.value)}
            placeholder="example.com"
            className="flex-1 px-3 py-2 text-sm border border-border rounded-sm bg-white text-black focus:outline-none focus:border-black"
          />

          <button
            onClick={() => handleQuickAdd('whitelist')}
            className="px-4 py-2 bg-green-600 text-white rounded-full text-sm font-medium hover:bg-green-700 transition-colors"
          >
            + {t('settings.test.add_whitelist')}
          </button>

          <button
            onClick={() => handleQuickAdd('blocklist')}
            className="px-4 py-2 bg-red-600 text-white rounded-full text-sm font-medium hover:bg-red-700 transition-colors"
          >
            + {t('settings.test.add_blocklist')}
          </button>
        </div>
      </div>
    </section>
  );
};

export const Settings: React.FC = () => {
  const queryClient = useQueryClient();
  const { t, setLanguage } = useLanguage();
  const { showToast } = useToast();

  const { data: config, isLoading } = useQuery({
    queryKey: ['config'],
    queryFn: () => window.electronAPI.getConfig(),
  });

  const { data: systemLogs } = useQuery({
    queryKey: ['systemLogs'],
    queryFn: () => window.electronAPI.getSystemLogs(),
    refetchInterval: 3000 // Refresh every 3 seconds
  });

  const { data: integrity } = useQuery({
    queryKey: ['integrity'],
    queryFn: () => window.electronAPI.getSystemIntegrity(),
    refetchInterval: 5000
  });

  const updateConfigMutation = useMutation({
    mutationFn: async (newConfig: Partial<Config>) => {
      await window.electronAPI.updateConfig(newConfig);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      queryClient.invalidateQueries({ queryKey: ['proxyStatus'] });
      queryClient.invalidateQueries({ queryKey: ['systemLogs'] });
      showToast(t('toasts.success_save'));
    },
  });

  const repairMutation = useMutation({
    mutationFn: async () => {
      await window.electronAPI.repairSystemIntegrity();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrity'] });
      queryClient.invalidateQueries({ queryKey: ['systemLogs'] });
      showToast(t('toasts.success_repair'));
    },
    onError: () => showToast(t('toasts.error_generic'), 'error')
  });

  const handleChange = async (key: keyof Config, value: any) => {
    if (key === 'language') {
        setLanguage(value as Language);
    }

    // Apply DNS immediately when changed
    if (key === 'dnsProvider') {
        try {
            const result = await window.electronAPI.applyDNS(value);
            if (result.success) {
                showToast(t('toasts.dns_applied'));
            } else {
                showToast(`DNS Error: ${result.error || 'Unknown error'}`, 'error');
                console.error('[DNS] Failed to apply DNS:', result.error);
                return; // Don't save config if DNS application failed
            }
        } catch (error) {
            showToast(t('toasts.error_generic'), 'error');
            console.error('[DNS] Exception applying DNS:', error);
            return; // Don't save config if DNS application failed
        }
    }

    updateConfigMutation.mutate({ [key]: value });
  };

  const handleExportLog = () => {
      if (!systemLogs) return;
      const logContent = systemLogs.join('\n');
      const blob = new Blob([logContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `calmweb_system_${new Date().toISOString().slice(0,10)}.log`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast(t('toasts.success_export'));
  };

  const StatusRow = ({ label, active }: { label: string, active: boolean }) => (
    <div className="flex justify-between items-center py-3 border-b border-border last:border-0">
        <span className="text-sm text-black">{label}</span>
        <div className="flex items-center gap-2">
            <span className={`text-xs font-medium ${active ? 'text-green-600' : 'text-red-500'}`}>
                {active ? t('settings.status_ok') : t('settings.status_error')}
            </span>
            <div className={`w-2 h-2 rounded-full ${active ? 'bg-green-500' : 'bg-red-500'}`} />
        </div>
    </div>
  );

  if (isLoading || !config) return <div className="flex justify-center p-12 text-secondary font-light">{t('settings.loading')}</div>;

  const allSystemsGo = integrity?.proxyConfigured && integrity?.firewallActive && integrity?.autoStartTaskScheduled;

  return (
    <div className="max-w-3xl mx-auto animate-fade-in pb-12 px-4 sm:px-0">
      <header className="flex flex-col items-center justify-center mb-12 lg:mb-16 text-center">
        <h1 className="text-3xl md:text-5xl font-light tracking-tight text-black mb-4 transition-colors">{t('settings.title')}</h1>
        <p className="text-secondary text-base md:text-lg font-light transition-colors">{t('settings.subtitle')}</p>
      </header>

      <div className="space-y-12">
        {/* General Section */}
        <section>
          <h2 className="text-xl font-normal mb-6 pb-2 border-b border-black text-black transition-colors">{t('settings.general')}</h2>
          <div className="space-y-1">
            <Toggle
              label={t('settings.auto_start')}
              description={t('settings.auto_start_desc')}
              checked={config.autoStart}
              onChange={(val) => handleChange('autoStart', val)}
            />
            <Toggle
              label={t('settings.notifications')}
              description={t('settings.notifications_desc')}
              checked={config.notifications}
              onChange={(val) => handleChange('notifications', val)}
            />
             <Toggle
              label={t('settings.auto_update')}
              description={t('settings.auto_update_desc')}
              checked={config.autoUpdate}
              onChange={(val) => handleChange('autoUpdate', val)}
            />
            <Select
                label={t('settings.language')}
                value={config.language}
                onChange={(val) => handleChange('language', val)}
                options={[
                    { label: 'English', value: 'en' },
                    { label: 'Français', value: 'fr' },
                ]}
            />
          </div>
        </section>

        {/* Network Section */}
        <section>
          <h2 className="text-xl font-normal mb-6 pb-2 border-b border-black text-black transition-colors">{t('settings.network')}</h2>
          <div className="space-y-1">
            <Input
                label={t('settings.proxy_port')}
                value={config.proxyPort}
                onChange={(val) => handleChange('proxyPort', parseInt(val))}
                type="number"
            />
             <Input
                label={t('settings.host_address')}
                value={config.proxyHost}
                onChange={(val) => handleChange('proxyHost', val)}
            />
             <Select
                label={t('settings.dns')}
                value={config.dnsProvider || 'system'}
                onChange={(val) => handleChange('dnsProvider', val)}
                options={[
                    { label: t('settings.options.dns_system'), value: 'system' },
                    { label: t('settings.options.dns_cloudflare'), value: 'cloudflare' },
                    { label: t('settings.options.dns_google'), value: 'google' },
                    { label: t('settings.options.dns_quad9'), value: 'quad9' },
                ]}
            />
          </div>
        </section>

        {/* Security Policies Section */}
        <section>
          <h2 className="text-xl font-normal mb-6 pb-2 border-b border-black text-black transition-colors">{t('settings.security')}</h2>
          <div className="space-y-1">
            <Toggle
              label={t('settings.block_ports')}
              description={t('settings.block_ports_desc')}
              checked={config.blockNonStandardPorts}
              onChange={(val) => handleChange('blockNonStandardPorts', val)}
            />
            <Toggle
              label={t('settings.numeric_ip')}
              description={t('settings.numeric_ip_desc')}
              checked={config.blockNumericIPs}
              onChange={(val) => handleChange('blockNumericIPs', val)}
            />
            <Toggle
              label={t('settings.force_https')}
              description={t('settings.force_https_desc')}
              checked={config.forceHTTPS}
              onChange={(val) => handleChange('forceHTTPS', val)}
            />
          </div>
        </section>

        {/* System Integrity Section (NEW) */}
        <section>
          <h2 className="text-xl font-normal mb-6 pb-2 border-b border-black text-black transition-colors">{t('settings.integrity')}</h2>
          <div className="bg-subtle border border-border rounded-sm p-6">
            <p className="text-xs text-secondary mb-4">{t('settings.integrity_desc')}</p>
            
            <div className="space-y-1 mb-6">
                <StatusRow label={t('settings.check_proxy')} active={!!integrity?.proxyConfigured} />
                <StatusRow label={t('settings.check_firewall')} active={!!integrity?.firewallActive} />
                <StatusRow label={t('settings.check_task')} active={!!integrity?.autoStartTaskScheduled} />
            </div>

            <div className="flex justify-end">
                 <button 
                    onClick={() => repairMutation.mutate()}
                    disabled={repairMutation.isPending || allSystemsGo}
                    className="flex items-center gap-2 px-5 py-2 bg-black text-white rounded-full text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
                >
                    {repairMutation.isPending ? (
                        <>
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            {t('settings.repairing')}
                        </>
                    ) : allSystemsGo ? (
                        <>{t('settings.system_healthy')}</>
                    ) : (
                        <>{t('settings.repair')}</>
                    )}
                </button>
            </div>
          </div>
        </section>

        {/* Testing Section */}
        <TestSection />

        {/* Technical Logs Section */}
        <section>
          <h2 className="text-xl font-normal mb-6 pb-2 border-b border-black text-black transition-colors">{t('settings.tech_logs')}</h2>
          <div className="space-y-1 mb-6">
             <Select
                label={t('settings.verbosity')}
                value={config.logLevel}
                onChange={(val) => handleChange('logLevel', val)}
                options={[
                    { label: t('settings.options.error'), value: 'ERROR' },
                    { label: t('settings.options.warn'), value: 'WARN' },
                    { label: t('settings.options.info'), value: 'INFO' },
                    { label: t('settings.options.debug'), value: 'DEBUG' },
                ]}
            />
          </div>
          
          <div className="bg-subtle border border-border rounded-sm p-4 font-mono text-xs text-secondary overflow-x-auto transition-colors h-64 overflow-y-auto">
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-border sticky top-0 bg-subtle">
                <span className="font-medium text-black">{t('settings.system_events')}</span>
                <button 
                    onClick={handleExportLog}
                    className="hover:text-black underline transition-colors"
                >
                    {t('settings.export_log')}
                </button>
            </div>
            <div className="space-y-1">
                {systemLogs?.map((log, idx) => (
                    <div key={idx} className="whitespace-nowrap">{log}</div>
                ))}
                <div className="animate-pulse">_</div>
            </div>
          </div>
        </section>

        <div className="pt-8 text-center">
            <p className="text-xs text-secondary">CalmWeb v2.0.0</p>
            <p className="text-xs text-secondary mt-1">{t('settings.footer')}</p>
        </div>
      </div>
    </div>
  );
};
