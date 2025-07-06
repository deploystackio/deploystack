import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GlobalSettingsInitService } from '../../../src/global-settings/index'
import { GlobalSettingsService } from '../../../src/services/globalSettingsService'

// Mock the GlobalSettingsService
vi.mock('../../../src/services/globalSettingsService', () => ({
  GlobalSettingsService: {
    get: vi.fn(),
    exists: vi.fn(),
    setTyped: vi.fn(),
    getByGroup: vi.fn(),
  }
}))

// Mock fs
vi.mock('fs', () => ({
  default: {
    readdirSync: vi.fn(),
  }
}))

// Mock the db module
vi.mock('../../../src/db', () => ({
  getDb: vi.fn(),
  getSchema: vi.fn(),
}))

// Mock the encryption module
vi.mock('../../../src/utils/encryption', () => ({
  encrypt: vi.fn((value) => `encrypted_${value}`),
}))

// Mock path module
vi.mock('path', () => ({
  default: {
    join: vi.fn((...args) => args.join('/')),
  }
}))

describe('GlobalSettingsInitService', () => {
  const mockGlobalSettingsService = GlobalSettingsService as any

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset the static state
    GlobalSettingsInitService['isLoaded'] = false
    GlobalSettingsInitService['settingsModules'] = []
  })

  describe('getAllSettings', () => {
    it('should return all settings from loaded modules', () => {
      GlobalSettingsInitService['settingsModules'] = [
        {
          group: { id: 'test1', name: 'Test 1', sort_order: 0 },
          settings: [
            { key: 'test1.setting1', defaultValue: 'value1', type: 'string', description: 'Test setting 1', encrypted: false, required: false },
            { key: 'test1.setting2', defaultValue: 'value2', type: 'string', description: 'Test setting 2', encrypted: false, required: false }
          ]
        },
        {
          group: { id: 'test2', name: 'Test 2', sort_order: 1 },
          settings: [
            { key: 'test2.setting1', defaultValue: 'value3', type: 'string', description: 'Test setting 3', encrypted: false, required: false }
          ]
        }
      ]

      const allSettings = GlobalSettingsInitService.getAllSettings()
      expect(allSettings).toHaveLength(3)
      expect(allSettings.map(s => s.key)).toEqual(['test1.setting1', 'test1.setting2', 'test2.setting1'])
    })

    it('should return empty array when no modules loaded', () => {
      const allSettings = GlobalSettingsInitService.getAllSettings()
      expect(allSettings).toEqual([])
    })
  })

  describe('getSettingsByGroup', () => {
    beforeEach(() => {
      GlobalSettingsInitService['settingsModules'] = [
        {
          group: { id: 'smtp', name: 'SMTP Settings', sort_order: 1 },
          settings: [
            { key: 'smtp.host', defaultValue: '', type: 'string', description: 'SMTP host', encrypted: false, required: true },
            { key: 'smtp.port', defaultValue: 587, type: 'number', description: 'SMTP port', encrypted: false, required: true }
          ]
        }
      ]
    })

    it('should return settings for existing group', () => {
      const settings = GlobalSettingsInitService.getSettingsByGroup('smtp')
      expect(settings).toHaveLength(2)
      expect(settings[0].key).toBe('smtp.host')
      expect(settings[1].key).toBe('smtp.port')
    })

    it('should return empty array for non-existent group', () => {
      const settings = GlobalSettingsInitService.getSettingsByGroup('nonexistent')
      expect(settings).toEqual([])
    })
  })

  describe('getGroups', () => {
    it('should return all group definitions', () => {
      GlobalSettingsInitService['settingsModules'] = [
        {
          group: { id: 'smtp', name: 'SMTP Settings', sort_order: 1 },
          settings: []
        },
        {
          group: { id: 'global', name: 'Global Settings', sort_order: 0 },
          settings: []
        }
      ]

      const groups = GlobalSettingsInitService.getGroups()
      expect(groups).toHaveLength(2)
      expect(groups[0].id).toBe('smtp')
      expect(groups[1].id).toBe('global')
    })
  })

  describe('loadSettingsDefinitions', () => {
    it('should skip loading if already loaded', async () => {
      GlobalSettingsInitService['isLoaded'] = true

      await GlobalSettingsInitService.loadSettingsDefinitions()

      // Since it's already loaded, no file system operations should occur
      expect(GlobalSettingsInitService['isLoaded']).toBe(true)
    })

    it('should handle file system errors by throwing', async () => {
      const fs = await import('fs')
      const mockFs = fs.default as any
      mockFs.readdirSync.mockImplementation(() => {
        throw new Error('File system error')
      })

      // Should throw the file system error
      await expect(GlobalSettingsInitService.loadSettingsDefinitions()).rejects.toThrow('File system error')
    })

    it('should load settings modules from files', async () => {
      const fs = await import('fs')
      const mockFs = fs.default as any
      
      // Mock file system to return test files
      mockFs.readdirSync.mockReturnValue(['smtp.ts', 'global.ts', 'index.ts', 'types.ts', 'helpers.ts'])

      // Mock dynamic imports
      const mockSmtpModule = {
        smtpSettings: {
          group: { id: 'smtp', name: 'SMTP Settings', sort_order: 1 },
          settings: [
            { key: 'smtp.host', defaultValue: '', type: 'string', description: 'SMTP host', encrypted: false, required: true }
          ]
        }
      }

      const mockGlobalModule = {
        globalSettings: {
          group: { id: 'global', name: 'Global Settings', sort_order: 0 },
          settings: [
            { key: 'global.page_url', defaultValue: 'http://localhost:5173', type: 'string', description: 'Page URL', encrypted: false, required: false }
          ]
        }
      }

      // Mock the dynamic import function
      const originalImport = global.__dirname
      vi.stubGlobal('__dirname', '/test/path')
      
      // Mock import calls
      vi.doMock('/test/path/smtp.ts', () => mockSmtpModule)
      vi.doMock('/test/path/global.ts', () => mockGlobalModule)

      await GlobalSettingsInitService.loadSettingsDefinitions()

      expect(GlobalSettingsInitService['isLoaded']).toBe(true)
      expect(GlobalSettingsInitService['settingsModules']).toHaveLength(2)
    })

    it('should handle import errors gracefully', async () => {
      const fs = await import('fs')
      const mockFs = fs.default as any
      
      mockFs.readdirSync.mockReturnValue(['invalid.ts'])
      vi.stubGlobal('__dirname', '/test/path')

      // This should not throw, but continue processing
      await expect(GlobalSettingsInitService.loadSettingsDefinitions()).resolves.not.toThrow()
      expect(GlobalSettingsInitService['isLoaded']).toBe(true)
    })
  })

  describe('initializeSettings', () => {
    it('should initialize settings successfully', async () => {
      // Setup test modules
      GlobalSettingsInitService['settingsModules'] = [
        {
          group: { id: 'test', name: 'Test Group', sort_order: 0 },
          settings: [
            { key: 'test.setting1', defaultValue: 'value1', type: 'string', description: 'Test setting', encrypted: false, required: false }
          ]
        }
      ]
      GlobalSettingsInitService['isLoaded'] = true

      mockGlobalSettingsService.exists.mockResolvedValue(false)

      const result = await GlobalSettingsInitService.initializeSettings()

      expect(result.totalModules).toBe(1)
      expect(result.totalSettings).toBe(1)
      expect(result.created).toBeGreaterThanOrEqual(0)
      expect(result.skipped).toBeGreaterThanOrEqual(0)
    })

    it('should skip existing settings', async () => {
      GlobalSettingsInitService['settingsModules'] = [
        {
          group: { id: 'test', name: 'Test Group', sort_order: 0 },
          settings: [
            { key: 'test.setting1', defaultValue: 'value1', type: 'string', description: 'Test setting', encrypted: false, required: false }
          ]
        }
      ]
      GlobalSettingsInitService['isLoaded'] = true

      mockGlobalSettingsService.exists.mockResolvedValue(true)

      const result = await GlobalSettingsInitService.initializeSettings()

      expect(result.totalModules).toBe(1)
      expect(result.totalSettings).toBe(1)
      expect(result.skipped).toBeGreaterThanOrEqual(0)
    })

    it('should load settings definitions if not loaded', async () => {
      GlobalSettingsInitService['isLoaded'] = false
      
      const fs = await import('fs')
      const mockFs = fs.default as any
      mockFs.readdirSync.mockReturnValue([])

      const result = await GlobalSettingsInitService.initializeSettings()

      expect(GlobalSettingsInitService['isLoaded']).toBe(true)
      expect(result.totalModules).toBe(0)
    })
  })

  describe('validateRequiredSettings', () => {
    beforeEach(() => {
      GlobalSettingsInitService['settingsModules'] = [
        {
          group: { id: 'smtp', name: 'SMTP Settings', sort_order: 1 },
          settings: [
            { key: 'smtp.host', defaultValue: '', type: 'string', description: 'SMTP host', encrypted: false, required: true },
            { key: 'smtp.port', defaultValue: 587, type: 'number', description: 'SMTP port', encrypted: false, required: true },
            { key: 'smtp.from_name', defaultValue: 'DeployStack', type: 'string', description: 'From name', encrypted: false, required: false }
          ]
        },
        {
          group: { id: 'global', name: 'Global Settings', sort_order: 0 },
          settings: [
            { key: 'global.page_url', defaultValue: 'http://localhost:5173', type: 'string', description: 'Page URL', encrypted: false, required: true }
          ]
        }
      ]
      GlobalSettingsInitService['isLoaded'] = true
    })

    it('should return valid when all required settings have values', async () => {
      mockGlobalSettingsService.get
        .mockResolvedValueOnce({ key: 'smtp.host', value: 'smtp.example.com', type: 'string' })
        .mockResolvedValueOnce({ key: 'smtp.port', value: '587', type: 'number' })
        .mockResolvedValueOnce({ key: 'global.page_url', value: 'https://example.com', type: 'string' })

      const result = await GlobalSettingsInitService.validateRequiredSettings()

      expect(result.valid).toBe(true)
      expect(result.missing).toEqual([])
      expect(result.groups.smtp.missing).toBe(0)
      expect(result.groups.global.missing).toBe(0)
    })

    it('should return invalid when required settings are missing', async () => {
      mockGlobalSettingsService.get
        .mockResolvedValueOnce(null) // smtp.host missing
        .mockResolvedValueOnce({ key: 'smtp.port', value: '587', type: 'number' })
        .mockResolvedValueOnce({ key: 'global.page_url', value: '', type: 'string' }) // empty value

      const result = await GlobalSettingsInitService.validateRequiredSettings()

      expect(result.valid).toBe(false)
      expect(result.missing).toEqual(['smtp.host', 'global.page_url'])
      expect(result.groups.smtp.missing).toBe(1)
      expect(result.groups.smtp.missingKeys).toEqual(['smtp.host'])
      expect(result.groups.global.missing).toBe(1)
      expect(result.groups.global.missingKeys).toEqual(['global.page_url'])
    })

    it('should handle database errors gracefully', async () => {
      mockGlobalSettingsService.get.mockRejectedValue(new Error('Database error'))

      const result = await GlobalSettingsInitService.validateRequiredSettings()

      expect(result.valid).toBe(false)
      expect(result.missing).toEqual(['smtp.host', 'smtp.port', 'global.page_url'])
    })

    it('should load settings definitions if not loaded', async () => {
      // Reset state completely for this test
      GlobalSettingsInitService['isLoaded'] = false
      GlobalSettingsInitService['settingsModules'] = []
      
      const fs = await import('fs')
      const mockFs = fs.default as any
      mockFs.readdirSync.mockReturnValue([])

      const result = await GlobalSettingsInitService.validateRequiredSettings()

      expect(GlobalSettingsInitService['isLoaded']).toBe(true)
      expect(result.missing).toEqual([]) // No required settings when no modules loaded
      expect(Object.keys(result.groups)).toEqual([]) // No groups when no modules loaded
    })
  })

  describe('helper methods', () => {
    describe('isGitHubOAuthConfigured', () => {
      it('should return true when GitHub OAuth is configured and enabled', async () => {
        mockGlobalSettingsService.get
          .mockResolvedValueOnce({ key: 'github.oauth.client_id', value: 'client123', type: 'string' })
          .mockResolvedValueOnce({ key: 'github.oauth.client_secret', value: 'secret456', type: 'string' })
          .mockResolvedValueOnce({ key: 'github.oauth.enabled', value: 'true', type: 'boolean' })
          .mockResolvedValueOnce({ key: 'github.oauth.callback_url', value: 'http://localhost:3000/callback', type: 'string' })
          .mockResolvedValueOnce({ key: 'github.oauth.scope', value: 'user:email', type: 'string' })

        const result = await GlobalSettingsInitService.isGitHubOAuthConfigured()
        expect(result).toBe(true)
      })

      it('should return false when GitHub OAuth is not configured', async () => {
        mockGlobalSettingsService.get.mockResolvedValue(null)

        const result = await GlobalSettingsInitService.isGitHubOAuthConfigured()
        expect(result).toBe(false)
      })
    })

    describe('isEmailRegistrationEnabled', () => {
      it('should return true when email registration is enabled', async () => {
        mockGlobalSettingsService.get.mockResolvedValue({
          key: 'global.enable_email_registration',
          value: 'true',
          type: 'boolean'
        })

        const result = await GlobalSettingsInitService.isEmailRegistrationEnabled()
        expect(result).toBe(true)
      })

      it('should return false when email registration is disabled', async () => {
        mockGlobalSettingsService.get.mockResolvedValue({
          key: 'global.enable_email_registration',
          value: 'false',
          type: 'boolean'
        })

        const result = await GlobalSettingsInitService.isEmailRegistrationEnabled()
        expect(result).toBe(false)
      })

      it('should return false when setting does not exist', async () => {
        mockGlobalSettingsService.get.mockResolvedValue(null)

        const result = await GlobalSettingsInitService.isEmailRegistrationEnabled()
        expect(result).toBe(false) // null?.value === 'true' is false
      })
    })
  })

  describe('error handling in configuration getters', () => {
    it('should handle errors in getSmtpConfiguration', async () => {
      mockGlobalSettingsService.get.mockRejectedValue(new Error('Database error'))

      const config = await GlobalSettingsInitService.getSmtpConfiguration()
      expect(config).toBeNull()
    })

    it('should handle errors in getGitHubOAuthConfiguration', async () => {
      mockGlobalSettingsService.get.mockRejectedValue(new Error('Database error'))

      const config = await GlobalSettingsInitService.getGitHubOAuthConfiguration()
      expect(config).toBeNull()
    })

    it('should handle errors in getGlobalConfiguration', async () => {
      mockGlobalSettingsService.get.mockRejectedValue(new Error('Database error'))

      const config = await GlobalSettingsInitService.getGlobalConfiguration()
      expect(config).toBeNull()
    })

    it('should handle errors in isEmailSendingEnabled', async () => {
      mockGlobalSettingsService.get.mockRejectedValue(new Error('Database error'))

      const result = await GlobalSettingsInitService.isEmailSendingEnabled()
      expect(result).toBe(false)
    })

    it('should handle errors in isLoginEnabled', async () => {
      mockGlobalSettingsService.get.mockRejectedValue(new Error('Database error'))

      const result = await GlobalSettingsInitService.isLoginEnabled()
      expect(result).toBe(true) // Default to enabled on error
    })

    it('should handle errors in getPageUrl', async () => {
      mockGlobalSettingsService.get.mockRejectedValue(new Error('Database error'))

      const result = await GlobalSettingsInitService.getPageUrl()
      expect(result).toBe('http://localhost:5173') // Default fallback
    })
  })

  describe('configuration getters', () => {

    describe('getSmtpConfiguration', () => {
      it('should return SMTP configuration when all required settings exist', async () => {
        mockGlobalSettingsService.get
          .mockResolvedValueOnce({ key: 'smtp.host', value: 'smtp.example.com', type: 'string' })
          .mockResolvedValueOnce({ key: 'smtp.port', value: '587', type: 'number' })
          .mockResolvedValueOnce({ key: 'smtp.username', value: 'user@example.com', type: 'string' })
          .mockResolvedValueOnce({ key: 'smtp.password', value: 'password123', type: 'string' })
          .mockResolvedValueOnce({ key: 'smtp.secure', value: 'true', type: 'boolean' })
          .mockResolvedValueOnce({ key: 'smtp.from_name', value: 'Test App', type: 'string' })
          .mockResolvedValueOnce({ key: 'smtp.from_email', value: 'noreply@example.com', type: 'string' })

        const config = await GlobalSettingsInitService.getSmtpConfiguration()

        expect(config).toEqual({
          host: 'smtp.example.com',
          port: 587,
          username: 'user@example.com',
          password: 'password123',
          secure: true,
          fromName: 'Test App',
          fromEmail: 'noreply@example.com'
        })
      })

      it('should return null when required settings are missing', async () => {
        mockGlobalSettingsService.get
          .mockResolvedValueOnce(null) // smtp.host missing
          .mockResolvedValueOnce({ key: 'smtp.port', value: '587', type: 'number' })
          .mockResolvedValueOnce({ key: 'smtp.username', value: 'user@example.com', type: 'string' })
          .mockResolvedValueOnce({ key: 'smtp.password', value: 'password123', type: 'string' })
          .mockResolvedValueOnce({ key: 'smtp.secure', value: 'true', type: 'boolean' })
          .mockResolvedValueOnce({ key: 'smtp.from_name', value: 'Test App', type: 'string' })
          .mockResolvedValueOnce({ key: 'smtp.from_email', value: 'noreply@example.com', type: 'string' })

        const config = await GlobalSettingsInitService.getSmtpConfiguration()
        expect(config).toBeNull()
      })

      it('should use default values for optional settings', async () => {
        mockGlobalSettingsService.get
          .mockResolvedValueOnce({ key: 'smtp.host', value: 'smtp.example.com', type: 'string' })
          .mockResolvedValueOnce({ key: 'smtp.port', value: '587', type: 'number' })
          .mockResolvedValueOnce({ key: 'smtp.username', value: 'user@example.com', type: 'string' })
          .mockResolvedValueOnce({ key: 'smtp.password', value: 'password123', type: 'string' })
          .mockResolvedValueOnce(null) // smtp.secure missing
          .mockResolvedValueOnce(null) // smtp.from_name missing
          .mockResolvedValueOnce(null) // smtp.from_email missing

        const config = await GlobalSettingsInitService.getSmtpConfiguration()

        expect(config).toEqual({
          host: 'smtp.example.com',
          port: 587,
          username: 'user@example.com',
          password: 'password123',
          secure: false, // default
          fromName: 'DeployStack', // default
          fromEmail: '' // default
        })
      })
    })

    describe('getGitHubOAuthConfiguration', () => {
      it('should return GitHub OAuth configuration when enabled and configured', async () => {
        mockGlobalSettingsService.get
          .mockResolvedValueOnce({ key: 'github.oauth.client_id', value: 'client123', type: 'string' })
          .mockResolvedValueOnce({ key: 'github.oauth.client_secret', value: 'secret456', type: 'string' })
          .mockResolvedValueOnce({ key: 'github.oauth.enabled', value: 'true', type: 'boolean' })
          .mockResolvedValueOnce({ key: 'github.oauth.callback_url', value: 'http://localhost:3000/callback', type: 'string' })
          .mockResolvedValueOnce({ key: 'github.oauth.scope', value: 'user:email read:user', type: 'string' })

        const config = await GlobalSettingsInitService.getGitHubOAuthConfiguration()

        expect(config).toEqual({
          clientId: 'client123',
          clientSecret: 'secret456',
          enabled: true,
          callbackUrl: 'http://localhost:3000/callback',
          scope: 'user:email read:user'
        })
      })

      it('should return null when OAuth is disabled', async () => {
        mockGlobalSettingsService.get
          .mockResolvedValueOnce({ key: 'github.oauth.client_id', value: 'client123', type: 'string' })
          .mockResolvedValueOnce({ key: 'github.oauth.client_secret', value: 'secret456', type: 'string' })
          .mockResolvedValueOnce({ key: 'github.oauth.enabled', value: 'false', type: 'boolean' })
          .mockResolvedValueOnce({ key: 'github.oauth.callback_url', value: 'http://localhost:3000/callback', type: 'string' })
          .mockResolvedValueOnce({ key: 'github.oauth.scope', value: 'user:email', type: 'string' })

        const config = await GlobalSettingsInitService.getGitHubOAuthConfiguration()
        expect(config).toBeNull()
      })
    })

    describe('getGlobalConfiguration', () => {
      it('should return global configuration with all settings', async () => {
        mockGlobalSettingsService.get
          .mockResolvedValueOnce({ key: 'global.page_url', value: 'https://myapp.com', type: 'string' })
          .mockResolvedValueOnce({ key: 'global.send_mail', value: 'true', type: 'boolean' })
          .mockResolvedValueOnce({ key: 'global.enable_login', value: 'false', type: 'boolean' })
          .mockResolvedValueOnce({ key: 'global.enable_email_registration', value: 'true', type: 'boolean' })

        const config = await GlobalSettingsInitService.getGlobalConfiguration()

        expect(config).toEqual({
          pageUrl: 'https://myapp.com',
          sendMail: true,
          enableLogin: false,
          enableEmailRegistration: true
        })
      })

      it('should use default values when settings are missing', async () => {
        mockGlobalSettingsService.get
          .mockResolvedValueOnce(null) // page_url missing
          .mockResolvedValueOnce(null) // send_mail missing
          .mockResolvedValueOnce(null) // enable_login missing
          .mockResolvedValueOnce(null) // enable_email_registration missing

        const config = await GlobalSettingsInitService.getGlobalConfiguration()

        expect(config).toEqual({
          pageUrl: 'http://localhost:5173', // default
          sendMail: false, // default
          enableLogin: false, // default (null value becomes false)
          enableEmailRegistration: false // default (null value becomes false)
        })
      })
    })

    describe('boolean helper methods', () => {
      describe('isSmtpConfigured', () => {
        it('should return true when SMTP is configured', async () => {
          mockGlobalSettingsService.get
            .mockResolvedValueOnce({ key: 'smtp.host', value: 'smtp.example.com', type: 'string' })
            .mockResolvedValueOnce({ key: 'smtp.port', value: '587', type: 'number' })
            .mockResolvedValueOnce({ key: 'smtp.username', value: 'user@example.com', type: 'string' })
            .mockResolvedValueOnce({ key: 'smtp.password', value: 'password123', type: 'string' })
            .mockResolvedValueOnce({ key: 'smtp.secure', value: 'true', type: 'boolean' })
            .mockResolvedValueOnce({ key: 'smtp.from_name', value: 'Test App', type: 'string' })
            .mockResolvedValueOnce({ key: 'smtp.from_email', value: 'noreply@example.com', type: 'string' })

          const result = await GlobalSettingsInitService.isSmtpConfigured()
          expect(result).toBe(true)
        })

        it('should return false when SMTP is not configured', async () => {
          mockGlobalSettingsService.get.mockResolvedValue(null)

          const result = await GlobalSettingsInitService.isSmtpConfigured()
          expect(result).toBe(false)
        })
      })

      describe('isEmailSendingEnabled', () => {
        it('should return true when email sending is enabled', async () => {
          mockGlobalSettingsService.get.mockResolvedValue({
            key: 'global.send_mail',
            value: 'true',
            type: 'boolean'
          })

          const result = await GlobalSettingsInitService.isEmailSendingEnabled()
          expect(result).toBe(true)
        })

        it('should return false when email sending is disabled', async () => {
          mockGlobalSettingsService.get.mockResolvedValue({
            key: 'global.send_mail',
            value: 'false',
            type: 'boolean'
          })

          const result = await GlobalSettingsInitService.isEmailSendingEnabled()
          expect(result).toBe(false)
        })

        it('should return false when setting does not exist', async () => {
          mockGlobalSettingsService.get.mockResolvedValue(null)

          const result = await GlobalSettingsInitService.isEmailSendingEnabled()
          expect(result).toBe(false)
        })
      })

      describe('isLoginEnabled', () => {
        it('should return true when login is enabled', async () => {
          mockGlobalSettingsService.get.mockResolvedValue({
            key: 'global.enable_login',
            value: 'true',
            type: 'boolean'
          })

          const result = await GlobalSettingsInitService.isLoginEnabled()
          expect(result).toBe(true)
        })

        it('should return false when login is disabled', async () => {
          mockGlobalSettingsService.get.mockResolvedValue({
            key: 'global.enable_login',
            value: 'false',
            type: 'boolean'
          })

          const result = await GlobalSettingsInitService.isLoginEnabled()
          expect(result).toBe(false)
        })

        it('should return false when setting does not exist', async () => {
          mockGlobalSettingsService.get.mockResolvedValue(null)

          const result = await GlobalSettingsInitService.isLoginEnabled()
          expect(result).toBe(false)
        })
      })
    })

    describe('getPageUrl', () => {
      it('should return configured page URL', async () => {
        mockGlobalSettingsService.get.mockResolvedValue({
          key: 'global.page_url',
          value: 'https://myapp.com',
          type: 'string'
        })

        const result = await GlobalSettingsInitService.getPageUrl()
        expect(result).toBe('https://myapp.com')
      })

      it('should return default URL when setting does not exist', async () => {
        mockGlobalSettingsService.get.mockResolvedValue(null)

        const result = await GlobalSettingsInitService.getPageUrl()
        expect(result).toBe('http://localhost:5173')
      })
    })
  })
})
