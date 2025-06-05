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
