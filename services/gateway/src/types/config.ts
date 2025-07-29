// Configuration types
// TODO: Define configuration types and interfaces

export interface GatewayConfig {
  port: number;
  host: string;
  logLevel: string;
}

export interface TeamConfig {
  teamId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  servers: any[]; // Use any[] to avoid conflicts with mcp.ts types
}

export interface AuthConfig {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}
