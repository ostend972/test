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

// Helper function to check Electron API availability
const checkElectronAPI = () => {
    if (!window.electronAPI) {
        throw new Error('Electron API not available. Please ensure the application is running in Electron.');
    }
};

// --- API SERVICES (using Electron IPC) ---

export const getDashboardStats = async () => {
    try {
        checkElectronAPI();
        return await window.electronAPI.getDashboardStats();
    } catch (error) {
        console.error('Failed to get dashboard stats:', error);
        throw error;
    }
};

export const getProxyStatus = async () => {
    try {
        checkElectronAPI();
        return await window.electronAPI.getProxyStatus();
    } catch (error) {
        console.error('Failed to get proxy status:', error);
        throw error;
    }
};

export const getWhitelist = async () => {
    try {
        checkElectronAPI();
        return await window.electronAPI.getWhitelist();
    } catch (error) {
        console.error('Failed to get whitelist:', error);
        throw error;
    }
};

export const addWhitelistDomain = async (domain) => {
    try {
        checkElectronAPI();
        return await window.electronAPI.addWhitelistDomain(domain);
    } catch (error) {
        console.error('Failed to add whitelist domain:', error);
        throw error;
    }
};

export const deleteWhitelistDomain = async (domainName) => {
    try {
        checkElectronAPI();
        return await window.electronAPI.deleteWhitelistDomain(domainName);
    } catch (error) {
        console.error('Failed to delete whitelist domain:', error);
        throw error;
    }
};

export const getBlocklist = async () => {
    try {
        checkElectronAPI();
        return await window.electronAPI.getBlocklist();
    } catch (error) {
        console.error('Failed to get blocklist:', error);
        throw error;
    }
};

export const addBlocklistDomain = async (domain) => {
    try {
        checkElectronAPI();
        return await window.electronAPI.addBlocklistDomain(domain);
    } catch (error) {
        console.error('Failed to add blocklist domain:', error);
        throw error;
    }
};

export const deleteBlocklistDomain = async (domainName) => {
    try {
        checkElectronAPI();
        return await window.electronAPI.deleteBlocklistDomain(domainName);
    } catch (error) {
        console.error('Failed to delete blocklist domain:', error);
        throw error;
    }
};

export const disableProtection = async () => {
    try {
        checkElectronAPI();
        return await window.electronAPI.disableProtection();
    } catch (error) {
        console.error('Failed to disable protection:', error);
        throw error;
    }
};

export const getChartData = async () => {
    try {
        checkElectronAPI();
        return await window.electronAPI.getChartData();
    } catch (error) {
        console.error('Failed to get chart data:', error);
        throw error;
    }
};

export const getConfig = async () => {
    try {
        checkElectronAPI();
        return await window.electronAPI.getConfig();
    } catch (error) {
        console.error('Failed to get config:', error);
        throw error;
    }
};

export const updateConfig = async (config) => {
    try {
        checkElectronAPI();
        return await window.electronAPI.updateConfig(config);
    } catch (error) {
        console.error('Failed to update config:', error);
        throw error;
    }
};

export const getLogs = async (filters, page, pageSize) => {
    try {
        checkElectronAPI();
        return await window.electronAPI.getLogs(filters, page, pageSize);
    } catch (error) {
        console.error('Failed to get logs:', error);
        throw error;
    }
};

export const getSecurityEvents = async (filters, page, pageSize) => {
    try {
        checkElectronAPI();
        return await window.electronAPI.getSecurityEvents(filters, page, pageSize);
    } catch (error) {
        console.error('Failed to get security events:', error);
        throw error;
    }
};

export const exportLogs = async () => {
    try {
        checkElectronAPI();
        const { content, filename } = await window.electronAPI.exportLogs();
        const blob = new Blob([content], { type: 'text/plain' });
        downloadFile(blob, filename);
    } catch (error) {
        console.error('Failed to export logs:', error);
        throw error;
    }
};

export const generateDiagnosticReport = async () => {
    try {
        checkElectronAPI();
        const { content, filename } = await window.electronAPI.generateDiagnosticReport();
        const blob = new Blob([content], { type: 'text/plain' });
        downloadFile(blob, filename);
    } catch (error) {
        console.error('Failed to generate diagnostic report:', error);
        throw error;
    }
};

export const exportWhitelist = async () => {
    try {
        checkElectronAPI();
        const { content, filename } = await window.electronAPI.exportWhitelist();
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        downloadFile(blob, filename);
    } catch (error) {
        console.error('Failed to export whitelist:', error);
        throw error;
    }
};

export const importWhitelist = async (file) => {
    try {
        checkElectronAPI();
        const content = await file.text();
        return await window.electronAPI.importWhitelist({ filename: file.name, content });
    } catch (error) {
        console.error('Failed to import whitelist:', error);
        throw error;
    }
};

export const exportBlocklist = async () => {
    try {
        checkElectronAPI();
        const { content, filename } = await window.electronAPI.exportBlocklist();
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        downloadFile(blob, filename);
    } catch (error) {
        console.error('Failed to export blocklist:', error);
        throw error;
    }
};

export const importBlocklist = async (file) => {
    try {
        checkElectronAPI();
        const content = await file.text();
        return await window.electronAPI.importBlocklist({ filename: file.name, content });
    } catch (error) {
        console.error('Failed to import blocklist:', error);
        throw error;
    }
};

export const getTopBlockedCategories = async () => {
    try {
        checkElectronAPI();
        return await window.electronAPI.getTopBlockedCategories();
    } catch (error) {
        console.error('Failed to get top blocked categories:', error);
        throw error;
    }
};

export const getThreatAnalysis = async () => {
    try {
        checkElectronAPI();
        return await window.electronAPI.getThreatAnalysis();
    } catch (error) {
        console.error('Failed to get threat analysis:', error);
        throw error;
    }
};

export const getTopBlockedDomains = async () => {
    try {
        checkElectronAPI();
        return await window.electronAPI.getTopBlockedDomains();
    } catch (error) {
        console.error('Failed to get top blocked domains:', error);
        throw error;
    }
};

export const getProtectionStatusDetails = async () => {
    try {
        checkElectronAPI();
        return await window.electronAPI.getProtectionStatusDetails();
    } catch (error) {
        console.error('Failed to get protection status details:', error);
        throw error;
    }
};

export const getSystemIntegrityStatus = async () => {
    try {
        checkElectronAPI();
        return await window.electronAPI.getSystemIntegrityStatus();
    } catch (error) {
        console.error('Failed to get system integrity status:', error);
        throw error;
    }
};

export const repairSystem = async () => {
    try {
        checkElectronAPI();
        return await window.electronAPI.repairSystem();
    } catch (error) {
        console.error('Failed to repair system:', error);
        throw error;
    }
};

// --- UPDATE API ---
export const checkForUpdates = async () => {
    try {
        checkElectronAPI();
        return await window.electronAPI.checkForUpdates();
    } catch (error) {
        console.error('Failed to check for updates:', error);
        throw error;
    }
};

export const downloadUpdate = async () => {
    try {
        checkElectronAPI();
        return await window.electronAPI.downloadUpdate();
    } catch (error) {
        console.error('Failed to download update:', error);
        throw error;
    }
};

export const installUpdate = async () => {
    try {
        checkElectronAPI();
        return await window.electronAPI.installUpdate();
    } catch (error) {
        console.error('Failed to install update:', error);
        throw error;
    }
};

export const getUpdateInfo = async () => {
    try {
        checkElectronAPI();
        return await window.electronAPI.getUpdateInfo();
    } catch (error) {
        console.error('Failed to get update info:', error);
        throw error;
    }
};
