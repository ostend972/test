/**
 * Tests de sécurité pour valider les corrections
 * Protection contre injection de commandes, path traversal, et validation IPC
 */

const { validateIpc, validators } = require('../ipc-validator');
const { validateFilePath, validateFilePathForRead, validateFilePathForWrite } = require('../path-validator');

describe('Security - IPC Validation', () => {
  describe('Domain Validator', () => {
    test('should accept valid domain names', () => {
      expect(validators.domain('google.com')).toBe('google.com');
      expect(validators.domain('sub.example.org')).toBe('sub.example.org');
      expect(validators.domain('test-site.co.uk')).toBe('test-site.co.uk');
    });

    test('should reject invalid domain names', () => {
      expect(() => validators.domain('not a domain')).toThrow('Invalid domain format');
      expect(() => validators.domain('http://example.com')).toThrow('Invalid domain format');
      expect(() => validators.domain('../etc/passwd')).toThrow('Invalid domain format');
      expect(() => validators.domain('a'.repeat(300))).toThrow('Domain length must be between');
    });

    test('should reject injection attempts in domains', () => {
      expect(() => validators.domain('evil.com"; rm -rf /')).toThrow();
      expect(() => validators.domain('evil.com && calc.exe')).toThrow();
      expect(() => validators.domain('<script>alert(1)</script>')).toThrow();
    });

    test('should reject non-string inputs', () => {
      expect(() => validators.domain(null)).toThrow('Domain must be a string');
      expect(() => validators.domain(undefined)).toThrow('Domain must be a string');
      expect(() => validators.domain(123)).toThrow('Domain must be a string');
      expect(() => validators.domain({})).toThrow('Domain must be a string');
    });
  });

  describe('Config Validator', () => {
    test('should accept valid configuration', () => {
      const validConfig = {
        protectionEnabled: true,
        proxyHost: '127.0.0.1',
        proxyPort: 8081,
        blockRemoteDesktop: false
      };

      const result = validators.config(validConfig);
      expect(result.protectionEnabled).toBe(true);
      expect(result.proxyHost).toBe('127.0.0.1');
      expect(result.proxyPort).toBe(8081);
    });

    test('should reject invalid proxy host', () => {
      const invalidConfig = {
        proxyHost: '192.168.1.1' // Pas localhost
      };

      expect(() => validators.config(invalidConfig)).toThrow('proxyHost must be 127.0.0.1');
    });

    test('should reject invalid port ranges', () => {
      expect(() => validators.config({ proxyPort: 80 })).toThrow('proxyPort must be between 1024 and 65535');
      expect(() => validators.config({ proxyPort: 70000 })).toThrow('proxyPort must be between 1024 and 65535');
      expect(() => validators.config({ proxyPort: -1 })).toThrow('proxyPort must be between 1024 and 65535');
    });

    test('should reject unknown config keys', () => {
      const configWithUnknownKey = {
        protectionEnabled: true,
        maliciousKey: 'injection attempt'
      };

      expect(() => validators.config(configWithUnknownKey)).toThrow('Unknown config key');
    });

    test('should reject wrong types', () => {
      expect(() => validators.config({ protectionEnabled: 'true' })).toThrow('must be a boolean');
      expect(() => validators.config({ proxyPort: '8081' })).toThrow('must be between');
    });
  });

  describe('CSV Content Validator', () => {
    test('should accept valid CSV content', () => {
      const validCSV = 'id,domain,ip\n1,example.com,1.2.3.4\n2,test.com,5.6.7.8';
      const result = validators.csvContent(validCSV);
      expect(result).toBe(validCSV);
    });

    test('should reject oversized CSV content', () => {
      const hugeCSV = 'x'.repeat(11 * 1024 * 1024); // 11 MB
      expect(() => validators.csvContent(hugeCSV)).toThrow('CSV content too large');
    });

    test('should reject CSV with too many lines', () => {
      const tooManyLines = Array(100001).fill('line').join('\n');
      expect(() => validators.csvContent(tooManyLines)).toThrow('CSV has too many lines');
    });

    test('should reject non-string CSV', () => {
      expect(() => validators.csvContent(null)).toThrow('CSV content must be a string');
      expect(() => validators.csvContent([])).toThrow('CSV content must be a string');
    });
  });
});

describe('Security - Path Traversal Protection', () => {
  describe('File Path Validation', () => {
    test('should reject path traversal attempts', async () => {
      await expect(validateFilePath('../../../../../../etc/passwd', null, ['.txt']))
        .rejects.toThrow();

      await expect(validateFilePath('../../../Windows/System32/config/sam', null, ['.txt']))
        .rejects.toThrow();

      await expect(validateFilePath('C:\\..\\..\\..\\Windows\\System32\\cmd.exe', null, ['.exe']))
        .rejects.toThrow();
    });

    test('should reject invalid file extensions', async () => {
      await expect(validateFilePath('test.exe', null, ['.json', '.csv']))
        .rejects.toThrow('Invalid file extension');

      await expect(validateFilePath('malware.bat', null, ['.json']))
        .rejects.toThrow('Invalid file extension');

      await expect(validateFilePath('script.ps1', null, ['.txt']))
        .rejects.toThrow('Invalid file extension');
    });

    test('should reject dangerous characters', async () => {
      await expect(validateFilePath('file<name>.json', null, ['.json']))
        .rejects.toThrow('dangerous characters');

      await expect(validateFilePath('file|name.json', null, ['.json']))
        .rejects.toThrow('dangerous characters');

      await expect(validateFilePath('file"name".json', null, ['.json']))
        .rejects.toThrow('dangerous characters');
    });

    test('should reject too long paths', async () => {
      const longPath = 'C:\\' + 'a'.repeat(500) + '.json';
      await expect(validateFilePath(longPath, null, ['.json']))
        .rejects.toThrow('File path too long');
    });

    test('should reject non-string paths', async () => {
      await expect(validateFilePath(null, null, ['.json']))
        .rejects.toThrow('Invalid file path');

      await expect(validateFilePath(undefined, null, ['.json']))
        .rejects.toThrow('Invalid file path');

      await expect(validateFilePath(123, null, ['.json']))
        .rejects.toThrow('Invalid file path');
    });

    test('should accept valid file paths', async () => {
      const validPath = 'C:\\Users\\Test\\Documents\\config.json';
      const result = await validateFilePath(validPath, null, ['.json']);
      expect(result).toContain('config.json');
    });
  });
});

describe('Security - IPC Handler Wrapper', () => {
  test('should validate inputs before calling handler', async () => {
    const mockHandler = jest.fn().mockResolvedValue({ success: true });
    const wrappedHandler = validateIpc(
      { domain: 'domain' },
      mockHandler
    );

    const mockEvent = {};
    await wrappedHandler(mockEvent, { domain: 'example.com' });

    expect(mockHandler).toHaveBeenCalledWith(
      mockEvent,
      { domain: 'example.com' }
    );
  });

  test('should reject invalid inputs before calling handler', async () => {
    const mockHandler = jest.fn();
    const wrappedHandler = validateIpc(
      { domain: 'domain' },
      mockHandler
    );

    const mockEvent = {};

    await expect(wrappedHandler(mockEvent, { domain: 'invalid domain!' }))
      .rejects.toThrow('Validation failed');

    // Handler ne devrait jamais être appelé
    expect(mockHandler).not.toHaveBeenCalled();
  });

  test('should handle missing required parameters', async () => {
    const mockHandler = jest.fn();
    const wrappedHandler = validateIpc(
      { domain: 'domain' },
      mockHandler
    );

    const mockEvent = {};

    await expect(wrappedHandler(mockEvent, {}))
      .rejects.toThrow('Missing required parameter');

    expect(mockHandler).not.toHaveBeenCalled();
  });

  test('should allow optional parameters', async () => {
    const mockHandler = jest.fn().mockResolvedValue({ success: true });
    const wrappedHandler = validateIpc(
      { domain: 'domain', optional: 'string?' },
      mockHandler
    );

    const mockEvent = {};
    await wrappedHandler(mockEvent, { domain: 'example.com' });

    expect(mockHandler).toHaveBeenCalled();
  });
});

describe('Security - DoS Protection', () => {
  test('should limit CSV content size', () => {
    const hugeCsv = 'x'.repeat(15 * 1024 * 1024); // 15 MB
    expect(() => validators.csvContent(hugeCsv)).toThrow('CSV content too large');
  });

  test('should limit CSV line count', () => {
    const tooManyLines = Array(150000).fill('line').join('\n');
    expect(() => validators.csvContent(tooManyLines)).toThrow('CSV has too many lines');
  });

  test('should limit domain length', () => {
    const longDomain = 'a'.repeat(300) + '.com';
    expect(() => validators.domain(longDomain)).toThrow('Domain length must be between');
  });

  test('should limit string lengths', () => {
    const longString = 'a'.repeat(2000);
    expect(() => validators.string(longString, 1000)).toThrow('String too long');
  });
});
