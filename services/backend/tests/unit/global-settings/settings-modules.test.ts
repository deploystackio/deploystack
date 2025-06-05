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

    it('should have all required SMTP settings', () => {
      const settingKeys = smtpSettings.settings.map(s => s.key)
      
      expect(settingKeys).toContain('smtp.host')
      expect(settingKeys).toContain('smtp.port')
      expect(settingKeys).toContain('smtp.username')
      expect(settingKeys).toContain('smtp.password')
      expect(settingKeys).toContain('smtp.secure')
      expect(settingKeys).toContain('smtp.from_name')
      expect(settingKeys).toContain('smtp.from_email')
    })

    it('should have correct setting definitions', () => {
      const settings = smtpSettings.settings

      // Test smtp.host
      const hostSetting = settings.find(s => s.key === 'smtp.host')
      expect(hostSetting).toBeDefined()
      expect(hostSetting?.defaultValue).toBe('')
      expect(hostSetting?.type).toBe('string')
      expect(hostSetting?.required).toBe(true)
      expect(hostSetting?.encrypted).toBe(false)

      // Test smtp.port
      const portSetting = settings.find(s => s.key === 'smtp.port')
      expect(portSetting).toBeDefined()
      expect(portSetting?.defaultValue).toBe(587)
      expect(portSetting?.type).toBe('number')
      expect(portSetting?.required).toBe(true)

      // Test smtp.password (should be encrypted)
      const passwordSetting = settings.find(s => s.key === 'smtp.password')
      expect(passwordSetting).toBeDefined()
      expect(passwordSetting?.encrypted).toBe(true)
      expect(passwordSetting?.required).toBe(true)

      // Test smtp.secure (boolean)
      const secureSetting = settings.find(s => s.key === 'smtp.secure')
      expect(secureSetting).toBeDefined()
      expect(secureSetting?.defaultValue).toBe(true)
      expect(secureSetting?.type).toBe('boolean')
      expect(secureSetting?.required).toBe(false)

      // Test smtp.from_name (optional)
      const fromNameSetting = settings.find(s => s.key === 'smtp.from_name')
      expect(fromNameSetting).toBeDefined()
      expect(fromNameSetting?.defaultValue).toBe('DeployStack')
      expect(fromNameSetting?.required).toBe(false)
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

    it('should have all required GitHub OAuth settings', () => {
      const settingKeys = githubOAuthSettings.settings.map(s => s.key)
      
      expect(settingKeys).toContain('github.oauth.client_id')
      expect(settingKeys).toContain('github.oauth.client_secret')
      expect(settingKeys).toContain('github.oauth.enabled')
      expect(settingKeys).toContain('github.oauth.callback_url')
      expect(settingKeys).toContain('github.oauth.scope')
    })

    it('should have correct setting definitions', () => {
      const settings = githubOAuthSettings.settings

      // Test client_id
      const clientIdSetting = settings.find(s => s.key === 'github.oauth.client_id')
      expect(clientIdSetting).toBeDefined()
      expect(clientIdSetting?.defaultValue).toBe('')
      expect(clientIdSetting?.type).toBe('string')
      expect(clientIdSetting?.required).toBe(false)
      expect(clientIdSetting?.encrypted).toBe(false)

      // Test client_secret (should be encrypted)
      const clientSecretSetting = settings.find(s => s.key === 'github.oauth.client_secret')
      expect(clientSecretSetting).toBeDefined()
      expect(clientSecretSetting?.encrypted).toBe(true)
      expect(clientSecretSetting?.required).toBe(false)

      // Test enabled (boolean)
      const enabledSetting = settings.find(s => s.key === 'github.oauth.enabled')
      expect(enabledSetting).toBeDefined()
      expect(enabledSetting?.defaultValue).toBe(false)
      expect(enabledSetting?.type).toBe('boolean')
      expect(enabledSetting?.required).toBe(false)

      // Test callback_url
      const callbackSetting = settings.find(s => s.key === 'github.oauth.callback_url')
      expect(callbackSetting).toBeDefined()
      expect(callbackSetting?.defaultValue).toBe('http://localhost:3000/api/auth/github/callback')
      expect(callbackSetting?.type).toBe('string')

      // Test scope
      const scopeSetting = settings.find(s => s.key === 'github.oauth.scope')
      expect(scopeSetting).toBeDefined()
      expect(scopeSetting?.defaultValue).toBe('user:email')
      expect(scopeSetting?.type).toBe('string')
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

    it('should have all settings as optional (since OAuth is optional)', () => {
      githubOAuthSettings.settings.forEach(setting => {
        expect(setting.required).toBe(false)
      })
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

    it('should have all required global settings', () => {
      const settingKeys = globalSettings.settings.map(s => s.key)
      
      expect(settingKeys).toContain('global.page_url')
      expect(settingKeys).toContain('global.send_mail')
      expect(settingKeys).toContain('global.enable_login')
      expect(settingKeys).toContain('global.enable_email_registration')
    })

    it('should have correct setting definitions', () => {
      const settings = globalSettings.settings

      // Test page_url
      const pageUrlSetting = settings.find(s => s.key === 'global.page_url')
      expect(pageUrlSetting).toBeDefined()
      expect(pageUrlSetting?.defaultValue).toBe('http://localhost:5173')
      expect(pageUrlSetting?.type).toBe('string')
      expect(pageUrlSetting?.required).toBe(false)
      expect(pageUrlSetting?.encrypted).toBe(false)

      // Test send_mail (boolean)
      const sendMailSetting = settings.find(s => s.key === 'global.send_mail')
      expect(sendMailSetting).toBeDefined()
      expect(sendMailSetting?.defaultValue).toBe(false)
      expect(sendMailSetting?.type).toBe('boolean')
      expect(sendMailSetting?.required).toBe(false)

      // Test enable_login (boolean)
      const enableLoginSetting = settings.find(s => s.key === 'global.enable_login')
      expect(enableLoginSetting).toBeDefined()
      expect(enableLoginSetting?.defaultValue).toBe(true)
      expect(enableLoginSetting?.type).toBe('boolean')
      expect(enableLoginSetting?.required).toBe(false)

      // Test enable_email_registration (boolean)
      const enableEmailRegSetting = settings.find(s => s.key === 'global.enable_email_registration')
      expect(enableEmailRegSetting).toBeDefined()
      expect(enableEmailRegSetting?.defaultValue).toBe(true)
      expect(enableEmailRegSetting?.type).toBe('boolean')
      expect(enableEmailRegSetting?.required).toBe(false)
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

    it('should have all settings as optional', () => {
      globalSettings.settings.forEach(setting => {
        expect(setting.required).toBe(false)
      })
    })

    it('should have no encrypted settings', () => {
      globalSettings.settings.forEach(setting => {
        expect(setting.encrypted).toBe(false)
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

      const encryptedSettings = allSettings.filter(s => s.encrypted)
      const encryptedKeys = encryptedSettings.map(s => s.key)

      // Only password and secret fields should be encrypted
      expect(encryptedKeys).toContain('smtp.password')
      expect(encryptedKeys).toContain('github.oauth.client_secret')
      
      // Should not encrypt other fields
      expect(encryptedKeys).not.toContain('smtp.host')
      expect(encryptedKeys).not.toContain('smtp.username')
      expect(encryptedKeys).not.toContain('github.oauth.client_id')
    })

    it('should have reasonable required field distribution', () => {
      const allSettings = [
        ...smtpSettings.settings,
        ...githubOAuthSettings.settings,
        ...globalSettings.settings
      ]

      const requiredSettings = allSettings.filter(s => s.required)
      const requiredKeys = requiredSettings.map(s => s.key)

      // SMTP core settings should be required
      expect(requiredKeys).toContain('smtp.host')
      expect(requiredKeys).toContain('smtp.port')
      expect(requiredKeys).toContain('smtp.username')
      expect(requiredKeys).toContain('smtp.password')

      // Optional settings should not be required
      expect(requiredKeys).not.toContain('smtp.from_name')
      expect(requiredKeys).not.toContain('github.oauth.enabled')
      expect(requiredKeys).not.toContain('global.page_url')
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
  })
})
