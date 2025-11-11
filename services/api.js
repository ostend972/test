const downloadFile = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
};

// --- API SERVICES (using Electron IPC) ---

export const getDashboardStats = async () => window.electronAPI.getDashboardStats();
export const getProxyStatus = async () => window.electronAPI.getProxyStatus();
export const getWhitelist = async () => window.electronAPI.getWhitelist();
export const addWhitelistDomain = async (domain) => window.electronAPI.addWhitelistDomain(domain);
export const deleteWhitelistDomain = async (domainName) => window.electronAPI.deleteWhitelistDomain(domainName);
export const getBlocklist = async () => window.electronAPI.getBlocklist();
export const addBlocklistDomain = async (domain) => window.electronAPI.addBlocklistDomain(domain);
export const deleteBlocklistDomain = async (domainName) => window.electronAPI.deleteBlocklistDomain(domainName);
export const disableProtection = async () => window.electronAPI.disableProtection();
export const getChartData = async () => window.electronAPI.getChartData();
export const getConfig = async () => window.electronAPI.getConfig();
export const updateConfig = async (config) => window.electronAPI.updateConfig(config);
export const getLogs = async (filters, page, pageSize) => window.electronAPI.getLogs(filters, page, pageSize);
export const getSecurityEvents = async (filters, page, pageSize) => window.electronAPI.getSecurityEvents(filters, page, pageSize);

export const exportLogs = async () => {
    const { content, filename } = await window.electronAPI.exportLogs();
    const blob = new Blob([content], { type: 'text/plain' });
    downloadFile(blob, filename);
};

export const generateDiagnosticReport = async () => {
    const { content, filename } = await window.electronAPI.generateDiagnosticReport();
    const blob = new Blob([content], { type: 'text/plain' });
    downloadFile(blob, filename);
};

export const exportWhitelist = async () => {
    const { content, filename } = await window.electronAPI.exportWhitelist();
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    downloadFile(blob, filename);
};

export const importWhitelist = async (file) => {
    const content = await file.text();
    return window.electronAPI.importWhitelist({ filename: file.name, content });
};

export const exportBlocklist = async () => {
    const { content, filename } = await window.electronAPI.exportBlocklist();
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    downloadFile(blob, filename);
};

export const importBlocklist = async (file) => {
    const content = await file.text();
    return window.electronAPI.importBlocklist({ filename: file.name, content });
};

export const getTopBlockedCategories = async () => window.electronAPI.getTopBlockedCategories();
export const getThreatAnalysis = async () => window.electronAPI.getThreatAnalysis();
export const getTopBlockedDomains = async () => window.electronAPI.getTopBlockedDomains();
export const getProtectionStatusDetails = async () => window.electronAPI.getProtectionStatusDetails();
export const getSystemIntegrityStatus = async () => window.electronAPI.getSystemIntegrityStatus();
export const repairSystem = async () => window.electronAPI.repairSystem();
export const forceBlocklistUpdate = async () => window.electronAPI.forceBlocklistUpdate();

// --- UPDATE API ---
export const checkForUpdates = async () => window.electronAPI.checkForUpdates();
export const downloadUpdate = async () => window.electronAPI.downloadUpdate();
export const installUpdate = async () => window.electronAPI.installUpdate();
export const getUpdateInfo = async () => window.electronAPI.getUpdateInfo();
