import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { displayStartupBanner } from '../../../src/utils/banner';

// Helper function to strip ANSI color codes from strings
const stripAnsiCodes = (str: string): string => {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
};

describe('banner.ts', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Spy on console.log to capture output
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    // Store original environment variables
    originalEnv = { ...process.env };
    
    // Clear console log spy calls from previous tests
    consoleLogSpy.mockClear();
  });

  afterEach(() => {
    // Restore console.log
    consoleLogSpy.mockRestore();
    
    // Restore original environment variables
    process.env = originalEnv;
  });

  describe('displayStartupBanner', () => {
    it('should call console.log with banner content', () => {
      const testPort = 3000;
      
      displayStartupBanner(testPort);
      
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const bannerOutput = consoleLogSpy.mock.calls[0][0] as string;
      expect(typeof bannerOutput).toBe('string');
      expect(bannerOutput.length).toBeGreaterThan(0);
    });

    it('should include the port number in the banner', () => {
      const testPort = 4000;
      
      displayStartupBanner(testPort);
      
      const bannerOutput = consoleLogSpy.mock.calls[0][0] as string;
      expect(bannerOutput).toContain('4000');
      expect(bannerOutput).toContain('Running on port');
    });

    it('should include DEPLOYSTACK ASCII art', () => {
      const testPort = 3000;
      
      displayStartupBanner(testPort);
      
      const bannerOutput = consoleLogSpy.mock.calls[0][0] as string;
      // Check for parts of the ASCII art
      expect(bannerOutput).toContain('██████╗ ███████╗██████╗ ██╗      ██████╗ ██╗   ██╗███████╗████████╗ █████╗  ██████╗██╗  ██╗');
      expect(bannerOutput).toContain('DeployStack CI/CD Backend');
    });

    it('should include ANSI color codes', () => {
      const testPort = 3000;
      
      displayStartupBanner(testPort);
      
      const bannerOutput = consoleLogSpy.mock.calls[0][0] as string;
      // Check for ANSI color codes
      expect(bannerOutput).toContain('\x1b[38;5;51m'); // Cyan color
      expect(bannerOutput).toContain('\x1b[38;5;93m'); // Purple color
      expect(bannerOutput).toContain('\x1b[38;5;82m'); // Green color
      expect(bannerOutput).toContain('\x1b[38;5;196m'); // Red color
      expect(bannerOutput).toContain('\x1b[0m'); // Reset color
    });

    it('should use DEPLOYSTACK_BACKEND_VERSION when available', () => {
      process.env.DEPLOYSTACK_BACKEND_VERSION = '1.2.3';
      const testPort = 3000;
      
      displayStartupBanner(testPort);
      
      const bannerOutput = consoleLogSpy.mock.calls[0][0] as string;
      expect(bannerOutput).toContain('v1.2.3');
      expect(bannerOutput).toContain('DeployStack CI/CD Backend');
    });

    it('should fallback to npm_package_version when DEPLOYSTACK_BACKEND_VERSION is not set', () => {
      delete process.env.DEPLOYSTACK_BACKEND_VERSION;
      process.env.npm_package_version = '2.1.0';
      const testPort = 3000;
      
      displayStartupBanner(testPort);
      
      const bannerOutput = consoleLogSpy.mock.calls[0][0] as string;
      expect(bannerOutput).toContain('v2.1.0');
    });

    it('should use default version when no version environment variables are set', () => {
      delete process.env.DEPLOYSTACK_BACKEND_VERSION;
      delete process.env.npm_package_version;
      const testPort = 3000;
      
      displayStartupBanner(testPort);
      
      const bannerOutput = consoleLogSpy.mock.calls[0][0] as string;
      expect(bannerOutput).toContain('v0.1.0');
    });

    it('should display current NODE_ENV', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      const testPort = 3000;
      
      displayStartupBanner(testPort);
      
      const bannerOutput = consoleLogSpy.mock.calls[0][0] as string;
      const cleanOutput = stripAnsiCodes(bannerOutput);
      expect(cleanOutput).toContain('Environment: production');
      
      // Restore original NODE_ENV
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should display development as default environment when NODE_ENV is not set', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      delete process.env.NODE_ENV;
      const testPort = 3000;
      
      displayStartupBanner(testPort);
      
      const bannerOutput = consoleLogSpy.mock.calls[0][0] as string;
      const cleanOutput = stripAnsiCodes(bannerOutput);
      expect(cleanOutput).toContain('Environment: development');
      
      // Restore original NODE_ENV
      if (originalNodeEnv !== undefined) {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });

    it('should handle different port numbers correctly', () => {
      const testCases = [80, 443, 3000, 8080, 65535];
      
      testCases.forEach((port) => {
        consoleLogSpy.mockClear();
        displayStartupBanner(port);
        
        const bannerOutput = consoleLogSpy.mock.calls[0][0] as string;
        const cleanOutput = stripAnsiCodes(bannerOutput);
        expect(cleanOutput).toContain(`Running on port ${port}`);
      });
    });

    it('should include all required banner sections', () => {
      const testPort = 3000;
      
      displayStartupBanner(testPort);
      
      const bannerOutput = consoleLogSpy.mock.calls[0][0] as string;
      
      // Check for banner structure elements
      expect(bannerOutput).toContain('╔═══'); // Top border
      expect(bannerOutput).toContain('╚═══'); // Bottom border
      expect(bannerOutput).toContain('║'); // Side borders
      expect(bannerOutput).toContain('DeployStack CI/CD Backend');
      expect(bannerOutput).toContain('Running on port');
      expect(bannerOutput).toContain('Environment:');
    });

    it('should handle edge case with port 0', () => {
      const testPort = 0;
      
      displayStartupBanner(testPort);
      
      const bannerOutput = consoleLogSpy.mock.calls[0][0] as string;
      const cleanOutput = stripAnsiCodes(bannerOutput);
      expect(cleanOutput).toContain('Running on port 0');
    });

    it('should handle very large port numbers', () => {
      const testPort = 65535;
      
      displayStartupBanner(testPort);
      
      const bannerOutput = consoleLogSpy.mock.calls[0][0] as string;
      const cleanOutput = stripAnsiCodes(bannerOutput);
      expect(cleanOutput).toContain('Running on port 65535');
    });

    it('should maintain consistent banner format across different environments', () => {
      const environments = ['development', 'production', 'test', 'staging'];
      const testPort = 3000;
      const originalNodeEnv = process.env.NODE_ENV;
      
      environments.forEach((env) => {
        consoleLogSpy.mockClear();
        process.env.NODE_ENV = env;
        
        displayStartupBanner(testPort);
        
        const bannerOutput = consoleLogSpy.mock.calls[0][0] as string;
        const cleanOutput = stripAnsiCodes(bannerOutput);
        expect(cleanOutput).toContain(`Environment: ${env}`);
        expect(bannerOutput).toContain('╔═══'); // Ensure banner structure is consistent
        expect(bannerOutput).toContain('╚═══');
      });
      
      // Restore original NODE_ENV
      if (originalNodeEnv !== undefined) {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });

    it('should handle empty string environment variables gracefully', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      const originalBackendVersion = process.env.DEPLOYSTACK_BACKEND_VERSION;
      const originalNpmVersion = process.env.npm_package_version;
      
      process.env.DEPLOYSTACK_BACKEND_VERSION = '';
      process.env.npm_package_version = '';
      process.env.NODE_ENV = '';
      const testPort = 3000;
      
      displayStartupBanner(testPort);
      
      const bannerOutput = consoleLogSpy.mock.calls[0][0] as string;
      const cleanOutput = stripAnsiCodes(bannerOutput);
      expect(cleanOutput).toContain('v0.1.0'); // Should fallback to default
      expect(cleanOutput).toContain('Environment: development'); // Should fallback to default
      
      // Restore original environment variables
      if (originalNodeEnv !== undefined) {
        process.env.NODE_ENV = originalNodeEnv;
      }
      if (originalBackendVersion !== undefined) {
        process.env.DEPLOYSTACK_BACKEND_VERSION = originalBackendVersion;
      }
      if (originalNpmVersion !== undefined) {
        process.env.npm_package_version = originalNpmVersion;
      }
    });

    it('should prioritize DEPLOYSTACK_BACKEND_VERSION over npm_package_version', () => {
      process.env.DEPLOYSTACK_BACKEND_VERSION = '5.0.0';
      process.env.npm_package_version = '4.0.0';
      const testPort = 3000;
      
      displayStartupBanner(testPort);
      
      const bannerOutput = consoleLogSpy.mock.calls[0][0] as string;
      expect(bannerOutput).toContain('v5.0.0');
      expect(bannerOutput).not.toContain('v4.0.0');
    });
  });
});
