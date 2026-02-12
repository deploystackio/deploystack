import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDb, getSchema } from '../../../db';
import { eq, and } from 'drizzle-orm';
import { OAuthTokenService } from '../../../services/OAuthTokenService';
import { encrypt, decrypt } from '../../../utils/encryption';
import { GlobalSettingsInitService } from '../../../global-settings';
import { GlobalSettings } from '../../../global-settings';
import { nanoid } from 'nanoid';
import { sanitizeText } from '../../../utils/sanitization';
import {
	OAUTH_CALLBACK_QUERY_SCHEMA,
	FLOW_ID_PARAM_SCHEMA,
	type OAuthCallbackQuery,
	type FlowIdParams,
} from './schemas';

/**
 * OAuth callback route for MCP server authentication
 *
 * This endpoint receives the authorization code from the OAuth provider,
 * exchanges it for access/refresh tokens, encrypts and stores them,
 * and completes the installation.
 *
 * Flow:
 * 1. Validate state parameter (CSRF protection)
 * 2. Find pending installation
 * 3. Exchange code for tokens using PKCE
 * 4. Encrypt and store tokens
 * 5. Mark installation as complete
 * 6. Redirect to frontend with success status
 */
export default async function oauthCallbackRoute(server: FastifyInstance) {
	server.get(
		'/teams/:teamId/mcp/oauth/callback/:flowId',
		{
			schema: {
				description: 'OAuth callback endpoint for MCP server authentication',
				tags: ['MCP Installations', 'OAuth'],
				params: FLOW_ID_PARAM_SCHEMA,
				querystring: OAUTH_CALLBACK_QUERY_SCHEMA,
			},
		},
		async (request: FastifyRequest, reply: FastifyReply) => {
			const query = request.query as OAuthCallbackQuery;
			const params = request.params as FlowIdParams;
			const { teamId, flowId } = params;
			const db = getDb();
			const { oauthPendingFlows, mcpServerInstallations, mcpServers, mcpOauthTokens } = getSchema();

			// Check for OAuth errors from provider
			if (query.error) {
				request.log.warn(
					{
						error: query.error,
						description: query.error_description,
						flowId,
						teamId,
					},
					'OAuth callback received error from provider'
				);

				// Render error page that posts message to opener
				const frontendUrl = await GlobalSettingsInitService.getPageUrl();
				const errorMsg = query.error_description || query.error;
				return reply.type('text/html').send(`
					<!DOCTYPE html>
					<html>
						<head>
							<title>Authorization Failed</title>
							<meta charset="utf-8">
						</head>
						<body>
							<h1>Authorization Failed</h1>
							<p><strong>Error:</strong> ${sanitizeText(query.error)}</p>
							${query.error_description ? `<p>${sanitizeText(query.error_description)}</p>` : ''}
							<p>Closing window...</p>
							<script>
								// Post error message to parent window
								if (window.opener) {
									window.opener.postMessage({
										type: 'oauth_error',
										error: '${sanitizeText(errorMsg)}'
									}, '${frontendUrl}');
								}

								// Close the popup window
								setTimeout(() => {
									window.close();
								}, 500);
							</script>
						</body>
					</html>
				`);
			}

			// Validate required parameters
			if (!query.state || !query.code) {
				request.log.error(
					{ state: query.state, hasCode: !!query.code, flowId },
					'Missing required OAuth parameters'
				);
				return reply.code(400).send({ error: 'Missing required OAuth parameters (state or code)' });
			}

			// Find pending flow by flowId and state
			const [flow] = await db
				.select()
				.from(oauthPendingFlows)
				.where(
					and(
						eq(oauthPendingFlows.id, flowId),
						eq(oauthPendingFlows.team_id, teamId),
						eq(oauthPendingFlows.oauth_state, query.state)
					)
				)
				.limit(1);

			if (!flow) {
				request.log.error(
					{ state: query.state, flowId, teamId },
					'No pending flow found for state'
				);
				return reply.code(404).send({ error: 'Flow not found or OAuth state invalid' });
			}

			// Determine if this is re-auth or new installation
			const isReAuth = flow.installation_id !== null;

			request.log.info({
				operation: 'oauth_callback',
				flowId,
				teamId,
				isReAuth,
				installationId: flow.installation_id || 'new'
			}, isReAuth ? 'Processing re-authentication callback' : 'Processing new installation callback');

			// Check if expired
			if (flow.expires_at < new Date()) {
				request.log.warn({ flowId }, 'OAuth pending flow expired');

				// Delete expired flow
				await db.delete(oauthPendingFlows).where(eq(oauthPendingFlows.id, flow.id));

				return reply.code(400).send({ error: 'Flow expired. Please try again.' });
			}

			// Get MCP server details
			const [mcpServer] = await db
				.select()
				.from(mcpServers)
				.where(eq(mcpServers.id, flow.server_id))
				.limit(1);

			if (!mcpServer) {
				request.log.error({ serverId: flow.server_id }, 'MCP server not found');
				return reply.code(404).send({ error: 'MCP server not found' });
			}

			try {
				// Construct redirect URI (must match what was sent in authorization request)
				const backendUrl = await GlobalSettings.get('global.backend_url', 'http://localhost:3000');
				const redirectUri = `${backendUrl}/api/teams/${teamId}/mcp/oauth/callback/${flowId}`;

				// Get OAuth configuration from flow record
				const clientId = flow.oauth_client_id;
				const tokenEndpoint = flow.oauth_token_endpoint;
				const tokenEndpointAuthMethod = flow.oauth_token_endpoint_auth_method as 'client_secret_post' | 'client_secret_basic' | 'none';

				// Decrypt client secret if present (for pre-registered providers)
				let clientSecret: string | null = null;
				if (flow.oauth_client_secret) {
					try {
						clientSecret = decrypt(flow.oauth_client_secret, request.log);
					} catch {
						request.log.error({ flowId: flow.id }, 'Failed to decrypt client secret');
						// Continue without client secret - may fail at token exchange
					}
				}

				request.log.info(
					{
						clientId,
						flowId: flow.id,
						tokenEndpoint,
						authMethod: tokenEndpointAuthMethod,
						hasClientSecret: !!clientSecret,
						hasProviderId: !!flow.oauth_provider_id
					},
					'Using OAuth configuration for token exchange'
				);

				// Exchange code for token using PKCE verification
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const tokenService = new OAuthTokenService(request.log as any);
				const tokenResponse = await tokenService.exchangeCodeForToken({
					code: query.code,
					codeVerifier: flow.oauth_code_verifier,
					clientId,
					redirectUri,
					tokenEndpoint,
					clientSecret,
					tokenEndpointAuthMethod,
				});

				// Calculate token expiry
				const expiresAt = tokenResponse.expires_in
					? new Date(Date.now() + tokenResponse.expires_in * 1000)
					: null;

				// Encrypt tokens (needed for both re-auth and new install)
				const encryptedAccessToken = encrypt(tokenResponse.access_token, request.log);
				const encryptedRefreshToken = tokenResponse.refresh_token
					? encrypt(tokenResponse.refresh_token, request.log)
					: null;

				// ============================================================================
				// RE-AUTHENTICATION PATH
				// ============================================================================
				if (isReAuth) {
					request.log.info({
						operation: 'oauth_reauth',
						installationId: flow.installation_id,
						teamId: flow.team_id
					}, 'Updating existing installation tokens');

					// Find existing token record
					const [existingToken] = await db
						.select()
						.from(mcpOauthTokens)
						.where(eq(mcpOauthTokens.installation_id, flow.installation_id!))
						.limit(1);

					if (!existingToken) {
						request.log.error({
							operation: 'oauth_reauth',
							installationId: flow.installation_id
						}, 'Token record not found for installation');

						// Delete pending flow
						await db.delete(oauthPendingFlows).where(eq(oauthPendingFlows.id, flow.id));

						// Return error page
						const frontendUrl = await GlobalSettingsInitService.getPageUrl();
						return reply.type('text/html').send(`
							<!DOCTYPE html>
							<html>
								<head>
									<title>Re-authentication Failed</title>
									<meta charset="utf-8">
									<style>
										body {
											font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
											display: flex;
											align-items: center;
											justify-content: center;
											height: 100vh;
											margin: 0;
											background: #f5f5f5;
										}
										.container {
											text-align: center;
											padding: 40px;
											background: white;
											border-radius: 8px;
											box-shadow: 0 2px 8px rgba(0,0,0,0.1);
										}
										.error-icon {
											font-size: 48px;
											color: #ef4444;
											margin-bottom: 16px;
										}
										h1 {
											font-size: 24px;
											margin: 0 0 8px 0;
											color: #1f2937;
										}
										p {
											color: #6b7280;
											margin: 0;
										}
									</style>
								</head>
								<body>
									<div class="container">
										<div class="error-icon">✗</div>
										<h1>Re-authentication Failed</h1>
										<p>Token record not found. Please contact support.</p>
										<p style="margin-top: 16px; font-size: 14px;">This window will close automatically...</p>
									</div>
									<script>
										if (window.opener) {
											window.opener.postMessage({
												type: 'oauth_error',
												error: 'Token record not found'
											}, '${frontendUrl}');
										}
										setTimeout(() => {
											window.close();
										}, 2000);
									</script>
								</body>
							</html>
						`);
					}

					// UPDATE existing token record
					await db
						.update(mcpOauthTokens)
						.set({
							access_token: encryptedAccessToken,
							refresh_token: encryptedRefreshToken || existingToken.refresh_token, // Keep old if not rotated
							expires_at: expiresAt,
							scope: tokenResponse.scope || existingToken.scope,
							updated_at: new Date()
						})
						.where(eq(mcpOauthTokens.id, existingToken.id));

					request.log.info({
						operation: 'oauth_reauth',
						installationId: flow.installation_id,
						tokenId: existingToken.id,
						expiresAt
					}, 'Tokens updated successfully');

					// UPDATE all user instances status after re-authentication
					const { mcpServerInstances } = getSchema();
					await db
						.update(mcpServerInstances)
						.set({
							status: 'connecting',
							status_message: 'Re-authenticated successfully, reconnecting to server',
							status_updated_at: new Date()
						})
						.where(eq(mcpServerInstances.installation_id, flow.installation_id!));

					// Update installation OAuth config + pending flag
					// Re-auth performs new DCR registration, so oauth_client_id/secret
					// must be updated for the token refresh cron job to work correctly
					await db
						.update(mcpServerInstallations)
						.set({
							oauth_pending: false,
							oauth_client_id: flow.oauth_client_id,
							oauth_client_secret: flow.oauth_client_secret,
							oauth_provider_id: flow.oauth_provider_id || null,
							oauth_token_endpoint: flow.oauth_token_endpoint,
							oauth_token_endpoint_auth_method: flow.oauth_token_endpoint_auth_method,
							updated_at: new Date()
						})
						.where(eq(mcpServerInstallations.id, flow.installation_id!));

					request.log.info({
						operation: 'oauth_reauth',
						installationId: flow.installation_id
					}, 'Installation status updated to connecting');

					// Notify satellites to reconnect
					try {
						const { SatelliteCommandService } = await import('../../../services/satelliteCommandService');
						const satelliteCommandService = new SatelliteCommandService(db, request.log);
						await satelliteCommandService.notifyMcpInstallation(
							flow.installation_id!,
							flow.team_id,
							flow.created_by
						);

						request.log.info({
							operation: 'oauth_reauth',
							installationId: flow.installation_id
						}, 'Satellite notified of token update');
					} catch (commandError) {
						request.log.error(commandError, `Failed to create satellite commands for re-auth ${flow.installation_id}:`);
						// Don't fail re-auth if command creation fails
					}

					// Delete pending flow
					await db.delete(oauthPendingFlows).where(eq(oauthPendingFlows.id, flow.id));

					request.log.info({
						operation: 'oauth_reauth',
						installationId: flow.installation_id,
						flowId: flow.id,
						serverId: mcpServer.id,
						teamId: flow.team_id
					}, 'OAuth re-authentication completed successfully');

					// Return success page with postMessage
					const frontendUrl = await GlobalSettingsInitService.getPageUrl();
					return reply.type('text/html').send(`
						<!DOCTYPE html>
						<html>
							<head>
								<title>Re-authentication Successful</title>
								<meta charset="utf-8">
								<style>
									body {
										font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
										display: flex;
										align-items: center;
										justify-content: center;
										height: 100vh;
										margin: 0;
										background: #f5f5f5;
									}
									.container {
										text-align: center;
										padding: 40px;
										background: white;
										border-radius: 8px;
										box-shadow: 0 2px 8px rgba(0,0,0,0.1);
									}
									.success-icon {
										font-size: 48px;
										color: #10b981;
										margin-bottom: 16px;
									}
									h1 {
										font-size: 24px;
										margin: 0 0 8px 0;
										color: #1f2937;
									}
									p {
										color: #6b7280;
										margin: 0;
									}
								</style>
							</head>
							<body>
								<div class="container">
									<div class="success-icon">✓</div>
									<h1>Success!</h1>
									<p>Re-authentication successful! Reconnecting to server...</p>
									<p style="margin-top: 16px; font-size: 14px;">This window will close automatically...</p>
								</div>
								<script>
									if (window.opener) {
										window.opener.postMessage({
											type: 'oauth_reauth_success',
											installation_id: '${flow.installation_id}'
										}, '${frontendUrl}');
									}
									setTimeout(() => {
										window.close();
									}, 500);
								</script>
							</body>
						</html>
					`);
				}

				// ============================================================================
				// NEW INSTALLATION PATH (existing behavior)
				// ============================================================================

				// Parse team config
				const teamConfig = flow.team_config ? JSON.parse(flow.team_config) : {};

				// CREATE INSTALLATION NOW (after successful OAuth - not before!)
				const installationId = nanoid();
				await db.insert(mcpServerInstallations).values({
					id: installationId,
					team_id: flow.team_id,
					server_id: flow.server_id,
					created_by: flow.created_by,
					installation_name: flow.installation_name,
					installation_type: flow.installation_type,
					satellite_id: flow.satellite_id || null,
					team_args: teamConfig.team_args ? JSON.stringify(teamConfig.team_args) : null,
					team_env: teamConfig.team_env ? JSON.stringify(teamConfig.team_env) : null,
					team_headers: teamConfig.team_headers ? JSON.stringify(teamConfig.team_headers) : null,
					team_url_query_params: teamConfig.team_url_query_params ? JSON.stringify(teamConfig.team_url_query_params) : null,
					// DO NOT set oauth_pending fields - installation is complete from the start
					oauth_state: null,
					oauth_code_verifier: null,
					oauth_pending: false,
					oauth_pending_expires_at: null,
					oauth_client_id: flow.oauth_client_id,
					oauth_client_secret: flow.oauth_client_secret,
					oauth_provider_id: flow.oauth_provider_id || null,
					oauth_token_endpoint: flow.oauth_token_endpoint,
					oauth_token_endpoint_auth_method: flow.oauth_token_endpoint_auth_method,
					created_at: new Date(),
					updated_at: new Date(),
					last_used_at: null,
				});

				// Store encrypted tokens (already encrypted above for both re-auth and new install)
				await db.insert(mcpOauthTokens).values({
					id: nanoid(),
					installation_id: installationId,
					user_id: flow.created_by,
					team_id: flow.team_id,
					access_token: encryptedAccessToken,
					refresh_token: encryptedRefreshToken,
					token_type: tokenResponse.token_type || 'Bearer',
					expires_at: expiresAt,
					scope: tokenResponse.scope || null,
					created_at: new Date(),
					updated_at: new Date(),
				});

				// DELETE the flow (critical - prevents reuse and cleans up temporary data)
				await db.delete(oauthPendingFlows).where(eq(oauthPendingFlows.id, flow.id));

				// Create instance for installing user (OAuth already completed, ready to connect)
				try {
					const { McpInstanceService } = await import('../../../services/mcpInstanceService');
					const instanceService = new McpInstanceService(db, request.log);

					await instanceService.createInstance(
						installationId,
						flow.created_by,
						'connecting'
					);

					request.log.info({
						operation: 'oauth_callback_create_instance',
						installationId,
						userId: flow.created_by,
						status: 'connecting'
					}, 'Created instance for installing user');
				} catch (instanceError) {
					request.log.error({
						operation: 'oauth_callback_create_instance',
						installationId,
						userId: flow.created_by,
						error: instanceError instanceof Error ? instanceError.message : 'Unknown'
					}, 'Failed to create instance for installing user');
				}

				// Create instances for all other team members (they need their own OAuth authorization)
				try {
					const { TeamService } = await import('../../../services/teamService');
					const { McpInstanceService } = await import('../../../services/mcpInstanceService');

					const instanceService = new McpInstanceService(db, request.log);

					const allMembers = await TeamService.getTeamMembers(flow.team_id);
					const otherMembers = allMembers.filter(member => member.user_id !== flow.created_by);

					request.log.info({
						operation: 'oauth_callback_provision_instances',
						installationId,
						teamId: flow.team_id,
						otherMemberCount: otherMembers.length,
						totalMembers: allMembers.length
					}, `Provisioning instances for ${otherMembers.length} other team members`);

					for (const member of otherMembers) {
						try {
							await instanceService.createInstance(
								installationId,
								member.user_id,
								'awaiting_user_config',
								'OAuth authorization required. Please authenticate with your own account.'
							);

							request.log.debug({
								operation: 'oauth_callback_provision_instance',
								installationId,
								userId: member.user_id,
								status: 'awaiting_user_config'
							}, 'Instance provisioned for team member');
						} catch (memberError) {
							request.log.error({
								operation: 'oauth_callback_provision_instance',
								installationId,
								userId: member.user_id,
								error: memberError instanceof Error ? memberError.message : 'Unknown'
							}, 'Failed to provision instance for team member');
						}
					}
				} catch (teamError) {
					request.log.error({
						operation: 'oauth_callback_provision_instances',
						installationId,
						teamId: flow.team_id,
						error: teamError instanceof Error ? teamError.message : 'Unknown'
					}, 'Failed to provision instances for other team members');
				}

				// Create satellite commands for immediate notification
				try {
					const { SatelliteCommandService } = await import('../../../services/satelliteCommandService');
					const satelliteCommandService = new SatelliteCommandService(db, request.log);
					const commands = await satelliteCommandService.notifyMcpInstallation(
						installationId,
						flow.team_id,
						flow.created_by
					);

					request.log.info(
						{
							installationId,
							flowId: flow.id,
							commandsCreated: commands.length,
							satelliteIds: commands.map(c => c.satellite_id)
						},
						'Satellite commands created for OAuth MCP installation'
					);
				} catch (commandError) {
					request.log.error(commandError, `Failed to create satellite commands for installation ${installationId}:`);
					// Don't fail OAuth completion if command creation fails
				}

				request.log.info(
					{
						installationId,
						flowId: flow.id,
						serverId: mcpServer.id,
						teamId: flow.team_id,
						userId: flow.created_by,
						providerId: flow.oauth_provider_id,
						authMethod: tokenEndpointAuthMethod,
					},
					'OAuth flow completed successfully - installation created'
				);

				// Return HTML page that posts message to opener and closes
				const frontendUrl = await GlobalSettingsInitService.getPageUrl();
				return reply.type('text/html').send(`
					<!DOCTYPE html>
					<html>
						<head>
							<title>Authorization Successful</title>
							<meta charset="utf-8">
						</head>
						<body>
							<h1>Authorization Successful</h1>
							<p>Closing window...</p>
							<script>
								// Post success message to parent window
								if (window.opener) {
									window.opener.postMessage({
										type: 'oauth_success',
										installation_id: '${installationId}'
									}, '${frontendUrl}');
								}

								// Close the popup window
								setTimeout(() => {
									window.close();
								}, 500);
							</script>
						</body>
					</html>
				`);
			} catch (error) {
				request.log.error(
					{
						error: error instanceof Error ? error.message : 'Unknown error',
						flowId: flow.id,
					},
					'OAuth callback processing failed'
				);

				// Clean up failed flow (NOT installation, since we didn't create one yet)
				await db.delete(oauthPendingFlows).where(eq(oauthPendingFlows.id, flow.id));

				// Render error page that posts message to opener
				const frontendUrl = await GlobalSettingsInitService.getPageUrl();
				const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
				return reply.type('text/html').send(`
					<!DOCTYPE html>
					<html>
						<head>
							<title>Authorization Failed</title>
							<meta charset="utf-8">
						</head>
						<body>
							<h1>Authorization Failed</h1>
							<p>An error occurred while processing the authorization.</p>
							<p>Closing window...</p>
							<script>
								// Post error message to parent window
								if (window.opener) {
									window.opener.postMessage({
										type: 'oauth_error',
										error: '${sanitizeText(errorMessage)}'
									}, '${frontendUrl}');
								}

								// Close the popup window
								setTimeout(() => {
									window.close();
								}, 500);
							</script>
						</body>
					</html>
				`);
			}
		}
	);
}