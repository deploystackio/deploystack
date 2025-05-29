# Contributing to DeployStack

Thank you for your interest in contributing to DeployStack! This document provides guidelines and instructions for contributing to our project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
  - [Project Structure](#project-structure)
  - [Development Environment](#development-environment)
- [Development Workflow](#development-workflow)
  - [Branching Strategy](#branching-strategy)
  - [Commit Message Guidelines](#commit-message-guidelines)
  - [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
  - [General Guidelines](#general-guidelines)
  - [Frontend Guidelines](#frontend-guidelines)
  - [Backend Guidelines](#backend-guidelines)
- [Testing](#testing)
- [Documentation](#documentation)
- [Release Process](#release-process)

## Code of Conduct

We expect all contributors to follow our Code of Conduct. Please read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before contributing.

## Getting Started

### Project Structure

DeployStack uses a monorepo structure:

```bash
deploystack/
├── services/
│   ├── frontend/        # Vue.js frontend application
│   ├── backend/         # Fastify backend API
│   └── shared/          # Shared code and utilities
├── scripts/             # Build and deployment scripts
└── ...
```

### Development Environment

1. **Prerequisites**:

   - Node.js (v18 or higher)
   - npm (v8 or higher)
   - Docker

2. **Setup**:

   ```bash
   # Clone the repository
   git clone https://github.com/your-username/deploystack.git
   cd deploystack

   # Install dependencies
   npm install

   # Start development servers
   npm run dev:frontend    # In one terminal
   npm run dev:backend     # In another terminal
   ```

## Development Workflow

### Branching Strategy

- `main` - Production-ready code
- `feature/*` - New features
- `fix/*` - Bug fixes
- `docs/*` - Documentation changes

Always create a new branch for your changes based on the latest `main`.

### Commit Message Guidelines

We follow the Angular commit convention with scoped messages. This helps with automatic versioning and changelog generation.

Format: `type(scope): subject`

Types:

- `feat`: A new feature (minor version bump)
- `fix`: A bug fix (patch version bump)
- `docs`: Documentation changes
- `style`: Changes that don't affect the code's meaning
- `refactor`: Code changes that neither fix bugs nor add features
- `perf`: Performance improvements
- `test`: Adding or correcting tests
- `chore`: Changes to the build process or tools

Scopes:

- `frontend`: Changes to the Vue.js frontend
- `backend`: Changes to the Fastify backend
- `shared`: Changes affecting shared code
- `all`: Changes affecting multiple parts of the application
- `deps`: Dependency updates
- `ci`: CI/CD changes

Examples:

- `feat(frontend): add dark mode support`
- `fix(backend): correct database query issue`
- `docs(all): update README with new instructions`
- `chore(deps): update dependencies`

**Important**: Using the correct scope ensures that changes appear in the appropriate changelogs.

### Pull Request Process

1. Create a new branch for your feature or fix
2. Make your changes with appropriate tests
3. Ensure your code passes linting: `npm run lint`
4. Submit a pull request to the `main` branch
5. Update the PR based on review feedback
6. Once approved, maintainers will merge your PR

## Coding Standards

### General Guidelines

- Follow existing code style and patterns
- Write clear, self-documenting code
- Add comments for complex logic
- Keep functions small and focused
- Write tests for new features

### Frontend Guidelines

- Follow Vue.js best practices
- Use composition API for new components
- Utilize TypeScript for type safety
- Follow the UI component structure
- Use i18n for all user-facing text

### Backend Guidelines

- Follow RESTful API design principles
- Validate all inputs
- Properly handle errors and return appropriate status codes
- Document API endpoints
- Write unit tests for business logic

## Testing

- Write unit tests for business logic
- Write integration tests for API endpoints
- Ensure existing tests pass before submitting a PR
- Aim for high test coverage for critical paths

## Documentation

- Update documentation when introducing new features
- Document API changes
- Update the README if necessary
- Add JSDoc comments to functions and methods

## Release Process

For detailed information about our release process, please refer to [RELEASE.md](RELEASE.md).

Thank you for contributing to DeployStack!
