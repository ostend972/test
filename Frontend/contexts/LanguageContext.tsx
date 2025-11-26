import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { translations, Language } from '../locales/translations';
import { useQuery } from '@tanstack/react-query';

// --- Simple Router Implementation ---
const RouterContext = createContext<{ pathname: string; navigate: (path: string, replace?: boolean) => void }>({ pathname: '/', navigate: () => {} });

export const useLocation = () => {
  const context = useContext(RouterContext);
  // Fallback to window.location.hash if context is missing (e.g. outside provider)
  if (!context) {
      const hashPath = typeof window !== 'undefined' ? window.location.hash.slice(1) || '/' : '/';
      return { pathname: hashPath };
  }
  return { pathname: context.pathname };
};

export const useNavigate = () => {
  const context = useContext(RouterContext);
  if (!context) return () => {};
  return (to: string, options?: { replace?: boolean }) => context.navigate(to, options?.replace);
};

export const HashRouter: React.FC<{ children: ReactNode }> = ({ children }) => {
  const getHashPath = () => {
      if (typeof window === 'undefined') return '/';
      return window.location.hash.slice(1) || '/';
  };
  const [pathname, setPathname] = useState(getHashPath());

  useEffect(() => {
    const handleHashChange = () => {
      setPathname(getHashPath());
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (path: string, replace?: boolean) => {
    if (replace) {
      window.location.replace(`#${path}`);
    } else {
      window.location.hash = path;
    }
  };

  return (
    <RouterContext.Provider value={{ pathname, navigate }}>
      {children}
    </RouterContext.Provider>
  );
};

export const Routes: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { pathname } = useLocation();
  
  let match = null;
  let defaultMatch = null;

  React.Children.forEach(children, (child) => {
    if (match) return;
    if (React.isValidElement(child)) {
      const props = child.props as { path?: string; element?: ReactNode };
      if (props.path === pathname) {
        match = child;
      }
      if (props.path === '*') {
        defaultMatch = child;
      }
    }
  });

  return (match || defaultMatch) as React.ReactElement | null;
};

export const Route: React.FC<{ path: string; element: ReactNode }> = ({ element }) => {
  return <>{element}</>;
};

export const Navigate: React.FC<{ to: string; replace?: boolean }> = ({ to, replace }) => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to, { replace });
  }, [navigate, to, replace]);
  return null;
};

export const Link: React.FC<{ to: string; children: ReactNode; className?: string; onClick?: () => void }> = ({ to, children, className, onClick }) => {
  const navigate = useNavigate();
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(to);
    if (onClick) onClick();
  };
  return <a href={`#${to}`} onClick={handleClick} className={className}>{children}</a>;
};
// --- End Router Implementation ---

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  locale: string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('fr');

  // Sync with backend config on load
  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: () => window.electronAPI.getConfig(),
    enabled: false, // Only fetch when explicitly needed or rely on initial load if implemented
  });

  // Initialize from backend if available (Optional, but good for consistency)
  useEffect(() => {
    window.electronAPI.getConfig().then(cfg => {
        if (cfg.language && (cfg.language === 'fr' || cfg.language === 'en')) {
            setLanguage(cfg.language);
        }
    });
  }, []);

  const t = (path: string, params?: Record<string, string | number>): string => {
    const keys = path.split('.');
    let current: any = translations[language];

    for (const key of keys) {
      if (current[key] === undefined) {
        console.warn(`Missing translation for key: ${path}`);
        return path;
      }
      current = current[key];
    }

    let result = current as string;
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        result = result.replace(`{${key}}`, String(value));
      });
    }

    return result;
  };

  const locale = language === 'fr' ? 'fr-FR' : 'en-US';

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, locale }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};