import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest'
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { randomUUID } from 'crypto'
import { registerRequestLoggerHooks } from '@src/fastify/hooks/request-logger'

// Mock crypto module
vi.mock('crypto', () => ({
  randomUUID: vi.fn()
}))

const mockRandomUUID = randomUUID as MockedFunction<typeof randomUUID>

describe('Request Logger Hooks', () => {
  let mockServer: FastifyInstance
  let mockRequest: Partial<FastifyRequest>
  let mockReply: Partial<FastifyReply>
  let onRequestHook: Function
  let onResponseHook: Function

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()
    
    // Mock FastifyInstance
    mockServer = {
      addHook: vi.fn((hookName: string, handler: Function) => {
        if (hookName === 'onRequest') {
          onRequestHook = handler
        } else if (hookName === 'onResponse') {
          onResponseHook = handler
        }
      })
    } as unknown as FastifyInstance

    // Mock FastifyRequest
    mockRequest = {
      headers: {},
      url: '/api/test',
      method: 'GET',
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
    }

    // Mock FastifyReply
    mockReply = {
      header: vi.fn(),
      startTime: 0,
      statusCode: 200
    }

    // Setup default UUID mock
    mockRandomUUID.mockReturnValue('550e8400-e29b-41d4-a716-446655440000')
  })

  describe('registerRequestLoggerHooks', () => {
    it('should register onRequest and onResponse hooks', () => {
      registerRequestLoggerHooks(mockServer)

      expect(mockServer.addHook).toHaveBeenCalledTimes(2)
      expect(mockServer.addHook).toHaveBeenCalledWith('onRequest', expect.any(Function))
      expect(mockServer.addHook).toHaveBeenCalledWith('onResponse', expect.any(Function))
    })
  })

  describe('onRequest Hook', () => {
    beforeEach(() => {
      registerRequestLoggerHooks(mockServer)
    })

    it('should generate new request ID when no header is provided', () => {
      const done = vi.fn()
      mockRequest.headers = {}

      onRequestHook(mockRequest, mockReply, done)

      expect(mockRandomUUID).toHaveBeenCalled()
      expect(mockRequest.id).toBe('550e8400-e29b-41d4-a716-446655440000')
      expect(mockReply.header).toHaveBeenCalledWith('x-request-id', '550e8400-e29b-41d4-a716-446655440000')
      expect(done).toHaveBeenCalled()
    })

    it('should use existing request ID from header when provided', () => {
      const done = vi.fn()
      const existingId = 'existing-request-id'
      mockRequest.headers = { 'x-request-id': existingId }

      onRequestHook(mockRequest, mockReply, done)

      expect(mockRandomUUID).not.toHaveBeenCalled()
      expect(mockRequest.id).toBe(existingId)
      expect(mockReply.header).toHaveBeenCalledWith('x-request-id', existingId)
      expect(done).toHaveBeenCalled()
    })

    it('should handle array header values by using first element', () => {
      const done = vi.fn()
      const headerArray = ['first-id', 'second-id']
      mockRequest.headers = { 'x-request-id': headerArray }

      onRequestHook(mockRequest, mockReply, done)

      expect(mockRandomUUID).not.toHaveBeenCalled()
      expect(mockRequest.id).toBe('first-id')
      expect(mockReply.header).toHaveBeenCalledWith('x-request-id', 'first-id')
      expect(done).toHaveBeenCalled()
    })

    it('should set start time on reply', () => {
      const done = vi.fn()
      const mockNow = 1234567890
      vi.spyOn(Date, 'now').mockReturnValue(mockNow)

      onRequestHook(mockRequest, mockReply, done)

      expect(mockReply.startTime).toBe(mockNow)
      expect(done).toHaveBeenCalled()
    })

    it('should log request received with correct information', () => {
      const done = vi.fn()
      mockRequest.headers = { 'x-request-id': 'test-id' }

      onRequestHook(mockRequest, mockReply, done)

      expect(mockRequest.log!.info).toHaveBeenCalledWith(
        {
          url: '/api/test',
          method: 'GET',
          requestId: 'test-id'
        },
        'request received'
      )
      expect(done).toHaveBeenCalled()
    })
  })

  describe('onResponse Hook', () => {
    beforeEach(() => {
      registerRequestLoggerHooks(mockServer)
      // Setup reply with start time
      mockReply.startTime = 1000
    })

    it('should calculate response time correctly', () => {
      const done = vi.fn()
      const startTime = 1000
      const endTime = 1500
      mockReply.startTime = startTime
      vi.spyOn(Date, 'now').mockReturnValue(endTime)

      onResponseHook(mockRequest, mockReply, done)

      expect(mockRequest.log!.info).toHaveBeenCalledWith(
        expect.objectContaining({
          durationMs: 500
        }),
        'request completed'
      )
      expect(done).toHaveBeenCalled()
    })

    it('should log request completion with all required information', () => {
      const done = vi.fn()
      mockRequest.id = 'test-request-id'
      mockReply.statusCode = 201
      mockReply.startTime = 1000
      vi.spyOn(Date, 'now').mockReturnValue(1250)

      onResponseHook(mockRequest, mockReply, done)

      expect(mockRequest.log!.info).toHaveBeenCalledWith(
        {
          url: '/api/test',
          method: 'GET',
          statusCode: 201,
          durationMs: 250,
          requestId: 'test-request-id'
        },
        'request completed'
      )
      expect(done).toHaveBeenCalled()
    })

    it('should handle missing start time gracefully', () => {
      const done = vi.fn()
      delete mockReply.startTime
      vi.spyOn(Date, 'now').mockReturnValue(2000)

      onResponseHook(mockRequest, mockReply, done)

      expect(mockRequest.log!.info).toHaveBeenCalledWith(
        expect.objectContaining({
          durationMs: expect.any(Number)
        }),
        'request completed'
      )
      expect(done).toHaveBeenCalled()
    })
  })

  describe('Integration Test', () => {
    it('should work correctly for a complete request-response cycle', () => {
      const requestDone = vi.fn()
      const responseDone = vi.fn()
      
      registerRequestLoggerHooks(mockServer)
      
      // Simulate request
      mockRequest.headers = {}
      vi.spyOn(Date, 'now').mockReturnValue(1000)
      
      onRequestHook(mockRequest, mockReply, requestDone)
      
      // Verify request setup
      expect(mockRequest.id).toBe('550e8400-e29b-41d4-a716-446655440000')
      expect(mockReply.startTime).toBe(1000)
      expect(requestDone).toHaveBeenCalled()
      
      // Simulate response
      mockReply.statusCode = 200
      vi.spyOn(Date, 'now').mockReturnValue(1500)
      
      onResponseHook(mockRequest, mockReply, responseDone)
      
      // Verify response logging
      expect(mockRequest.log!.info).toHaveBeenCalledWith(
        {
          url: '/api/test',
          method: 'GET',
          statusCode: 200,
          durationMs: 500,
          requestId: '550e8400-e29b-41d4-a716-446655440000'
        },
        'request completed'
      )
      expect(responseDone).toHaveBeenCalled()
    })
  })
})
