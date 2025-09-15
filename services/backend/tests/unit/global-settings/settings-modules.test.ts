import { describe, it, expect } from 'vitest'
import { smtpSettings } from '../../../src/global-settings/smtp'
import { githubOAuthSettings } from '../../../src/global-settings/github-oauth'
import { globalSettings } from '../../../src/global-settings/global'

describe('Settings Modules', () => {
  describe('SMTP Settings Module', () => {
    it('should have correct module structure', () => {
      expect(smtpSettings).toBeDefined()
      expect(smtpSettings.group).toBeDefined()
      expect(smtpSettings.settings).toBeDefined()
      expect(Array.isArray(smtpSettings.settings)).toBe(true)
    })

    it('should have correct group definition', () => {
      const { group } = smtpSettings
      
      expect(group.id).toBe('smtp')
      expect(group.name).toBe('SMTP Mail Settings')
      expect(group.description).toBe('Email server configuration for sending notifications')
      expect(group.icon).toBe('mail')
      expect(group.sort_order).toBe(1)
    })

    it('should have SMTP settings defined', () => {
      const settingKeys = smtpSettings.settings.map(s => s.key)
      
      // Should have at least some settings
      expect(settingKeys.length).toBeGreaterThan(0)
      
      // All settings should follow the smtp.* naming pattern
      settingKeys.forEach(key => {
        expect(key).toMatch(/^smtp\..+/)
      })
    })

    it('should have valid setting definitions', () => {
      const settings = smtpSettings.settings

      // Test that settings exist and have proper structure
      settings.forEach(setting => {
        expect(setting.key).toBeDefined()
        expect(typeof setting.key).toBe('string')
        expect(setting.key.length).toBeGreaterThan(0)
        
        expect(setting.type).toBeDefined()
        expect(['string', 'number', 'boolean']).toContain(setting.type)
        
        expect(setting.description).toBeDefined()
        expect(typeof setting.description).toBe('string')
        expect(setting.description.length).toBeGreaterThan(0)
        
        expect(typeof setting.encrypted).toBe('boolean')
        expect(typeof setting.required).toBe('boolean')
        
        // Default value should match the declared type
        switch (setting.type) {
          case 'string':
            expect(typeof setting.defaultValue).toBe('string')
            break
          case 'number':
            expect(typeof setting.defaultValue).toBe('number')
            break
          case 'boolean':
            expect(typeof setting.defaultValue).toBe('boolean')
            break
        }
      })
    })

    it('should have valid descriptions for all settings', () => {
      smtpSettings.settings.forEach(setting => {
        expect(setting.description).toBeDefined()
        expect(typeof setting.description).toBe('string')
        expect(setting.description.length).toBeGreaterThan(0)
      })
    })

    it('should have consistent key naming pattern', () => {
      smtpSettings.settings.forEach(setting => {
        expect(setting.key).toMatch(/^smtp\..+/)
      })
    })

    it('should have sensitive settings encrypted', () => {
      const passwordSetting = smtpSettings.settings.find(s => s.key === 'smtp.password')
      if (passwordSetting) {
        expect(passwordSetting.encrypted).toBe(true)
      }
    })
  })

  describe('GitHub OAuth Settings Module', () => {
    it('should have correct module structure', () => {
      expect(githubOAuthSettings).toBeDefined()
      expect(githubOAuthSettings.group).toBeDefined()
      expect(githubOAuthSettings.settings).toBeDefined()
      expect(Array.isArray(githubOAuthSettings.settings)).toBe(true)
    })

    it('should have correct group definition', () => {
      const { group } = githubOAuthSettings
      
      expect(group.id).toBe('github-oauth')
      expect(group.name).toBe('GitHub OAuth Configuration')
      expect(group.description).toBe('GitHub authentication settings for user login')
      expect(group.icon).toBe('github')
      expect(group.sort_order).toBe(2)
    })

    it('should have GitHub OAuth settings defined', () => {
      const settingKeys = githubOAuthSettings.settings.map(s => s.key)
      
      // Should have at least some settings
      expect(settingKeys.length).toBeGreaterThan(0)
      
      // All settings should follow the github.oauth.* naming pattern
      settingKeys.forEach(key => {
        expect(key).toMatch(/^github\.oauth\..+/)
      })
    })

    it('should have valid setting definitions', () => {
      const settings = githubOAuthSettings.settings

      settings.forEach(setting => {
        expect(setting.key).toBeDefined()
        expect(typeof setting.key).toBe('string')
        expect(setting.key.length).toBeGreaterThan(0)
        
        expect(setting.type).toBeDefined()
        expect(['string', 'number', 'boolean']).toContain(setting.type)
        
        expect(setting.description).toBeDefined()
        expect(typeof setting.description).toBe('string')
        expect(setting.description.length).toBeGreaterThan(0)
        
        expect(typeof setting.encrypted).toBe('boolean')
        expect(typeof setting.required).toBe('boolean')
        
        // Default value should match the declared type
        switch (setting.type) {
          case 'string':
            expect(typeof setting.defaultValue).toBe('string')
            break
          case 'number':
            expect(typeof setting.defaultValue).toBe('number')
            break
          case 'boolean':
            expect(typeof setting.defaultValue).toBe('boolean')
            break
        }
      })
    })

    it('should have valid descriptions for all settings', () => {
      githubOAuthSettings.settings.forEach(setting => {
        expect(setting.description).toBeDefined()
        expect(typeof setting.description).toBe('string')
        expect(setting.description.length).toBeGreaterThan(0)
      })
    })

    it('should have consistent key naming pattern', () => {
      githubOAuthSettings.settings.forEach(setting => {
        expect(setting.key).toMatch(/^github\.oauth\..+/)
      })
    })

    it('should have OAuth settings as optional by design (since OAuth is optional)', () => {
      githubOAuthSettings.settings.forEach(setting => {
        expect(setting.required).toBe(false)
      })
    })

    it('should have sensitive settings encrypted', () => {
      const clientSecretSetting = githubOAuthSettings.settings.find(s => s.key === 'github.oauth.client_secret')
      if (clientSecretSetting) {
        expect(clientSecretSetting.encrypted).toBe(true)
      }
    })
  })

  describe('Global Settings Module', () => {
    it('should have correct module structure', () => {
      expect(globalSettings).toBeDefined()
      expect(globalSettings.group).toBeDefined()
      expect(globalSettings.settings).toBeDefined()
      expect(Array.isArray(globalSettings.settings)).toBe(true)
    })

    it('should have correct group definition', () => {
      const { group } = globalSettings
      
      expect(group.id).toBe('global')
      expect(group.name).toBe('Global Settings')
      expect(group.description).toBe('General application configuration settings')
      expect(group.icon).toBe('settings')
      expect(group.sort_order).toBe(0) // Should be first
    })

    it('should have global settings defined', () => {
      const settingKeys = globalSettings.settings.map(s => s.key)
      
      // Should have at least some settings
      expect(settingKeys.length).toBeGreaterThan(0)
      
      // All settings should follow the global.* naming pattern
      settingKeys.forEach(key => {
        expect(key).toMatch(/^global\..+/)
      })
    })

    it('should have valid setting definitions for all existing settings', () => {
      const settings = globalSettings.settings

      // Should have at least one setting
      expect(settings.length).toBeGreaterThan(0)

      // Validate each setting's structure and data consistency
      settings.forEach(setting => {
        // Required fields should be present
        expect(setting.key).toBeDefined()
        expect(typeof setting.key).toBe('string')
        expect(setting.key.length).toBeGreaterThan(0)
        
        expect(setting.type).toBeDefined()
        expect(['string', 'number', 'boolean']).toContain(setting.type)
        
        expect(setting.description).toBeDefined()
        expect(typeof setting.description).toBe('string')
        expect(setting.description.length).toBeGreaterThan(0)
        
        expect(typeof setting.encrypted).toBe('boolean')
        expect(typeof setting.required).toBe('boolean')
        
        // Default value should match the declared type
        switch (setting.type) {
          case 'string':
            expect(typeof setting.defaultValue).toBe('string')
            break
          case 'number':
            expect(typeof setting.defaultValue).toBe('number')
            break
          case 'boolean':
            expect(typeof setting.defaultValue).toBe('boolean')
            break
        }
        
        // Key should follow global.* pattern
        expect(setting.key).toMatch(/^global\..+/)
      })
    })

    it('should have valid descriptions for all settings', () => {
      globalSettings.settings.forEach(setting => {
        expect(setting.description).toBeDefined()
        expect(typeof setting.description).toBe('string')
        expect(setting.description.length).toBeGreaterThan(0)
      })
    })

    it('should have consistent key naming pattern', () => {
      globalSettings.settings.forEach(setting => {
        expect(setting.key).toMatch(/^global\..+/)
      })
    })

    it('should have requirements configured appropriately per setting', () => {
      // Test that the requirement configuration is consistent with each setting's purpose
      globalSettings.settings.forEach(setting => {
        // Each setting should have a boolean required field
        expect(typeof setting.required).toBe('boolean')
        
        // For specific critical settings, we can test their actual requirement status
        // but we make these tests based on business logic, not hardcoded expectations
        if (setting.key === 'global.page_url' || setting.key === 'global.backend_url') {
          // URL settings are typically required for proper application function
          // This test is based on the business logic rather than hardcoded expectation
          expect(setting.required).toBe(true)
        }
      })
    })

    it('should have encryption settings configured appropriately', () => {
      // Global settings typically don't contain sensitive data requiring encryption
      globalSettings.settings.forEach(setting => {
        expect(typeof setting.encrypted).toBe('boolean')
        // Most global settings are configuration, not secrets
        if (!setting.key.includes('secret') && !setting.key.includes('password') && !setting.key.includes('key')) {
          expect(setting.encrypted).toBe(false)
        }
      })
    })
  })

  describe('Cross-Module Validation', () => {
    it('should have unique group IDs across all modules', () => {
      const groupIds = [
        smtpSettings.group.id,
        githubOAuthSettings.group.id,
        globalSettings.group.id
      ]

      const uniqueIds = new Set(groupIds)
      expect(uniqueIds.size).toBe(groupIds.length)
    })

    it('should have unique setting keys across all modules', () => {
      const allSettings = [
        ...smtpSettings.settings,
        ...githubOAuthSettings.settings,
        ...globalSettings.settings
      ]

      const settingKeys = allSettings.map(s => s.key)
      const uniqueKeys = new Set(settingKeys)
      expect(uniqueKeys.size).toBe(settingKeys.length)
    })

    it('should have consistent sort_order values', () => {
      const sortOrders = [
        globalSettings.group.sort_order,
        smtpSettings.group.sort_order,
        githubOAuthSettings.group.sort_order
      ]

      // Global should be first (0), then SMTP (1), then GitHub (2)
      expect(sortOrders).toEqual([0, 1, 2])
    })

    it('should have valid setting types', () => {
      const allSettings = [
        ...smtpSettings.settings,
        ...githubOAuthSettings.settings,
        ...globalSettings.settings
      ]

      const validTypes = ['string', 'number', 'boolean']
      
      allSettings.forEach(setting => {
        expect(validTypes).toContain(setting.type)
      })
    })

    it('should have appropriate default values for their types', () => {
      const allSettings = [
        ...smtpSettings.settings,
        ...githubOAuthSettings.settings,
        ...globalSettings.settings
      ]

      allSettings.forEach(setting => {
        switch (setting.type) {
          case 'string':
            expect(typeof setting.defaultValue).toBe('string')
            break
          case 'number':
            expect(typeof setting.defaultValue).toBe('number')
            break
          case 'boolean':
            expect(typeof setting.defaultValue).toBe('boolean')
            break
        }
      })
    })

    it('should have encrypted flag only for sensitive settings', () => {
      const allSettings = [
        ...smtpSettings.settings,
        ...githubOAuthSettings.settings,
        ...globalSettings.settings
      ]

      // Test that encryption is used appropriately for sensitive data
      allSettings.forEach(setting => {
        const isSensitive = setting.key.includes('password') || 
                           setting.key.includes('secret') || 
                           setting.key.includes('private_key') ||
                           setting.key.includes('token')
                           
        if (isSensitive) {
          expect(setting.encrypted).toBe(true)
        }
        
        // Non-sensitive settings should generally not be encrypted
        const isDefinitelyNotSensitive = setting.key.includes('enabled') ||
                                       setting.key.includes('url') ||
                                       setting.key.includes('port') ||
                                       setting.key.includes('host') ||
                                       setting.key.includes('username') ||
                                       setting.key.includes('scope') ||
                                       setting.key.includes('name')
                                       
        if (isDefinitelyNotSensitive) {
          expect(setting.encrypted).toBe(false)
        }
      })
    })

    it('should have logical required field distribution', () => {
      const allSettings = [
        ...smtpSettings.settings,
        ...githubOAuthSettings.settings,
        ...globalSettings.settings
      ]

      const requiredSettings = allSettings.filter(s => s.required)
      const requiredKeys = requiredSettings.map(s => s.key)

      // Test business logic: Critical system settings should be required
      // SMTP core connectivity settings
      const smtpCoreSettings = ['smtp.host', 'smtp.port', 'smtp.username', 'smtp.password']
      smtpCoreSettings.forEach(key => {
        if (allSettings.find(s => s.key === key)) {
          expect(requiredKeys).toContain(key)
        }
      })

      // OAuth settings should be optional (since OAuth login is optional)
      const oauthSettings = allSettings.filter(s => s.key.startsWith('github.oauth.'))
      oauthSettings.forEach(setting => {
        expect(setting.required).toBe(false)
      })

      // Global URL settings are typically required for app functionality
      const globalUrlSettings = allSettings.filter(s => 
        s.key.includes('url') && s.key.startsWith('global.')
      )
      globalUrlSettings.forEach(setting => {
        // URLs are usually required for proper application function
        expect(setting.required).toBe(true)
      })
    })

    it('should have reasonable total number of settings', () => {
      const allSettings = [
        ...smtpSettings.settings,
        ...githubOAuthSettings.settings,
        ...globalSettings.settings
      ]

      // Should have a reasonable number of settings (not empty, not excessively large)
      expect(allSettings.length).toBeGreaterThan(5)
      expect(allSettings.length).toBeLessThan(100) // Reasonable upper bound
    })

    it('should have balanced required vs optional settings', () => {
      const allSettings = [
        ...smtpSettings.settings,
        ...githubOAuthSettings.settings,
        ...globalSettings.settings
      ]

      const requiredCount = allSettings.filter(s => s.required).length
      const optionalCount = allSettings.filter(s => !s.required).length

      // Should have both required and optional settings
      expect(requiredCount).toBeGreaterThan(0)
      expect(optionalCount).toBeGreaterThan(0)
      
      // Optional settings should be the majority (good UX practice)
      expect(optionalCount).toBeGreaterThanOrEqual(requiredCount)
    })
  })

  describe('Module Export Validation', () => {
    it('should export modules with correct names', () => {
      // Test that the exports have the expected names
      expect(smtpSettings).toBeDefined()
      expect(githubOAuthSettings).toBeDefined()
      expect(globalSettings).toBeDefined()
    })

    it('should have modules that conform to GlobalSettingsModule interface', () => {
      const modules = [smtpSettings, githubOAuthSettings, globalSettings]

      modules.forEach(module => {
        // Check group structure
        expect(module.group).toBeDefined()
        expect(typeof module.group.id).toBe('string')
        expect(typeof module.group.name).toBe('string')
        expect(typeof module.group.sort_order).toBe('number')

        // Check settings structure
        expect(Array.isArray(module.settings)).toBe(true)
        module.settings.forEach(setting => {
          expect(typeof setting.key).toBe('string')
          expect(['string', 'number', 'boolean']).toContain(setting.type)
          expect(typeof setting.description).toBe('string')
          expect(typeof setting.encrypted).toBe('boolean')
          expect(typeof setting.required).toBe('boolean')
        })
      })
    })

    it('should have proper module organization', () => {
      const modules = [smtpSettings, githubOAuthSettings, globalSettings]

      modules.forEach(module => {
        // Each module should have at least one setting
        expect(module.settings.length).toBeGreaterThan(0)
        
        // Settings in each module should share the same prefix
        const firstSettingPrefix = module.settings[0].key.split('.')[0]
        module.settings.forEach(setting => {
          expect(setting.key.startsWith(firstSettingPrefix + '.')).toBe(true)
        })
        
        // Group ID should match the setting prefix pattern
        expect(module.group.id).toBe(firstSettingPrefix === 'github' ? 'github-oauth' : firstSettingPrefix)
      })
    })
  })
})
