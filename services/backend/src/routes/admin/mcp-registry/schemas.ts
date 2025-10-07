/**
 * Shared schemas for MCP Registry admin routes
 * 
 * This file contains common JSON schemas and TypeScript interfaces
 * used across multiple MCP Registry endpoints to ensure consistency
 * and eliminate duplication.
 */

// Common error response schema used by all endpoints
export const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', default: false },
    error: { type: 'string' }
  },
  required: ['success', 'error']
} as const;

// Common batch ID parameter schema
export const BATCH_ID_PARAM_SCHEMA = {
  type: 'object',
  properties: {
    batchId: { type: 'string', description: 'Job batch ID' }
  },
  required: ['batchId']
} as const;

// TypeScript interfaces
export interface ErrorResponse {
  success: boolean;
  error: string;
}

export interface BatchIdParams {
  batchId: string;
}
