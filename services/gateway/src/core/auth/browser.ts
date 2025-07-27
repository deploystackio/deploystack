import open from 'open';
import chalk from 'chalk';
import { AuthError, AuthenticationError } from '../../types/auth';

export class BrowserManager {
  /**
   * Open the default browser to the specified URL
   * @param url URL to open
   * @throws AuthenticationError if browser opening fails
   */
  async openBrowser(url: string): Promise<void> {
    try {
      await open(url, { wait: false });
    } catch (error) {
      throw new AuthenticationError(
        AuthError.BROWSER_ERROR,
        'Failed to open browser automatically',
        error as Error
      );
    }
  }

  /**
   * Display URL for manual opening when automatic browser opening fails
   * @param url URL to display
   */
  displayUrlForManualOpening(url: string): void {
    console.log(chalk.yellow('⚠️  Could not open browser automatically'));
    console.log(chalk.cyan('📋 Please open this URL manually in your browser:'));
    console.log(chalk.underline.blue(url));
    console.log();
  }

  /**
   * Check if we're in a headless environment
   * @returns true if running in headless environment
   */
  isHeadless(): boolean {
    // Check common headless environment indicators
    return (
      process.env.CI === 'true' ||
      process.env.HEADLESS === 'true' ||
      !process.env.DISPLAY && process.platform === 'linux' ||
      process.env.SSH_CLIENT !== undefined ||
      process.env.SSH_TTY !== undefined
    );
  }

  /**
   * Attempt to open browser with fallback to manual URL display
   * @param url URL to open
   * @param skipBrowser Skip automatic browser opening
   */
  async openBrowserWithFallback(url: string, skipBrowser: boolean = false): Promise<void> {
    if (skipBrowser || this.isHeadless()) {
      this.displayUrlForManualOpening(url);
      return;
    }

    try {
      await this.openBrowser(url);
      console.log(chalk.green('🌐 Opened browser to authorization page'));
    } catch (error) {
      this.displayUrlForManualOpening(url);
    }
  }
}
