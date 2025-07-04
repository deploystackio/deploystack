import { describe, it, expect, vi, beforeEach, afterEach, type MockedFunction } from 'vitest';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import cloudCredentialsRoute from '../../../src/routes/cloud-credentials/index';
import { CloudCredentialsService } from '../../../src/services/cloudCredentialsService';
import { RoleService } from '../../../src/services/roleService';
import { requirePermission } from '../../../src/middleware/roleMiddleware';
import { getEnabledCloudProviders } from '../../../src/config/cloud-providers';

// Mock dependencies
vi.mock('../../../src/services/cloudCredentialsService');
vi.mock('../../../src/services/roleService');
vi.mock('../../../src/middleware/roleMiddleware');
vi.mock('../../../src/config/cloud-providers');

// Type the mocked modules
const mockCloudCredentialsService = CloudCredentialsService as any;
const mockRoleService = RoleService as any;
const mockRequirePermission = requirePermission as MockedFunction<typeof requirePermission>;
const mockGetEnabledCloudProviders = getEnabledCloudProviders as MockedFunction<typeof getEnabledCloudProviders>;

describe('Cloud Credentials Route', () => {
  let mockFastify: Partial<FastifyInstance>;
  let routeHandlers: Record<string, any>;
  let preHandlers: Record<string, any>;
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let mockCloudCredentialsServiceInstance: any;
  let mockRoleServiceInstance: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup route handlers and preHandlers storage
    routeHandlers = {};
    preHandlers = {};

    // Setup mock Fastify instance
    mockFastify = {
      post: vi.fn((path, options, handler) => {
        routeHandlers[`POST ${path}`] = handler;
        preHandlers[`POST ${path}`] = options.preHandler;
        return mockFastify as FastifyInstance;
      }),
      get: vi.fn((path, options, handler) => {
        routeHandlers[`GET ${path}`] = handler;
        preHandlers[`GET ${path}`] = options?.preHandler;
        return mockFastify as FastifyInstance;
      }),
      put: vi.fn((path, options, handler) => {
        routeHandlers[`PUT ${path}`] = handler;
        preHandlers[`PUT ${path}`] = options?.preHandler;
        return mockFastify as FastifyInstance;
      }),
      delete: vi.fn((path, options, handler) => {
        routeHandlers[`DELETE ${path}`] = handler;
        preHandlers[`DELETE ${path}`] = options?.preHandler;
        return mockFastify as FastifyInstance;
      }),
      log: {
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
      },
    } as any;

    // Setup mock request and reply
    mockRequest = {
      body: {},
      params: {},
      user: {
        id: 'user-123',
      },
      log: {
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        fatal: vi.fn(),
        trace: vi.fn(),
        child: vi.fn().mockReturnValue({
          error: vi.fn(),
          info: vi.fn(),
          debug: vi.fn(),
          warn: vi.fn(),
          fatal: vi.fn(),
          trace: vi.fn(),
        }),
        level: 'info',
        silent: vi.fn(),
      },
    } as any;

    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    // Mock requirePermission middleware
    mockRequirePermission.mockReturnValue(vi.fn());

    // Setup mock service instances
    mockCloudCredentialsServiceInstance = {
      getTeamCredentials: vi.fn(),
      getTeamCredentialsGlobalAdmin: vi.fn(),
      getTeamCredentialsBasic: vi.fn(),
      createCredentials: vi.fn(),
      getCredentialById: vi.fn(),
      getCredentialByIdGlobalAdmin: vi.fn(),
      getCredentialByIdBasic: vi.fn(),
      updateCredentials: vi.fn(),
      deleteCredentials: vi.fn(),
    };

    mockRoleServiceInstance = {
      userHasPermission: vi.fn(),
      getUserRole: vi.fn(),
    };

    // Mock service constructors
    mockCloudCredentialsService.mockImplementation(() => mockCloudCredentialsServiceInstance);
    mockRoleService.mockImplementation(() => mockRoleServiceInstance);

    // Mock getEnabledCloudProviders
    mockGetEnabledCloudProviders.mockReturnValue([
      {
        id: 'aws',
        name: 'Amazon Web Services',
        description: 'AWS cloud provider',
        fields: [
          {
            key: 'accessKeyId',
            label: 'Access Key ID',
            type: 'text',
            required: true,
            secret: false,
          },
          {
            key: 'secretAccessKey',
            label: 'Secret Access Key',
            type: 'password',
            required: true,
            secret: true,
          },
        ],
        enabled: true,
      },
    ]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Route Registration', () => {
    it('should register all cloud credentials routes', async () => {
      await cloudCredentialsRoute(mockFastify as FastifyInstance);

      expect(mockFastify.get).toHaveBeenCalledWith(
        '/teams/:teamId/cloud-providers',
        expect.objectContaining({
          schema: expect.objectContaining({
            tags: ['Cloud Credentials'],
            summary: 'List available cloud providers',
          }),
          preHandler: expect.any(Function),
        }),
        expect.any(Function)
      );

      expect(mockFastify.get).toHaveBeenCalledWith(
        '/teams/:teamId/cloud-credentials',
        expect.objectContaining({
          schema: expect.objectContaining({
            tags: ['Cloud Credentials'],
            summary: 'List team cloud credentials',
          }),
          preHandler: expect.any(Function),
        }),
        expect.any(Function)
      );

      expect(mockFastify.post).toHaveBeenCalledWith(
        '/teams/:teamId/cloud-credentials',
        expect.objectContaining({
          schema: expect.objectContaining({
            tags: ['Cloud Credentials'],
            summary: 'Create cloud credentials',
          }),
          preHandler: expect.any(Function),
        }),
        expect.any(Function)
      );

      expect(mockFastify.get).toHaveBeenCalledWith(
        '/teams/:teamId/cloud-credentials/:credentialId',
        expect.objectContaining({
          schema: expect.objectContaining({
            tags: ['Cloud Credentials'],
            summary: 'Get cloud credential by ID',
          }),
          preHandler: expect.any(Function),
        }),
        expect.any(Function)
      );

      expect(mockFastify.put).toHaveBeenCalledWith(
        '/teams/:teamId/cloud-credentials/:credentialId',
        expect.objectContaining({
          schema: expect.objectContaining({
            tags: ['Cloud Credentials'],
            summary: 'Update cloud credentials',
          }),
          preHandler: expect.any(Function),
        }),
        expect.any(Function)
      );

      expect(mockFastify.delete).toHaveBeenCalledWith(
        '/teams/:teamId/cloud-credentials/:credentialId',
        expect.objectContaining({
          schema: expect.objectContaining({
            tags: ['Cloud Credentials'],
            summary: 'Delete cloud credentials',
          }),
          preHandler: expect.any(Function),
        }),
        expect.any(Function)
      );
    });

    it('should use correct permission middleware for each route', async () => {
      await cloudCredentialsRoute(mockFastify as FastifyInstance);

      expect(mockRequirePermission).toHaveBeenCalledWith('cloud_credentials.view');
      expect(mockRequirePermission).toHaveBeenCalledWith('cloud_credentials.create');
      expect(mockRequirePermission).toHaveBeenCalledWith('cloud_credentials.edit');
      expect(mockRequirePermission).toHaveBeenCalledWith('cloud_credentials.delete');
    });
  });

  describe('GET /teams/:teamId/cloud-providers - List Cloud Providers', () => {
    beforeEach(async () => {
      await cloudCredentialsRoute(mockFastify as FastifyInstance);
      mockRequest.params = { teamId: 'team-123' };
    });

    it('should return enabled cloud providers successfully', async () => {
      const handler = routeHandlers['GET /teams/:teamId/cloud-providers'];
      await handler(mockRequest, mockReply);

      expect(mockGetEnabledCloudProviders).toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            id: 'aws',
            name: 'Amazon Web Services',
            enabled: true,
          }),
        ]),
      });
    });

    it('should handle errors when retrieving cloud providers', async () => {
      mockGetEnabledCloudProviders.mockImplementation(() => {
        throw new Error('Configuration error');
      });

      const handler = routeHandlers['GET /teams/:teamId/cloud-providers'];
      await handler(mockRequest, mockReply);

      expect(mockRequest.log?.error).toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to retrieve cloud providers',
      });
    });
  });

  describe('GET /teams/:teamId/cloud-credentials - List Team Credentials', () => {
    beforeEach(async () => {
      await cloudCredentialsRoute(mockFastify as FastifyInstance);
      mockRequest.params = { teamId: 'team-123' };
    });

    it('should return team credentials for team admin', async () => {
      const mockCredentials = [
        {
          id: 'cred-1',
          teamId: 'team-123',
          providerId: 'aws',
          name: 'AWS Production',
          comment: 'Production AWS credentials',
          provider: {
            id: 'aws',
            name: 'Amazon Web Services',
            description: 'AWS cloud provider',
          },
          fields: {
            accessKeyId: { value: 'AKIA...', hasValue: true, secret: false },
            secretAccessKey: { hasValue: true, secret: true },
          },
          createdBy: 'user-123',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      mockRoleServiceInstance.userHasPermission.mockResolvedValue(true);
      mockRoleServiceInstance.getUserRole.mockResolvedValue({ id: 'team_admin' });
      mockCloudCredentialsServiceInstance.getTeamCredentials.mockResolvedValue(mockCredentials);

      const handler = routeHandlers['GET /teams/:teamId/cloud-credentials'];
      await handler(mockRequest, mockReply);

      expect(mockRoleServiceInstance.userHasPermission).toHaveBeenCalledWith('user-123', 'cloud_credentials.edit');
      expect(mockRoleServiceInstance.getUserRole).toHaveBeenCalledWith('user-123');
      expect(mockCloudCredentialsServiceInstance.getTeamCredentials).toHaveBeenCalledWith('team-123');
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: mockCredentials,
      });
    });

    it('should return basic credentials for team member', async () => {
      const mockCredentials = [
        {
          id: 'cred-1',
          teamId: 'team-123',
          providerId: 'aws',
          name: 'AWS Production',
          comment: 'Production AWS credentials',
          provider: {
            id: 'aws',
            name: 'Amazon Web Services',
            description: 'AWS cloud provider',
          },
          createdBy: 'user-123',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      mockRoleServiceInstance.userHasPermission.mockResolvedValue(false);
      mockRoleServiceInstance.getUserRole.mockResolvedValue({ id: 'team_user' });
      mockCloudCredentialsServiceInstance.getTeamCredentialsBasic.mockResolvedValue(mockCredentials);

      const handler = routeHandlers['GET /teams/:teamId/cloud-credentials'];
      await handler(mockRequest, mockReply);

      expect(mockCloudCredentialsServiceInstance.getTeamCredentialsBasic).toHaveBeenCalledWith('team-123');
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: mockCredentials,
      });
    });

    it('should return global admin view for global admin', async () => {
      const mockCredentials = [
        {
          id: 'cred-1',
          teamId: 'team-123',
          providerId: 'aws',
          name: 'AWS Production',
          comment: 'Production AWS credentials',
          provider: {
            id: 'aws',
            name: 'Amazon Web Services',
            description: 'AWS cloud provider',
          },
          fields: {
            accessKeyId: { hasValue: true, secret: false },
            secretAccessKey: { hasValue: true, secret: true },
          },
          createdBy: 'user-123',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      mockRoleServiceInstance.userHasPermission.mockResolvedValue(true);
      mockRoleServiceInstance.getUserRole.mockResolvedValue({ id: 'global_admin' });
      mockCloudCredentialsServiceInstance.getTeamCredentialsGlobalAdmin.mockResolvedValue(mockCredentials);

      const handler = routeHandlers['GET /teams/:teamId/cloud-credentials'];
      await handler(mockRequest, mockReply);

      expect(mockCloudCredentialsServiceInstance.getTeamCredentialsGlobalAdmin).toHaveBeenCalledWith('team-123');
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: mockCredentials,
      });
    });

    it('should return 401 when user is not authenticated', async () => {
      (mockRequest as any).user = null;

      const handler = routeHandlers['GET /teams/:teamId/cloud-credentials'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'User not authenticated',
      });
    });

    it('should handle service errors', async () => {
      mockRoleServiceInstance.userHasPermission.mockRejectedValue(new Error('Database error'));

      const handler = routeHandlers['GET /teams/:teamId/cloud-credentials'];
      await handler(mockRequest, mockReply);

      expect(mockRequest.log?.error).toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to retrieve team credentials',
      });
    });
  });

  describe('POST /teams/:teamId/cloud-credentials - Create Credentials', () => {
    beforeEach(async () => {
      await cloudCredentialsRoute(mockFastify as FastifyInstance);
      mockRequest.params = { teamId: 'team-123' };
    });

    it('should create credentials successfully', async () => {
      const credentialData = {
        providerId: 'aws',
        name: 'AWS Production',
        comment: 'Production AWS credentials',
        credentials: {
          accessKeyId: 'AKIA123456789',
          secretAccessKey: 'secret123',
        },
      };

      const createdCredential = {
        id: 'cred-1',
        teamId: 'team-123',
        providerId: 'aws',
        name: 'AWS Production',
        comment: 'Production AWS credentials',
        provider: {
          id: 'aws',
          name: 'Amazon Web Services',
          description: 'AWS cloud provider',
        },
        fields: {
          accessKeyId: { value: 'AKIA123456789', hasValue: true, secret: false },
          secretAccessKey: { hasValue: true, secret: true },
        },
        createdBy: 'user-123',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mockRequest.body = credentialData;
      mockCloudCredentialsServiceInstance.createCredentials.mockResolvedValue(createdCredential);

      const handler = routeHandlers['POST /teams/:teamId/cloud-credentials'];
      await handler(mockRequest, mockReply);

      expect(mockCloudCredentialsServiceInstance.createCredentials).toHaveBeenCalledWith(
        'team-123',
        (mockRequest as any).user.id,
        credentialData
      );
      expect(mockRequest.log?.info).toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(201);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: createdCredential,
        message: 'Cloud credentials created successfully',
      });
    });

    it('should return 401 when user is not authenticated', async () => {
      (mockRequest as any).user = null;

      const handler = routeHandlers['POST /teams/:teamId/cloud-credentials'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'User not authenticated',
      });
    });

    it('should return 400 for validation errors', async () => {
      const invalidData = {
        providerId: '', // Invalid: empty provider ID
        name: '',
        credentials: {},
      };

      mockRequest.body = invalidData;

      const handler = routeHandlers['POST /teams/:teamId/cloud-credentials'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Validation failed',
        details: expect.any(Array),
      });
    });

    it('should return 409 for duplicate credential names', async () => {
      const credentialData = {
        providerId: 'aws',
        name: 'Existing Credential',
        credentials: {
          accessKeyId: 'AKIA123456789',
          secretAccessKey: 'secret123',
        },
      };

      mockRequest.body = credentialData;
      mockCloudCredentialsServiceInstance.createCredentials.mockRejectedValue(
        new Error('Credential with this name already exists')
      );

      const handler = routeHandlers['POST /teams/:teamId/cloud-credentials'];
      await handler(mockRequest, mockReply);

      expect(mockRequest.log?.error).toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(409);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Credential with this name already exists',
      });
    });

    it('should return 400 for invalid provider errors', async () => {
      const credentialData = {
        providerId: 'invalid-provider',
        name: 'Test Credential',
        credentials: {
          accessKeyId: 'AKIA123456789',
          secretAccessKey: 'secret123',
        },
      };

      mockRequest.body = credentialData;
      mockCloudCredentialsServiceInstance.createCredentials.mockRejectedValue(
        new Error('Invalid provider: invalid-provider')
      );

      const handler = routeHandlers['POST /teams/:teamId/cloud-credentials'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid provider: invalid-provider',
      });
    });

    it('should handle internal server errors', async () => {
      const credentialData = {
        providerId: 'aws',
        name: 'AWS Production',
        credentials: {
          accessKeyId: 'AKIA123456789',
          secretAccessKey: 'secret123',
        },
      };

      mockRequest.body = credentialData;
      mockCloudCredentialsServiceInstance.createCredentials.mockRejectedValue(new Error('Database error'));

      const handler = routeHandlers['POST /teams/:teamId/cloud-credentials'];
      await handler(mockRequest, mockReply);

      expect(mockRequest.log?.error).toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to create cloud credentials',
      });
    });
  });

  describe('GET /teams/:teamId/cloud-credentials/:credentialId - Get Credential', () => {
    beforeEach(async () => {
      await cloudCredentialsRoute(mockFastify as FastifyInstance);
      mockRequest.params = { teamId: 'team-123', credentialId: 'cred-1' };
    });

    it('should return credential for team admin', async () => {
      const mockCredential = {
        id: 'cred-1',
        teamId: 'team-123',
        providerId: 'aws',
        name: 'AWS Production',
        comment: 'Production AWS credentials',
        provider: {
          id: 'aws',
          name: 'Amazon Web Services',
          description: 'AWS cloud provider',
        },
        fields: {
          accessKeyId: { value: 'AKIA...', hasValue: true, secret: false },
          secretAccessKey: { hasValue: true, secret: true },
        },
        createdBy: 'user-123',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mockRoleServiceInstance.userHasPermission.mockResolvedValue(true);
      mockRoleServiceInstance.getUserRole.mockResolvedValue({ id: 'team_admin' });
      mockCloudCredentialsServiceInstance.getCredentialById.mockResolvedValue(mockCredential);

      const handler = routeHandlers['GET /teams/:teamId/cloud-credentials/:credentialId'];
      await handler(mockRequest, mockReply);

      expect(mockCloudCredentialsServiceInstance.getCredentialById).toHaveBeenCalledWith('cred-1', 'team-123');
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: mockCredential,
      });
    });

    it('should return 404 when credential is not found', async () => {
      mockRoleServiceInstance.userHasPermission.mockResolvedValue(true);
      mockRoleServiceInstance.getUserRole.mockResolvedValue({ id: 'team_admin' });
      mockCloudCredentialsServiceInstance.getCredentialById.mockResolvedValue(null);

      const handler = routeHandlers['GET /teams/:teamId/cloud-credentials/:credentialId'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Cloud credential not found',
      });
    });

    it('should return 401 when user is not authenticated', async () => {
      (mockRequest as any).user = null;

      const handler = routeHandlers['GET /teams/:teamId/cloud-credentials/:credentialId'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'User not authenticated',
      });
    });
  });

  describe('PUT /teams/:teamId/cloud-credentials/:credentialId - Update Credentials', () => {
    beforeEach(async () => {
      await cloudCredentialsRoute(mockFastify as FastifyInstance);
      mockRequest.params = { teamId: 'team-123', credentialId: 'cred-1' };
    });

    it('should update credentials successfully', async () => {
      const updateData = {
        name: 'Updated AWS Production',
        comment: 'Updated comment',
        credentials: {
          accessKeyId: 'AKIA987654321',
        },
      };

      const updatedCredential = {
        id: 'cred-1',
        teamId: 'team-123',
        providerId: 'aws',
        name: 'Updated AWS Production',
        comment: 'Updated comment',
        provider: {
          id: 'aws',
          name: 'Amazon Web Services',
          description: 'AWS cloud provider',
        },
        fields: {
          accessKeyId: { value: 'AKIA987654321', hasValue: true, secret: false },
          secretAccessKey: { hasValue: true, secret: true },
        },
        createdBy: 'user-123',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
      };

      mockRequest.body = updateData;
      mockCloudCredentialsServiceInstance.updateCredentials.mockResolvedValue(updatedCredential);

      const handler = routeHandlers['PUT /teams/:teamId/cloud-credentials/:credentialId'];
      await handler(mockRequest, mockReply);

      expect(mockCloudCredentialsServiceInstance.updateCredentials).toHaveBeenCalledWith(
        'cred-1',
        'team-123',
        updateData
      );
      expect(mockRequest.log?.info).toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: updatedCredential,
        message: 'Cloud credentials updated successfully',
      });
    });

    it('should return 404 when credential is not found', async () => {
      const updateData = {
        name: 'Updated Name',
      };

      mockRequest.body = updateData;
      mockCloudCredentialsServiceInstance.updateCredentials.mockResolvedValue(null);

      const handler = routeHandlers['PUT /teams/:teamId/cloud-credentials/:credentialId'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Cloud credential not found',
      });
    });

    it('should return 400 for validation errors', async () => {
      const invalidData = {
        name: '', // Invalid: empty name
      };

      mockRequest.body = invalidData;

      const handler = routeHandlers['PUT /teams/:teamId/cloud-credentials/:credentialId'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Validation failed',
        details: expect.any(Array),
      });
    });
  });

  describe('DELETE /teams/:teamId/cloud-credentials/:credentialId - Delete Credentials', () => {
    beforeEach(async () => {
      await cloudCredentialsRoute(mockFastify as FastifyInstance);
      mockRequest.params = { teamId: 'team-123', credentialId: 'cred-1' };
    });

    it('should delete credentials successfully', async () => {
      mockCloudCredentialsServiceInstance.deleteCredentials.mockResolvedValue(true);

      const handler = routeHandlers['DELETE /teams/:teamId/cloud-credentials/:credentialId'];
      await handler(mockRequest, mockReply);

      expect(mockCloudCredentialsServiceInstance.deleteCredentials).toHaveBeenCalledWith('cred-1', 'team-123');
      expect(mockRequest.log?.info).toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        message: 'Cloud credentials deleted successfully',
      });
    });

    it('should return 404 when credential is not found', async () => {
      mockCloudCredentialsServiceInstance.deleteCredentials.mockResolvedValue(false);

      const handler = routeHandlers['DELETE /teams/:teamId/cloud-credentials/:credentialId'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Cloud credential not found',
      });
    });

    it('should handle service errors', async () => {
      mockCloudCredentialsServiceInstance.deleteCredentials.mockRejectedValue(new Error('Database error'));

      const handler = routeHandlers['DELETE /teams/:teamId/cloud-credentials/:credentialId'];
      await handler(mockRequest, mockReply);

      expect(mockRequest.log?.error).toHaveBeenCalled();
      expect(mockRequest.log?.error).toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to delete cloud credentials',
      });
    });
  });

  describe('Schema Validation', () => {
    beforeEach(async () => {
      await cloudCredentialsRoute(mockFastify as FastifyInstance);
    });

    it('should have proper OpenAPI schema for all routes', async () => {
      const getCalls = (mockFastify.get as any).mock.calls;
      const postCalls = (mockFastify.post as any).mock.calls;
      const putCalls = (mockFastify.put as any).mock.calls;
      const deleteCalls = (mockFastify.delete as any).mock.calls;

      // Check GET /teams/:teamId/cloud-providers
      const getProvidersCall = getCalls.find((call: any) => call[0] === '/teams/:teamId/cloud-providers');
      expect(getProvidersCall).toBeDefined();
      expect(getProvidersCall[1].schema.tags).toEqual(['Cloud Credentials']);
      expect(getProvidersCall[1].schema.summary).toBe('List available cloud providers');

      // Check GET /teams/:teamId/cloud-credentials
      const getCredentialsCall = getCalls.find((call: any) => call[0] === '/teams/:teamId/cloud-credentials');
      expect(getCredentialsCall).toBeDefined();
      expect(getCredentialsCall[1].schema.tags).toEqual(['Cloud Credentials']);
      expect(getCredentialsCall[1].schema.summary).toBe('List team cloud credentials');

      // Check POST /teams/:teamId/cloud-credentials
      const postCall = postCalls.find((call: any) => call[0] === '/teams/:teamId/cloud-credentials');
      expect(postCall).toBeDefined();
      expect(postCall[1].schema.tags).toEqual(['Cloud Credentials']);
      expect(postCall[1].schema.summary).toBe('Create cloud credentials');
      expect(postCall[1].schema.body).toBeDefined();

      // Check GET /teams/:teamId/cloud-credentials/:credentialId
      const getCredentialCall = getCalls.find((call: any) => call[0] === '/teams/:teamId/cloud-credentials/:credentialId');
      expect(getCredentialCall).toBeDefined();
      expect(getCredentialCall[1].schema.tags).toEqual(['Cloud Credentials']);
      expect(getCredentialCall[1].schema.summary).toBe('Get cloud credential by ID');

      // Check PUT /teams/:teamId/cloud-credentials/:credentialId
      const putCall = putCalls.find((call: any) => call[0] === '/teams/:teamId/cloud-credentials/:credentialId');
      expect(putCall).toBeDefined();
      expect(putCall[1].schema.tags).toEqual(['Cloud Credentials']);
      expect(putCall[1].schema.summary).toBe('Update cloud credentials');
      expect(putCall[1].schema.body).toBeDefined();

      // Check DELETE /teams/:teamId/cloud-credentials/:credentialId
      const deleteCall = deleteCalls.find((call: any) => call[0] === '/teams/:teamId/cloud-credentials/:credentialId');
      expect(deleteCall).toBeDefined();
      expect(deleteCall[1].schema.tags).toEqual(['Cloud Credentials']);
      expect(deleteCall[1].schema.summary).toBe('Delete cloud credentials');
    });
  });

  describe('Error Handling Edge Cases', () => {
    beforeEach(async () => {
      await cloudCredentialsRoute(mockFastify as FastifyInstance);
    });

    it('should handle non-Error objects thrown in create route', async () => {
      const credentialData = {
        providerId: 'aws',
        name: 'Test Credential',
        credentials: {
          accessKeyId: 'AKIA123456789',
          secretAccessKey: 'secret123',
        },
      };

      mockRequest.body = credentialData;
      mockRequest.params = { teamId: 'team-123' };
      mockCloudCredentialsServiceInstance.createCredentials.mockRejectedValue('String error');

      const handler = routeHandlers['POST /teams/:teamId/cloud-credentials'];
      await handler(mockRequest, mockReply);

      expect(mockRequest.log?.error).toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to create cloud credentials',
      });
    });

    it('should handle validation errors in update route', async () => {
      const updateData = {
        name: 'a'.repeat(101), // Too long
      };

      mockRequest.body = updateData;
      mockRequest.params = { teamId: 'team-123', credentialId: 'cred-1' };

      const handler = routeHandlers['PUT /teams/:teamId/cloud-credentials/:credentialId'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Validation failed',
        details: expect.any(Array),
      });
    });

    it('should handle conflict errors in update route', async () => {
      const updateData = {
        name: 'Existing Name',
      };

      mockRequest.body = updateData;
      mockRequest.params = { teamId: 'team-123', credentialId: 'cred-1' };
      mockCloudCredentialsServiceInstance.updateCredentials.mockRejectedValue(
        new Error('Credential with this name already exists')
      );

      const handler = routeHandlers['PUT /teams/:teamId/cloud-credentials/:credentialId'];
      await handler(mockRequest, mockReply);

      expect(mockRequest.log?.error).toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(409);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Credential with this name already exists',
      });
    });

    it('should handle service instance creation', async () => {
      // Test that service instances are created properly
      await cloudCredentialsRoute(mockFastify as FastifyInstance);
      
      // The services are instantiated when the route handlers are called, not during route registration
      // So we need to call a handler to trigger service instantiation
      const handler = routeHandlers['GET /teams/:teamId/cloud-credentials'];
      await handler(mockRequest, mockReply);
      
      expect(mockCloudCredentialsService).toHaveBeenCalled();
      expect(mockRoleService).toHaveBeenCalled();
    });
  });
});
