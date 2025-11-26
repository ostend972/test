
export interface Stats {
  blockedToday: number;
  allowedToday: number;
  totalBlocked: number;
  totalAllowed: number;
  blocklistSize: number;
  whitelistSize: number;
  proxyStatus: 'active' | 'inactive';
  uptime: number;
  lastUpdate: string;
}

export interface ProxyStatus {
  status: 'active' | 'inactive';
  port: number;
  host: string;
}

export interface BlocklistSource {
  id: string;
  name: string;
  enabled: boolean;
  url: string;
  lastUpdate: string;
  domainCount: number;
  category: string;
  custom?: boolean;
}

export interface WhitelistSource {
  id: string;
  name: string;
  enabled: boolean;
  url: string;
  lastUpdate: string;
  domainCount: number;
  category: string;
  custom?: boolean;
}

export interface WhitelistEntry {
  id: number;
  domain: string;
  source: 'user' | 'system';
  created_at: string;
}

export interface BlocklistEntry {
  id: number;
  domain: string;
  source: 'user' | 'system';
  created_at: string;
}

export interface DomainEvent {
  type: 'blocked' | 'allowed';
  domain: string;
  timestamp: string;
  reason?: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  type: 'blocked' | 'allowed';
  domain: string;
  reason?: string;
  method: string;
  duration: number;
}

export interface Config {
  isFirstRun: boolean; // New flag for onboarding
  proxyPort: number;
  proxyHost: string;
  autoStart: boolean;
  autoUpdate: boolean;
  logLevel: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
  language: 'fr' | 'en';
  notifications: boolean;
  // New Security Policies
  blockNonStandardPorts: boolean;
  blockNumericIPs: boolean;
  forceHTTPS: boolean;
  // DNS Configuration
  dnsProvider: 'system' | 'cloudflare' | 'google' | 'quad9';
}

export interface UpdateInfo {
  available: boolean;
  version?: string;
  currentVersion?: string;
  releaseNotes?: string;
  releaseDate?: string;
  downloadUrl?: string;
}

export interface SystemIntegrity {
  proxyConfigured: boolean;
  firewallActive: boolean;
  autoStartTaskScheduled: boolean;
}

export interface IElectronAPI {
  getStats: () => Promise<Stats>;
  getProxyStatus: () => Promise<ProxyStatus>;

  // Blocklists (Subscriptions)
  getBlocklistSources: () => Promise<BlocklistSource[]>;
  toggleBlocklistSource: (id: string, enabled: boolean) => Promise<void>;
  addBlocklistSource: (name: string, url: string) => Promise<void>;
  removeBlocklistSource: (id: string) => Promise<void>;
  updateBlocklists: () => Promise<void>;

  // Whitelists (Subscriptions)
  getWhitelistSources: () => Promise<WhitelistSource[]>;
  toggleWhitelistSource: (id: string, enabled: boolean) => Promise<void>;
  addWhitelistSource: (name: string, url: string) => Promise<void>;
  removeWhitelistSource: (id: string) => Promise<void>;

  // User Whitelist (Individual Domains)
  getWhitelist: () => Promise<WhitelistEntry[]>;
  addToWhitelist: (domain: string) => Promise<void>;
  removeFromWhitelist: (domain: string) => Promise<void>;

  // User Blocklist (Individual Domains)
  getBlocklist: () => Promise<BlocklistEntry[]>;
  addToBlocklist: (domain: string) => Promise<void>;
  removeFromBlocklist: (domain: string) => Promise<void>;

  getLogs: (filter?: { type?: 'blocked' | 'allowed'; search?: string; limit?: number; offset?: number }) => Promise<LogEntry[]>;

  // System Logs
  getSystemLogs: () => Promise<string[]>;

  // System Integrity
  getSystemIntegrity: () => Promise<SystemIntegrity>;
  repairSystemIntegrity: () => Promise<void>;

  // DNS Manager
  applyDNS: (provider: 'system' | 'cloudflare' | 'google' | 'quad9') => Promise<{ success: boolean; error?: string }>;
  getDNSStatus: () => Promise<{ interface: string; dns: string[] }[]>;

  startProxy: () => Promise<void>;
  stopProxy: (duration?: number) => Promise<void>;
  onDomainEvent: (callback: (event: DomainEvent) => void) => void;
  getConfig: () => Promise<Config>;
  updateConfig: (config: Partial<Config>) => Promise<void>;

  // Updates
  checkForUpdates: () => Promise<UpdateInfo>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
  onUpdateAvailable: (callback: (info: any) => void) => void;
  onUpdateDownloadProgress: (callback: (progress: any) => void) => void;
  onUpdateDownloaded: (callback: (info: any) => void) => void;
  onUpdateError: (callback: (error: string) => void) => void;

  // Analytics
  getHourlyAnalytics: (hours?: number) => Promise<Array<{ time: string; blocked: number; allowed: number }>>;
  getDailyAnalytics: (days?: number) => Promise<Array<{ day: string; blocked: number; allowed: number }>>;
  getTopThreats: (limit?: number) => Promise<Array<{ domain: string; hits: number; category: string; lastSeen: string }>>;

  // Testing
  testBlock: (input: string, testType: 'domain' | 'url' | 'ip' | 'port') => Promise<{ blocked: boolean; reason?: string }>;
  quickAddWhitelist: (domain: string) => Promise<{ success: boolean; error?: string }>;
  quickAddBlocklist: (domain: string) => Promise<{ success: boolean; error?: string }>;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
