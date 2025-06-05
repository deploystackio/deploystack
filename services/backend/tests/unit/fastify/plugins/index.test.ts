import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest'
import { FastifyInstance } from 'fastify'
import { registerFastifyPlugins } from '@src/fastify/plugins/index'

// Mock @fastify/cors
vi.mock('@fastify/cors', () => ({
  default: vi.fn()
}))

import fastifyCors from '@fastify/cors'
const mockFastifyCors = fastifyCors as MockedFunction<typeof fastifyCors>

describe('Fastify Plugins', () => {
  let mockServer: FastifyInstance
  const originalEnv = process.env

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()
    
    // Reset environment variables
    process.env = { ...originalEnv }
    
    // Mock FastifyInstance
    mockServer = {
      register: vi.fn().mockResolvedValue(undefined),
      log: {
        info: vi.fn(),
        child: vi.fn(),
        level: 'info',
        fatal: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        trace: vi.fn(),
        silent: vi.fn()
      }
    } as unknown as FastifyInstance
  })

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv
  })

  describe('registerFastifyPlugins', () => {
    it('should register CORS plugin with default origins', async () => {
      await registerFastifyPlugins(mockServer)

      expect(mockServer.register).toHaveBeenCalledWith(
        mockFastifyCors,
        {
          origin: [
            'http://localhost:5173',
            'http://localhost:5174',
            'http://localhost:3000',
            'http://localhost:4173'
          ],
          credentials: true,
          methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
        }
      )
    })

    it('should include frontend URL from environment variable when provided', async () => {
      process.env.DEPLOYSTACK_FRONTEND_URL = 'https://example.com'

      await registerFastifyPlugins(mockServer)

      expect(mockServer.register).toHaveBeenCalledWith(
        mockFastifyCors,
        {
          origin: [
            'http://localhost:5173',
            'http://localhost:5174',
            'http://localhost:3000',
            'http://localhost:4173',
            'https://example.com'
          ],
          credentials: true,
          methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
        }
      )
    })

    it('should not duplicate frontend URL if it matches a default origin', async () => {
      process.env.DEPLOYSTACK_FRONTEND_URL = 'http://localhost:5173'

      await registerFastifyPlugins(mockServer)

      expect(mockServer.register).toHaveBeenCalledWith(
        mockFastifyCors,
        {
          origin: [
            'http://localhost:5173',
            'http://localhost:5174',
            'http://localhost:3000',
            'http://localhost:4173',
            'http://localhost:5173'
          ],
          credentials: true,
          methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
        }
      )
    })

    it('should handle empty frontend URL environment variable', async () => {
      process.env.DEPLOYSTACK_FRONTEND_URL = ''

      await registerFastifyPlugins(mockServer)

      expect(mockServer.register).toHaveBeenCalledWith(
        mockFastifyCors,
        {
          origin: [
            'http://localhost:5173',
            'http://localhost:5174',
            'http://localhost:3000',
            'http://localhost:4173'
          ],
          credentials: true,
          methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
        }
      )
    })

    it('should handle undefined frontend URL environment variable', async () => {
      delete process.env.DEPLOYSTACK_FRONTEND_URL

      await registerFastifyPlugins(mockServer)

      expect(mockServer.register).toHaveBeenCalledWith(
        mockFastifyCors,
        {
          origin: [
            'http://localhost:5173',
            'http://localhost:5174',
            'http://localhost:3000',
            'http://localhost:4173'
          ],
          credentials: true,
          methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
        }
      )
    })

    it('should log the configured origins', async () => {
      process.env.DEPLOYSTACK_FRONTEND_URL = 'https://production.example.com'

      await registerFastifyPlugins(mockServer)

      expect(mockServer.log.info).toHaveBeenCalledWith(
        'CORS configured with origins: http://localhost:5173, http://localhost:5174, http://localhost:3000, http://localhost:4173, https://production.example.com'
      )
    })

    it('should log default origins when no frontend URL is provided', async () => {
      delete process.env.DEPLOYSTACK_FRONTEND_URL

      await registerFastifyPlugins(mockServer)

      expect(mockServer.log.info).toHaveBeenCalledWith(
        'CORS configured with origins: http://localhost:5173, http://localhost:5174, http://localhost:3000, http://localhost:4173'
      )
    })

    it('should register plugin only once', async () => {
      await registerFastifyPlugins(mockServer)

      expect(mockServer.register).toHaveBeenCalledTimes(1)
    })

    it('should handle plugin registration errors gracefully', async () => {
      const registrationError = new Error('Plugin registration failed')
      mockServer.register = vi.fn().mockRejectedValue(registrationError)

      await expect(registerFastifyPlugins(mockServer)).rejects.toThrow('Plugin registration failed')
    })

    it('should configure CORS with correct credentials setting', async () => {
      await registerFastifyPlugins(mockServer)

      const corsConfig = (mockServer.register as MockedFunction<any>).mock.calls[0][1] as any
      expect(corsConfig.credentials).toBe(true)
    })

    it('should configure CORS with correct HTTP methods', async () => {
      await registerFastifyPlugins(mockServer)

      const corsConfig = (mockServer.register as MockedFunction<any>).mock.calls[0][1] as any
      expect(corsConfig.methods).toEqual(['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])
    })

    it('should build origins array correctly with multiple environment scenarios', async () => {
      // Test with a complex frontend URL
      process.env.DEPLOYSTACK_FRONTEND_URL = 'https://app.deploystack.com:8080'

      await registerFastifyPlugins(mockServer)

      const corsConfig = (mockServer.register as MockedFunction<any>).mock.calls[0][1] as any
      expect(corsConfig.origin).toContain('https://app.deploystack.com:8080')
      expect(corsConfig.origin).toHaveLength(5) // 4 defaults + 1 from env
    })
  })

  describe('Origins Array Building', () => {
    it('should always include default development origins', async () => {
      await registerFastifyPlugins(mockServer)

      const corsConfig = (mockServer.register as MockedFunction<any>).mock.calls[0][1] as any
      const origins = corsConfig.origin

      expect(origins).toContain('http://localhost:5173') // Vite dev server
      expect(origins).toContain('http://localhost:5174') // Alternative Vite dev server
      expect(origins).toContain('http://localhost:3000') // Frontend production
      expect(origins).toContain('http://localhost:4173') // Vite preview
    })

    it('should maintain order of origins', async () => {
      process.env.DEPLOYSTACK_FRONTEND_URL = 'https://custom.example.com'

      await registerFastifyPlugins(mockServer)

      const corsConfig = (mockServer.register as MockedFunction<any>).mock.calls[0][1] as any
      const origins = corsConfig.origin

      expect(origins[0]).toBe('http://localhost:5173')
      expect(origins[1]).toBe('http://localhost:5174')
      expect(origins[2]).toBe('http://localhost:3000')
      expect(origins[3]).toBe('http://localhost:4173')
      expect(origins[4]).toBe('https://custom.example.com')
    })
  })
})
