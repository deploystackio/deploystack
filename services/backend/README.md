# DeployStack Backend

A modular and extensible backend API for the DeployStack CI/CD platform, built with Fastify and TypeScript.

## 🚀 Features

- **High-performance**: Built on Fastify for optimal speed and efficiency
- **Type-safe**: Written in TypeScript for better development experience
- **Modular**: Well-organized code structure for maintainability
- **Email System**: Integrated email service with Pug templates and SMTP support
- **Global Settings**: Centralized configuration management with encryption
- **Database Integration**: PostgreSQL support with Drizzle ORM
- **Plugin System**: Extensible architecture for custom functionality
- **Authentication**: Lucia-based authentication with role management
- **Logging**: Comprehensive request logging with request IDs and timing
- **Developer-friendly**: Pretty logging in development, production-ready in production

## 🚀 Quick Start with Docker

```bash
# Run with Docker Compose (includes PostgreSQL)
docker-compose up -d

# Access the setup wizard at http://localhost:3000
# (or http://localhost:8080 if using the full docker-compose stack)
```

## 📋 Prerequisites

- Node.js (v18 or higher)
- npm (v8 or higher)
- PostgreSQL (v13 or higher)

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

# Start local PostgreSQL (Docker-based)
npm run postgres:local

# Create .env file (see Environment Variables section)
cp .env.example .env

# Start development server
npm run dev

# Access at http://localhost:3000
```

### Production Setup with Docker

```bash
# Using Docker Compose (recommended - includes PostgreSQL)
git clone https://github.com/deploystackio/deploystack.git
cd deploystack
docker-compose up -d

# Access frontend at http://localhost:8080
# Backend API at http://localhost:3000
```

## 🚀 Usage

### Development Commands

```bash
# Start local PostgreSQL for development
npm run postgres:local

# Run in development mode (with live reloading)
npm run dev

# Build TypeScript files
npm run build

# Run in production mode (after building)
npm run start

# Lint and fix TypeScript files
npm run lint

# Database migrations
npm run db:generate  # Generate new migrations (applied automatically on server startup)

# API documentation
npm run api:spec      # Generate OpenAPI spec
```

### Initial Setup

1. **Start PostgreSQL**: Run `npm run postgres:local` for local development
2. **First Run**: Navigate to `/setup` in your browser
3. **Configure Database**: PostgreSQL connection details are configured via environment variables
4. **Create Admin**: Set up your administrator account
5. **Configure Settings**: Access Global Settings to configure email, features, etc.

## 💾 Database

DeployStack uses PostgreSQL as its database backend, providing enterprise-grade reliability with ACID compliance and advanced features.

### Local Development

For local development, use the provided PostgreSQL script:

```bash
# Start PostgreSQL 18 in Docker
npm run postgres:local

# This creates a local PostgreSQL instance with:
# - Host: localhost
# - Port: 5432
# - User: deploystack
# - Password: deploystack
# - Database: deploystack
```

### Environment Configuration

Configure PostgreSQL connection in your `.env` file:

```bash
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=deploystack
POSTGRES_USER=deploystack
POSTGRES_PASSWORD=deploystack
POSTGRES_SSL=false
```

### Database Migrations

Migrations are automatically applied on server startup. To generate new migrations:

```bash
npm run db:generate
```

Migration files are stored in `drizzle/migrations/`.

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

# PostgreSQL Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=deploystack
POSTGRES_USER=deploystack
POSTGRES_PASSWORD=deploystack
POSTGRES_SSL=false
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
