import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GlobalSettings } from '../../../src/global-settings/helpers'
import { GlobalSettingsService } from '../../../src/services/globalSettingsService'

// Mock the GlobalSettingsService
vi.mock('../../../src/services/globalSettingsService', () => ({
  GlobalSettingsService: {
    get: vi.fn(),
    getByGroup: vi.fn(),
    exists: vi.fn(),
  }
}))

describe('GlobalSettings Helper Class', () => {
  const mockGlobalSettingsService = GlobalSettingsService as any

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('get method', () => {
    it('should return setting value when setting exists', async () => {
      mockGlobalSettingsService.get.mockResolvedValue({
        key: 'test.key',
        value: 'test value',
        type: 'string'
      })

      const result = await GlobalSettings.get('test.key')
      expect(result).toBe('test value')
      expect(mockGlobalSettingsService.get).toHaveBeenCalledWith('test.key')
    })

    it('should return null when setting does not exist', async () => {
      mockGlobalSettingsService.get.mockResolvedValue(null)

      const result = await GlobalSettings.get('nonexistent.key')
      expect(result).toBeNull()
    })

    it('should return default value when setting does not exist and default provided', async () => {
      mockGlobalSettingsService.get.mockResolvedValue(null)

      const result = await GlobalSettings.get('nonexistent.key', 'default value')
      expect(result).toBe('default value')
    })

    it('should return null when setting has empty value', async () => {
      mockGlobalSettingsService.get.mockResolvedValue({
        key: 'test.key',
        value: '',
        type: 'string'
      })

      const result = await GlobalSettings.get('test.key')
      expect(result).toBeNull()
    })

    it('should return default when setting has empty value and default provided', async () => {
      mockGlobalSettingsService.get.mockResolvedValue({
        key: 'test.key',
        value: '   ',
        type: 'string'
      })

      const result = await GlobalSettings.get('test.key', 'default')
      expect(result).toBe('default')
    })

    it('should handle service errors gracefully', async () => {
      mockGlobalSettingsService.get.mockRejectedValue(new Error('Database error'))

      const result = await GlobalSettings.get('test.key')
      expect(result).toBeNull()
    })

    it('should return default value when service throws error', async () => {
      mockGlobalSettingsService.get.mockRejectedValue(new Error('Database error'))

      const result = await GlobalSettings.get('test.key', 'fallback')
      expect(result).toBe('fallback')
    })
  })

  describe('getString method', () => {
    it('should work as alias for get method', async () => {
      mockGlobalSettingsService.get.mockResolvedValue({
        key: 'test.key',
        value: 'string value',
        type: 'string'
      })

      const result = await GlobalSettings.getString('test.key')
      expect(result).toBe('string value')
    })

    it('should return default value when provided', async () => {
      mockGlobalSettingsService.get.mockResolvedValue(null)

      const result = await GlobalSettings.getString('test.key', 'default string')
      expect(result).toBe('default string')
    })
  })

  describe('getBoolean method', () => {
    it('should return true for "true" value', async () => {
      mockGlobalSettingsService.get.mockResolvedValue({
        key: 'test.bool',
        value: 'true',
        type: 'boolean'
      })

      const result = await GlobalSettings.getBoolean('test.bool')
      expect(result).toBe(true)
    })

    it('should return false for "false" value', async () => {
      mockGlobalSettingsService.get.mockResolvedValue({
        key: 'test.bool',
        value: 'false',
        type: 'boolean'
      })

      const result = await GlobalSettings.getBoolean('test.bool')
      expect(result).toBe(false)
    })

    it('should handle various truthy values', async () => {
      const truthyValues = ['1', 'yes', 'on', 'enabled', 'TRUE', 'Yes', 'ON']
      
      for (const value of truthyValues) {
        mockGlobalSettingsService.get.mockResolvedValue({
          key: 'test.bool',
          value: value,
          type: 'boolean'
        })

        const result = await GlobalSettings.getBoolean('test.bool')
        expect(result).toBe(true)
      }
    })

    it('should handle various falsy values', async () => {
      const falsyValues = ['0', 'no', 'off', 'disabled', 'FALSE', 'No', 'OFF']
      
      for (const value of falsyValues) {
        mockGlobalSettingsService.get.mockResolvedValue({
          key: 'test.bool',
          value: value,
          type: 'boolean'
        })

        const result = await GlobalSettings.getBoolean('test.bool')
        expect(result).toBe(false)
      }
    })

    it('should return null for unparseable boolean values', async () => {
      mockGlobalSettingsService.get.mockResolvedValue({
        key: 'test.bool',
        value: 'invalid',
        type: 'boolean'
      })

      const result = await GlobalSettings.getBoolean('test.bool')
      expect(result).toBeNull()
    })

    it('should return default value for unparseable boolean', async () => {
      mockGlobalSettingsService.get.mockResolvedValue({
        key: 'test.bool',
        value: 'invalid',
        type: 'boolean'
      })

      const result = await GlobalSettings.getBoolean('test.bool', true)
      expect(result).toBe(true)
    })

    it('should return null when setting does not exist', async () => {
      mockGlobalSettingsService.get.mockResolvedValue(null)

      const result = await GlobalSettings.getBoolean('nonexistent.bool')
      expect(result).toBeNull()
    })

    it('should return default when setting does not exist', async () => {
      mockGlobalSettingsService.get.mockResolvedValue(null)

      const result = await GlobalSettings.getBoolean('nonexistent.bool', false)
      expect(result).toBe(false)
    })
  })

  describe('getNumber method', () => {
    it('should return number for valid numeric string', async () => {
      mockGlobalSettingsService.get.mockResolvedValue({
        key: 'test.number',
        value: '42',
        type: 'number'
      })

      const result = await GlobalSettings.getNumber('test.number')
      expect(result).toBe(42)
    })

    it('should handle decimal numbers', async () => {
      mockGlobalSettingsService.get.mockResolvedValue({
        key: 'test.decimal',
        value: '3.14',
        type: 'number'
      })

      const result = await GlobalSettings.getNumber('test.decimal')
      expect(result).toBe(3.14)
    })

    it('should handle negative numbers', async () => {
      mockGlobalSettingsService.get.mockResolvedValue({
        key: 'test.negative',
        value: '-100',
        type: 'number'
      })

      const result = await GlobalSettings.getNumber('test.negative')
      expect(result).toBe(-100)
    })

    it('should return null for non-numeric values', async () => {
      mockGlobalSettingsService.get.mockResolvedValue({
        key: 'test.invalid',
        value: 'not a number',
        type: 'number'
      })

      const result = await GlobalSettings.getNumber('test.invalid')
      expect(result).toBeNull()
    })

    it('should return default for non-numeric values', async () => {
      mockGlobalSettingsService.get.mockResolvedValue({
        key: 'test.invalid',
        value: 'not a number',
        type: 'number'
      })

      const result = await GlobalSettings.getNumber('test.invalid', 0)
      expect(result).toBe(0)
    })

    it('should return null when setting does not exist', async () => {
      mockGlobalSettingsService.get.mockResolvedValue(null)

      const result = await GlobalSettings.getNumber('nonexistent.number')
      expect(result).toBeNull()
    })
  })

  describe('getInteger method', () => {
    it('should return integer for decimal number', async () => {
      mockGlobalSettingsService.get.mockResolvedValue({
        key: 'test.decimal',
        value: '3.14',
        type: 'number'
      })

      const result = await GlobalSettings.getInteger('test.decimal')
      expect(result).toBe(3)
    })

    it('should return integer for whole number', async () => {
      mockGlobalSettingsService.get.mockResolvedValue({
        key: 'test.whole',
        value: '42',
        type: 'number'
      })

      const result = await GlobalSettings.getInteger('test.whole')
      expect(result).toBe(42)
    })

    it('should return null for invalid number', async () => {
      mockGlobalSettingsService.get.mockResolvedValue({
        key: 'test.invalid',
        value: 'not a number',
        type: 'number'
      })

      const result = await GlobalSettings.getInteger('test.invalid')
      expect(result).toBeNull()
    })
  })

  describe('getUrl method', () => {
    it('should return valid URL', async () => {
      mockGlobalSettingsService.get.mockResolvedValue({
        key: 'test.url',
        value: 'https://example.com',
        type: 'string'
      })

      const result = await GlobalSettings.getUrl('test.url')
      expect(result).toBe('https://example.com')
    })

    it('should return null for invalid URL', async () => {
      mockGlobalSettingsService.get.mockResolvedValue({
        key: 'test.invalid.url',
        value: 'not-a-url',
        type: 'string'
      })

      const result = await GlobalSettings.getUrl('test.invalid.url')
      expect(result).toBeNull()
    })

    it('should return default for invalid URL', async () => {
      mockGlobalSettingsService.get.mockResolvedValue({
        key: 'test.invalid.url',
        value: 'not-a-url',
        type: 'string'
      })

      const result = await GlobalSettings.getUrl('test.invalid.url', 'https://default.com')
      expect(result).toBe('https://default.com')
    })

    it('should handle various valid URL formats', async () => {
      const validUrls = [
        'https://example.com',
        'http://localhost:3000',
        'ftp://files.example.com',
        'https://sub.domain.com/path?query=value'
      ]

      for (const url of validUrls) {
        mockGlobalSettingsService.get.mockResolvedValue({
          key: 'test.url',
          value: url,
          type: 'string'
        })

        const result = await GlobalSettings.getUrl('test.url')
        expect(result).toBe(url)
      }
    })
  })

  describe('getEmail method', () => {
    it('should return valid email', async () => {
      mockGlobalSettingsService.get.mockResolvedValue({
        key: 'test.email',
        value: 'user@example.com',
        type: 'string'
      })

      const result = await GlobalSettings.getEmail('test.email')
      expect(result).toBe('user@example.com')
    })

    it('should return null for invalid email', async () => {
      mockGlobalSettingsService.get.mockResolvedValue({
        key: 'test.invalid.email',
        value: 'not-an-email',
        type: 'string'
      })

      const result = await GlobalSettings.getEmail('test.invalid.email')
      expect(result).toBeNull()
    })

    it('should return default for invalid email', async () => {
      mockGlobalSettingsService.get.mockResolvedValue({
        key: 'test.invalid.email',
        value: 'not-an-email',
        type: 'string'
      })

      const result = await GlobalSettings.getEmail('test.invalid.email', 'default@example.com')
      expect(result).toBe('default@example.com')
    })

    it('should handle various valid email formats', async () => {
      const validEmails = [
        'user@example.com',
        'test.email@domain.co.uk',
        'user+tag@example.org',
        'firstname.lastname@company.com'
      ]

      for (const email of validEmails) {
        mockGlobalSettingsService.get.mockResolvedValue({
          key: 'test.email',
          value: email,
          type: 'string'
        })

        const result = await GlobalSettings.getEmail('test.email')
        expect(result).toBe(email)
      }
    })
  })

  describe('getJson method', () => {
    it('should parse valid JSON object', async () => {
      const jsonObject = { key: 'value', number: 42 }
      mockGlobalSettingsService.get.mockResolvedValue({
        key: 'test.json',
        value: JSON.stringify(jsonObject),
        type: 'string'
      })

      const result = await GlobalSettings.getJson('test.json')
      expect(result).toEqual(jsonObject)
    })

    it('should parse valid JSON array', async () => {
      const jsonArray = ['item1', 'item2', 'item3']
      mockGlobalSettingsService.get.mockResolvedValue({
        key: 'test.json.array',
        value: JSON.stringify(jsonArray),
        type: 'string'
      })

      const result = await GlobalSettings.getJson('test.json.array')
      expect(result).toEqual(jsonArray)
    })

    it('should return null for invalid JSON', async () => {
      mockGlobalSettingsService.get.mockResolvedValue({
        key: 'test.invalid.json',
        value: 'invalid json {',
        type: 'string'
      })

      const result = await GlobalSettings.getJson('test.invalid.json')
      expect(result).toBeNull()
    })

    it('should return default for invalid JSON', async () => {
      const defaultValue = { default: true }
      mockGlobalSettingsService.get.mockResolvedValue({
        key: 'test.invalid.json',
        value: 'invalid json {',
        type: 'string'
      })

      const result = await GlobalSettings.getJson('test.invalid.json', defaultValue)
      expect(result).toEqual(defaultValue)
    })
  })

  describe('getArray method', () => {
    it('should parse comma-separated values', async () => {
      mockGlobalSettingsService.get.mockResolvedValue({
        key: 'test.array',
        value: 'item1,item2,item3',
        type: 'string'
      })

      const result = await GlobalSettings.getArray('test.array')
      expect(result).toEqual(['item1', 'item2', 'item3'])
    })

    it('should trim whitespace from items', async () => {
      mockGlobalSettingsService.get.mockResolvedValue({
        key: 'test.array.spaces',
        value: ' item1 , item2 , item3 ',
        type: 'string'
      })

      const result = await GlobalSettings.getArray('test.array.spaces')
      expect(result).toEqual(['item1', 'item2', 'item3'])
    })

    it('should filter out empty items', async () => {
      mockGlobalSettingsService.get.mockResolvedValue({
        key: 'test.array.empty',
        value: 'item1,,item3,',
        type: 'string'
      })

      const result = await GlobalSettings.getArray('test.array.empty')
      expect(result).toEqual(['item1', 'item3'])
    })

    it('should return empty array for empty string', async () => {
      mockGlobalSettingsService.get.mockResolvedValue({
        key: 'test.array.empty',
        value: '',
        type: 'string'
      })

      const result = await GlobalSettings.getArray('test.array.empty')
      expect(result).toEqual([])
    })

    it('should return default array when setting does not exist', async () => {
      mockGlobalSettingsService.get.mockResolvedValue(null)

      const result = await GlobalSettings.getArray('nonexistent.array', ['default'])
      expect(result).toEqual(['default'])
    })
  })

  describe('getMultiple method', () => {
    it('should get multiple settings at once', async () => {
      mockGlobalSettingsService.get
        .mockResolvedValueOnce({ key: 'key1', value: 'value1', type: 'string' })
        .mockResolvedValueOnce({ key: 'key2', value: 'value2', type: 'string' })
        .mockResolvedValueOnce(null)

      const result = await GlobalSettings.getMultiple(['key1', 'key2', 'key3'])
      expect(result).toEqual({
        key1: 'value1',
        key2: 'value2',
        key3: null
      })
    })

    it('should handle empty keys array', async () => {
      const result = await GlobalSettings.getMultiple([])
      expect(result).toEqual({})
    })
  })

  describe('getGroupValues method', () => {
    it('should get group values without group prefix', async () => {
      mockGlobalSettingsService.getByGroup.mockResolvedValue([
        { key: 'smtp.host', value: 'smtp.example.com', type: 'string' },
        { key: 'smtp.port', value: '587', type: 'number' },
        { key: 'smtp.secure', value: 'true', type: 'boolean' }
      ])

      const result = await GlobalSettings.getGroupValues('smtp')
      expect(result).toEqual({
        host: 'smtp.example.com',
        port: '587',
        secure: 'true'
      })
    })

    it('should handle nested group keys', async () => {
      mockGlobalSettingsService.getByGroup.mockResolvedValue([
        { key: 'api.openai.key', value: 'sk-123', type: 'string' },
        { key: 'api.openai.model', value: 'gpt-4', type: 'string' }
      ])

      const result = await GlobalSettings.getGroupValues('api')
      expect(result).toEqual({
        'openai.key': 'sk-123',
        'openai.model': 'gpt-4'
      })
    })

    it('should handle service errors gracefully', async () => {
      mockGlobalSettingsService.getByGroup.mockRejectedValue(new Error('Database error'))

      const result = await GlobalSettings.getGroupValues('smtp')
      expect(result).toEqual({})
    })
  })

  describe('getGroupValuesWithFullKeys method', () => {
    it('should get group values with full keys', async () => {
      mockGlobalSettingsService.getByGroup.mockResolvedValue([
        { key: 'smtp.host', value: 'smtp.example.com', type: 'string' },
        { key: 'smtp.port', value: '587', type: 'number' }
      ])

      const result = await GlobalSettings.getGroupValuesWithFullKeys('smtp')
      expect(result).toEqual({
        'smtp.host': 'smtp.example.com',
        'smtp.port': '587'
      })
    })
  })

  describe('isSet method', () => {
    it('should return true for existing setting with value', async () => {
      mockGlobalSettingsService.get.mockResolvedValue({
        key: 'test.key',
        value: 'some value',
        type: 'string'
      })

      const result = await GlobalSettings.isSet('test.key')
      expect(result).toBe(true)
    })

    it('should return false for non-existent setting', async () => {
      mockGlobalSettingsService.get.mockResolvedValue(null)

      const result = await GlobalSettings.isSet('nonexistent.key')
      expect(result).toBe(false)
    })

    it('should return false for setting with empty value', async () => {
      mockGlobalSettingsService.get.mockResolvedValue({
        key: 'test.key',
        value: '   ',
        type: 'string'
      })

      const result = await GlobalSettings.isSet('test.key')
      expect(result).toBe(false)
    })
  })

  describe('isEmpty method', () => {
    it('should return false for existing setting with value', async () => {
      mockGlobalSettingsService.get.mockResolvedValue({
        key: 'test.key',
        value: 'some value',
        type: 'string'
      })

      const result = await GlobalSettings.isEmpty('test.key')
      expect(result).toBe(false)
    })

    it('should return true for non-existent setting', async () => {
      mockGlobalSettingsService.get.mockResolvedValue(null)

      const result = await GlobalSettings.isEmpty('nonexistent.key')
      expect(result).toBe(true)
    })
  })

  describe('getRequired method', () => {
    it('should return value for existing setting', async () => {
      mockGlobalSettingsService.get.mockResolvedValue({
        key: 'required.key',
        value: 'required value',
        type: 'string'
      })

      const result = await GlobalSettings.getRequired('required.key')
      expect(result).toBe('required value')
    })

    it('should throw error for non-existent setting', async () => {
      mockGlobalSettingsService.get.mockResolvedValue(null)

      await expect(GlobalSettings.getRequired('missing.key'))
        .rejects.toThrow("Required setting 'missing.key' is not configured or is empty")
    })

    it('should throw error for empty setting', async () => {
      mockGlobalSettingsService.get.mockResolvedValue({
        key: 'empty.key',
        value: '',
        type: 'string'
      })

      await expect(GlobalSettings.getRequired('empty.key'))
        .rejects.toThrow("Required setting 'empty.key' is not configured or is empty")
    })
  })

  describe('exists method', () => {
    it('should return true when setting exists', async () => {
      mockGlobalSettingsService.exists.mockResolvedValue(true)

      const result = await GlobalSettings.exists('existing.key')
      expect(result).toBe(true)
      expect(mockGlobalSettingsService.exists).toHaveBeenCalledWith('existing.key')
    })

    it('should return false when setting does not exist', async () => {
      mockGlobalSettingsService.exists.mockResolvedValue(false)

      const result = await GlobalSettings.exists('nonexistent.key')
      expect(result).toBe(false)
    })

    it('should handle service errors gracefully', async () => {
      mockGlobalSettingsService.exists.mockRejectedValue(new Error('Database error'))

      const result = await GlobalSettings.exists('test.key')
      expect(result).toBe(false)
    })
  })

  describe('getRaw method', () => {
    it('should return raw setting object', async () => {
      const rawSetting = {
        key: 'test.key',
        value: 'test value',
        type: 'string',
        description: 'Test setting',
        is_encrypted: false,
        group_id: 'test',
        created_at: new Date(),
        updated_at: new Date()
      }
      mockGlobalSettingsService.get.mockResolvedValue(rawSetting)

      const result = await GlobalSettings.getRaw('test.key')
      expect(result).toEqual(rawSetting)
      expect(mockGlobalSettingsService.get).toHaveBeenCalledWith('test.key')
    })
  })

  describe('refreshCaches method', () => {
    it('should execute without errors', async () => {
      // This method currently just logs, so we test it doesn't throw
      await expect(GlobalSettings.refreshCaches()).resolves.toBeUndefined()
    })
  })
})
