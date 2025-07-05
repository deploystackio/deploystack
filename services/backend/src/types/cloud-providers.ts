export interface StoredCredentials {
  [fieldKey: string]: {
    value: string;        // Always encrypted
    secret: boolean;      // From provider config
    updatedAt: string;    // When this field was last updated
  };
}

export interface CredentialFieldResponse {
  value?: string;     // Only for non-secret fields
  hasValue: boolean;  // Always true if field has been set
  secret: boolean;    // From provider config
}

export interface UserInfo {
  id: string;
  username: string;
  email: string;
}

export interface CloudCredentialResponse {
  id: string;
  teamId: string;
  providerId: string;
  name: string;
  comment?: string;
  provider: {
    id: string;
    name: string;
    description: string;
  };
  fields: Record<string, CredentialFieldResponse>;
  createdBy: UserInfo | string; // User object when available, fallback to ID
  createdAt: string;
  updatedAt: string;
}

export interface CloudCredentialBasicResponse {
  id: string;
  teamId: string;
  providerId: string;
  name: string;
  comment?: string;
  provider: {
    id: string;
    name: string;
    description: string;
  };
  createdBy: UserInfo | string; // User object when available, fallback to ID
  createdAt: string;
  updatedAt: string;
}

export interface CreateCloudCredentialRequest {
  providerId: string;
  name: string;
  comment?: string;
  credentials: Record<string, string>;
}

export interface UpdateCloudCredentialRequest {
  name?: string;
  comment?: string;
  credentials?: Record<string, string>;
}
