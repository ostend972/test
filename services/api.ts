import { DashboardStats, Domain, ChartDataPoint, Config, Log, LogLevel, BlockedCategory, ThreatAnalysis, TopBlockedDomain, ProtectionStatusDetails, SystemIntegrityStatus, SecurityEvent } from '../types';

declare global {
  interface Window {
    electronAPI?: any;
  }
}

// Helper pour utiliser l'API Electron
const api = () => {
  if (!window.electronAPI) {
    throw new Error('Electron API not available');
  }
  return window.electronAPI;
};

// --- DASHBOARD ---
export const getDashboardStats = async (): Promise<DashboardStats> => {
  return await api().getDashboardStats();
};

export const getProxyStatus = async (): Promise<{ status: 'active' | 'inactive' }> => {
  return await api().getProxyStatus();
};

export const getChartData = async (): Promise<ChartDataPoint[]> => {
  return await api().getChartData();
};

export const getTopBlockedCategories = async (): Promise<BlockedCategory[]> => {
  return await api().getTopBlockedCategories();
};

export const getThreatAnalysis = async (): Promise<ThreatAnalysis> => {
  return await api().getThreatAnalysis();
};

export const getTopBlockedDomains = async (): Promise<TopBlockedDomain[]> => {
  return await api().getTopBlockedDomains();
};

export const getProtectionStatusDetails = async (): Promise<ProtectionStatusDetails> => {
  return await api().getProtectionStatusDetails();
};

// --- WHITELIST ---
export const getWhitelist = async (): Promise<Domain[]> => {
  return await api().getWhitelist();
};

export const addWhitelistDomain = async (domain: string): Promise<Domain> => {
  return await api().addWhitelistDomain(domain);
};

export const deleteWhitelistDomain = async (domainName: string): Promise<{ message: string }> => {
  await api().deleteWhitelistDomain(domainName);
  return { message: 'Domaine supprimé avec succès' };
};

export const exportWhitelist = async () => {
  const result = await api().exportWhitelist();
  const blob = new Blob([result.content], { type: 'text/csv;charset=utf-8;' });
  downloadFile(blob, result.filename || 'whitelist.csv');
};

export const importWhitelist = async (file: File): Promise<{ message: string }> => {
  const content = await file.text();
  const result = await api().importWhitelist({ content });
  return { message: `Importation réussie. ${result.imported || 0} domaines ajoutés.` };
};

// --- BLOCKLIST ---
export const getBlocklist = async (): Promise<Domain[]> => {
  return await api().getBlocklist();
};

export const addBlocklistDomain = async (domain: string): Promise<Domain> => {
  return await api().addBlocklistDomain(domain);
};

export const deleteBlocklistDomain = async (domainName: string): Promise<{ message: string }> => {
  await api().deleteBlocklistDomain(domainName);
  return { message: 'Domaine supprimé avec succès' };
};

export const exportBlocklist = async () => {
  const result = await api().exportBlocklist();
  const blob = new Blob([result.content], { type: 'text/csv;charset=utf-8;' });
  downloadFile(blob, result.filename || 'blocklist.csv');
};

export const importBlocklist = async (file: File): Promise<{ message: string }> => {
  const content = await file.text();
  const result = await api().importBlocklist({ content });
  return { message: `Importation réussie. ${result.imported || 0} domaines ajoutés.` };
};

// --- CONFIG ---
export const getConfig = async (): Promise<Config> => {
  return await api().getConfig();
};

export const updateConfig = async (config: Partial<Config>): Promise<Config> => {
  return await api().updateConfig(config);
};

// --- EMERGENCY ---
export const disableProtection = async (): Promise<{ message: string }> => {
  return await api().disableProtection();
};

// --- LOGS ---
export const getLogs = async (filters?: { level?: LogLevel; from?: string; to?: string; limit?: number }): Promise<Log[]> => {
  return await api().getLogs(filters || {});
};

export const getSecurityEvents = async (): Promise<SecurityEvent[]> => {
  return await api().getSecurityEvents();
};

export const exportLogs = async (): Promise<void> => {
  const result = await api().exportLogs();
  const blob = new Blob([result.content], { type: 'text/plain' });
  downloadFile(blob, result.filename || 'logs.txt');
};

export const generateDiagnosticReport = async (): Promise<void> => {
  const result = await api().generateDiagnosticReport();
  const blob = new Blob([result.content], { type: 'text/plain' });
  downloadFile(blob, result.filename || 'diagnostic.txt');
};

// --- SYSTEM ---
export const getSystemIntegrityStatus = async (): Promise<SystemIntegrityStatus> => {
  return await api().getSystemIntegrityStatus();
};

export const repairSystem = async (): Promise<{ success: boolean }> => {
  return await api().repairSystem();
};

// --- HELPERS ---
const downloadFile = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};
