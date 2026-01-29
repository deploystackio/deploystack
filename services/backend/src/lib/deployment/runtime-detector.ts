import type { Octokit } from '@octokit/rest';

export type Runtime = 'node' | 'python' | 'go' | 'unknown';

export interface McpSdkInfo {
  detected: boolean;
  version?: string;
  package?: string;
  runtime: Runtime;
}

export interface RuntimeDetectionResult {
  runtime: Runtime;
  mcp_sdk: McpSdkInfo;
  scripts?: Record<string, string>;  // Only for Node.js
  packageJson?: {
    name?: string;
    version?: string;
    description?: string;
    license?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
}

/**
 * Multi-language runtime detector for MCP servers
 * Supports: Node.js, Python, Go
 */
export class RuntimeDetector {
  /**
   * Detect runtime and MCP SDK from repository files
   * Tries detection in order: Node.js → Python → Go → Unknown
   */
  static async detectRuntime(
    octokit: Octokit,
    owner: string,
    repo: string,
    ref: string
  ): Promise<RuntimeDetectionResult> {
    // Try Node.js detection (package.json)
    const nodeResult = await this.detectNodeJs(octokit, owner, repo, ref);
    if (nodeResult) return nodeResult;

    // Try Python detection (requirements.txt, pyproject.toml)
    const pythonResult = await this.detectPython(octokit, owner, repo, ref);
    if (pythonResult) return pythonResult;

    // Try Go detection (go.mod)
    const goResult = await this.detectGo(octokit, owner, repo, ref);
    if (goResult) return goResult;

    return {
      runtime: 'unknown',
      mcp_sdk: { detected: false, runtime: 'unknown' }
    };
  }

  /**
   * Detect Node.js runtime by reading package.json
   */
  private static async detectNodeJs(
    octokit: Octokit,
    owner: string,
    repo: string,
    ref: string
  ): Promise<RuntimeDetectionResult | null> {
    try {
      const { data: file } = await octokit.repos.getContent({
        owner,
        repo,
        path: 'package.json',
        ref
      });

      if (!('content' in file)) return null;

      const packageJson = JSON.parse(
        Buffer.from(file.content, 'base64').toString('utf8')
      );

      // Check for Node.js MCP SDK
      const mcpSdk = packageJson.dependencies?.['@modelcontextprotocol/sdk'] ||
                     packageJson.devDependencies?.['@modelcontextprotocol/sdk'];

      return {
        runtime: 'node',
        mcp_sdk: {
          detected: !!mcpSdk,
          version: mcpSdk,
          package: '@modelcontextprotocol/sdk',
          runtime: 'node'
        },
        scripts: packageJson.scripts || {},
        packageJson
      };
    } catch {
      return null;  // package.json not found
    }
  }

  /**
   * Detect Python runtime by reading requirements.txt or pyproject.toml
   */
  private static async detectPython(
    octokit: Octokit,
    owner: string,
    repo: string,
    ref: string
  ): Promise<RuntimeDetectionResult | null> {
    // Try requirements.txt first
    try {
      const { data: file } = await octokit.repos.getContent({
        owner,
        repo,
        path: 'requirements.txt',
        ref
      });

      if ('content' in file) {
        const requirements = Buffer.from(file.content, 'base64')
          .toString('utf8')
          .split('\n');

        // Official Python MCP SDK: mcp
        const mcpLine = requirements.find(line =>
          line.trim().startsWith('mcp==') ||
          line.trim().startsWith('mcp>=') ||
          line.trim() === 'mcp'
        );

        return {
          runtime: 'python',
          mcp_sdk: {
            detected: !!mcpLine,
            version: mcpLine?.split(/==|>=/)[1]?.trim(),
            package: 'mcp',
            runtime: 'python'
          }
        };
      }
    } catch {
      // Continue to pyproject.toml
    }

    // Try pyproject.toml
    try {
      const { data: file } = await octokit.repos.getContent({
        owner,
        repo,
        path: 'pyproject.toml',
        ref
      });

      if ('content' in file) {
        const content = Buffer.from(file.content, 'base64').toString('utf8');

        // Simple check for "mcp" in dependencies
        const hasMcp = content.includes('"mcp"') || content.includes("'mcp'");

        // Try to extract version from pyproject.toml if present
        const versionMatch = content.match(/mcp\s*=\s*["']([^"']+)["']/);

        return {
          runtime: 'python',
          mcp_sdk: {
            detected: hasMcp,
            version: versionMatch?.[1],
            package: 'mcp',
            runtime: 'python'
          }
        };
      }
    } catch {
      // Continue
    }

    return null;  // No Python files found
  }

  /**
   * Detect Go runtime by reading go.mod
   */
  private static async detectGo(
    octokit: Octokit,
    owner: string,
    repo: string,
    ref: string
  ): Promise<RuntimeDetectionResult | null> {
    try {
      const { data: file } = await octokit.repos.getContent({
        owner,
        repo,
        path: 'go.mod',
        ref
      });

      if ('content' in file) {
        const goMod = Buffer.from(file.content, 'base64').toString('utf8');

        // Official Go MCP SDK: github.com/mark3labs/mcp-go
        const hasMcp = goMod.includes('github.com/mark3labs/mcp-go');

        // Try to extract version if present
        const versionMatch = goMod.match(/github\.com\/mark3labs\/mcp-go\s+v([^\s]+)/);

        return {
          runtime: 'go',
          mcp_sdk: {
            detected: hasMcp,
            version: versionMatch?.[1],
            package: 'github.com/mark3labs/mcp-go',
            runtime: 'go'
          }
        };
      }
    } catch {
      // go.mod not found
    }

    return null;
  }
}
