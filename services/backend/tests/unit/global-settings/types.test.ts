import { describe, it, expect } from 'vitest'
import type { 
  GlobalSettingType, 
  GlobalSettingDefinition, 
  GlobalSettingGroup, 
  GlobalSettingsModule,
  SmtpConfig,
  GitHubOAuthConfig,
  GlobalConfig,
  ValidationResult,
  InitializationResult
} from '../../../src/global-settings/types'

describe('Global Settings Types', () => {
  describe('GlobalSettingType', () => {
    it('should include all expected setting types', () => {
      const validTypes: GlobalSettingType[] = ['string', 'number', 'boolean']
      
      // This test ensures the type definition includes the expected values
      // TypeScript will catch if we try to assign invalid values
      expect(validTypes).toContain('string')
      expect(validTypes).toContain('number')
      expect(validTypes).toContain('boolean')
    })
  })

  describe('GlobalSettingDefinition', () => {
    it('should allow valid setting definition objects', () => {
      const validSetting: GlobalSettingDefinition = {
        key: 'test.setting',
        defaultValue: 'default',
        type: 'string',
        description: 'Test setting',
        encrypted: false,
        required: true
      }

      expect(validSetting.key).toBe('test.setting')
      expect(validSetting.type).toBe('string')
      expect(validSetting.required).toBe(true)
    })
  })

  describe('GlobalSettingGroup', () => {
    it('should allow valid group definition objects', () => {
      const validGroup: GlobalSettingGroup = {
        id: 'test-group',
        name: 'Test Group',
        sort_order: 1
      }

      expect(validGroup.id).toBe('test-group')
      expect(validGroup.name).toBe('Test Group')
      expect(validGroup.sort_order).toBe(1)
    })

    it('should allow optional description and icon', () => {
      const validGroup: GlobalSettingGroup = {
        id: 'test-group',
        name: 'Test Group',
        description: 'A test group',
        icon: 'settings',
        sort_order: 1
      }

      expect(validGroup.description).toBe('A test group')
      expect(validGroup.icon).toBe('settings')
    })
  })

  describe('GlobalSettingsModule', () => {
    it('should allow valid settings module objects', () => {
      const validModule: GlobalSettingsModule = {
        group: {
          id: 'test-group',
          name: 'Test Group',
          sort_order: 1
        },
        settings: [
          {
            key: 'test.setting1',
            defaultValue: 'value1',
            type: 'string',
            description: 'Test setting 1',
            encrypted: false,
            required: false
          },
          {
            key: 'test.setting2',
            defaultValue: 42,
            type: 'number',
            description: 'Test setting 2',
            encrypted: false,
            required: true
          }
        ]
      }

      expect(validModule.group.id).toBe('test-group')
      expect(validModule.settings).toHaveLength(2)
      expect(validModule.settings[0].type).toBe('string')
      expect(validModule.settings[1].type).toBe('number')
    })
  })

  describe('SmtpConfig', () => {
    it('should allow valid SMTP configuration objects', () => {
      const validConfig: SmtpConfig = {
        host: 'smtp.example.com',
        port: 587,
        username: 'user@example.com',
        password: 'password123',
        secure: true,
        fromName: 'Test App',
        fromEmail: 'noreply@example.com'
      }

      expect(validConfig.host).toBe('smtp.example.com')
      expect(validConfig.port).toBe(587)
      expect(validConfig.secure).toBe(true)
    })
  })

  describe('GitHubOAuthConfig', () => {
    it('should allow valid GitHub OAuth configuration objects', () => {
      const validConfig: GitHubOAuthConfig = {
        clientId: 'client123',
        clientSecret: 'secret456',
        enabled: true,
        callbackUrl: 'http://localhost:3000/callback',
        scope: 'user:email read:user'
      }

      expect(validConfig.clientId).toBe('client123')
      expect(validConfig.enabled).toBe(true)
      expect(validConfig.scope).toBe('user:email read:user')
    })
  })

  describe('GlobalConfig', () => {
    it('should allow valid global configuration objects', () => {
      const validConfig: GlobalConfig = {
        pageUrl: 'https://myapp.com',
        sendMail: true,
        enableLogin: false,
        enableEmailRegistration: true
      }

      expect(validConfig.pageUrl).toBe('https://myapp.com')
      expect(validConfig.sendMail).toBe(true)
      expect(validConfig.enableLogin).toBe(false)
      expect(validConfig.enableEmailRegistration).toBe(true)
    })
  })

  describe('ValidationResult', () => {
    it('should allow valid validation result objects', () => {
      const validResult: ValidationResult = {
        valid: false,
        missing: ['smtp.host', 'smtp.port'],
        groups: {
          smtp: {
            total: 4,
            missing: 2,
            missingKeys: ['smtp.host', 'smtp.port']
          }
        }
      }

      expect(validResult.valid).toBe(false)
      expect(validResult.missing).toHaveLength(2)
      expect(validResult.groups.smtp.total).toBe(4)
    })
  })

  describe('InitializationResult', () => {
    it('should allow valid initialization result objects', () => {
      const validResult: InitializationResult = {
        totalModules: 3,
        totalSettings: 15,
        created: 10,
        skipped: 5,
        createdSettings: ['smtp.host', 'smtp.port'],
        skippedSettings: ['global.page_url']
      }

      expect(validResult.totalModules).toBe(3)
      expect(validResult.totalSettings).toBe(15)
      expect(validResult.created).toBe(10)
      expect(validResult.skipped).toBe(5)
      expect(validResult.createdSettings).toHaveLength(2)
      expect(validResult.skippedSettings).toHaveLength(1)
    })
  })
})
