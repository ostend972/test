export interface DashboardStats {
  blockedToday: {
    value: number;
    trend: number; // ex: 15 pour +15%
  };
  totalBlocked: number;
  lastThreat?: {
    domain: string;
    timestamp: string;
  };
  proxyStatus: 'active' | 'inactive';
}

export interface Domain {
  id: number;
  domain: string;
  ipAddress: string;
  hits: number;
  lastUsed: string | null;
  createdAt: string;
}

export type BlockReason = 'Phishing' | 'Malware' | 'Adware' | 'Scam' | 'IP Block' | 'Remote Desktop' | 'Port Block';

export interface RealtimeEvent {
  type: 'blocked' | 'allowed';
  domain: string;
  timestamp: string;
  reason?: BlockReason;
  source?: string;
}

export interface Config {
  protectionEnabled: boolean;
  blockDirectIPs: boolean;
  blockRemoteDesktop: boolean;
  blockHTTPTraffic?: boolean;
  blockNonStandardPorts?: boolean;
  updateInterval: number;
  proxyPort: number;
  blocklistSources: Record<string, boolean>;
  whitelistGitHubURL?: string;
  usefulDomainsURL?: string;
  enableUsefulDomains?: boolean;
  whitelistGitHubLoaded?: boolean;
  usefulDomainsLoaded?: boolean;
}

export interface ChartDataPoint {
  time: string;
  blocks: number;
}

export type LogLevel = 'INFO' | 'WARNING' | 'ERROR';

export interface Log {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
}

export interface SecurityEvent extends RealtimeEvent {
    id: string;
}


export interface BlockedCategory {
    name: string;
    count: number;
}

export interface ThreatAnalysis {
  title: string;
  summary: string;
  recommendation: string;
}

export interface TopBlockedDomain {
  domain: string;
  count: number;
  threatType: BlockReason;
  source: string;
}

export interface ProtectionLayer {
    id: string;
    name: string;
    description: string;
    status: 'active' | 'inactive' | 'configured';
}

export interface ProtectionStatusDetails {
    layers: ProtectionLayer[];
}

export interface SystemIntegrityStatus {
    proxy: 'configured' | 'error';
    firewall: 'active' | 'inactive';
    startupTask: 'active' | 'inactive';
}