import { describe, it, expect } from 'vitest'
import { githubAppSettings } from '../../../src/global-settings/github-app'
import type { GlobalSettingsModule, GlobalSettingDefinition } from '../../../src/global-settings/types'

describe('GitHub App Settings Module', () => {
  describe('Module Structure', () => {
    it('should have correct module structure', () => {
      expect(githubAppSettings).toBeDefined()
      expect(githubAppSettings.group).toBeDefined()
      expect(githubAppSettings.settings).toBeDefined()
      expect(Array.isArray(githubAppSettings.settings)).toBe(true)
    })

    it('should conform to GlobalSettingsModule type', () => {
      // TypeScript compilation ensures this, but we can also do runtime checks
      const module: GlobalSettingsModule = githubAppSettings
      
      expect(module.group).toHaveProperty('id')
      expect(module.group).toHaveProperty('name')
      expect(module.group).toHaveProperty('sort_order')
      expect(typeof module.group.id).toBe('string')
      expect(typeof module.group.name).toBe('string')
      expect(typeof module.group.sort_order).toBe('number')
      expect(Array.isArray(module.settings)).toBe(true)
    })
  })

  describe('Group Definition', () => {
    it('should have correct group properties', () => {
      const { group } = githubAppSettings
      
      expect(group.id).toBe('github-app')
      expect(group.name).toBe('GitHub App Configuration')
      expect(group.description).toBe('GitHub App authentication for MCP catalog integration')
      expect(group.icon).toBe('github')
      expect(group.sort_order).toBe(4)
    })

    it('should have all required group properties', () => {
      const { group } = githubAppSettings
      
      expect(group).toHaveProperty('id')
      expect(group).toHaveProperty('name')
      expect(group).toHaveProperty('description')
      expect(group).toHaveProperty('icon')
      expect(group).toHaveProperty('sort_order')
    })

    it('should have meaningful group values', () => {
      const { group } = githubAppSettings
      
      expect(group.id).toMatch(/^[a-z-]+$/) // Should be kebab-case
      expect(group.name.length).toBeGreaterThan(0)
      expect(group.description!.length).toBeGreaterThan(0)
      expect(group.icon).toBe('github')
      expect(group.sort_order).toBeGreaterThan(0)
    })
  })

  describe('Settings Definitions', () => {
    it('should have correct number of settings', () => {
      expect(githubAppSettings.settings).toHaveLength(4)
    })

    it('should have all required GitHub App settings', () => {
      const settingKeys = githubAppSettings.settings.map(s => s.key)
      
      expect(settingKeys).toContain('github.app.app_id')
      expect(settingKeys).toContain('github.app.private_key_base64')
      expect(settingKeys).toContain('github.app.installation_id')
      expect(settingKeys).toContain('github.app.enabled')
    })

    it('should have unique setting keys', () => {
      const settingKeys = githubAppSettings.settings.map(s => s.key)
      const uniqueKeys = new Set(settingKeys)
      
      expect(uniqueKeys.size).toBe(settingKeys.length)
    })

    it('should have all settings with github.app prefix', () => {
      githubAppSettings.settings.forEach(setting => {
        expect(setting.key).toMatch(/^github\.app\./)
      })
    })

    it('should have all settings conform to GlobalSettingDefinition type', () => {
      githubAppSettings.settings.forEach(setting => {
        const definition: GlobalSettingDefinition = setting
        
        expect(definition).toHaveProperty('key')
        expect(definition).toHaveProperty('defaultValue')
        expect(definition).toHaveProperty('type')
        expect(definition).toHaveProperty('description')
        expect(definition).toHaveProperty('encrypted')
        expect(definition).toHaveProperty('required')
      })
    })
  })

  describe('GitHub App ID Setting', () => {
    const appIdSetting = () => githubAppSettings.settings.find(s => s.key === 'github.app.app_id')

    it('should exist', () => {
      expect(appIdSetting()).toBeDefined()
    })

    it('should have correct properties', () => {
      const setting = appIdSetting()!
      
      expect(setting.key).toBe('github.app.app_id')
      expect(setting.defaultValue).toBe('')
      expect(setting.type).toBe('string')
      expect(setting.description).toBe('GitHub App ID for API authentication')
      expect(setting.encrypted).toBe(false)
      expect(setting.required).toBe(false)
    })

    it('should have meaningful description', () => {
      const setting = appIdSetting()!
      
      expect(setting.description.length).toBeGreaterThan(10)
      expect(setting.description.toLowerCase()).toContain('github')
      expect(setting.description.toLowerCase()).toContain('app')
      expect(setting.description.toLowerCase()).toContain('id')
    })
  })

  describe('GitHub App Private Key Setting', () => {
    const privateKeySetting = () => githubAppSettings.settings.find(s => s.key === 'github.app.private_key_base64')

    it('should exist', () => {
      expect(privateKeySetting()).toBeDefined()
    })

    it('should have correct properties', () => {
      const setting = privateKeySetting()!
      
      expect(setting.key).toBe('github.app.private_key_base64')
      expect(setting.defaultValue).toBe('')
      expect(setting.type).toBe('string')
      expect(setting.description).toBe('GitHub App private key (base64 encoded)')
      expect(setting.encrypted).toBe(true) // Should be encrypted for security
      expect(setting.required).toBe(false)
    })

    it('should be marked as encrypted for security', () => {
      const setting = privateKeySetting()!
      
      expect(setting.encrypted).toBe(true)
    })

    it('should indicate base64 encoding in description', () => {
      const setting = privateKeySetting()!
      
      expect(setting.description.toLowerCase()).toContain('base64')
    })
  })

  describe('GitHub App Installation ID Setting', () => {
    const installationIdSetting = () => githubAppSettings.settings.find(s => s.key === 'github.app.installation_id')

    it('should exist', () => {
      expect(installationIdSetting()).toBeDefined()
    })

    it('should have correct properties', () => {
      const setting = installationIdSetting()!
      
      expect(setting.key).toBe('github.app.installation_id')
      expect(setting.defaultValue).toBe('')
      expect(setting.type).toBe('string')
      expect(setting.description).toBe('GitHub App installation ID')
      expect(setting.encrypted).toBe(false)
      expect(setting.required).toBe(false)
    })

    it('should not be encrypted', () => {
      const setting = installationIdSetting()!
      
      expect(setting.encrypted).toBe(false)
    })
  })

  describe('GitHub App Enabled Setting', () => {
    const enabledSetting = () => githubAppSettings.settings.find(s => s.key === 'github.app.enabled')

    it('should exist', () => {
      expect(enabledSetting()).toBeDefined()
    })

    it('should have correct properties', () => {
      const setting = enabledSetting()!
      
      expect(setting.key).toBe('github.app.enabled')
      expect(setting.defaultValue).toBe(false)
      expect(setting.type).toBe('boolean')
      expect(setting.description).toBe('Enable GitHub App integration for MCP catalog')
      expect(setting.encrypted).toBe(false)
      expect(setting.required).toBe(false)
    })

    it('should be boolean type with false default', () => {
      const setting = enabledSetting()!
      
      expect(setting.type).toBe('boolean')
      expect(setting.defaultValue).toBe(false)
    })

    it('should mention MCP catalog in description', () => {
      const setting = enabledSetting()!
      
      expect(setting.description.toLowerCase()).toContain('mcp')
      expect(setting.description.toLowerCase()).toContain('catalog')
    })
  })

  describe('Setting Types and Defaults', () => {
    it('should have appropriate default values for each type', () => {
      githubAppSettings.settings.forEach(setting => {
        if (setting.type === 'string') {
          expect(typeof setting.defaultValue).toBe('string')
        } else if (setting.type === 'boolean') {
          expect(typeof setting.defaultValue).toBe('boolean')
        } else if (setting.type === 'number') {
          expect(typeof setting.defaultValue).toBe('number')
        }
      })
    })

    it('should have string settings with empty string defaults', () => {
      const stringSetting = githubAppSettings.settings.filter(s => s.type === 'string')
      
      stringSetting.forEach(setting => {
        expect(setting.defaultValue).toBe('')
      })
    })

    it('should have boolean setting with false default', () => {
      const booleanSettings = githubAppSettings.settings.filter(s => s.type === 'boolean')
      
      expect(booleanSettings).toHaveLength(1)
      expect(booleanSettings[0].defaultValue).toBe(false)
    })
  })

  describe('Security Considerations', () => {
    it('should encrypt sensitive data', () => {
      const privateKeySetting = githubAppSettings.settings.find(s => s.key === 'github.app.private_key_base64')
      
      expect(privateKeySetting?.encrypted).toBe(true)
    })

    it('should not encrypt non-sensitive data', () => {
      const nonSensitiveSettings = githubAppSettings.settings.filter(s => 
        s.key !== 'github.app.private_key_base64'
      )
      
      nonSensitiveSettings.forEach(setting => {
        expect(setting.encrypted).toBe(false)
      })
    })

    it('should have meaningful security boundaries', () => {
      // Private key should be encrypted
      const privateKey = githubAppSettings.settings.find(s => s.key.includes('private_key'))
      expect(privateKey?.encrypted).toBe(true)
      
      // Public identifiers should not be encrypted
      const appId = githubAppSettings.settings.find(s => s.key.includes('app_id'))
      const installationId = githubAppSettings.settings.find(s => s.key.includes('installation_id'))
      const enabled = githubAppSettings.settings.find(s => s.key.includes('enabled'))
      
      expect(appId?.encrypted).toBe(false)
      expect(installationId?.encrypted).toBe(false)
      expect(enabled?.encrypted).toBe(false)
    })
  })

  describe('Integration Context', () => {
    it('should be configured for MCP catalog integration', () => {
      expect(githubAppSettings.group.description).toContain('MCP catalog')
      
      const enabledSetting = githubAppSettings.settings.find(s => s.key === 'github.app.enabled')
      expect(enabledSetting?.description).toContain('MCP catalog')
    })

    it('should have GitHub-specific naming convention', () => {
      expect(githubAppSettings.group.id).toBe('github-app')
      expect(githubAppSettings.group.icon).toBe('github')
      
      githubAppSettings.settings.forEach(setting => {
        expect(setting.key).toMatch(/^github\.app\./)
      })
    })

    it('should have appropriate sort order', () => {
      // Sort order should be reasonable (not 0 or negative)
      expect(githubAppSettings.group.sort_order).toBeGreaterThan(0)
      expect(githubAppSettings.group.sort_order).toBeLessThan(100) // Reasonable upper bound
    })
  })

  describe('Required vs Optional Settings', () => {
    it('should have all settings marked as optional', () => {
      githubAppSettings.settings.forEach(setting => {
        expect(setting.required).toBe(false)
      })
    })

    it('should allow gradual configuration', () => {
      // Since all settings are optional, users can configure them incrementally
      const requiredSettings = githubAppSettings.settings.filter(s => s.required)
      expect(requiredSettings).toHaveLength(0)
    })
  })

  describe('Module Export', () => {
    it('should export the module as githubAppSettings', () => {
      expect(githubAppSettings).toBeDefined()
      expect(typeof githubAppSettings).toBe('object')
    })

    it('should be importable', () => {
      // This test passes if the import at the top of the file works
      expect(githubAppSettings.group.id).toBe('github-app')
    })
  })

  describe('Data Validation', () => {
    it('should have non-empty descriptions for all settings', () => {
      githubAppSettings.settings.forEach(setting => {
        expect(setting.description).toBeTruthy()
        expect(setting.description.length).toBeGreaterThan(5)
      })
    })

    it('should have valid setting keys', () => {
      githubAppSettings.settings.forEach(setting => {
        expect(setting.key).toMatch(/^[a-z._0-9]+$/) // Only lowercase letters, dots, underscores, and numbers
        expect(setting.key.length).toBeGreaterThan(0)
      })
    })

    it('should have consistent naming pattern', () => {
      githubAppSettings.settings.forEach(setting => {
        expect(setting.key).toMatch(/^github\.app\./)
      })
    })
  })

  describe('Completeness Check', () => {
    it('should include all essential GitHub App configuration options', () => {
      const settingKeys = githubAppSettings.settings.map(s => s.key)
      
      // Essential GitHub App settings
      expect(settingKeys).toContain('github.app.app_id')           // Required for GitHub App identification
      expect(settingKeys).toContain('github.app.private_key_base64') // Required for authentication
      expect(settingKeys).toContain('github.app.installation_id')  // Required for specific installation
      expect(settingKeys).toContain('github.app.enabled')          // Required for feature toggle
    })

    it('should provide comprehensive GitHub App configuration', () => {
      // Should cover the main aspects of GitHub App setup
      const hasAppIdentification = githubAppSettings.settings.some(s => s.key.includes('app_id'))
      const hasAuthentication = githubAppSettings.settings.some(s => s.key.includes('private_key'))
      const hasInstallation = githubAppSettings.settings.some(s => s.key.includes('installation_id'))
      const hasFeatureToggle = githubAppSettings.settings.some(s => s.key.includes('enabled'))
      
      expect(hasAppIdentification).toBe(true)
      expect(hasAuthentication).toBe(true)
      expect(hasInstallation).toBe(true)
      expect(hasFeatureToggle).toBe(true)
    })
  })
})
