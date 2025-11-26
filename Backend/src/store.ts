import Store from 'electron-store';
import { Config } from './types';

const schema = {
    isFirstRun: { type: 'boolean', default: true },
    proxyPort: { type: 'number', default: 8081 },
    proxyHost: { type: 'string', default: '127.0.0.1' },
    autoStart: { type: 'boolean', default: true },
    autoUpdate: { type: 'boolean', default: false },
    logLevel: { type: 'string', default: 'INFO' },
    language: { type: 'string', default: 'fr' },
    notifications: { type: 'boolean', default: true },
    blockNonStandardPorts: { type: 'boolean', default: false },
    blockNumericIPs: { type: 'boolean', default: true },
    forceHTTPS: { type: 'boolean', default: false },
    dnsProvider: { type: 'string', default: 'system' }
} as const;

const store = new Store<Config>({
    schema: schema as any,
    defaults: {
        isFirstRun: true,
        proxyPort: 8081,
        proxyHost: '127.0.0.1',
        autoStart: true,
        autoUpdate: false,
        logLevel: 'INFO',
        language: 'fr',
        notifications: true,
        blockNonStandardPorts: false,
        blockNumericIPs: true,
        forceHTTPS: false,
        dnsProvider: 'system'
    }
});

export default store;
