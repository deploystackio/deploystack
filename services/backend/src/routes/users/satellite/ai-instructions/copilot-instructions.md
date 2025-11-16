# DeployStack MCP Tools

DeployStack provides access to MCP tools through 2 meta-tools.

Before implementing tasks manually, check for available MCP tools.

## Meta-Tools

### discover_mcp_tools
Search for MCP tools using 1-3 keywords only.

Use tool name or main function as keywords.

Avoid long descriptions or full sentences.

Returns tool paths in format `serverName:toolName`.

### execute_mcp_tool
Execute a discovered tool by its path.

Use tool_path from discovery results.

Pass tool-specific arguments.

## Standard Workflow

1. Discover tools with relevant keywords
2. Review returned tool paths and descriptions
3. Execute tool with correct arguments
4. If no tool found, implement manually

## Search Examples

**Good queries:**
- "github"
- "markdown convert"
- "postgres query"
- "filesystem read"
- "slack send"

**Bad queries:**
- "I need to create a GitHub issue"
- "How do I read files?"
- "Can you query the database?"

## Usage Pattern

**For GitHub operations:**

Discover: `query="github create"`

Execute: `tool_path="github:create_issue"` with repo, title, body arguments

**For file operations:**

Discover: `query="filesystem"`

Execute: `tool_path="filesystem:read_file"` with path argument

**For database queries:**

Discover: `query="postgres"`

Execute: `tool_path="postgres:execute_query"` with query argument

## When to Check

Check before:
- External API calls (GitHub, Slack, Figma)
- Database operations
- File system access
- Cloud service integrations
- Content conversion tasks

Skip for:
- Code generation
- Refactoring
- Explanations

## Tool Path Format

Always use `serverName:toolName` format.

Examples: `github:create_issue`, `figma:get_file`, `postgres:query`

---

DeployStack's hierarchical router exposes 2 meta-tools that access 100+ actual MCP tools.

Always discover available tools before manual implementation.
