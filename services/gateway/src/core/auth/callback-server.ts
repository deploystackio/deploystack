import { createServer, IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import chalk from 'chalk';
import { AuthError, AuthenticationError, OAuthCallbackResult } from '../../types/auth';

export class CallbackServer {
  private server: ReturnType<typeof createServer> | null = null;
  private port = 8976;
  private callbackPath = '/oauth/callback';

  /**
   * Start the callback server and return a promise that resolves with the OAuth callback result
   * @param timeout Timeout in milliseconds
   * @returns Promise that resolves with OAuth callback data
   */
  async start(timeout: number): Promise<OAuthCallbackResult> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.stop();
        reject(new AuthenticationError(
          AuthError.TIMEOUT,
          'OAuth callback timeout - no response received within the specified time'
        ));
      }, timeout);

      this.server = createServer((req, res) => {
        try {
          const result = this.handleRequest(req, res);
          if (result) {
            clearTimeout(timeoutId);
            resolve(result);
          }
        } catch (error) {
          clearTimeout(timeoutId);
          reject(error);
        }
      });

      this.server.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(new AuthenticationError(
          AuthError.NETWORK_ERROR,
          `Failed to start callback server: ${error.message}`,
          error
        ));
      });

      this.server.listen(this.port, 'localhost', () => {
        console.log(chalk.gray(`🔗 Callback server listening on http://localhost:${this.port}${this.callbackPath}`));
      });
    });
  }

  /**
   * Stop the callback server
   */
  async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => {
          this.server = null;
          resolve();
        });
      });
    }
  }

  /**
   * Handle incoming HTTP requests
   * @param req Incoming request
   * @param res Server response
   * @returns OAuth callback result if this is a callback request
   */
  private handleRequest(req: IncomingMessage, res: ServerResponse): OAuthCallbackResult | null {
    const url = new URL(req.url!, `http://localhost:${this.port}`);

    // Only handle callback path
    if (url.pathname !== this.callbackPath) {
      this.send404(res);
      return null;
    }

    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');

    if (error) {
      this.sendErrorPage(res, error, errorDescription);
      return {
        code: '',
        state: state || '',
        error,
        error_description: errorDescription || undefined
      };
    }

    if (!code || !state) {
      this.sendErrorPage(res, 'invalid_request', 'Missing required parameters');
      throw new AuthenticationError(
        AuthError.INVALID_GRANT,
        'OAuth callback missing required parameters (code or state)'
      );
    }

    this.sendSuccessPage(res);
    return { code, state };
  }

  /**
   * Send success page to user
   */
  private sendSuccessPage(res: ServerResponse): void {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>DeployStack Gateway - Authentication Successful</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px; background: #f5f5f5; }
        .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; }
        .success { color: #22c55e; font-size: 48px; margin-bottom: 20px; }
        h1 { color: #1f2937; margin-bottom: 16px; }
        p { color: #6b7280; line-height: 1.6; margin-bottom: 24px; }
        .close-btn { background: #3b82f6; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 16px; }
        .close-btn:hover { background: #2563eb; }
    </style>
</head>
<body>
    <div class="container">
        <div class="success">✅</div>
        <h1>Authentication Successful!</h1>
        <p>You have successfully authenticated with DeployStack. You can now close this window and return to your terminal.</p>
        <button class="close-btn" onclick="window.close()">Close Window</button>
    </div>
    <script>
        // Auto-close after 3 seconds
        setTimeout(() => {
            window.close();
        }, 3000);
    </script>
</body>
</html>`;

    res.writeHead(200, {
      'Content-Type': 'text/html',
      'Content-Length': Buffer.byteLength(html)
    });
    res.end(html);
  }

  /**
   * Send error page to user
   */
  private sendErrorPage(res: ServerResponse, error: string, description?: string | null): void {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>DeployStack Gateway - Authentication Error</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px; background: #f5f5f5; }
        .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; }
        .error { color: #ef4444; font-size: 48px; margin-bottom: 20px; }
        h1 { color: #1f2937; margin-bottom: 16px; }
        p { color: #6b7280; line-height: 1.6; margin-bottom: 24px; }
        .error-code { background: #fef2f2; color: #dc2626; padding: 8px 12px; border-radius: 4px; font-family: monospace; margin: 16px 0; }
        .close-btn { background: #6b7280; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 16px; }
        .close-btn:hover { background: #4b5563; }
    </style>
</head>
<body>
    <div class="container">
        <div class="error">❌</div>
        <h1>Authentication Failed</h1>
        <p>There was an error during the authentication process:</p>
        <div class="error-code">${error}</div>
        ${description ? `<p>${description}</p>` : ''}
        <p>Please close this window and try again from your terminal.</p>
        <button class="close-btn" onclick="window.close()">Close Window</button>
    </div>
</body>
</html>`;

    res.writeHead(400, {
      'Content-Type': 'text/html',
      'Content-Length': Buffer.byteLength(html)
    });
    res.end(html);
  }

  /**
   * Send 404 page
   */
  private send404(res: ServerResponse): void {
    const html = '<h1>404 Not Found</h1><p>This is the DeployStack Gateway OAuth callback server.</p>';
    res.writeHead(404, {
      'Content-Type': 'text/html',
      'Content-Length': Buffer.byteLength(html)
    });
    res.end(html);
  }
}
