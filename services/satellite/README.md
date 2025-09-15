# DeployStack Satellite

DeployStack Satellite is a MCP (Model Context Protocol) server management service that provides enterprise-ready deployment capabilities for MCP servers. It acts as an intelligent edge worker that bridges centralized management with on-premise MCP server execution.

## Overview

The Satellite service follows the proven GitHub Actions runner pattern for enterprise compatibility, providing:

- **Global Satellites**: Cloud-hosted and operated by DeployStack team
- **Team Satellites**: Customer-deployed within corporate networks
- **HTTP Proxy**: Intelligent routing for MCP server communication
- **Process Management**: Complete lifecycle management for MCP server processes
- **Enterprise Security**: Team isolation, audit logging, and compliance features

## Quick Start

### Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# The server will start on http://localhost:3001
# API Documentation: http://localhost:3001/documentation
# Backend Status: http://localhost:3001/api/status/backend
```

### Production

```bash
# Build the application
npm run build

# Start production server
npm start
```

## Configuration

The satellite service uses environment variables for configuration:

```bash
# .env file
PORT=3001                           # Server port (default: 3001)
NODE_ENV=development                # Environment mode
LOG_LEVEL=debug                     # Logging level (trace, debug, info, warn, error, fatal)

# Backend Connection (Required)
DEPLOYSTACK_BACKEND_URL=http://localhost:3000  # DeployStack Backend URL

# Backend Polling Configuration (Optional)
DEPLOYSTACK_BACKEND_POLLING_INTERVAL=60         # Command polling interval in seconds (default: 60)

# Satellite Identity (Required)
DEPLOYSTACK_SATELLITE_NAME=dev-satellite-001   # Unique satellite name (10-32 chars, lowercase only)

# Status Display Configuration (Optional)
DEPLOYSTACK_STATUS_SHOW_UPTIME=true     # Show uptime in status endpoint (default: true)
DEPLOYSTACK_STATUS_SHOW_VERSION=true    # Show version info in status endpoint (default: true)
```

### Satellite Name Requirements

The `DEPLOYSTACK_SATELLITE_NAME` environment variable is **mandatory** and must follow strict validation rules:

- **Length**: 10-32 characters
- **Characters**: Only lowercase letters (a-z), numbers (0-9), hyphens (-), and underscores (_)
- **No spaces or uppercase letters allowed**
- **Examples**: `dev-satellite-001`, `production_worker_main`, `team-europe-01`

The satellite will **fail to start** with a clear error message if the name is invalid or missing. This ensures consistent naming across all satellite deployments.

## Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run lint` - Run ESLint with auto-fix
- `npm start` - Start production server

## Architecture

The satellite service implements a three-tier architecture:

1. **MCP Client Layer** - VS Code, Claude, etc.
2. **Satellite Layer** - Edge processing with HTTP proxy + process management
3. **Backend Layer** - Central management and orchestration

For detailed architecture information, see the documents in the docs repository.

## License

This project is part of the DeployStack platform. See the main repository for license information.
