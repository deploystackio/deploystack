# DeployStack MCP Integration

## Overview
You have access to MCP (Model Context Protocol) tools through DeployStack's hierarchical router. Before attempting tasks manually, always check if a relevant MCP tool is available.

## Available Meta-Tools

DeployStack exposes **2 meta-tools** that provide access to all installed MCP servers:

### 1. discover_mcp_tools
**Purpose:** Search for available MCP tools using short keywords

**Usage:**
- Use 1-3 keywords only (e.g., "github", "markdown", "database postgres")
- Avoid full sentences or long descriptions
- Returns tool paths in format `serverName:toolName`

**Examples:**
- Search for GitHub tools: `query: "github"`
- Search for file operations: `query: "filesystem"`
- Search for database tools: `query: "postgres query"`

### 2. execute_mcp_tool
**Purpose:** Execute a discovered tool by its path

**Usage:**
- Use `tool_path` from discovery results (format: `serverName:toolName`)
- Pass tool-specific arguments as `arguments` object
- Check tool description from discovery for argument schema

## Workflow

**Before starting any task, follow this pattern:**

1. **Discover Available Tools**
   ```
   Use discover_mcp_tools with relevant keywords
   Example: query="github" to find GitHub-related tools
   ```

2. **Review Results**
   ```
   Check returned tool paths and descriptions
   Verify a tool matches your task
   ```

3. **Execute Tool**
   ```
   Use execute_mcp_tool with:
   - tool_path from discovery (e.g., "github:create_issue")
   - arguments specific to that tool
   ```

4. **Fallback to Manual**
   ```
   If no suitable tool found, proceed with manual implementation
   ```

## Search Best Practices

**Good Queries (1-3 keywords):**
- "github"
- "markdown convert"
- "database postgres"
- "slack send"
- "figma design"

**Bad Queries (too verbose):**
- ❌ "I need to create an issue in GitHub repository"
- ❌ "How do I read files from the filesystem?"
- ❌ "Can you help me query the database?"

**Use the tool name or main function as keywords.**

## When to Check for MCP Tools

**Always check before:**
- External API integrations (GitHub, Slack, Figma, etc.)
- Database operations (PostgreSQL, MySQL, MongoDB, etc.)
- File system operations
- Content conversion (Markdown, PDF, etc.)
- Cloud service operations (AWS, GCP, Azure, etc.)

**Skip for:**
- Pure code generation tasks
- Architecture discussions
- Explaining concepts
- Refactoring existing code

## Important Notes

1. **Keyword-Based Search:** Use short, specific keywords - not full sentences
2. **Tool Path Format:** Always use `serverName:toolName` (e.g., `github:create_issue`)
3. **Check First:** Before manual implementation, always discover available tools
4. **Tool-Specific Args:** Check tool description from discovery for argument schema
5. **Fallback Strategy:** If no tool found or tool fails, proceed with manual approach

---

**Remember:** DeployStack's hierarchical router means you only see 2 meta-tools, but they provide access to 100+ actual MCP tools. Always discover before implementing manually.
