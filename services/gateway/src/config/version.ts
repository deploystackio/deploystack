import * as fs from 'fs';
import * as path from 'path';

export interface VersionInfo {
  version: string;
  buildTime: string;
  source: string;
}

// This will be replaced by the build script
let versionData: VersionInfo = {
  version: '0.3.0',
  buildTime: '2025-07-27T20:35:19.046Z',
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

export const getGatewayVersion = (): VersionInfo => {
  return {
    version: versionData.version || '0.1.0',
    buildTime: versionData.buildTime,
    source: versionData.source
  };
};

export const getVersionString = (): string => {
  return getGatewayVersion().version;
};
