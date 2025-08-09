# DeployStack Backend

A modular and extensible backend API for the DeployStack CI/CD platform, built with Fastify and TypeScript.

## 🚀 Features

- **High-performance**: Built on Fastify for optimal speed and efficiency
- **Type-safe**: Written in TypeScript for better development experience
- **Modular**: Well-organized code structure for maintainability
- **Email System**: Integrated email service with Pug templates and SMTP support
- **Global Settings**: Centralized configuration management with encryption
- **Database Integration**: SQLite/Turso support with Drizzle ORM
- **Plugin System**: Extensible architecture for custom functionality
- **Authentication**: Lucia-based authentication with role management
- **Logging**: Comprehensive request logging with request IDs and timing
- **Developer-friendly**: Pretty logging in development, production-ready in production

## 🚀 Quick Start with Docker

```bash
# Run with Docker (using docker-compose recommended)
docker-compose up -d

# Or run standalone with volume for data persistence
docker run -it -p 3000:3000 \
  -e NODE_ENV=production \
  -e DEPLOYSTACK_ENCRYPTION_SECRET=your-32-character-secret-key-here \
  -v deploystack_data:/app/persistent_data \
  deploystack/backend:latest

# Access the setup wizard at http://localhost:3000
# (or http://localhost:8080 if using the full docker-compose stack)
```

## 📋 Prerequisites

- Node.js (v18 or higher)
- npm (v8 or higher)

## 🛠️ Installation

### Development Setup

```bash
# Clone the repository
git clone https://github.com/deploystackio/deploystack.git
cd deploystack

# Navigate to backend directory
cd services/backend

# Install dependencies
npm install

# Create .env file (see Environment Variables section)
cp .env.example .env  # Or create manually

# Start development server
npm run dev

# Access at http://localhost:3000
```

### Production Setup with Docker

```bash
# Using Docker Compose (recommended)
git clone https://github.com/deploystackio/deploystack.git
cd deploystack
docker-compose up -d

# Access frontend at http://localhost:8080
# Backend API at http://localhost:3000
```

## 🚀 Usage

### Development Commands

```bash
# Run in development mode (with live reloading)
npm run dev

# Build TypeScript files
npm run build

# Run in production mode (after building)
npm run start

# Lint and fix TypeScript files
npm run lint

# Database migrations
npm run db:generate  # Generate new migrations
npm run db:up        # Apply migrations

# API documentation
npm run api:spec      # Generate OpenAPI spec
```

### Initial Setup

1. **First Run**: Navigate to `/setup` in your browser
2. **Choose Database**: Select SQLite (default) or Turso
3. **Create Admin**: Set up your administrator account
4. **Configure Settings**: Access Global Settings to configure email, features, etc.

## 💾 Persistent Data

All persistent data is stored in the `persistent_data/` directory, which maintains the same structure across development and production environments.

### Directory Structure

```
persistent_data/
├── database/
│   └── deploystack.db     # SQLite database (if using SQLite)
└── db.selection.json       # Database type configuration
```

### Environment-Specific Locations

**Development (Local):**
- Location: `services/backend/persistent_data/`
- Created automatically when running `npm run dev`
- Direct file system access

**Production (Docker):**
- Location: `/app/persistent_data/` (inside container)
- Mounted as Docker volume: `deploystack_backend_persistent`
- Persists data between container restarts

### Backup Strategies

**Docker Volume Backup:**
```bash
# Create backup
docker run --rm -v deploystack_backend_persistent:/data \
  -v $(pwd):/backup alpine \
  tar czf /backup/deploystack-backup-$(date +%Y%m%d).tar.gz /data

# Restore backup
docker run --rm -v deploystack_backend_persistent:/data \
  -v $(pwd):/backup alpine \
  tar xzf /backup/deploystack-backup-20250108.tar.gz -C /
```

**Local Development Backup:**
```bash
# Create backup
tar czf deploystack-backup-$(date +%Y%m%d).tar.gz \
  services/backend/persistent_data/

# Restore backup
tar xzf deploystack-backup-20250108.tar.gz
```

**Important:** Always backup the entire `persistent_data/` directory/volume, not just the database file, as it contains critical configuration.

## 📧 Email System

DeployStack includes a comprehensive email system with Pug templates and SMTP integration:

### Quick Start

```typescript
import { EmailService } from './src/email';

// Send a welcome email
await EmailService.sendWelcomeEmail({
  to: 'user@example.com',
  userName: 'John Doe',
  userEmail: 'user@example.com',
  loginUrl: 'https://app.deploystack.com/login'
});

// Send a notification
await EmailService.sendNotificationEmail({
  to: 'user@example.com',
  title: 'Deployment Complete',
  message: 'Your app has been deployed successfully.'
});
```

### Configuration

1. Configure SMTP settings in the global settings interface
2. Required settings: `smtp.host`, `smtp.port`, `smtp.username`, `smtp.password`
3. Optional settings: `smtp.secure`, `smtp.from_name`, `smtp.from_email`

### Documentation

- **[Mail.md](./Mail.md)**: Complete email system documentation
- **Templates**: Located in `src/email/templates/`
- **Examples**: See `src/email/example.ts` for usage examples

## 🌍 Environment Variables

Create a `.env` file in the `services/backend` directory with the following variables:

```bash
NODE_ENV=development
PORT=3000
HOST=localhost
LOG_LEVEL=info
DEPLOYSTACK_FRONTEND_URL=http://localhost:5173  # Frontend URL for CORS and redirects
DEPLOYSTACK_ENCRYPTION_SECRET=your-32-character-secret-key-here  # Required for global settings encryption
```

### Logging Configuration

DeployStack uses **Pino** logger with **Fastify** for high-performance, structured logging:

**Available Log Levels** (in order of severity):

- `trace` (10) - Very detailed debugging information
- `debug` (20) - Debugging information for development
- `info` (30) - General information (default for production)
- `warn` (40) - Warning messages
- `error` (50) - Error conditions
- `fatal` (60) - Fatal errors that cause application termination

**Environment-based Defaults:**

- **Development**: `debug` level with pretty-printed, colorized output
- **Production**: `info` level with structured JSON output
- **Override**: Set `LOG_LEVEL` environment variable to any level

**Examples:**

```bash
# Show all logs including debug info
LOG_LEVEL=debug npm run dev

# Production-like logging in development
LOG_LEVEL=info npm run dev

# Only show errors and fatal messages
LOG_LEVEL=error npm run start
```

**Log Output Formats:**

- **Development**: `[2025-07-03 10:48:06.636 +0200] INFO: ✅ Database initialization completed`
- **Production**: `{"level":30,"time":"2025-07-03T08:48:06.636Z","msg":"Database initialization completed"}`

## 🤝 Contributing

We welcome contributions from the community! Here's how you can help:

### 1. Fork and Clone

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/your-username/deploystack.git
cd deploystack
```

### 2. Create a Branch

```bash
git checkout -b feature/amazing-feature
```

### 3. Make Changes

Make your changes to the codebase. Be sure to follow the existing code style and organization.

### 4. Lint and Test

```bash
npm run lint
```

### 5. Commit and Push

```bash
git add .
git commit -m "Add amazing feature"
git push origin feature/amazing-feature
```

### 6. Submit a Pull Request

Go to the GitHub repository and submit a pull request from your branch to the main repository.

### Contribution Guidelines

- Follow the established code structure and naming conventions
- Add appropriate comments and documentation
- Update the [DeployStack Documentation](https://github.com/deploystackio/documentation) if necessary
- Make sure all lint rules pass
- Write meaningful commit messages
- Don't include any sensitive information
