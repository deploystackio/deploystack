/**
 * Runtime Detection Composable
 *
 * Detects programming language and runtime environment from command-line commands.
 * Used when parsing Claude Desktop config or analyzing MCP server configurations.
 *
 * @example
 * ```typescript
 * import { useRuntimeDetection } from '@/composables/admin/mcp-catalog'
 *
 * const { detectRuntimeFromCommand } = useRuntimeDetection()
 * const result = detectRuntimeFromCommand('uvx') // { language: 'python', runtime: 'python' }
 * ```
 */

export interface RuntimeDetection {
  language: string
  runtime: string
}

export function useRuntimeDetection() {
  /**
   * Detects runtime and language from a command string
   *
   * @param command - The command to analyze (e.g., 'uvx', 'npx', 'python3')
   * @returns RuntimeDetection object with language and runtime
   *
   * @example
   * detectRuntimeFromCommand('uvx') // { language: 'python', runtime: 'python' }
   * detectRuntimeFromCommand('npx') // { language: 'typescript', runtime: 'node' }
   */
  const detectRuntimeFromCommand = (command: string): RuntimeDetection => {
    // Normalize: lowercase, trim, extract base command from paths
    const normalizedCommand = command.toLowerCase().trim().split('/').pop() || command

    // Node.js / TypeScript ecosystem
    if (['npx', 'npm', 'node', 'bun', 'deno', 'yarn', 'pnpm'].includes(normalizedCommand)) {
      return { language: 'typescript', runtime: 'node' }
    }

    // Python ecosystem
    if (['python', 'python3', 'pip', 'pipx', 'uvx', 'uv', 'poetry', 'conda'].includes(normalizedCommand)) {
      return { language: 'python', runtime: 'python' }
    }

    // Go
    if (normalizedCommand === 'go') {
      return { language: 'go', runtime: 'go' }
    }

    // Rust
    if (normalizedCommand === 'cargo') {
      return { language: 'rust', runtime: 'rust' }
    }

    // Ruby
    if (['ruby', 'gem', 'bundle'].includes(normalizedCommand)) {
      return { language: 'ruby', runtime: 'ruby' }
    }

    // Default fallback to Node.js
    return { language: 'typescript', runtime: 'node' }
  }

  return {
    detectRuntimeFromCommand
  }
}
