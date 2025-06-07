# API Documentation Generation

This document explains how to generate and use the OpenAPI specification for the DeployStack Backend API.

## Overview

The DeployStack Backend uses Fastify with Swagger plugins to automatically generate OpenAPI 3.0 specifications. Route schemas are defined using [Zod](https://zod.dev/) for type safety and expressiveness, and then converted to JSON Schema using the [zod-to-json-schema](https://www.npmjs.com/package/zod-to-json-schema) library. This provides:

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

To add OpenAPI documentation to your routes, define your request body and response schemas using Zod. Then, use the `zodToJsonSchema` utility to convert these Zod schemas into the JSON Schema format expected by Fastify.

Make sure you have `zod` and `zod-to-json-schema` installed in your backend service.

### Recommended Approach: Automatic Validation with Zod

The power of Zod lies in providing **automatic validation** through Fastify's schema system. This approach eliminates manual validation and leverages Zod's full validation capabilities.

```typescript
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// 1. Define your Zod schemas for request body, responses, etc.
const myRequestBodySchema = z.object({
  name: z.string().min(3).describe("The name of the item (min 3 chars)"),
  count: z.number().positive().describe("How many items (must be positive)"),
  type: z.enum(['mysql', 'sqlite']).describe("Database engine type")
});

const mySuccessResponseSchema = z.object({
  success: z.boolean().describe("Indicates if the operation was successful"),
  itemId: z.string().uuid().describe("The UUID of the created/affected item"),
  message: z.string().optional().describe("Optional success message")
});

const myErrorResponseSchema = z.object({
  success: z.boolean().default(false).describe("Indicates failure"),
  error: z.string().describe("Error message detailing what went wrong")
});

// 2. Construct the Fastify route schema using zodToJsonSchema
const routeSchema = {
  tags: ['Category'], // Your API category
  summary: 'Brief description of your endpoint',
  description: 'Detailed description of what this endpoint does, its parameters, and expected outcomes.',
  security: [{ cookieAuth: [] }], // Include if authentication is required
  body: zodToJsonSchema(myRequestBodySchema, { 
    $refStrategy: 'none', // Keeps definitions inline, often simpler for Fastify
    target: 'openApi3'   // Ensures compatibility with OpenAPI 3.0
  }),
  response: {
    200: zodToJsonSchema(mySuccessResponseSchema.describe("Successful operation"), { 
      $refStrategy: 'none', 
      target: 'openApi3' 
    }),
    400: zodToJsonSchema(myErrorResponseSchema.describe("Bad Request - Invalid input"), { 
      $refStrategy: 'none', 
      target: 'openApi3' 
    }),
    // Define other responses (e.g., 401, 403, 404, 500) similarly
  }
};

// 3. Use the schema in your Fastify route definition with proper TypeScript typing
interface RequestBody {
  name: string;
  count: number;
  type: 'mysql' | 'sqlite';
}

fastify.post<{ Body: RequestBody }>(
  '/your-route', 
  { schema: routeSchema }, 
  async (request, reply) => {
    // ✅ Fastify has already validated request.body using our Zod schema
    // ✅ If we reach here, request.body is guaranteed to be valid
    // ✅ No manual validation needed!
    
    const { name, count, type } = request.body; // Fully typed and validated
    
    // Your route handler logic here
    return reply.status(200).send({ 
      success: true, 
      itemId: 'some-uuid-v4-here', 
      message: `Item ${name} processed successfully with ${count} items using ${type}.` 
    });
  }
);
```

### Key Benefits of This Approach

1. **Single Source of Truth**: Zod schemas define both validation AND documentation
2. **Automatic Validation**: Fastify automatically validates requests before your handler runs
3. **No Manual Validation**: Remove all manual `zod.parse()` calls and field checks
4. **Better Error Messages**: Fastify provides detailed validation errors automatically
5. **Type Safety**: Handlers receive properly typed, validated data
6. **Cleaner Code**: No redundant validation logic in handlers

### What NOT to Do (Anti-patterns)

❌ **Don't do manual validation in handlers:**
```typescript
// BAD: Manual validation (redundant)
const parsedBody = myRequestBodySchema.safeParse(request.body);
if (!parsedBody.success) {
  return reply.status(400).send({ error: 'Invalid request body' });
}

// BAD: Manual field checks (redundant)
if (!request.body.name || !request.body.count) {
  return reply.status(400).send({ error: 'Required fields missing' });
}

// BAD: Manual enum validation (redundant)
if (request.body.type !== 'mysql' && request.body.type !== 'sqlite') {
  return reply.status(400).send({ error: 'Invalid database type' });
}
```

✅ **Do trust Fastify's automatic validation:**
```typescript
// GOOD: Trust the validation - if handler runs, data is valid
const { name, count, type } = request.body; // Already validated by Fastify
```

### Validation Flow

The validation chain works as follows:

**Zod Schema → JSON Schema → Fastify Validation → Handler**

1. **Zod Schema**: Define validation rules using Zod
2. **JSON Schema**: Convert to OpenAPI format using `zodToJsonSchema()`
3. **Fastify Validation**: Fastify automatically validates incoming requests
4. **Handler**: Receives validated, typed data

If validation fails, Fastify automatically returns a 400 error **before** your handler runs.

### Real-World Examples

See these files for complete examples of proper Zod validation:
- `src/routes/db/setup.ts` - Database setup with enum validation
- `src/routes/db/status.ts` - Simple GET endpoint with response schemas
- `src/routes/auth/loginEmail.ts` - Login with required string fields
- `src/routes/auth/registerEmail.ts` - Registration with complex validation rules

**Note**: Older examples in this document (like the "Logout Route Documentation" below) might still show manually crafted JSON schemas. The recommended approach is now to use Zod with automatic Fastify validation as shown above.

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

## Plugin API Routes

### Plugin Route Structure

All plugin routes are automatically namespaced under `/api/plugin/<plugin-name>/` for security and isolation:

- **Core Routes**: `/api/auth/*`, `/api/users/*`, `/api/settings/*` (protected from plugins)
- **Plugin Routes**: `/api/plugin/<plugin-name>/*` (isolated per plugin)

### Example Plugin Routes

For a plugin with ID `example-plugin`:

```
GET    /api/plugin/example-plugin/examples
GET    /api/plugin/example-plugin/examples/:id
POST   /api/plugin/example-plugin/examples
PUT    /api/plugin/example-plugin/examples/:id
DELETE /api/plugin/example-plugin/examples/:id
```

### Security Benefits

1. **Route Isolation**: Plugins cannot interfere with core routes or each other
2. **Predictable Structure**: All plugin APIs follow the same pattern
3. **Easy Identification**: Plugin ownership is clear from the URL
4. **Automatic Namespacing**: No manual prefix management required

### Plugin Route Registration

Plugins register routes using the `PluginRouteManager`:

```typescript
// In plugin's routes.ts file
export async function registerRoutes(routeManager: PluginRouteManager, db: AnyDatabase | null) {
  // This becomes /api/plugin/my-plugin/data
  routeManager.get('/data', async () => {
    return { message: 'Hello from plugin!' };
  });
}
```

## Files Generated

- `api-spec.json` - Complete OpenAPI 3.0 specification in JSON format
- `api-spec.yaml` - Complete OpenAPI 3.0 specification in YAML format
- Interactive documentation available at `/documentation` when server is running
