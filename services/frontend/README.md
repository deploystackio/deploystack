# DeployStack Frontend

The DeployStack frontend is a modern Vue 3 application built with TypeScript and Vite, providing a seamless UI for managing MCP (Model Context Protocol) tools and configurations.

## 🚀 Quick Start

### Development

```bash
# Navigate to frontend directory
cd services/frontend

# Install dependencies
npm install

# Copy environment template
cp .env .env.local

# Run development server
npm run dev
```

The application will be available at `http://localhost:5173`

### Production Build

```bash
# Build for production
npm run build

# Preview production build locally
npm run preview
```

### Docker

```bash
# Run with Docker
docker run -it -p 8080:80 \
  -e VITE_DEPLOYSTACK_BACKEND_URL="https://api.deploystack.io" \
  -e VITE_APP_TITLE="DeployStack Production" \
  deploystack/frontend:latest
```

## 🎨 Tech Stack

- **Framework**: Vue 3 with Composition API
- **Language**: TypeScript
- **Build Tool**: Vite
- **Styling**: TailwindCSS + [shadcn-vue](https://www.shadcn-vue.com/)
- **State Management**: Pinia
- **Router**: Vue Router
- **Icons**: Lucide Icons
- **Internationalization**: Vue I18n

## 🎨 UI Components

The frontend uses TailwindCSS and [shadcn-vue](https://www.shadcn-vue.com/) for consistent, accessible components.

### Installing New Components

```bash
# Add a new shadcn-vue component
npx shadcn-vue@latest add button

# Add multiple components
npx shadcn-vue@latest add dialog card input
```

### Available Components

Check `components/ui/` for all available shadcn-vue components. Common ones include:

- Button, Card, Dialog, Input, Label
- Select, Switch, Tabs, Toast
- Table, Form, Alert, Badge

## Icons

The project uses [Lucide Icons](https://lucide.dev/) via the `lucide-vue-next` package.

## 🔧 Environment Variables

The frontend uses a dual-layer environment system that works seamlessly across development and production.

### Core Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `VITE_DEPLOYSTACK_BACKEND_URL` | Backend API URL | `http://localhost:3000` | Yes |
| `VITE_APP_TITLE` | Application title | `DeployStack` | Yes |

### Development Setup

```bash
# Create local environment file (gitignored)
cat > .env.local << EOF
VITE_DEPLOYSTACK_BACKEND_URL=http://localhost:3000
VITE_APP_TITLE=DeployStack
EOF
```

**Environment file priority** (highest to lowest):

1. `.env.local` (personal settings, gitignored)
2. `.env.development.local`
3. `.env.development`
4. `.env` (base configuration)

### Production (Docker)

```bash
# Pass environment variables at runtime
docker run -d -p 8080:80 \
  -e VITE_DEPLOYSTACK_BACKEND_URL="https://api.deploystack.io" \
  -e VITE_APP_TITLE="DeployStack" \
  deploystack/frontend:latest
```

## 📚 Documentation

- [Frontend Development Guide](https://docs.deploystack.io/development/frontend)
- [Environment Variables](https://docs.deploystack.io/development/frontend/environment-variables)
- [API Documentation](https://docs.deploystack.io/api)
- [Deployment Guide](https://docs.deploystack.io/self-hosted/docker-compose)

## 🤝 Contributing

We welcome contributions! Please:

1. Follow the existing code style
2. Write tests for new features
3. Update documentation as needed
4. Create detailed pull requests

## 📝 License

Copyright (c) 2024 DeployStack. All rights reserved.
