import * as fs from 'fs';
import * as path from 'path';

export interface VersionInfo {
  version: string;
  buildTime: string;
  source: string;
}

// This will be replaced by the build script
let versionData: VersionInfo = {
  version: '0.37.0',
  buildTime: '2025-10-17T22:20:23.126Z',
  source: 'release'
};

// Try to read from package.json as fallback for development
try {
  const packageJsonPath = path.join(__dirname, '../../package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    versionData = {
      version: packageJson.version || '0.1.0',
      buildTime: new Date().toISOString(),
      source: 'package.json'
    };
  }
} catch {
  // Use static fallback if package.json can't be read
}

export const getBackendVersion = (): VersionInfo => {
  return {
    version: versionData.version || '0.1.0',
    buildTime: versionData.buildTime,
    source: versionData.source
  };
};

export const getVersionString = (): string => {
  return getBackendVersion().version;
};
