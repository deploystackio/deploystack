# GitHub Copilot Instructions for DeployStack

## Project Context
This is a monorepo for DeployStack, an Enterprise Control Plane for the Model Context Protocol (MCP) ecosystem. The project consists of multiple services that must be developed and released independently.

## Commit Message Requirements
**MANDATORY: All commit messages MUST include a scope!**

When generating commit messages, always follow this format:
```
<type>(<scope>): <description>
```

### Required Scopes
- `frontend` - For changes ONLY in `services/frontend/`
- `backend` - For changes ONLY in `services/backend/`
- `satellite` - For changes ONLY in `services/satellite/`
- `shared` - For changes ONLY in `services/shared/`
- `all` - **USE THIS when changes span multiple services** (e.g., changes in both `services/backend/` AND `services/satellite/`)
- `ci` - For CI/CD pipeline and workflow changes (`.github/` directory)
- `deps` - For dependency updates

### Scope Selection Rules
1. **Count the affected service directories** - look at which `services/*` folders have changes
2. If changes are in **exactly ONE** service → use that service's scope
3. If changes are in **TWO OR MORE** services → use `all` scope
4. Root-level config changes affecting all services → use `all` scope

### Examples of Good Commit Messages
- `feat(frontend): add user authentication flow`
- `fix(backend): resolve database connection pooling issue`
- `feat(satellite): implement MCP server process management`
- `refactor(shared): extract common validation utilities`
- `chore(all): exclude release commits from changelog` ← changes in 2+ services (e.g., backend/ + frontend/, or all three)
- `docs(all): update installation and setup instructions`
- `chore(deps): update all dependencies to latest versions`

### Why This Matters
- Each service has independent changelog generation
- Scoped commits ensure proper release automation
- Clear impact assessment for code reviews
- Enables independent service versioning

## Code Generation Guidelines
- Follow TypeScript best practices across all services
- Use proper error handling and validation
- Include JSDoc comments for public APIs
- Follow existing code patterns within each service
- Prioritize security, especially for the satellite service
