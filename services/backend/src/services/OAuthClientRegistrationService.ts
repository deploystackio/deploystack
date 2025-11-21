import type { Logger } from 'pino';

export interface ClientRegistrationRequest {
	client_name: string;
	redirect_uris: string[];
	grant_types?: string[];
	response_types?: string[];
	token_endpoint_auth_method?: string;
	scope?: string;
}

export interface ClientRegistrationResponse {
	client_id: string;
	client_secret?: string;
	client_id_issued_at?: number;
	client_secret_expires_at?: number;
	redirect_uris: string[];
	grant_types?: string[];
	response_types?: string[];
	token_endpoint_auth_method?: string;
}

/**
 * Service for dynamically registering OAuth clients with MCP servers
 * Implements RFC 7591 (OAuth 2.0 Dynamic Client Registration Protocol)
 */
export class OAuthClientRegistrationService {
	private logger: Logger;

	constructor(logger: Logger) {
		this.logger = logger;
	}

	/**
	 * Registers a new OAuth client with an MCP server's registration endpoint
	 *
	 * @param registrationEndpoint - The registration endpoint URL from OAuth metadata
	 * @param request - Client registration request
	 * @returns Client registration response with client_id and optional client_secret
	 * @throws Error if registration fails
	 */
	async registerClient(
		registrationEndpoint: string,
		request: ClientRegistrationRequest
	): Promise<ClientRegistrationResponse> {
		this.logger.info(
			{
				registrationEndpoint,
				clientName: request.client_name,
				redirectUris: request.redirect_uris,
			},
			'Registering OAuth client'
		);

		try {
			// Build registration request body
			const registrationBody: ClientRegistrationRequest = {
				client_name: request.client_name,
				redirect_uris: request.redirect_uris,
				grant_types: request.grant_types || ['authorization_code', 'refresh_token'],
				response_types: request.response_types || ['code'],
				token_endpoint_auth_method: request.token_endpoint_auth_method || 'none', // Public client by default
			};

			// Add scope if provided
			if (request.scope) {
				registrationBody.scope = request.scope;
			}

			// Register client
			const response = await fetch(registrationEndpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Accept: 'application/json',
					'User-Agent': 'DeployStack/1.0',
				},
				body: JSON.stringify(registrationBody),
				signal: AbortSignal.timeout(10000), // 10 second timeout
			});

			if (!response.ok) {
				const errorText = await response.text();
				this.logger.error(
					{
						status: response.status,
						error: errorText,
						registrationEndpoint,
					},
					'Client registration failed'
				);
				throw new Error(`Client registration failed: ${response.status} ${errorText}`);
			}

			const registrationData = (await response.json()) as ClientRegistrationResponse;

			// Validate required fields
			if (!registrationData.client_id) {
				this.logger.error({ registrationData }, 'Registration response missing client_id');
				throw new Error('Registration response missing client_id');
			}

			this.logger.info(
				{
					clientId: registrationData.client_id,
					hasClientSecret: !!registrationData.client_secret,
					tokenEndpointAuthMethod: registrationData.token_endpoint_auth_method,
				},
				'Client registration successful'
			);

			return registrationData;
		} catch (error) {
			this.logger.error(
				{
					error: error instanceof Error ? error.message : 'Unknown error',
					registrationEndpoint,
				},
				'Client registration exception'
			);
			throw error;
		}
	}
}
