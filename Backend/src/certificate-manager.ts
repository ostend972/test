import forge from 'node-forge';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { execSync } from 'child_process';

const CERT_DIR = path.join(app.getPath('userData'), 'certificates');
const CA_KEY_PATH = path.join(CERT_DIR, 'ca-key.pem');
const CA_CERT_PATH = path.join(CERT_DIR, 'ca-cert.pem');

export interface CertificateInfo {
    installed: boolean;
    commonName: string;
    validFrom: string;
    validTo: string;
    serialNumber: string;
}

/**
 * Ensure certificate directory exists
 */
function ensureCertDir() {
    if (!fs.existsSync(CERT_DIR)) {
        console.log(`[CertManager] Creating certificate directory: ${CERT_DIR}`);
        try {
            fs.mkdirSync(CERT_DIR, { recursive: true });
            console.log('[CertManager] ✓ Certificate directory created');
        } catch (error: any) {
            console.error('[CertManager] ✗ Failed to create directory:', error.message);
            throw error;
        }
    }
}

/**
 * Generate a new Certificate Authority (CA)
 */
export function generateCA(): { key: string; cert: string } {
    console.log('[CertManager] Generating new CA certificate...');

    try {
        // Generate RSA key pair
        console.log('[CertManager] Generating RSA 2048-bit key pair...');
        const keys = forge.pki.rsa.generateKeyPair(2048);
        console.log('[CertManager] ✓ Key pair generated');

    // Create certificate
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10); // Valid for 10 years

    const attrs = [
        { name: 'commonName', value: 'CalmWeb Security CA' },
        { name: 'countryName', value: 'US' },
        { name: 'organizationName', value: 'CalmWeb' },
        { shortName: 'OU', value: 'Security' }
    ];

    cert.setSubject(attrs);
    cert.setIssuer(attrs);

    // Set extensions for CA
    cert.setExtensions([
        {
            name: 'basicConstraints',
            cA: true
        },
        {
            name: 'keyUsage',
            keyCertSign: true,
            digitalSignature: true,
            nonRepudiation: true,
            keyEncipherment: true,
            dataEncipherment: true
        },
        {
            name: 'subjectKeyIdentifier'
        }
    ]);

    // Self-sign certificate
    cert.sign(keys.privateKey, forge.md.sha256.create());

    const keyPem = forge.pki.privateKeyToPem(keys.privateKey);
    const certPem = forge.pki.certificateToPem(cert);

        // Save to disk
        ensureCertDir();
        fs.writeFileSync(CA_KEY_PATH, keyPem);
        fs.writeFileSync(CA_CERT_PATH, certPem);

        console.log('[CertManager] ✓ CA certificate generated successfully');
        console.log('[CertManager] Key saved to:', CA_KEY_PATH);
        console.log('[CertManager] Cert saved to:', CA_CERT_PATH);

        return { key: keyPem, cert: certPem };
    } catch (error: any) {
        console.error('[CertManager] ✗ Failed to generate CA certificate:', error.message);
        throw error;
    }
}

/**
 * Load existing CA or generate new one
 */
export function getOrCreateCA(): { key: string; cert: string } {
    ensureCertDir();

    if (fs.existsSync(CA_KEY_PATH) && fs.existsSync(CA_CERT_PATH)) {
        console.log('[CertManager] Loading existing CA certificate...');
        try {
            const result = {
                key: fs.readFileSync(CA_KEY_PATH, 'utf8'),
                cert: fs.readFileSync(CA_CERT_PATH, 'utf8')
            };
            console.log('[CertManager] ✓ Existing CA loaded successfully');
            return result;
        } catch (error: any) {
            console.error('[CertManager] ✗ Failed to load existing CA:', error.message);
            console.log('[CertManager] Generating new CA instead...');
            return generateCA();
        }
    }

    console.log('[CertManager] No existing CA found, generating new one...');
    return generateCA();
}

/**
 * Generate a certificate for a specific domain signed by our CA
 */
export function generateDomainCert(domain: string, caCert: string, caKey: string): { key: string; cert: string } {
    console.log(`[CertManager] Generating domain certificate for: ${domain}`);

    try {
        // Generate key pair for domain
        console.log('[CertManager] Generating RSA 2048-bit key pair for domain...');
        const keys = forge.pki.rsa.generateKeyPair(2048);
        console.log('[CertManager] ✓ Domain key pair generated');

        // Parse CA cert and key
        console.log('[CertManager] Parsing CA certificate and private key...');
        const ca = forge.pki.certificateFromPem(caCert);
        const caPrivateKey = forge.pki.privateKeyFromPem(caKey);
        console.log('[CertManager] ✓ CA certificate parsed successfully');

        // Create certificate for domain
        const cert = forge.pki.createCertificate();
        cert.publicKey = keys.publicKey;
        cert.serialNumber = Math.floor(Math.random() * 100000).toString();
        cert.validity.notBefore = new Date();
        cert.validity.notAfter = new Date();
        cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1); // Valid for 1 year

        const attrs = [
            { name: 'commonName', value: domain },
            { name: 'organizationName', value: 'CalmWeb Proxy' }
        ];

        cert.setSubject(attrs);
        cert.setIssuer(ca.subject.attributes);

        // Set extensions
        cert.setExtensions([
            {
                name: 'basicConstraints',
                cA: false
            },
            {
                name: 'keyUsage',
                digitalSignature: true,
                keyEncipherment: true
            },
            {
                name: 'extKeyUsage',
                serverAuth: true,
                clientAuth: true
            },
            {
                name: 'subjectAltName',
                altNames: [
                    { type: 2, value: domain }, // DNS
                    { type: 2, value: `*.${domain}` } // Wildcard
                ]
            }
        ]);

        console.log('[CertManager] Signing domain certificate with CA private key...');
        // Sign with CA private key
        cert.sign(caPrivateKey, forge.md.sha256.create());
        console.log(`[CertManager] ✓ Domain certificate for ${domain} generated successfully (valid for 1 year)`);

        return {
            key: forge.pki.privateKeyToPem(keys.privateKey),
            cert: forge.pki.certificateToPem(cert)
        };
    } catch (error: any) {
        console.error(`[CertManager] ✗ Failed to generate domain certificate for ${domain}:`, error.message);
        throw error;
    }
}

/**
 * Install CA certificate to Windows Trusted Root Store
 */
export function installCertificateToWindows(): boolean {
    console.log('[CertManager] Starting CA installation to Windows Trusted Root Store...');

    try {
        if (!fs.existsSync(CA_CERT_PATH)) {
            console.error('[CertManager] ✗ CA certificate file not found at:', CA_CERT_PATH);
            return false;
        }

        console.log('[CertManager] CA certificate file found at:', CA_CERT_PATH);
        console.log('[CertManager] Executing certutil command to install certificate...');

        // Use certutil to install certificate
        const command = `certutil -addstore -user "Root" "${CA_CERT_PATH}"`;
        const output = execSync(command, { stdio: 'pipe' }).toString();

        console.log('[CertManager] ✓ Certificate installed successfully to Windows Trust Store');
        console.log('[CertManager] Certutil output:', output.trim());
        return true;
    } catch (error: any) {
        console.error('[CertManager] ✗ Failed to install certificate:', error.message);
        if (error.stderr) {
            console.error('[CertManager] Certutil error output:', error.stderr.toString().trim());
        }
        return false;
    }
}

/**
 * Uninstall CA certificate from Windows Trusted Root Store
 */
export function uninstallCertificateFromWindows(): boolean {
    console.log('[CertManager] Starting CA removal from Windows Trusted Root Store...');

    try {
        console.log('[CertManager] Looking for certificate: "CalmWeb Security CA"');
        console.log('[CertManager] Executing certutil command to remove certificate...');

        // Use certutil to remove certificate by name
        const command = `certutil -delstore -user "Root" "CalmWeb Security CA"`;
        const output = execSync(command, { stdio: 'pipe' }).toString();

        console.log('[CertManager] ✓ Certificate removed successfully from Windows Trust Store');
        console.log('[CertManager] Certutil output:', output.trim());
        return true;
    } catch (error: any) {
        console.error('[CertManager] ✗ Failed to remove certificate:', error.message);
        if (error.stderr) {
            console.error('[CertManager] Certutil error output:', error.stderr.toString().trim());
        }
        return false;
    }
}

/**
 * Check if certificate is installed in Windows store
 */
export function isCertificateInstalled(): boolean {
    console.log('[CertManager] Checking if CA certificate is installed in Windows Trust Store...');

    try {
        const command = `certutil -user -verifystore Root "CalmWeb Security CA"`;
        execSync(command, { stdio: 'pipe' });
        console.log('[CertManager] ✓ Certificate is installed in Windows Trust Store');
        return true;
    } catch (error) {
        console.log('[CertManager] Certificate is NOT installed in Windows Trust Store');
        return false;
    }
}

/**
 * Get certificate information
 */
export function getCertificateInfo(): CertificateInfo | null {
    console.log('[CertManager] Retrieving certificate information...');

    try {
        if (!fs.existsSync(CA_CERT_PATH)) {
            console.log('[CertManager] No certificate file found at:', CA_CERT_PATH);
            return null;
        }

        console.log('[CertManager] Reading certificate file from:', CA_CERT_PATH);
        const certPem = fs.readFileSync(CA_CERT_PATH, 'utf8');

        console.log('[CertManager] Parsing certificate...');
        const cert = forge.pki.certificateFromPem(certPem);

        const info = {
            installed: isCertificateInstalled(),
            commonName: cert.subject.getField('CN')?.value || 'Unknown',
            validFrom: cert.validity.notBefore.toISOString(),
            validTo: cert.validity.notAfter.toISOString(),
            serialNumber: cert.serialNumber
        };

        console.log('[CertManager] ✓ Certificate info retrieved:', {
            commonName: info.commonName,
            validTo: info.validTo,
            installed: info.installed
        });

        return info;
    } catch (error: any) {
        console.error('[CertManager] ✗ Failed to get certificate info:', error.message);
        return null;
    }
}

/**
 * Delete CA certificate files
 */
export function deleteCertificate(): boolean {
    console.log('[CertManager] Starting certificate file deletion...');

    try {
        let deletedCount = 0;

        if (fs.existsSync(CA_KEY_PATH)) {
            console.log('[CertManager] Deleting CA private key:', CA_KEY_PATH);
            fs.unlinkSync(CA_KEY_PATH);
            console.log('[CertManager] ✓ CA private key deleted');
            deletedCount++;
        } else {
            console.log('[CertManager] CA private key not found (already deleted or never created)');
        }

        if (fs.existsSync(CA_CERT_PATH)) {
            console.log('[CertManager] Deleting CA certificate:', CA_CERT_PATH);
            fs.unlinkSync(CA_CERT_PATH);
            console.log('[CertManager] ✓ CA certificate deleted');
            deletedCount++;
        } else {
            console.log('[CertManager] CA certificate not found (already deleted or never created)');
        }

        console.log(`[CertManager] ✓ Certificate deletion completed (${deletedCount} file(s) deleted)`);
        return true;
    } catch (error: any) {
        console.error('[CertManager] ✗ Failed to delete certificate files:', error.message);
        return false;
    }
}
