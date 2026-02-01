/**
 * Python deployment utilities
 *
 * Extracted from github-deployment.ts to reduce file size and improve maintainability.
 * Contains pattern detection, dependency parsing, and entry point resolution for Python MCP servers.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Python entry point resolution result
 */
export interface PythonEntryPoint {
  /** Command to execute (e.g., ".venv/bin/mcp-hello-world" or ".venv/bin/python") */
  command: string;
  /** Entry point path (e.g., "" for installed scripts, "server.py" for direct execution) */
  entryPoint: string;
}

/**
 * Python installation pattern detection
 */
export enum PythonInstallPattern {
  /** Installable package with pyproject.toml + package structure → uv sync --no-dev */
  INSTALLABLE_PACKAGE = 'installable_package',
  /** Simple script with pyproject.toml but no package structure → uv venv + uv pip install deps */
  SIMPLE_SCRIPT = 'simple_script',
  /** Legacy script with requirements.txt → uv venv + uv pip install -r */
  LEGACY_REQUIREMENTS = 'legacy_requirements'
}

/**
 * Helper: Check if file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Detects if pyproject.toml represents a simple script vs installable package
 *
 * A "simple script" is a Python project with pyproject.toml that:
 * 1. Has no package structure (no src/ dir, no matching package dir), OR
 * 2. Has [build-system] but the build will fail due to missing structure
 *
 * We detect this by checking if common Python script files exist at root level
 * (server.py, main.py, app.py, __main__.py) - indicating it's meant to run directly.
 *
 * @param tempDir - Deployment directory containing pyproject.toml
 * @returns true if simple script, false if installable package
 */
export async function isPyprojectSimpleScript(tempDir: string): Promise<boolean> {
  const pyprojectPath = path.join(tempDir, 'pyproject.toml');
  try {
    const content = await fs.readFile(pyprojectPath, 'utf8');

    // Check if pyproject.toml has [build-system] section
    const hasBuildSystem = content.includes('[build-system]');

    // If no build-system, it's definitely a simple script (just dependency management)
    if (!hasBuildSystem) {
      return true;
    }

    // Has build-system - check if package structure exists
    // Look for src/ directory or package directory matching project name
    const hasSrcDir = await fileExists(path.join(tempDir, 'src'));

    // Extract package name from pyproject.toml
    const nameMatch = content.match(/^name\s*=\s*"([^"]+)"/m);
    const packageName = nameMatch ? nameMatch[1].replace(/-/g, '_') : null;
    const hasPackageDir = packageName ? await fileExists(path.join(tempDir, packageName)) : false;

    // If it has proper package structure (src/ or package dir), it's installable
    if (hasSrcDir || hasPackageDir) {
      return false;
    }

    // No package structure - check if there are standalone script files at root
    const scriptFiles = ['server.py', 'main.py', 'app.py', '__main__.py'];
    for (const scriptFile of scriptFiles) {
      if (await fileExists(path.join(tempDir, scriptFile))) {
        // Found a standalone script - treat as simple script
        return true;
      }
    }

    // Has build-system, has scripts, but no package structure and no standalone scripts
    // This will likely fail to build - treat as simple script to avoid build errors
    return true;
  } catch {
    return false;
  }
}

/**
 * Parses dependencies from pyproject.toml [project] section
 *
 * Extracts the dependencies array and returns individual dependency strings.
 * Used for simple scripts where we install dependencies directly without building the package.
 *
 * @param pyprojectPath - Absolute path to pyproject.toml file
 * @returns Array of dependency strings (e.g., ["mcp>=1.0.0", "pydantic>=2.0.0"])
 * @throws Error if file cannot be read or parsed
 */
export async function parsePyprojectDependencies(pyprojectPath: string): Promise<string[]> {
  const content = await fs.readFile(pyprojectPath, 'utf8');

  // Extract dependencies array from [project] section
  const depsMatch = content.match(/dependencies\s*=\s*\[([\s\S]*?)\]/);
  if (!depsMatch) {
    return [];
  }

  const depsContent = depsMatch[1];

  // Parse individual dependencies (handle both "pkg" and 'pkg' quotes)
  const deps = depsContent
    .split(',')
    .map(d => d.trim())
    .filter(d => d.length > 0)
    .map(d => d.replace(/^["']|["']$/g, '')); // Remove quotes

  return deps;
}

/**
 * Resolves Python entry point with 8 fallback patterns
 *
 * Priority order:
 * 1. [project.scripts] → .venv/bin/{script_name}
 * 2. [project.gui-scripts] → .venv/bin/{script_name}
 * 3. __main__.py at root → .venv/bin/python __main__.py
 * 4. src/__main__.py → .venv/bin/python src/__main__.py
 * 5. server.py → .venv/bin/python server.py
 * 6. main.py → .venv/bin/python main.py
 * 7. app.py → .venv/bin/python app.py
 * 8. run.py → .venv/bin/python run.py
 *
 * Falls back to python3 if .venv/bin/python doesn't exist.
 *
 * @param tempDir - Deployment directory
 * @param pyprojectData - Optional pre-parsed pyproject.toml data
 * @returns PythonEntryPoint with command and entryPoint, or null if not found
 */
export async function resolvePythonEntryPoint(
  tempDir: string,
  _pyprojectData?: unknown
): Promise<PythonEntryPoint | null> {
  // Try pyproject.toml first
  const pyprojectPath = path.join(tempDir, 'pyproject.toml');
  if (await fileExists(pyprojectPath)) {
    const content = await fs.readFile(pyprojectPath, 'utf8');

    // Look for [project.scripts] section
    const scriptsMatch = content.match(/\[project\.scripts\]\s*\n([^[]+)/);
    if (scriptsMatch) {
      const firstScriptMatch = scriptsMatch[1].match(/^(\w+)\s*=/m);
      if (firstScriptMatch) {
        const scriptName = firstScriptMatch[1];
        // Entry point is installed in .venv/bin/ after uv sync
        const entryPoint = path.join(tempDir, '.venv', 'bin', scriptName);
        return { command: entryPoint, entryPoint };
      }
    }

    // Look for [project.gui-scripts] as fallback
    const guiMatch = content.match(/\[project\.gui-scripts\]\s*\n([^[]+)/);
    if (guiMatch) {
      const firstScriptMatch = guiMatch[1].match(/^(\w+)\s*=/m);
      if (firstScriptMatch) {
        const scriptName = firstScriptMatch[1];
        const entryPoint = path.join(tempDir, '.venv', 'bin', scriptName);
        return { command: entryPoint, entryPoint };
      }
    }
  }

  // Fallback: look for __main__.py
  const mainPath = path.join(tempDir, '__main__.py');
  if (await fileExists(mainPath)) {
    // Use system python3 (security validated, venv packages available via working directory)
    return { command: 'python3', entryPoint: mainPath };
  }

  // Try src/__main__.py (common pattern)
  const srcMainPath = path.join(tempDir, 'src', '__main__.py');
  if (await fileExists(srcMainPath)) {
    // Use system python3 (security validated, venv packages available via working directory)
    return { command: 'python3', entryPoint: srcMainPath };
  }

  // Try common script names (server.py, main.py, app.py, run.py)
  const commonScriptNames = ['server.py', 'main.py', 'app.py', 'run.py'];
  for (const scriptName of commonScriptNames) {
    const scriptPath = path.join(tempDir, scriptName);
    if (await fileExists(scriptPath)) {
      // Use system python3 (security validated, venv packages available via working directory)
      return { command: 'python3', entryPoint: scriptPath };
    }
  }

  // No entry point found
  return null;
}

/**
 * Detects Python installation pattern for GitHub deployments
 *
 * Determines which of 3 installation methods to use:
 * 1. INSTALLABLE_PACKAGE: pyproject.toml with package structure → uv sync --no-dev
 * 2. SIMPLE_SCRIPT: pyproject.toml without package structure → uv venv + parse deps + uv pip install
 * 3. LEGACY_REQUIREMENTS: requirements.txt only → uv venv + uv pip install -r
 *
 * @param tempDir - Deployment directory
 * @returns PythonInstallPattern enum value
 * @throws Error if no dependency file found
 */
export async function detectPythonInstallationPattern(tempDir: string): Promise<PythonInstallPattern> {
  const hasPyproject = await fileExists(path.join(tempDir, 'pyproject.toml'));
  const hasRequirements = await fileExists(path.join(tempDir, 'requirements.txt'));

  if (!hasPyproject && !hasRequirements) {
    throw new Error('No pyproject.toml or requirements.txt found');
  }

  // Pattern 1: Check for installable package
  if (hasPyproject) {
    const pyprojectPath = path.join(tempDir, 'pyproject.toml');
    const content = await fs.readFile(pyprojectPath, 'utf8');

    // Check for [project.scripts] or [project.gui-scripts]
    const hasScripts = content.includes('[project.scripts]') || content.includes('[project.gui-scripts]');

    if (hasScripts) {
      // Check if it's a simple script (no package structure)
      const isSimple = await isPyprojectSimpleScript(tempDir);

      if (!isSimple) {
        // Has scripts AND package structure → installable package
        return PythonInstallPattern.INSTALLABLE_PACKAGE;
      }
    }

    // Pattern 2: Simple script with pyproject.toml
    // Has pyproject.toml but either:
    // - No scripts section, OR
    // - Has scripts but no package structure (simple script)
    const hasDependencies = content.includes('dependencies');
    if (hasDependencies) {
      return PythonInstallPattern.SIMPLE_SCRIPT;
    }
  }

  // Pattern 3: Legacy requirements.txt
  if (hasRequirements) {
    return PythonInstallPattern.LEGACY_REQUIREMENTS;
  }

  throw new Error('No valid Python installation pattern detected');
}
