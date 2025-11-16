# DeployStack MCP Integration Rules

## Core Principle
Before implementing any task manually, check if a relevant MCP tool is available through DeployStack.

## Available Meta-Tools

DeployStack provides 2 meta-tools for accessing all installed MCP servers:

### 1. discover_mcp_tools
Search for MCP tools using 1-3 keywords only.

Use tool name or main function as keywords.

Do not use full sentences or long descriptions.

Returns tool paths in format `serverName:toolName`.

### 2. execute_mcp_tool
Execute a discovered tool by its path.

Requires `tool_path` from discovery (format: `serverName:toolName`).

Requires `arguments` object with tool-specific parameters.

## Standard Workflow

1. Discover tools with relevant keywords
2. Review tool paths and descriptions from results
3. Execute tool with correct arguments
4. Fallback to manual implementation if no suitable tool found

## Search Query Guidelines

**Use 1-3 keywords:**
- "github"
- "markdown"
- "postgres query"
- "filesystem read"
- "slack message"

**Avoid verbose queries:**
- ❌ "I need to create an issue in GitHub"
- ❌ "How can I read files from the local system?"
- ❌ "Please help me query the PostgreSQL database"

## When to Check for MCP Tools

**Always check before:**
- External API integrations
- Database queries or operations
- File system access
- Cloud service operations
- Communication platform interactions
- Design tool integrations
- Content conversion tasks

**Skip checking for:**
- Pure code generation
- Code refactoring
- Architecture discussions
- Concept explanations
- Documentation writing

## Important Notes

The hierarchical router exposes only 2 meta-tools, but provides access to 100+ actual MCP tools.

Use keyword-based search with 1-3 words maximum.

Check tool description from discovery for argument schema.

Always discover before implementing manually.

Tool paths use colon separator: `serverName:toolName`.

Arguments must match tool-specific schema from discovery.

---

**Primary Rule:** Before manual implementation, run `discover_mcp_tools` with relevant keywords to check for available tools.
