
import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { translations } from '../../locales/translations';

// Helper to access nested keys safely
const getDetails = (t: any, sectionKey: string, language: 'en' | 'fr') => {
    const details = translations[language].documentation.details as any;
    return details[sectionKey] || [];
};

export const Documentation: React.FC = () => {
  const { t, language } = useLanguage();
  const [selectedSection, setSelectedSection] = useState<string | null>(null);

  const sections = [
    { id: 'dashboard', title: t('documentation.sections.dashboard.title'), desc: t('documentation.sections.dashboard.desc') },
    { id: 'analytics', title: t('documentation.sections.analytics.title'), desc: t('documentation.sections.analytics.desc') },
    { id: 'logs', title: t('documentation.sections.logs.title'), desc: t('documentation.sections.logs.desc') },
    { id: 'rulesets', title: t('documentation.sections.rulesets.title'), desc: t('documentation.sections.rulesets.desc') },
    { id: 'lists', title: t('documentation.sections.lists.title'), desc: t('documentation.sections.lists.desc') },
    { id: 'settings', title: t('documentation.sections.settings.title'), desc: t('documentation.sections.settings.desc') },
  ];

  return (
    <div className="max-w-4xl mx-auto animate-fade-in pb-12">
      <header className="flex flex-col items-center justify-center mb-16 text-center">
        <h1 className="text-5xl font-light tracking-tight text-black mb-4 transition-colors">{t('documentation.title')}</h1>
        <p className="text-secondary text-lg font-light transition-colors">{t('documentation.subtitle')}</p>
      </header>

      {!selectedSection ? (
        // Overview Grid View
        <div className="animate-fade-in">
            {/* Introduction */}
            <section className="mb-12 text-center max-w-2xl mx-auto">
            <h2 className="text-2xl font-normal text-black mb-4 transition-colors">{t('documentation.intro_title')}</h2>
            <p className="text-secondary leading-relaxed font-light transition-colors">
                {t('documentation.intro_desc')}
            </p>
            </section>

            {/* Feature Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                {sections.map((section) => (
                    <button 
                        key={section.id}
                        onClick={() => setSelectedSection(section.id)}
                        className="text-left p-8 bg-subtle rounded-sm border border-border hover:border-black hover:shadow-sm transition-all duration-300 group h-full flex flex-col"
                    >
                        <h3 className="text-lg font-medium text-black mb-3 group-hover:text-black transition-colors">{section.title}</h3>
                        <p className="text-sm text-secondary font-light leading-relaxed mb-4 flex-grow transition-colors">{section.desc}</p>
                        <span className="text-xs font-medium text-black opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                            Read more
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                        </span>
                    </button>
                ))}
            </div>
        </div>
      ) : (
        // Detailed Section View
        <div className="animate-fade-in">
            <button 
                onClick={() => setSelectedSection(null)}
                className="flex items-center gap-2 text-sm font-medium text-secondary hover:text-black transition-colors mb-8 group"
            >
                <svg className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                {t('documentation.back')}
            </button>

            <h2 className="text-3xl font-light text-black mb-8 pb-4 border-b border-black transition-colors">
                {sections.find(s => s.id === selectedSection)?.title}
            </h2>

            <div className="space-y-12">
                {getDetails(t, selectedSection, language).map((item: any, idx: number) => (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="md:col-span-1">
                            <h3 className="text-lg font-medium text-black transition-colors">{item.title}</h3>
                        </div>
                        <div className="md:col-span-3">
                            <p className="text-secondary leading-relaxed font-light transition-colors">
                                {item.content}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      )}
    </div>
  );
};