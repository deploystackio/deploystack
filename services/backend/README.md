# DeployStack Backend

A modular and extensible backend API for the DeployStack CI/CD platform, built with Fastify and TypeScript.

## 🚀 Features

- **High-performance**: Built on Fastify for optimal speed and efficiency
- **Type-safe**: Written in TypeScript for better development experience
- **Modular**: Well-organized code structure for maintainability
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
│   ├── config/         # Configuration files
│   │   └── logger.ts   # Logger configuration
│   ├── hooks/          # Fastify hooks
│   │   └── request-logger.ts  # Request logging hooks
│   ├── plugins/        # Fastify plugins
│   │   └── index.ts    # Plugin registration
│   ├── routes/         # API routes
│   │   └── index.ts    # Route definitions
│   ├── types/          # TypeScript type definitions
│   │   └── fastify.ts  # Fastify type extensions
│   ├── utils/          # Utility functions
│   │   └── banner.ts   # Startup banner
│   ├── server.ts       # Server configuration
│   └── index.ts        # Application entry point
├── .env                # Environment variables (not in version control)
├── .eslintrc           # ESLint configuration
├── package.json        # Package dependencies and scripts
└── tsconfig.json       # TypeScript configuration
```

## 🌍 Environment Variables

Create a `.env` file in the `services/backend` directory with the following variables:

```bash
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug
FOO=bar  # Example environment variable used in the demo route
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
