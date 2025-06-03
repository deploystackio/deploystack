# DeployStack Backend

A modular and extensible backend API for the DeployStack CI/CD platform, built with Fastify and TypeScript.

## 🚀 Features

- **High-performance**: Built on Fastify for optimal speed and efficiency
- **Type-safe**: Written in TypeScript for better development experience
- **Modular**: Well-organized code structure for maintainability
- **Email System**: Integrated email service with Pug templates and SMTP support
- **Global Settings**: Centralized configuration management with encryption
- **Database Integration**: SQLite/PostgreSQL support with Drizzle ORM
- **Plugin System**: Extensible architecture for custom functionality
- **Authentication**: Lucia-based authentication with role management
- **Logging**: Comprehensive request logging with request IDs and timing
- **Developer-friendly**: Pretty logging in development, production-ready in production

## 🚀 Run

```bash
docker run -it -p 3000:3000 \
  -e FOO=bar22 \
  -v $(pwd)/data:/app/data \
  deploystack/backend:latest
```

## 📋 Prerequisites

- Node.js (v18 or higher)
- npm (v8 or higher)

## 🛠️ Installation

```bash
# Clone the repository
git clone https://github.com/deploystack/deploystack.git
cd deploystack

# Navigate to backend directory
cd services/backend

# Install dependencies
npm install
```

## 🚀 Usage

```bash
# Run in development mode (with live reloading)
npm run dev

# Build TypeScript files
npm run build

# Run in production mode (after building)
npm run start

# Lint and fix TypeScript files
npm run lint
```

## 🧱 Project Structure

```bash
services/backend/
├── src/
│   ├── api/            # API route handlers
│   ├── db/             # Database configuration and schema
│   │   ├── config.ts   # Database connection setup
│   │   ├── index.ts    # Database exports
│   │   ├── migrations.ts # Migration management
│   │   └── schema.ts   # Database schema definitions
│   ├── email/          # Email system (NEW)
│   │   ├── templates/  # Pug email templates
│   │   │   ├── layouts/    # Base layout components
│   │   │   │   ├── base.pug    # Main email layout
│   │   │   │   ├── header.pug  # Email header
│   │   │   │   └── footer.pug  # Email footer
│   │   │   ├── welcome.pug     # Welcome email template
│   │   │   ├── password-reset.pug # Password reset template
│   │   │   └── notification.pug   # General notification template
│   │   ├── emailService.ts     # Main email service
│   │   ├── templateRenderer.ts # Pug template renderer
│   │   ├── types.ts           # Email type definitions
│   │   ├── example.ts         # Usage examples
│   │   └── index.ts           # Email module exports
│   ├── fastify/        # Fastify configuration
│   │   ├── config/     # Fastify setup
│   │   ├── hooks/      # Request/response hooks
│   │   └── plugins/    # Fastify plugins
│   ├── global-settings/ # Global configuration system
│   │   ├── github-oauth.ts # GitHub OAuth settings
│   │   ├── smtp.ts     # SMTP email settings
│   │   ├── types.ts    # Global settings types
│   │   └── index.ts    # Settings initialization
│   ├── hooks/          # Authentication hooks
│   ├── lib/            # External library integrations
│   │   └── lucia.ts    # Lucia authentication setup
│   ├── middleware/     # Request middleware
│   ├── plugin-system/  # Plugin architecture
│   ├── plugins/        # Available plugins
│   ├── routes/         # API route definitions
│   │   ├── auth/       # Authentication routes
│   │   ├── db/         # Database management routes
│   │   ├── globalSettings/ # Settings management routes
│   │   ├── roles/      # Role management routes
│   │   └── users/      # User management routes
│   ├── services/       # Business logic services
│   │   ├── globalSettingsService.ts # Settings service
│   │   ├── roleService.ts           # Role management
│   │   ├── teamService.ts           # Team management
│   │   └── userService.ts           # User management
│   ├── types/          # TypeScript type definitions
│   ├── utils/          # Utility functions
│   │   ├── banner.ts   # Startup banner
│   │   └── encryption.ts # Encryption utilities
│   ├── server.ts       # Server configuration
│   └── index.ts        # Application entry point
├── drizzle/            # Database migrations
├── persistent_data/    # Persistent application data
├── tests/              # Test files
├── .env                # Environment variables (not in version control)
├── DB.md               # Database documentation
├── GLOBAL_SETTINGS.md  # Global settings documentation
├── Mail.md             # Email system documentation (NEW)
├── PLUGINS.md          # Plugin system documentation
├── ROLES.md            # Role management documentation
├── SECURITY.md         # Security documentation
├── package.json        # Package dependencies and scripts
└── tsconfig.json       # TypeScript configuration
```

## 💾 Persistent Data

The `services/backend/persistent_data/` directory is designated for storing all data that needs to persist across application restarts or deployments.

**Purpose:**

- To provide a single, consistent location for all persistent backend data.
- When developing backend features that require data persistence (e.g., database files, configuration files that should not be in version control but are generated/modified at runtime), use this directory exclusively.

**Examples of data stored here:**

- SQLite database file (e.g., `persistent_data/database/deploystack.db`)
- Database selection configuration (e.g., `persistent_data/db.selection.json`)

This ensures that persistent data is managed in a predictable way and is not scattered across the project.

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
LOG_LEVEL=debug
DEPLOYSTACK_ENCRYPTION_SECRET=your-32-character-secret-key-here  # Required for global settings encryption
```

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
