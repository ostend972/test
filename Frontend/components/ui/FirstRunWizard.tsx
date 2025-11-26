
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Config } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { Language } from '../../locales/translations';

interface FirstRunWizardProps {
  onComplete: () => void;
}

export const FirstRunWizard: React.FC<FirstRunWizardProps> = ({ onComplete }) => {
  const { t, setLanguage, language } = useLanguage();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<Partial<Config>>({});

  // Load initial config
  useEffect(() => {
    window.electronAPI.getConfig().then(cfg => setConfig(cfg));
  }, []);

  // Integrity Check Hooks
  const { data: integrity, refetch: refetchIntegrity } = useQuery({
    queryKey: ['integrity'],
    queryFn: () => window.electronAPI.getSystemIntegrity(),
    enabled: step === 4, // Only run on final step
  });

  const updateConfigMutation = useMutation({
    mutationFn: async (newConfig: Partial<Config>) => {
      await window.electronAPI.updateConfig(newConfig);
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['config'] });
    }
  });

  const repairMutation = useMutation({
    mutationFn: async () => {
      await window.electronAPI.repairSystemIntegrity();
    },
    onSuccess: () => {
      refetchIntegrity();
    },
  });

  const handleConfigChange = (key: keyof Config, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    if (key === 'language') {
        setLanguage(value as Language);
    }
    // Save immediately to backend
    updateConfigMutation.mutate({ [key]: value });
  };

  const handleNext = () => {
    setStep(s => s + 1);
  };

  const handleFinish = async () => {
    // Mark as not first run anymore
    await window.electronAPI.updateConfig({ isFirstRun: false });
    onComplete();
  };

  const steps = [
    // Step 0: Language
    {
      title: t('wizard.step_language'),
      desc: t('wizard.step_language_desc'),
      render: () => (
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => handleConfigChange('language', 'fr')}
            className={`p-6 rounded-sm border-2 transition-all flex flex-col items-center gap-3 text-black ${
              config.language === 'fr' 
                ? 'border-black bg-gray-50' 
                : 'border-gray-200 hover:border-gray-400'
            }`}
          >
            <span className="text-4xl">🇫🇷</span>
            <span className="font-medium">Français</span>
          </button>
          <button
            onClick={() => handleConfigChange('language', 'en')}
            className={`p-6 rounded-sm border-2 transition-all flex flex-col items-center gap-3 text-black ${
              config.language === 'en' 
                ? 'border-black bg-gray-50' 
                : 'border-gray-200 hover:border-gray-400'
            }`}
          >
            <span className="text-4xl">🇺🇸</span>
            <span className="font-medium">English</span>
          </button>
        </div>
      )
    },
    // Step 1: Notifications
    {
        title: t('wizard.step_notifications'),
        desc: t('wizard.step_notifications_desc'),
        render: () => (
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-sm">
                <span className="text-sm font-medium text-black">{t('wizard.enable_notifications')}</span>
                <button
                    onClick={() => handleConfigChange('notifications', !config.notifications)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                        config.notifications ? 'bg-black' : 'bg-gray-200'
                    }`}
                >
                    <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        config.notifications ? 'translate-x-6' : 'translate-x-1'
                        }`}
                    />
                </button>
            </div>
        )
    },
    // Step 2: DNS
    {
        title: t('wizard.step_dns'),
        desc: t('wizard.step_dns_desc'),
        render: () => (
            <div className="space-y-3">
                {[
                    { value: 'system', label: t('settings.options.dns_system') },
                    { value: 'cloudflare', label: t('settings.options.dns_cloudflare') },
                    { value: 'google', label: t('settings.options.dns_google') },
                    { value: 'quad9', label: t('settings.options.dns_quad9') },
                ].map(opt => (
                    <button
                        key={opt.value}
                        onClick={() => handleConfigChange('dnsProvider', opt.value)}
                        className={`w-full p-4 text-left border rounded-sm transition-all ${
                            config.dnsProvider === opt.value 
                                ? 'border-black bg-black text-white' 
                                : 'border-gray-200 hover:bg-gray-50 text-black'
                        }`}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>
        )
    },
    // Step 3: Security Policies
    {
        title: t('wizard.step_security'),
        desc: t('wizard.step_security_desc'),
        render: () => (
            <div className="space-y-4">
                {[
                    { key: 'blockNonStandardPorts', label: t('settings.block_ports'), desc: t('settings.block_ports_desc') },
                    { key: 'blockNumericIPs', label: t('settings.numeric_ip'), desc: t('settings.numeric_ip_desc') },
                    { key: 'forceHTTPS', label: t('settings.force_https'), desc: t('settings.force_https_desc') },
                ].map(item => (
                    <div key={item.key} className="flex items-start justify-between p-3 border border-gray-100 rounded-sm">
                        <div className="pr-4">
                            <h4 className="text-sm font-medium text-black">{item.label}</h4>
                            <p className="text-xs text-secondary mt-1">{item.desc}</p>
                        </div>
                        <button
                            onClick={() => handleConfigChange(item.key as keyof Config, !config[item.key as keyof Config])}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ${
                                config[item.key as keyof Config] ? 'bg-black' : 'bg-gray-200'
                            }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                config[item.key as keyof Config] ? 'translate-x-6' : 'translate-x-1'
                                }`}
                            />
                        </button>
                    </div>
                ))}
            </div>
        )
    },
    // Step 4: System Integrity
    {
        title: t('wizard.step_integrity'),
        desc: t('wizard.step_integrity_desc'),
        render: () => {
            if (!integrity) return <div className="text-center py-8"><div className="animate-spin w-8 h-8 border-2 border-black border-t-transparent rounded-full mx-auto"></div></div>;
            
            const allGood = integrity.proxyConfigured && integrity.firewallActive && integrity.autoStartTaskScheduled;

            return (
                <div className="space-y-4">
                    <div className="bg-gray-50 p-4 rounded-sm border border-gray-200">
                        <h4 className="font-medium mb-4 text-black">{t('wizard.integrity_check_title')}</h4>
                        <div className="space-y-2 text-sm text-black">
                            <div className="flex justify-between">
                                <span>{t('settings.check_proxy')}</span>
                                <span className={integrity.proxyConfigured ? 'text-green-600' : 'text-red-500'}>
                                    {integrity.proxyConfigured ? t('settings.status_ok') : t('settings.status_error')}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span>{t('settings.check_firewall')}</span>
                                <span className={integrity.firewallActive ? 'text-green-600' : 'text-red-500'}>
                                    {integrity.firewallActive ? t('settings.status_ok') : t('settings.status_error')}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span>{t('settings.check_task')}</span>
                                <span className={integrity.autoStartTaskScheduled ? 'text-green-600' : 'text-red-500'}>
                                    {integrity.autoStartTaskScheduled ? t('settings.status_ok') : t('settings.status_error')}
                                </span>
                            </div>
                        </div>
                    </div>

                    {allGood ? (
                        <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-sm">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-sm font-medium">{t('wizard.integrity_success')}</span>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-sm">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <span className="text-sm font-medium">{t('wizard.integrity_issues')}</span>
                            </div>
                            <button 
                                onClick={() => repairMutation.mutate()}
                                disabled={repairMutation.isPending}
                                className="w-full py-2 bg-black text-white rounded-full text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
                            >
                                {repairMutation.isPending ? t('wizard.repairing') : t('wizard.repair')}
                            </button>
                        </div>
                    )}
                </div>
            );
        }
    }
  ];

  const currentStep = steps[step];
  const isLastStep = step === steps.length - 1;
  // Block finish if on last step and integrity not checked or failing (optional policy, here we allow user to skip if they really want but visual cue is strong)
  const canProceed = true; 

  return (
    <div className="fixed inset-0 z-[200] bg-white text-black flex flex-col animate-fade-in">
        {/* Progress Bar */}
        <div className="w-full bg-gray-100 h-1">
            <div 
                className="bg-black h-full transition-all duration-500 ease-out" 
                style={{ width: `${((step + 1) / steps.length) * 100}%` }}
            />
        </div>

        <div className="flex-1 flex flex-col justify-center items-center p-6">
            <div className="w-full max-w-md">
                <div className="mb-8 text-center">
                    <span className="text-xs font-bold text-secondary tracking-widest uppercase mb-2 block">
                        Step {step + 1} of {steps.length}
                    </span>
                    <h1 className="text-3xl font-light text-black mb-2">{currentStep.title}</h1>
                    <p className="text-secondary">{currentStep.desc}</p>
                </div>

                <div className="mb-12">
                    {currentStep.render()}
                </div>

                <div className="flex justify-end">
                    {isLastStep ? (
                        <button
                            onClick={handleFinish}
                            disabled={!canProceed}
                            className="px-8 py-3 bg-black text-white rounded-full text-sm font-medium hover:bg-gray-900 transition-colors shadow-lg hover:shadow-xl"
                        >
                            {t('wizard.finish')}
                        </button>
                    ) : (
                        <button
                            onClick={handleNext}
                            className="px-8 py-3 bg-black text-white rounded-full text-sm font-medium hover:bg-gray-900 transition-colors shadow-lg hover:shadow-xl flex items-center gap-2"
                        >
                            {t('wizard.next')}
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};
