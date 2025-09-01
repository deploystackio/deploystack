import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';
import chalk from 'chalk';

export interface VersionInfo {
  version: string;
  buildTime: string;
  source: string;
}

export interface VersionCheckResult {
  currentVersion: string;
  latestVersion: string;
  isUpdateAvailable: boolean;
  updateMessage?: string;
}

// This will be replaced by the build script
let versionData: VersionInfo = {
  version: '0.9.4',
  buildTime: '2025-09-01T09:15:37.430Z',
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

/**
 * Check if a newer version is available on npm (with optional debug output)
 * @param timeout - Request timeout in milliseconds (default: 5000)
 * @param debug - Show debug information about the API call
 * @returns Promise<VersionCheckResult>
 */
export const checkForUpdates = async (timeout: number = 5000, debug: boolean = false): Promise<VersionCheckResult> => {
  const currentVersion = getVersionString();
  
  if (debug) {
    console.log(chalk.blue('🔍 Debug: Starting version check...'));
    console.log(chalk.gray(`   Current version: ${currentVersion}`));
    console.log(chalk.gray(`   Timeout: ${timeout}ms`));
    console.log(chalk.gray(`   API endpoint: https://registry.npmjs.org/@deploystack/gateway`));
  }
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    if (debug) {
      console.log(chalk.blue('🌐 Debug: Fetching from npm registry...'));
    }
    
    // Use the correct npm registry API endpoint
    const response = await fetch('https://registry.npmjs.org/@deploystack/gateway', {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': `@deploystack/gateway/${currentVersion}`
      }
    });
    
    clearTimeout(timeoutId);
    
    if (debug) {
      console.log(chalk.blue(`📊 Debug: Response status: ${response.status} ${response.statusText}`));
    }
    
    if (!response.ok) {
      if (debug) {
        console.log(chalk.red(`❌ Debug: HTTP error ${response.status}`));
      }
      return {
        currentVersion,
        latestVersion: currentVersion,
        isUpdateAvailable: false,
        updateMessage: `Failed to check for updates (HTTP ${response.status})`
      };
    }
    
    const data = await response.json() as {
      name?: string;
      'dist-tags': { latest: string };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      versions: { [key: string]: any };
      description?: string;
      time?: { modified: string };
    };
    
    if (debug) {
      console.log(chalk.blue('📊 Debug: Parsed npm response'));
      console.log(chalk.gray(`   Package name: ${data.name || 'N/A'}`));
      console.log(chalk.gray(`   Latest tag: ${data['dist-tags']?.latest || 'N/A'}`));
      console.log(chalk.gray(`   Available tags: ${Object.keys(data['dist-tags'] || {}).join(', ')}`));
      console.log(chalk.gray(`   Total versions: ${Object.keys(data.versions || {}).length}`));
    }
    
    const latestVersion = data['dist-tags'].latest;
    
    if (!latestVersion) {
      return {
        currentVersion,
        latestVersion: currentVersion,
        isUpdateAvailable: false,
        updateMessage: 'Could not determine latest version from npm'
      };
    }
    
    const isUpdateAvailable = compareVersions(currentVersion, latestVersion) < 0;
    
    if (debug) {
      console.log(chalk.blue('🔍 Debug: Version comparison'));
      console.log(chalk.gray(`   Current: ${currentVersion}`));
      console.log(chalk.gray(`   Latest:  ${latestVersion}`));
      console.log(chalk.gray(`   Update available: ${isUpdateAvailable}`));
      console.log(chalk.gray(`   Comparison result: ${compareVersions(currentVersion, latestVersion)}`));
    }
    
    return {
      currentVersion,
      latestVersion,
      isUpdateAvailable,
      updateMessage: isUpdateAvailable 
        ? `Update available! Run: ${chalk.cyan('npm install -g @deploystack/gateway@latest')}`
        : undefined
    };
    
  } catch (error) {
    // Handle timeout or network errors gracefully
    const errorMessage = error instanceof Error && error.name === 'AbortError' 
      ? 'Request timed out'
      : error instanceof Error ? error.message : 'Network error';
    
    if (debug) {
      console.log(chalk.red('❌ Debug: Error occurred'));
      console.log(chalk.gray(`   Error name: ${error instanceof Error ? error.name : 'Unknown'}`));
      console.log(chalk.gray(`   Error message: ${errorMessage}`));
      if (error instanceof Error && error.stack) {
        console.log(chalk.gray(`   Stack trace: ${error.stack.split('\n')[0]}`));
      }
    }
      
    return {
      currentVersion,
      latestVersion: currentVersion,
      isUpdateAvailable: false,
      updateMessage: `Could not check for updates (${errorMessage})`
    };
  }
};

/**
 * Compare two semantic version strings
 * @param current - Current version (e.g., "1.2.3")
 * @param latest - Latest version (e.g., "1.3.0")
 * @returns -1 if current < latest, 0 if equal, 1 if current > latest
 */
function compareVersions(current: string, latest: string): number {
  // Remove 'v' prefix if present
  const cleanCurrent = current.replace(/^v/, '');
  const cleanLatest = latest.replace(/^v/, '');
  
  // Parse version parts
  const parseVersion = (version: string) => {
    const [versionPart, preReleasePart] = version.split('-');
    const numbers = versionPart.split('.').map(part => parseInt(part, 10) || 0);
    return {
      numbers,
      isPreRelease: !!preReleasePart,
      preRelease: preReleasePart || ''
    };
  };
  
  const currentVersion = parseVersion(cleanCurrent);
  const latestVersion = parseVersion(cleanLatest);
  
  // Ensure both arrays have the same length
  const maxLength = Math.max(currentVersion.numbers.length, latestVersion.numbers.length);
  while (currentVersion.numbers.length < maxLength) currentVersion.numbers.push(0);
  while (latestVersion.numbers.length < maxLength) latestVersion.numbers.push(0);
  
  // Compare version numbers first
  for (let i = 0; i < maxLength; i++) {
    if (currentVersion.numbers[i] < latestVersion.numbers[i]) return -1;
    if (currentVersion.numbers[i] > latestVersion.numbers[i]) return 1;
  }
  
  // If version numbers are equal, handle pre-release logic
  // Pre-release versions are considered lower than stable versions
  if (currentVersion.isPreRelease && !latestVersion.isPreRelease) {
    return -1; // current is pre-release, latest is stable
  }
  if (!currentVersion.isPreRelease && latestVersion.isPreRelease) {
    return 1; // current is stable, latest is pre-release
  }
  
  // Both are pre-release or both are stable with same version numbers
  if (currentVersion.isPreRelease && latestVersion.isPreRelease) {
    // Compare pre-release identifiers lexicographically
    return currentVersion.preRelease.localeCompare(latestVersion.preRelease);
  }
  
  return 0;
}

/**
 * Display version information with update check
 * @param skipUpdateCheck - Skip the update check (useful for offline scenarios)
 * @param debug - Show debug information about the API call
 */
export const displayVersionInfo = async (skipUpdateCheck: boolean = false, debug: boolean = false): Promise<void> => {
  const versionInfo = getGatewayVersion();
  
  console.log(`${chalk.bold('DeployStack Gateway')} v${chalk.green(versionInfo.version)}`);
  console.log(`Built: ${chalk.gray(new Date(versionInfo.buildTime).toLocaleString())}`);
  console.log(`Source: ${chalk.gray(versionInfo.source)}`);
  
  if (!skipUpdateCheck) {
    console.log(); // Empty line
    console.log(chalk.gray('Checking npm registry for updates...'));
    
    try {
      const updateCheck = await checkForUpdates(5000, debug);
      
      if (updateCheck.isUpdateAvailable) {
        console.log();
        console.log(chalk.yellow('📦 Update Available!'));
        console.log(`   Current: ${chalk.red(updateCheck.currentVersion)}`);
        console.log(`   Latest:  ${chalk.green(updateCheck.latestVersion)}`);
        console.log(`   Package: ${chalk.blue('https://www.npmjs.com/package/@deploystack/gateway')}`);
        if (updateCheck.updateMessage) {
          console.log(`   ${updateCheck.updateMessage}`);
        }
      } else if (updateCheck.updateMessage && !updateCheck.isUpdateAvailable) {
        // Show error message if there was an issue checking
        console.log(chalk.gray(`ℹ️  ${updateCheck.updateMessage}`));
      } else {
        console.log(chalk.green('✅ You are running the latest version'));
      }
    } catch {
      console.log(chalk.gray('ℹ️  Could not check for updates'));
    }
  }
};
