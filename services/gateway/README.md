# DeployStack Gateway

The local secure gateway that connects developers to their team's MCP servers through a centralized control plane. The DeployStack Gateway acts as a smart proxy, managing MCP server processes locally while enforcing access policies from the cloud.

## 🔍 Features

- **Dual Transport Architecture**: Supports both legacy SSE transport and modern Streamable HTTP transport for maximum MCP client compatibility
- **Individual Tool Exposure**: Exposes individual MCP tools with namespacing (e.g., `brightdata-search_engine`) for direct use
- **Automatic Tool Discovery**: Discovers and caches tools from all MCP servers when switching teams
- **Fast Gateway Startup**: Instant startup using cached tools without waiting for server discovery
- **Process Management**: Runs MCP server processes as persistent background services for instant tool availability
- **Secure Credential Injection**: Injects credentials directly into MCP server processes without exposing them to developers
- **Modern SSE Endpoints**: Clean `/sse` endpoint for connections and `/message` for session-based communication
- **Team-Based Access Control**: Only exposes MCP servers that your team has access to
- **Team-Aware Caching**: Each team's tools are cached separately with complete isolation
- **Language Agnostic**: Supports MCP servers written in Node.js, Python, Go, Rust, and more
- **Automatic Update Checking**: Built-in npm version checking with smart update notifications

## 🛠️ Installation

```bash
# Installation command coming soon
npm install -g @deploystack/gateway
```

## 🚀 Usage

```bash
# Login to your DeployStack account (automatically starts the gateway)
deploystack login

# Check status
deploystack status

# Or start the gateway manually if needed
deploystack start
```

## 🧱 How It Works

1. **Login & Auto-Start**: The gateway authenticates with `cloud.deploystack.io`, downloads your team's MCP server configurations, and automatically starts the gateway server
2. **Persistent Process Startup**: All configured MCP servers launch as persistent background processes immediately after login
3. **Tool Discovery**: Automatically discovers and caches individual tools from all running MCP servers for your team
4. **SSE Connection**: VS Code connects to `/sse` endpoint and receives session information for message routing
5. **Session-Based Communication**: All JSON-RPC requests are sent to `/message` endpoint with session context
6. **Instant Tool Access**: All MCP tools are instantly available since servers run continuously in the background
7. **Credential Injection**: Securely injects API tokens and credentials into MCP server process environments at startup
8. **Tool Routing**: Routes namespaced tool calls (e.g., `brightdata-search_engine`) to already-running MCP servers via stdio

## 📋 Prerequisites

- Node.js (v18 or higher)
- npm (v8 or higher)
- A DeployStack account at [cloud.deploystack.io](https://cloud.deploystack.io)

## 🏗️ Architecture

### SSE Transport Layer

The DeployStack Gateway implements a modern **dual-endpoint SSE architecture** for VS Code compatibility:

```text
1. Client connects:     GET /sse
2. Gateway responds:    SSE stream + session endpoint  
3. Client sends:        POST /message?session=xyz (JSON-RPC)
4. Gateway responds:    Via SSE stream (real-time)
```

**Connection Flow:**

1. **SSE Connection**: VS Code connects to `GET /sse`
2. **Session Creation**: Gateway creates secure session and returns endpoint via SSE
3. **Message Routing**: Client sends JSON-RPC to `POST /message?session=xyz`
4. **Response Streaming**: Gateway responds via the SSE connection

**Benefits:**

- ✅ **VS Code Compatible**: Follows exact SSE pattern VS Code expects
- ✅ **Real-time Communication**: Persistent connections enable instant responses  
- ✅ **Session Security**: Cryptographically secure session management
- ✅ **Modern Architecture**: Clean separation between connection and messaging

### Process Management

The gateway runs MCP servers as **persistent background processes**:

- **Startup**: All team MCP servers launch when gateway starts
- **Always Ready**: Tools available instantly (no spawn delays)
- **Secure Environment**: Credentials injected at process startup
- **Team Isolation**: Each team's processes run separately
- **Graceful Lifecycle**: Proper MCP protocol initialization and cleanup

## 🔧 Configuration

After logging in, the gateway automatically downloads and synchronizes your team's configuration. No manual configuration required!

**VS Code/Cursor Configuration:**

```json
{
  "mcpServers": {
    "deploystack": {
      "url": "http://localhost:9095/sse",
      "name": "DeployStack Gateway",
      "description": "Enterprise MCP Gateway with team-based access control"
    }
  }
}
```

**Gateway Endpoints:**

- 📡 **SSE Connection**: `http://localhost:9095/sse` (for establishing legacy SSE connections)
- 📨 **Messages**: `http://localhost:9095/message` (for JSON-RPC with session context)
- 🚀 **MCP Endpoint**: `http://localhost:9095/mcp` (for modern Streamable HTTP transport)
- 📊 **Health Check**: `http://localhost:9095/health` (for monitoring)
- 📋 **Status**: `http://localhost:9095/status` (for detailed information)

## 📖 Commands

### `deploystack version`

Display version information and check for updates from npm registry.

**Options:**

- `--no-update-check` - Skip checking for updates from npm registry
- `--json` - Output version information in JSON format
- `--debug` - Show detailed debug information for npm API calls

**Examples:**

```bash
# Basic version information with update check
deploystack version

# Skip update check (for offline use)
deploystack version --no-update-check

# JSON output for scripts
deploystack version --json

# Debug npm API integration
deploystack version --debug
```

**Output when update available:**

```text
DeployStack Gateway v0.3.0
Built: Mon, Jul 29, 2025, 12:00:00 AM
Source: release

Checking npm registry for updates...

📦 Update Available!
   Current: 0.3.0
   Latest:  0.4.0
   Package: https://www.npmjs.com/package/@deploystack/gateway
   Update available! Run: npm install -g @deploystack/gateway@latest

Environment:
Node.js: v18.x.x
Platform: darwin arm64
```

**Output when up to date:**

```text
DeployStack Gateway v0.3.0
Built: Mon, Jul 29, 2025, 12:00:00 AM
Source: release

Checking npm registry for updates...
✅ You are running the latest version

Environment:
Node.js: v18.x.x
Platform: darwin arm64
```

### `deploystack teams`

Manage team context and switch between teams.

**Options:**

- `--switch <team-number>` - Switch to a different team by team number

**Examples:**

```bash
# List available teams
deploystack teams

# Switch to team #2 (automatically discovers and caches tools)
deploystack teams --switch 2
```

### `deploystack refresh`

Refresh MCP server configurations from cloud control plane with automatic change detection and restart prompting.

**Options:**

- `--url <url>` - DeployStack backend URL (override stored URL)

**Features:**

- **Change Detection**: Automatically detects configuration changes (added/removed/modified servers)
- **Interactive Restart**: Prompts to restart gateway when changes require it
- **Smart Behavior**: Only prompts for restart if gateway is running and changes detected

**Examples:**

```bash
# Refresh MCP configuration for current team
deploystack refresh

# Refresh with custom backend URL
deploystack refresh --url http://localhost:3000
```

**Sample Output with Changes:**

```text
🔄 Refreshing MCP configuration for team: My Team
✅ MCP configuration refreshed (4 servers)

🔄 Configuration changes detected:
   • brightdata: Environment variables updated
   • github-server: Arguments changed
   • new-server: Added to team configuration

⚠️  Gateway restart required for changes to take effect.
? Do you want to restart the DeployStack Gateway now? (Y/n)
```

### `deploystack mcp`

Manage MCP server configurations and discover tools.

**Options:**

- `--status` - Show MCP configuration status
- `--refresh` - Force refresh MCP configuration from API
- `--tools <server-number>` - Discover and list tools from a specific MCP server (requires running gateway)
- `--clear` - Clear stored MCP configuration

**Examples:**

```bash
# Show MCP configuration status
deploystack mcp

# Refresh configuration from cloud
deploystack mcp --refresh

# Discover tools from server #1
deploystack mcp --tools 1

# Clear stored configuration
deploystack mcp --clear
```

**Note:** Both `deploystack refresh` and `deploystack mcp --refresh` perform identical operations using shared logic.

### `deploystack start`

Start the gateway server as a daemon (background process).

**Options:**

- `-p, --port <port>` - Port to run the gateway on (default: 9095)
- `-h, --host <host>` - Host to bind the gateway to (default: localhost)
- `-f, --foreground` - Run in foreground instead of daemon mode

**Examples:**

```bash
# Start gateway with SSE endpoints on default port (9095)
deploystack start

# Start on custom port  
deploystack start --port 8080

# Run in foreground for debugging
deploystack start --foreground
```

**Output:**

```text
🚀 DeployStack Gateway listening at:
   📡 SSE endpoint: http://localhost:9095/sse
   📨 Messages: http://localhost:9095/message
   🚀 MCP endpoint: http://localhost:9095/mcp
   📊 Health check: http://localhost:9095/health
🤖 Ready to serve 2 MCP servers for team: kaka
```

### `deploystack restart`

Restart the gateway server with graceful shutdown and startup sequence.

**Options:**

- `-p, --port <port>` - Port to run the gateway on (default: 9095)
- `-h, --host <host>` - Host to bind the gateway to (default: localhost)
- `-f, --foreground` - Run in foreground instead of daemon mode

**Features:**

- **Graceful Shutdown**: Properly stops all MCP server processes before restart
- **Smart Behavior**: If gateway isn't running, performs a start operation instead
- **Configuration Reload**: Picks up any configuration changes after restart

**Examples:**

```bash
# Restart gateway with current configuration
deploystack restart

# Restart on custom port
deploystack restart --port 8080

# Restart in foreground for debugging
deploystack restart --foreground
```

### `deploystack stop`

Stop the running gateway server.

**Options:**

- `-f, --force` - Force stop the server (SIGKILL instead of SIGTERM)

**Examples:**

```bash
# Graceful shutdown
deploystack stop

# Force shutdown
deploystack stop --force
```

### `deploystack status`

Show detailed gateway status including running processes.

**Options:**

- `-j, --json` - Output status as JSON
- `-v, --verbose` - Show detailed process information

**Examples:**

```bash
# Basic status
deploystack status

# Detailed status with process info
deploystack status --verbose

# JSON output for scripting
deploystack status --json
```

## 🛠️ Troubleshooting

### Common Issues

**VS Code not connecting:**

```bash
# Check if gateway is running
deploystack status

# Verify endpoints are responding
curl http://localhost:9095/health

# Test SSE connection
curl -N -H "Accept: text/event-stream" http://localhost:9095/sse
```

**No tools available:**

```bash
# Check if team is selected
deploystack teams

# Refresh team configuration
deploystack mcp --refresh

# Restart gateway to reload config
deploystack stop && deploystack start
```

**Authentication issues:**

```bash
# Re-authenticate
deploystack logout
deploystack login

# Check stored credentials
deploystack whoami
```

### Debug Mode & Version Checking

```bash
# Check version and updates
deploystack version

# Run in foreground to see detailed logs
deploystack start --foreground

# Debug npm API integration
deploystack version --debug

# Check process status
deploystack status --verbose
```

### Version Management

**Automatic Updates**: The gateway automatically checks for updates when you run `deploystack version`. You'll be notified if a newer version is available on npm.

**Update Process**:

```bash
# Check for updates
deploystack version

# If update available, install latest version
npm install -g @deploystack/gateway@latest

# Verify new version
deploystack version
```

**Offline Mode**: Use `--no-update-check` flag to skip version checking when working offline.

## 🕰️ Version History

## 🤝 Contributing

We welcome contributions! This is a new service in active development with a modern SSE-based architecture.

**Key areas for contribution:**

- **SSE Transport**: Enhancing session management and connection reliability
- **Process Management**: Improving MCP server lifecycle and team isolation  
- **Security**: Strengthening credential handling and session security
- **Performance**: Optimizing persistent process communication
- **VS Code Integration**: Improving MCP client compatibility
- **Enterprise Features**: Team management and access control enhancements

**Development Setup:**

```bash
# Clone and setup
git clone <repository>
cd services/gateway
npm install

# Development mode
npm run dev

# Build and test
npm run build
node dist/index.js start --foreground
```

For detailed contribution guidelines, see [CONTRIBUTING.md](../../CONTRIBUTING.md) in the project root.
