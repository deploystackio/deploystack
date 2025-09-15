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
- `frontend` - For Vue.js frontend application changes
- `backend` - For Fastify backend API changes  
- `satellite` - For DeployStack satellite application changes
- `shared` - For shared utilities and common code
- `all` - For changes affecting multiple services or project-wide changes
- `ci` - For CI/CD pipeline and workflow changes
- `deps` - For dependency updates

### Examples of Good Commit Messages
- `feat(frontend): add user authentication flow`
- `fix(backend): resolve database connection pooling issue`
- `feat(satellite): implement MCP server process management`
- `refactor(shared): extract common validation utilities`
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
