import { describe, it, expect, vi, beforeEach, afterEach, type MockedFunction } from 'vitest';
import path from 'node:path';
import { getDbConfig, saveDbConfig, deleteDbConfig, type DbConfig, type SQLiteConfig } from '../../../src/db/config';

// Create mock functions using vi.hoisted
const { mockMkdir, mockReadFile, mockWriteFile, mockUnlink } = vi.hoisted(() => ({
  mockMkdir: vi.fn(),
  mockReadFile: vi.fn(),
  mockWriteFile: vi.fn(),
  mockUnlink: vi.fn(),
}));

// Mock the fs/promises module
vi.mock('node:fs/promises', () => ({
  default: {
    mkdir: mockMkdir,
    readFile: mockReadFile,
    writeFile: mockWriteFile,
    unlink: mockUnlink,
  },
  mkdir: mockMkdir,
  readFile: mockReadFile,
  writeFile: mockWriteFile,
  unlink: mockUnlink,
}));

const TEST_CONFIG_DIR = path.join(__dirname, '..', '..', '..', 'src', 'db', '..', '..', 'persistent_data');
const TEST_DB_SELECTION_FILE_NAME = 'db.selection.test.json';
const TEST_CONFIG_FILE_PATH = path.join(TEST_CONFIG_DIR, TEST_DB_SELECTION_FILE_NAME);

describe('Database Configuration', () => {
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    vi.resetAllMocks();
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test'; // Ensure test mode for consistent file naming

    // Default mock for mkdir, can be overridden in specific tests if needed
    mockMkdir.mockResolvedValue(TEST_CONFIG_DIR as any);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('getDbConfig', () => {
    it('should read and parse an existing configuration file', async () => {
      const mockConfig: SQLiteConfig = { type: 'sqlite', dbPath: 'test.db' };
      mockReadFile.mockResolvedValue(JSON.stringify(mockConfig));

      const config = await getDbConfig();
      expect(config).toEqual(mockConfig);
      expect(mockMkdir).toHaveBeenCalledWith(TEST_CONFIG_DIR, { recursive: true });
      expect(mockReadFile).toHaveBeenCalledWith(TEST_CONFIG_FILE_PATH, 'utf-8');
    });

    it('should return null if the configuration file does not exist (ENOENT)', async () => {
      const error = new Error('File not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      mockReadFile.mockRejectedValue(error);

      const config = await getDbConfig();
      expect(config).toBeNull();
      expect(mockMkdir).toHaveBeenCalledWith(TEST_CONFIG_DIR, { recursive: true });
    });

    it('should log an error and return null for other readFile errors', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Read permission denied');
      mockReadFile.mockRejectedValue(error);

      const config = await getDbConfig();
      expect(config).toBeNull();
      expect(mockMkdir).toHaveBeenCalledWith(TEST_CONFIG_DIR, { recursive: true });
      expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR] Failed to read database configuration:', error);
      consoleErrorSpy.mockRestore();
    });

    it('should log an error and return null if JSON parsing fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockReadFile.mockResolvedValue('invalid json');

      // We expect JSON.parse to throw, which should be caught by getDbConfig
      // For this test, we don't mock JSON.parse itself, but rely on it failing.
      // The function should catch this and return null.
      const config = await getDbConfig();
      expect(config).toBeNull();
      // The error logged would be the SyntaxError from JSON.parse
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('[ERROR] Failed to read database configuration:'), expect.any(SyntaxError));
      consoleErrorSpy.mockRestore();
    });
  });

  describe('saveDbConfig', () => {
    const mockConfig: SQLiteConfig = { type: 'sqlite', dbPath: 'test.db' };

    it('should save the configuration file successfully', async () => {
      process.env.NODE_ENV = 'development'; // Set to non-test mode to enable logging
      mockWriteFile.mockResolvedValue(undefined);
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await saveDbConfig(mockConfig);

      expect(mockMkdir).toHaveBeenCalledWith(TEST_CONFIG_DIR, { recursive: true });
      expect(mockWriteFile).toHaveBeenCalledWith(TEST_CONFIG_FILE_PATH, JSON.stringify(mockConfig, null, 2), 'utf-8');
      expect(consoleLogSpy).toHaveBeenCalledWith(`[INFO] Database configuration saved to ${TEST_CONFIG_FILE_PATH}`);
      consoleLogSpy.mockRestore();
    });

    it('should log an error and re-throw if writeFile fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Write permission denied');
      mockWriteFile.mockRejectedValue(error);

      await expect(saveDbConfig(mockConfig)).rejects.toThrow(error);
      expect(mockMkdir).toHaveBeenCalledWith(TEST_CONFIG_DIR, { recursive: true });
      expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR] Failed to save database configuration:', error);
      consoleErrorSpy.mockRestore();
    });

     it('should log an error and re-throw if mkdir fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Cannot create directory');
      mockMkdir.mockRejectedValue(error); // Mock mkdir to fail

      await expect(saveDbConfig(mockConfig)).rejects.toThrow(error);
      // writeFile should not be called if mkdir fails
      expect(mockWriteFile).not.toHaveBeenCalled();
      // The error from mkdir is caught by the try-catch in saveDbConfig
      expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR] Failed to save database configuration:', error);
      consoleErrorSpy.mockRestore();
    });
  });

  describe('deleteDbConfig', () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    beforeEach(() => {
        consoleLogSpy.mockClear();
        consoleErrorSpy.mockClear();
    })

    it('should delete the configuration file successfully', async () => {
      process.env.NODE_ENV = 'development'; // Set to non-test mode to enable logging
      mockUnlink.mockResolvedValue(undefined);

      await deleteDbConfig();
      expect(mockUnlink).toHaveBeenCalledWith(TEST_CONFIG_FILE_PATH);
      expect(consoleLogSpy).toHaveBeenCalledWith(`[INFO] Database configuration deleted from ${TEST_CONFIG_FILE_PATH}`);
    });

    it('should log info and not throw if the file does not exist (ENOENT)', async () => {
      process.env.NODE_ENV = 'development'; // Set to non-test mode to enable logging
      const error = new Error('File not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      mockUnlink.mockRejectedValue(error);

      await deleteDbConfig();
      expect(mockUnlink).toHaveBeenCalledWith(TEST_CONFIG_FILE_PATH);
      expect(consoleLogSpy).toHaveBeenCalledWith('[INFO] Database configuration file not found, nothing to delete.');
      expect(consoleErrorSpy).not.toHaveBeenCalled(); // No error should be logged
    });

    it('should log an error and re-throw for other unlink errors', async () => {
      const error = new Error('Delete permission denied');
      mockUnlink.mockRejectedValue(error);

      await expect(deleteDbConfig()).rejects.toThrow(error);
      expect(mockUnlink).toHaveBeenCalledWith(TEST_CONFIG_FILE_PATH);
      expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR] Failed to delete database configuration:', error);
      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('nothing to delete'));
    });
  });

  describe('NODE_ENV handling for logging', () => {
    const mockConfig: SQLiteConfig = { type: 'sqlite', dbPath: 'test.db' };

    it('should not call console.log when NODE_ENV is "test" for saveDbConfig', async () => {
      process.env.NODE_ENV = 'test';
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockWriteFile.mockResolvedValue(undefined);

      await saveDbConfig(mockConfig);
      expect(consoleLogSpy).not.toHaveBeenCalled(); // logInfo should prevent this
      consoleLogSpy.mockRestore();
    });

    it('should call console.log when NODE_ENV is not "test" for saveDbConfig', async () => {
      process.env.NODE_ENV = 'development'; // Not 'test'
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockWriteFile.mockResolvedValue(undefined);

      await saveDbConfig(mockConfig);
      expect(consoleLogSpy).toHaveBeenCalledWith(`[INFO] Database configuration saved to ${TEST_CONFIG_FILE_PATH}`); // Use the actual path that will be used
      consoleLogSpy.mockRestore();
    });


    it('should not call console.log when NODE_ENV is "test" for deleteDbConfig (success)', async () => {
      process.env.NODE_ENV = 'test';
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockUnlink.mockResolvedValue(undefined);

      await deleteDbConfig();
      expect(consoleLogSpy).not.toHaveBeenCalled();
      consoleLogSpy.mockRestore();
    });

    it('should call console.log when NODE_ENV is not "test" for deleteDbConfig (success)', async () => {
      process.env.NODE_ENV = 'development';
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockUnlink.mockResolvedValue(undefined);

      await deleteDbConfig();
      expect(consoleLogSpy).toHaveBeenCalledWith(`[INFO] Database configuration deleted from ${TEST_CONFIG_FILE_PATH}`);
      consoleLogSpy.mockRestore();
    });

    it('should not call console.log when NODE_ENV is "test" for deleteDbConfig (ENOENT)', async () => {
      process.env.NODE_ENV = 'test';
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const error = new Error('File not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      mockUnlink.mockRejectedValue(error);

      await deleteDbConfig();
      expect(consoleLogSpy).not.toHaveBeenCalled();
      consoleLogSpy.mockRestore();
    });

    it('should call console.log when NODE_ENV is not "test" for deleteDbConfig (ENOENT)', async () => {
      process.env.NODE_ENV = 'development';
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const error = new Error('File not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      mockUnlink.mockRejectedValue(error);

      await deleteDbConfig();
      expect(consoleLogSpy).toHaveBeenCalledWith('[INFO] Database configuration file not found, nothing to delete.');
      consoleLogSpy.mockRestore();
    });
  });
});
