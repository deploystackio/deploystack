import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { FastifyServerOptions } from 'fastify'

// Type for our specific logger configuration
type LoggerConfig = {
  level: string
  transport?: {
    target: string
    options: {
      colorize: boolean
      translateTime: string
      ignore: string
    }
  }
}

describe('Logger Configuration', () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Reset modules and environment variables before each test
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv
  })

  describe('loggerConfig export', () => {
    it('should export a valid FastifyServerOptions logger configuration', async () => {
      process.env.NODE_ENV = 'development'
      delete process.env.LOG_LEVEL
      
      const { loggerConfig } = await import('../../../../src/fastify/config/logger')
      
      expect(loggerConfig).toBeDefined()
      expect(typeof loggerConfig).toBe('object')
      expect(loggerConfig).toHaveProperty('level')
      expect(loggerConfig).toHaveProperty('transport')
    })

    it('should be compatible with FastifyServerOptions logger type', async () => {
      process.env.NODE_ENV = 'development'
      
      const { loggerConfig } = await import('../../../../src/fastify/config/logger')
      
      // Type assertion to ensure compatibility
      const fastifyOptions: FastifyServerOptions = {
        logger: loggerConfig
      }
      
      expect(fastifyOptions.logger).toBe(loggerConfig)
    })
  })

  describe('Log Level Configuration', () => {
    it('should use LOG_LEVEL environment variable when provided', async () => {
      process.env.LOG_LEVEL = 'warn'
      process.env.NODE_ENV = 'development'
      
      const { loggerConfig } = await import('../../../../src/fastify/config/logger')
      const config = loggerConfig as LoggerConfig
      expect(config.level).toBe('warn')
    })

    it('should default to "info" in production environment', async () => {
      delete process.env.LOG_LEVEL
      process.env.NODE_ENV = 'production'
      
      const { loggerConfig } = await import('../../../../src/fastify/config/logger')
      const config = loggerConfig as LoggerConfig
      expect(config.level).toBe('info')
    })

    it('should default to "debug" in development environment', async () => {
      delete process.env.LOG_LEVEL
      process.env.NODE_ENV = 'development'
      
      const { loggerConfig } = await import('../../../../src/fastify/config/logger')
      const config = loggerConfig as LoggerConfig
      expect(config.level).toBe('debug')
    })

    it('should default to "debug" in test environment', async () => {
      delete process.env.LOG_LEVEL
      process.env.NODE_ENV = 'test'
      
      const { loggerConfig } = await import('../../../../src/fastify/config/logger')
      const config = loggerConfig as LoggerConfig
      expect(config.level).toBe('debug')
    })

    it('should default to "debug" when NODE_ENV is not set', async () => {
      delete process.env.LOG_LEVEL
      delete process.env.NODE_ENV
      
      const { loggerConfig } = await import('../../../../src/fastify/config/logger')
      const config = loggerConfig as LoggerConfig
      expect(config.level).toBe('debug')
    })

    it('should prioritize LOG_LEVEL over NODE_ENV defaults', async () => {
      process.env.LOG_LEVEL = 'error'
      process.env.NODE_ENV = 'production'
      
      const { loggerConfig } = await import('../../../../src/fastify/config/logger')
      const config = loggerConfig as LoggerConfig
      expect(config.level).toBe('error')
    })

    it('should handle all valid pino log levels', async () => {
      const validLevels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']
      
      for (const level of validLevels) {
        process.env.LOG_LEVEL = level
        process.env.NODE_ENV = 'development'
        
        vi.resetModules()
        const { loggerConfig } = await import('../../../../src/fastify/config/logger')
        const config = loggerConfig as LoggerConfig
        expect(config.level).toBe(level)
      }
    })
  })

  describe('Transport Configuration', () => {
    it('should configure pino-pretty transport in development environment', async () => {
      process.env.NODE_ENV = 'development'
      
      const { loggerConfig } = await import('../../../../src/fastify/config/logger')
      const config = loggerConfig as LoggerConfig
      
      expect(config.transport).toBeDefined()
      expect(config.transport).toEqual({
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname'
        }
      })
    })

    it('should configure pino-pretty transport in test environment', async () => {
      process.env.NODE_ENV = 'test'
      
      const { loggerConfig } = await import('../../../../src/fastify/config/logger')
      const config = loggerConfig as LoggerConfig
      
      expect(config.transport).toBeDefined()
      expect(config.transport!.target).toBe('pino-pretty')
    })

    it('should not configure transport in production environment', async () => {
      process.env.NODE_ENV = 'production'
      
      const { loggerConfig } = await import('../../../../src/fastify/config/logger')
      const config = loggerConfig as LoggerConfig
      
      expect(config.transport).toBeUndefined()
    })

    it('should configure transport when NODE_ENV is undefined', async () => {
      delete process.env.NODE_ENV
      
      const { loggerConfig } = await import('../../../../src/fastify/config/logger')
      const config = loggerConfig as LoggerConfig
      
      expect(config.transport).toBeDefined()
    })

    it('should have correct pino-pretty options structure', async () => {
      process.env.NODE_ENV = 'development'
      
      const { loggerConfig } = await import('../../../../src/fastify/config/logger')
      const config = loggerConfig as LoggerConfig
      
      expect(config.transport!.options).toEqual({
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname'
      })
    })

    it('should have colorize enabled for better development experience', async () => {
      process.env.NODE_ENV = 'development'
      
      const { loggerConfig } = await import('../../../../src/fastify/config/logger')
      const config = loggerConfig as LoggerConfig
      
      expect(config.transport!.options.colorize).toBe(true)
    })

    it('should use SYS:standard time format for readability', async () => {
      process.env.NODE_ENV = 'development'
      
      const { loggerConfig } = await import('../../../../src/fastify/config/logger')
      const config = loggerConfig as LoggerConfig
      
      expect(config.transport!.options.translateTime).toBe('SYS:standard')
    })

    it('should ignore pid and hostname for cleaner output', async () => {
      process.env.NODE_ENV = 'development'
      
      const { loggerConfig } = await import('../../../../src/fastify/config/logger')
      const config = loggerConfig as LoggerConfig
      
      expect(config.transport!.options.ignore).toBe('pid,hostname')
    })
  })

  describe('Environment-specific Complete Configurations', () => {
    it('should return complete development configuration', async () => {
      process.env.NODE_ENV = 'development'
      process.env.LOG_LEVEL = 'info'
      
      const { loggerConfig } = await import('../../../../src/fastify/config/logger')
      
      expect(loggerConfig).toEqual({
        level: 'info',
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
          }
        }
      })
    })

    it('should return complete production configuration', async () => {
      process.env.NODE_ENV = 'production'
      process.env.LOG_LEVEL = 'warn'
      
      const { loggerConfig } = await import('../../../../src/fastify/config/logger')
      
      expect(loggerConfig).toEqual({
        level: 'warn',
        transport: undefined
      })
    })

    it('should return complete test configuration', async () => {
      process.env.NODE_ENV = 'test'
      delete process.env.LOG_LEVEL
      
      const { loggerConfig } = await import('../../../../src/fastify/config/logger')
      
      expect(loggerConfig).toEqual({
        level: 'debug',
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
          }
        }
      })
    })

    it('should handle production with default log level', async () => {
      process.env.NODE_ENV = 'production'
      delete process.env.LOG_LEVEL
      
      const { loggerConfig } = await import('../../../../src/fastify/config/logger')
      
      expect(loggerConfig).toEqual({
        level: 'info',
        transport: undefined
      })
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty LOG_LEVEL environment variable', async () => {
      process.env.LOG_LEVEL = ''
      process.env.NODE_ENV = 'development'
      
      const { loggerConfig } = await import('../../../../src/fastify/config/logger')
      const config = loggerConfig as LoggerConfig
      
      // Empty string is falsy, so should fall back to NODE_ENV logic
      expect(config.level).toBe('debug')
    })

    it('should handle whitespace-only LOG_LEVEL environment variable', async () => {
      process.env.LOG_LEVEL = '   '
      process.env.NODE_ENV = 'production'
      
      const { loggerConfig } = await import('../../../../src/fastify/config/logger')
      const config = loggerConfig as LoggerConfig
      
      // Whitespace string is truthy, so should be used as-is
      expect(config.level).toBe('   ')
    })

    it('should handle case-sensitive NODE_ENV values', async () => {
      delete process.env.LOG_LEVEL
      process.env.NODE_ENV = 'PRODUCTION' // uppercase
      
      const { loggerConfig } = await import('../../../../src/fastify/config/logger')
      const config = loggerConfig as LoggerConfig
      
      // Should not match 'production', so should default to debug with transport
      expect(config.level).toBe('debug')
      expect(config.transport).toBeDefined()
    })

    it('should handle arbitrary NODE_ENV values', async () => {
      delete process.env.LOG_LEVEL
      process.env.NODE_ENV = 'staging'
      
      const { loggerConfig } = await import('../../../../src/fastify/config/logger')
      const config = loggerConfig as LoggerConfig
      
      expect(config.level).toBe('debug')
      expect(config.transport).toBeDefined()
    })
  })

  describe('Module Re-import Behavior', () => {
    it('should reflect environment changes when module is re-imported', async () => {
      // First import with development settings
      process.env.NODE_ENV = 'development'
      process.env.LOG_LEVEL = 'debug'
      
      const { loggerConfig: devConfig } = await import('../../../../src/fastify/config/logger')
      const devConfigTyped = devConfig as LoggerConfig
      expect(devConfigTyped.level).toBe('debug')
      expect(devConfigTyped.transport).toBeDefined()
      
      // Reset modules and change environment
      vi.resetModules()
      process.env.NODE_ENV = 'production'
      process.env.LOG_LEVEL = 'error'
      
      const { loggerConfig: prodConfig } = await import('../../../../src/fastify/config/logger')
      const prodConfigTyped = prodConfig as LoggerConfig
      expect(prodConfigTyped.level).toBe('error')
      expect(prodConfigTyped.transport).toBeUndefined()
    })
  })
})
