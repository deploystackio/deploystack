# DeployStack Gateway

The local secure gateway that connects developers to their team's MCP servers through a centralized control plane. The DeployStack Gateway acts as a smart proxy, managing MCP server processes locally while enforcing access policies from the cloud.

## 🚀 Features

- **One-Time Login**: Authenticate once and access all authorized MCP servers
- **Process Management**: Automatically spawns and manages local MCP server processes on-demand
- **Secure Credential Injection**: Injects credentials directly into MCP server processes without exposing them to developers
- **Unified Endpoint**: Single local HTTP endpoint for all MCP tools (VS Code, Cursor, etc.)
- **Team-Based Access Control**: Only exposes MCP servers that your team has access to
- **Language Agnostic**: Supports MCP servers written in Node.js, Python, Go, Rust, and more

## 🛠️ Installation

```bash
# Installation command coming soon
npm install -g @deploystack/gateway
```

## 🚀 Usage

```bash
# Login to your DeployStack account
deploystack login

# Start the gateway (runs on localhost:9095 by default)
deploystack start

# Check status
deploystack status
```

## 🧱 How It Works

1. **Login**: The gateway authenticates with `cloud.deploystack.io` and downloads your team's MCP server configurations
2. **Local Proxy**: Exposes a single HTTP endpoint (e.g., `http://localhost:9095/mcp`) for all your development tools
3. **Process Spawning**: When you use an MCP tool, the gateway automatically spawns the required MCP server process
4. **Credential Injection**: Securely injects API tokens and credentials into the MCP server process environment
5. **Request Proxying**: Routes requests between your tools and the appropriate MCP server processes via stdio

## 📋 Prerequisites

- Node.js (v18 or higher)
- npm (v8 or higher)
- A DeployStack account at [cloud.deploystack.io](https://cloud.deploystack.io)

## 🔧 Configuration

After logging in, the gateway automatically downloads and synchronizes your team's configuration. No manual configuration required!

Your development tools (VS Code, Cursor, etc.) should be configured to use:

```text
MCP Endpoint: http://localhost:9095/mcp
```

## 🤝 Contributing

We welcome contributions! This is a new service in active development.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/gateway-improvement`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin feature/gateway-improvement`)
5. Open a Pull Request

For detailed contribution guidelines, see [CONTRIBUTING.md](../../CONTRIBUTING.md) in the project root.
