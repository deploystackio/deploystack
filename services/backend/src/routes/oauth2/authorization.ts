/* eslint-disable @typescript-eslint/no-explicit-any */
import { type FastifyInstance } from 'fastify';
import { AuthorizationService } from '../../services/oauth/authorizationService';
import { GlobalSettingsInitService } from '../../global-settings';
import {
  RESPONSE_TYPE_SCHEMA,
  CLIENT_ID_SCHEMA,
  REDIRECT_URI_SCHEMA,
  SCOPE_SCHEMA,
  STATE_SCHEMA,
  CODE_CHALLENGE_SCHEMA,
  CODE_CHALLENGE_METHOD_SCHEMA,
  OAUTH2_ERROR_RESPONSE_SCHEMA,
  type OAuth2ErrorResponse
} from './schemas';

// Reusable Schema Constants
const AUTHORIZATION_QUERY_SCHEMA = {
  type: 'object',
  properties: {
    response_type: {
      ...RESPONSE_TYPE_SCHEMA,
      description: 'OAuth2 response type, must be "code"'
    },
    client_id: {
      ...CLIENT_ID_SCHEMA,
      description: 'OAuth2 client identifier'
    },
    redirect_uri: {
      ...REDIRECT_URI_SCHEMA,
      description: 'OAuth2 redirect URI for callback'
    },
    scope: {
      ...SCOPE_SCHEMA,
      description: 'Space-separated list of requested scopes'
    },
    state: STATE_SCHEMA,
    code_challenge: CODE_CHALLENGE_SCHEMA,
    code_challenge_method: CODE_CHALLENGE_METHOD_SCHEMA,
    team: {
      type: 'string',
      description: 'Team ID for team-scoped OAuth flow (optional, defaults to user team)'
    }
  },
  required: ['response_type', 'client_id', 'redirect_uri', 'scope', 'state', 'code_challenge', 'code_challenge_method'],
  additionalProperties: false
} as const;

// TypeScript interfaces
interface AuthorizationQuery {
  response_type: 'code';
  client_id: string;
  redirect_uri: string;
  scope: string;
  state: string;
  code_challenge: string;
  code_challenge_method: 'S256';
  team?: string;
}

interface TeamSelectionData {
  clientId: string;
  redirectUri: string;
  scope: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  userTeams: Array<{id: string, name: string, isDefault: boolean}>;
  userName: string;
}

// Helper function to generate team selection HTML
function generateTeamSelectionHTML(data: TeamSelectionData): string {
  const clientNames: Record<string, string> = {
    'vscode_mcp_extension': 'VS Code MCP Extension',
    'cursor_mcp_client': 'Cursor MCP Client',
    'claude_ai_mcp_client': 'Claude.ai MCP Client',
    'cline_mcp_client': 'Cline MCP Client'
  };

  const clientName = clientNames[data.clientId] || data.clientId;

  return `
<!DOCTYPE html>
<html>
<head>
  <title>Authorize MCP Client</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      max-width: 500px; 
      margin: 50px auto; 
      padding: 20px; 
      background: #f8f9fa;
    }
    .container {
      background: white;
      padding: 30px;
      border-radius: 12px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .client-info { 
      background: #f5f5f5; 
      padding: 20px; 
      border-radius: 8px; 
      margin-bottom: 25px; 
      border-left: 4px solid #007bff;
    }
    .team-selection { 
      margin-bottom: 25px; 
    }
    select { 
      width: 100%; 
      padding: 12px; 
      border: 2px solid #ddd; 
      border-radius: 6px; 
      font-size: 16px; 
      background: white;
    }
    select:focus {
      border-color: #007bff;
      outline: none;
    }
    .actions { 
      display: flex; 
      gap: 15px; 
      margin-top: 30px;
    }
    button { 
      padding: 12px 24px; 
      border: none; 
      border-radius: 6px; 
      font-size: 16px; 
      cursor: pointer; 
      flex: 1;
      font-weight: 500;
    }
    .approve { 
      background: #007bff; 
      color: white; 
    }
    .approve:hover {
      background: #0056b3;
    }
    .deny { 
      background: #6c757d; 
      color: white; 
    }
    .deny:hover {
      background: #545b62;
    }
    .help-text { 
      font-size: 14px; 
      color: #666; 
      margin-top: 8px; 
      line-height: 1.4;
    }
    h1 {
      color: #333;
      margin-bottom: 10px;
    }
    .user-info {
      color: #666;
      font-size: 14px;
      margin-bottom: 25px;
    }
    .scope-info {
      background: #e3f2fd;
      padding: 15px;
      border-radius: 6px;
      margin-top: 15px;
    }
    .scope-info h4 {
      margin: 0 0 8px 0;
      color: #1976d2;
    }
    .scope-list {
      margin: 0;
      padding-left: 20px;
      color: #555;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Authorize MCP Client</h1>
    <div class="user-info">Signed in as: <strong>${data.userName}</strong></div>
    
    <div class="client-info">
      <h3>${clientName} wants to access your MCP tools</h3>
      <p><strong>Client ID:</strong> ${data.clientId}</p>
      <div class="scope-info">
        <h4>Requested Permissions:</h4>
        <ul class="scope-list">
          ${data.scope.split(' ').map(s => {
            const scopeDescriptions: Record<string, string> = {
              'mcp:read': 'Discover and list your team\'s MCP tools',
              'mcp:tools:execute': 'Execute MCP tools on your behalf',
              'offline_access': 'Maintain access when you\'re not actively using the app'
            };
            return `<li>${scopeDescriptions[s] || s}</li>`;
          }).join('')}
        </ul>
      </div>
    </div>
    
    <form method="POST" action="/api/oauth2/auth">
      <div class="team-selection">
        <label for="team_id"><strong>Select Team:</strong></label>
        <select name="team_id" id="team_id" required>
          ${data.userTeams.map(team => 
            `<option value="${team.id}" ${team.isDefault ? 'selected' : ''}>${team.name}${team.isDefault ? ' (Default)' : ''}</option>`
          ).join('')}
        </select>
        <p class="help-text">MCP servers are team-scoped. Select which team's MCP servers this client can access.</p>
      </div>
      
      <!-- Hidden OAuth parameters -->
      <input type="hidden" name="client_id" value="${data.clientId}">
      <input type="hidden" name="redirect_uri" value="${data.redirectUri}">
      <input type="hidden" name="scope" value="${data.scope}">
      <input type="hidden" name="state" value="${data.state}">
      <input type="hidden" name="code_challenge" value="${data.codeChallenge}">
      <input type="hidden" name="code_challenge_method" value="${data.codeChallengeMethod}">
      <input type="hidden" name="response_type" value="code">
      
      <div class="actions">
        <button type="submit" name="consent" value="true" class="approve">Authorize Access</button>
        <button type="submit" name="consent" value="false" class="deny">Deny Access</button>
      </div>
    </form>
  </div>
</body>
</html>
  `;
}

export default async function authorizationRoute(server: FastifyInstance) {
  // POST handler for team selection form submission
  server.post('/oauth2/auth', {
    schema: {
      tags: ['OAuth2'],
      summary: 'OAuth2 Team Selection Submission',
      description: 'Processes team selection and generates authorization code',
      body: {
        type: 'object',
        properties: {
          client_id: { type: 'string' },
          redirect_uri: { type: 'string' },
          scope: { type: 'string' },
          state: { type: 'string' },
          code_challenge: { type: 'string' },
          code_challenge_method: { type: 'string' },
          response_type: { type: 'string' },
          team_id: { type: 'string' },
          consent: { type: 'string', enum: ['true', 'false'] }
        },
        required: ['client_id', 'redirect_uri', 'scope', 'state', 'code_challenge', 'code_challenge_method', 'response_type', 'team_id', 'consent'],
        additionalProperties: false
      },
      response: {
        302: {
          type: 'string',
          description: 'Redirect to client callback or error redirect'
        },
        500: {
          type: 'string',
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { client_id, redirect_uri, scope, state, code_challenge, code_challenge_method, response_type, team_id, consent } = request.body as {
        client_id: string;
        redirect_uri: string;
        scope: string;
        state: string;
        code_challenge: string;
        code_challenge_method: string;
        response_type: string;
        team_id: string;
        consent: string;
      };

      // Check user authentication
      if (!request.user) {
        const errorUrl = `${redirect_uri}?error=access_denied&error_description=${encodeURIComponent('User not authenticated')}&state=${state}`;
        return reply.redirect(errorUrl);
      }

      if (consent !== 'true') {
        // User denied consent
        const errorUrl = `${redirect_uri}?error=access_denied&error_description=${encodeURIComponent('User denied authorization')}&state=${state}`;
        return reply.redirect(errorUrl);
      }

      // Debug logging for client validation
      request.log.debug({
        operation: 'oauth2_post_validation',
        client_id,
        isDynamicClient: client_id.startsWith('dyn_'),
        hasIsClientRegistered: typeof (server as any).isClientRegistered === 'function',
      }, 'Starting POST handler validation');

      // Validate client first
      const isValidClient = await AuthorizationService.validateClient(client_id, request.log);
      request.log.debug({
        operation: 'oauth2_post_validation',
        client_id,
        isValidClient,
      }, 'Client validation result');

      // Validate other parameters
      const isValidRedirectUri = await AuthorizationService.validateRedirectUri(redirect_uri, client_id, request.log);
      const isValidScope = AuthorizationService.validateScope(scope);
      const isValidResponseType = response_type === 'code';

      request.log.debug({
        operation: 'oauth2_post_validation',
        isValidClient,
        isValidRedirectUri,
        isValidScope,
        isValidResponseType,
      }, 'All validation results');

      // Check if any validation failed
      if (!isValidClient || !isValidRedirectUri || !isValidScope || !isValidResponseType) {
        request.log.warn({
          operation: 'oauth2_post_validation',
          client_id,
          isValidClient,
          isValidRedirectUri,
          isValidScope,
          isValidResponseType,
        }, 'OAuth parameter validation failed');

        const errorUrl = `${redirect_uri}?error=invalid_request&error_description=${encodeURIComponent('Invalid OAuth parameters')}&state=${state}`;
        return reply.redirect(errorUrl);
      }

      // Validate team access
      if (!await AuthorizationService.validateTeamAccess(request.user.id, team_id)) {
        const errorUrl = `${redirect_uri}?error=invalid_request&error_description=${encodeURIComponent('Invalid team selection')}&state=${state}`;
        return reply.redirect(errorUrl);
      }

      // Store authorization request and generate code
      const requestId = await AuthorizationService.storeAuthorizationRequest(
        request.user.id,
        team_id,
        client_id,
        redirect_uri,
        scope,
        state,
        code_challenge,
        code_challenge_method,
        request.log
      );

      const code = await AuthorizationService.generateAuthorizationCode(requestId, request.log);

      if (!code) {
        const errorUrl = `${redirect_uri}?error=server_error&error_description=${encodeURIComponent('Failed to generate authorization code')}&state=${state}`;
        return reply.redirect(errorUrl);
      }

      request.log.debug({
        operation: 'oauth2_team_selection',
        clientId: client_id,
        userId: request.user.id,
        teamId: team_id,
        requestId,
      }, 'Team selection processed, authorization code generated');

      // Redirect back to MCP client with authorization code
      const callbackUrl = `${redirect_uri}?code=${code}&state=${encodeURIComponent(state)}`;
      return reply.redirect(callbackUrl);

    } catch (error) {
      request.log.error({
        operation: 'oauth2_team_selection',
        error,
      }, 'OAuth2 team selection error');

      // Try to redirect with error, fallback to generic error if redirect_uri is not available
      const redirectUri = (request.body as any)?.redirect_uri;
      const state = (request.body as any)?.state;
      
      if (redirectUri) {
        const errorUrl = `${redirectUri}?error=server_error&error_description=${encodeURIComponent('An error occurred processing the authorization request')}&state=${state || ''}`;
        return reply.redirect(errorUrl);
      } else {
        return reply.status(500).send('OAuth2 authorization error');
      }
    }
  });

  server.get('/oauth2/auth', {
    schema: {
      tags: ['OAuth2'],
      summary: 'OAuth2 Authorization Endpoint',
      description: 'Initiates OAuth2 authorization flow with PKCE. Validates client credentials and redirects to consent page for user authorization.',
      querystring: AUTHORIZATION_QUERY_SCHEMA,
      response: {
        302: {
          type: 'string',
          description: 'Redirect to consent page or error redirect'
        },
        400: {
          ...OAUTH2_ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request - Invalid parameters'
        },
        500: {
          ...OAUTH2_ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    try {
      const {
        response_type,
        client_id,
        redirect_uri,
        scope,
        state,
        code_challenge,
        code_challenge_method,
        team
      } = request.query as AuthorizationQuery;

      // Check if user is authenticated first
      if (!request.user) {
        request.log.debug({
          operation: 'oauth2_authorization',
          clientId: client_id,
          error: 'user_not_authenticated',
        }, 'User not authenticated for OAuth authorization');

        // For OAuth flows, redirect to error page with instructions
        const errorUrl = `${redirect_uri}?error=access_denied&error_description=${encodeURIComponent('Please log in to DeployStack web interface first, then retry the OAuth authorization')}&state=${state}`;
        return reply.redirect(errorUrl);
      }

      // Team selection will happen in HTML form - no automatic team assignment
      if (!team) {
        // No team provided - show team selection form
        const userTeams = await AuthorizationService.getUserTeams(request.user.id, request.log);

        if (userTeams.length === 0) {
          const errorUrl = `${redirect_uri}?error=invalid_request&error_description=${encodeURIComponent('User has no teams configured')}&state=${state}`;
          return reply.redirect(errorUrl);
        }

        // Render HTML page with team selection + consent form
        const html = generateTeamSelectionHTML({
          clientId: client_id,
          redirectUri: redirect_uri,
          scope,
          state,
          codeChallenge: code_challenge,
          codeChallengeMethod: code_challenge_method,
          userTeams,
          userName: (request.user as any).username || (request.user as any).email || 'User'
        });

        return reply.type('text/html').send(html);
      }
      
      const teamId = team;

      // Validate response_type (additional validation beyond schema)
      if (response_type !== 'code') {
        request.log.warn({
          operation: 'oauth2_authorization',
          responseType: response_type,
          error: 'unsupported_response_type',
        }, 'Unsupported OAuth2 response type');

        const errorUrl = `${redirect_uri}?error=unsupported_response_type&error_description=${encodeURIComponent('Only "code" response type is supported')}&state=${state}`;
        return reply.redirect(errorUrl);
      }

      request.log.debug({
        operation: 'oauth2_authorization',
        clientId: client_id,
        redirectUri: redirect_uri,
        scope,
        responseType: response_type,
        codeChallengeMethod: code_challenge_method,
      }, 'OAuth2 authorization request received');

      // Validate client_id (including dynamic registration support)
      if (!await AuthorizationService.validateClient(client_id, request.log)) {
        request.log.warn({
          operation: 'oauth2_authorization',
          clientId: client_id,
          error: 'invalid_client',
        }, 'Invalid OAuth2 client');

        const errorUrl = `${redirect_uri}?error=invalid_client&error_description=${encodeURIComponent('Invalid client identifier')}&state=${state}`;
        return reply.redirect(errorUrl);
      }

      // Validate redirect_uri
      if (!await AuthorizationService.validateRedirectUri(redirect_uri, client_id, request.log)) {
        request.log.warn({
          operation: 'oauth2_authorization',
          clientId: client_id,
          redirectUri: redirect_uri,
          error: 'invalid_redirect_uri',
        }, 'Invalid OAuth2 redirect URI');

        const errorResponse: OAuth2ErrorResponse = {
          error: 'invalid_request',
          error_description: 'Invalid redirect URI'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }

      // Validate scope
      if (!AuthorizationService.validateScope(scope)) {
        request.log.warn({
          operation: 'oauth2_authorization',
          clientId: client_id,
          scope,
          error: 'invalid_scope',
        }, 'Invalid OAuth2 scope');

        const errorUrl = `${redirect_uri}?error=invalid_scope&error_description=${encodeURIComponent('Invalid or unsupported scope')}&state=${state}`;
        return reply.redirect(errorUrl);
      }


      // Validate team access
      if (!await AuthorizationService.validateTeamAccess(request.user.id, teamId)) {
        request.log.warn({
          operation: 'oauth2_authorization',
          userId: request.user.id,
          teamId: teamId,
          error: 'invalid_team',
        }, 'User not member of requested team');

        const errorUrl = `${redirect_uri}?error=invalid_team&error_description=${encodeURIComponent('User not member of requested team')}&state=${state}`;
        return reply.redirect(errorUrl);
      }

      // Store authorization request for consent page
      const requestId = await AuthorizationService.storeAuthorizationRequest(
        request.user.id,
        teamId,
        client_id,
        redirect_uri,
        scope,
        state,
        code_challenge,
        code_challenge_method,
        request.log
      );

      request.log.debug({
        operation: 'oauth2_authorization',
        clientId: client_id,
        userId: request.user.id,
        requestId,
      }, 'Authorization request stored, redirecting to frontend consent');

      // Get frontend URL and redirect to frontend consent page
      const frontendUrl = await GlobalSettingsInitService.getPageUrl();
      const consentUrl = `${frontendUrl}/oauth/consent?request_id=${requestId}`;
      return reply.redirect(consentUrl);

    } catch (error) {
      request.log.error({
        operation: 'oauth2_authorization',
        error,
      }, 'OAuth2 authorization error');

      const errorResponse: OAuth2ErrorResponse = {
        error: 'server_error',
        error_description: 'An error occurred processing the authorization request'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
