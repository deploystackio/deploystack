# API Documentation Generation

This document explains how to generate and use the OpenAPI specification for the DeployStack Backend API.

## Overview

The DeployStack Backend uses Fastify with Swagger plugins to automatically generate OpenAPI 3.0 specifications from route definitions. This provides:

- **Interactive Documentation**: Swagger UI interface for testing APIs
- **Postman Integration**: JSON/YAML specs that can be imported into Postman
- **Automated Generation**: Specifications are generated from actual route code

## Available Commands

### 1. Generate Complete API Specification

```bash
npm run api:spec
```

This command:

- Starts a temporary server
- Generates both JSON and YAML specifications
- Saves files to `api-spec.json` and `api-spec.yaml`
- Provides URLs for interactive documentation
- Automatically shuts down the server

**Output:**

- `api-spec.json` - OpenAPI JSON specification (for Postman import)
- `api-spec.yaml` - OpenAPI YAML specification

### 2. Generate JSON Specification (requires running server)

```bash
npm run api:spec:json
```

Requires the development server to be running (`npm run dev`).

### 3. Generate YAML Specification (requires running server)

```bash
npm run api:spec:yaml
```

Requires the development server to be running (`npm run dev`).

## Usage Examples

### Complete Generation (Recommended)

```bash
cd services/backend
npm run api:spec
```

### Manual Generation with Running Server

```bash
# Terminal 1: Start the server
cd services/backend
npm run dev

# Terminal 2: Generate specifications
npm run api:spec:json
npm run api:spec:yaml
```

## Accessing Documentation

When the server is running (`npm run dev`), you can access:

- **Interactive Docs**: http://localhost:3000/documentation
- **JSON Spec**: http://localhost:3000/documentation/json
- **YAML Spec**: http://localhost:3000/documentation/yaml

## Importing into Postman

1. Run `npm run api:spec` to generate the specification
2. Open Postman
3. Click "Import"
4. Select the generated `api-spec.json` file
5. All API endpoints will be imported with proper documentation

## Adding Documentation to Routes

To add OpenAPI documentation to your routes, include a schema object:

```typescript
const routeSchema = {
  tags: ['Category'],
  summary: 'Brief description',
  description: 'Detailed description of what this endpoint does',
  security: [{ cookieAuth: [] }], // If authentication required
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' }
      },
      required: ['success', 'message']
    }
  }
};

fastify.post('/your-route', { schema: routeSchema }, async (request, reply) => {
  // Your route handler
});
```

## Example: Logout Route Documentation

The logout route (`/api/auth/logout`) demonstrates proper documentation:

```typescript
const logoutSchema = {
  tags: ['Authentication'],
  summary: 'User logout',
  description: 'Invalidates the current user session and clears authentication cookies',
  security: [{ cookieAuth: [] }],
  response: {
    200: {
      type: 'object',
      properties: {
        success: { 
          type: 'boolean',
          description: 'Indicates if the logout operation was successful'
        },
        message: { 
          type: 'string',
          description: 'Human-readable message about the logout result'
        }
      },
      required: ['success', 'message'],
      examples: [
        {
          success: true,
          message: 'Logged out successfully.'
        }
      ]
    }
  }
};
```

## Configuration

The Swagger configuration is in `src/server.ts`:

```typescript
await server.register(fastifySwagger, {
  openapi: {
    openapi: '3.0.0',
    info: {
      title: 'DeployStack Backend API',
      description: 'API documentation for DeployStack Backend',
      version: '0.20.5'
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'auth_session'
        }
      }
    }
  }
});
```

## Troubleshooting

### "Route already declared" Error

This happens when trying to manually add routes that Swagger UI already provides. The `/documentation/json` and `/documentation/yaml` endpoints are automatically created.

### "Failed to fetch API spec" Error

Ensure the server is fully started before trying to fetch the specification. The generation script includes a 2-second delay to allow for complete initialization.

### Missing Route Documentation

Routes without schema definitions will appear in the specification but with minimal documentation. Add schema objects to routes for complete documentation.

## Next Steps

To extend API documentation:

1. Add schema definitions to more routes
2. Define reusable components in the OpenAPI configuration
3. Add request body schemas for POST/PUT endpoints
4. Include error response schemas (400, 401, 500, etc.)
5. Add parameter validation schemas

## Files Generated

- `api-spec.json` - Complete OpenAPI 3.0 specification in JSON format
- `api-spec.yaml` - Complete OpenAPI 3.0 specification in YAML format
- Interactive documentation available at `/documentation` when server is running
