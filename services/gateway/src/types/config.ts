// Configuration types
// TODO: Define configuration types and interfaces

export interface GatewayConfig {
  port: number;
  host: string;
  logLevel: string;
}

export interface TeamConfig {
  teamId: string;
  servers: MCPServerConfig[];
}

export interface MCPServerConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface AuthConfig {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}
