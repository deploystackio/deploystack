import * as fs from 'fs-extra';
import * as path from 'path';
import Database from 'better-sqlite3';
import type { GlobalSettingsModule, GlobalSettingDefinition } from '../../src/global-settings/types';

// Helper function to dynamically get all defined core setting keys
async function getDefinedCoreSettingKeys(): Promise<string[]> {
  const definedKeys: string[] = [];
  // __dirname is services/backend/tests/e2e
  // '..' -> services/backend/tests
  // '..' -> services/backend
  // then 'src/global-settings'
  const globalSettingsDir = path.join(__dirname, '..', '..', 'src', 'global-settings');
  
  try {
    const files = fs.readdirSync(globalSettingsDir);

    for (const file of files) {
      // Process only .ts files, excluding index.ts (auto-discovery service) and types.ts
      if (file.endsWith('.ts') && file !== 'index.ts' && file !== 'types.ts') {
        const filePath = path.join(globalSettingsDir, file);
        try {
          const moduleExports = require(filePath); // Dynamically require the .ts file

          // Iterate over exports to find the GlobalSettingsModule object
          for (const exportName in moduleExports) {
            const exportedItem = moduleExports[exportName];
            // Check if it structurally resembles a GlobalSettingsModule
            if (
              exportedItem &&
              typeof exportedItem === 'object' &&
              exportedItem.group && // Check for group property
              typeof exportedItem.group === 'object' &&
              Array.isArray(exportedItem.settings) // Check for settings array
            ) {
              const settingsModule = exportedItem as GlobalSettingsModule;
              settingsModule.settings.forEach((setting: GlobalSettingDefinition) => {
                definedKeys.push(setting.key);
              });
              // Assuming one main GlobalSettingsModule export per relevant file
              break; 
            }
          }
        } catch (error) {
          console.warn(`Could not load or parse settings from ${file}:`, error);
          // Optionally, rethrow or collect errors if critical
        }
      }
    }
  } catch (error) {
    console.error('Failed to read global-settings directory:', error);
    // Rethrow or handle as a test failure if directory read fails
    throw error;
  }
  
  return [...new Set(definedKeys)]; // Return unique keys
}

describe('Global Settings Initialization Check', () => {
  // __dirname is services/backend/tests/e2e
  const APP_BACKEND_ROOT = path.join(__dirname, '..', '..'); // Resolves to services/backend/
  const dbPath = path.join(APP_BACKEND_ROOT, 'database', 'deploystack.test.db'); // Correct path
  let db: Database.Database;

  beforeAll(() => {
    try {
      // The database file should exist as '1-setup.e2e.test.ts' must have run and created it.
      // Open in read-only mode as this test only verifies existence.
      db = new Database(dbPath, { readonly: true, fileMustExist: true });
    } catch (error) {
      console.error(
        `Failed to open database at ${dbPath}. Ensure '1-setup.e2e.test.ts' ran successfully and created the database.`,
        error
      );
      // Re-throw to fail the test suite early if DB connection fails
      throw error;
    }
  });

  afterAll(() => {
    if (db) {
      db.close();
    }
  });

  it('should ensure all defined core global settings are created in the database', async () => {
    const definedKeys = await getDefinedCoreSettingKeys();
    
    expect(definedKeys.length).toBeGreaterThanOrEqual(12); // Expect at least smtp (7) + github-oauth (5)

    let dbKeys: string[] = [];
    let settingsFound = false;
    const maxRetries = 10; // Poll for up to 5 seconds (10 * 500ms)
    const retryInterval = 500; // 500 ms

    for (let i = 0; i < maxRetries; i++) {
      try {
        const rowsFromDB = db.prepare("SELECT key FROM globalSettings").all() as Array<{ key: string }>;
        dbKeys = rowsFromDB.map(row => row.key);
        
        // Check if all defined keys are present
        let allFound = true;
        // Removed critical log here as the test will fail if settings are not found after polling.
        // if (definedKeys.length > 0 && dbKeys.length === 0 && i === 0) { 
        //      console.error('[Test 4] Initial Check CRITICAL: Defined settings were found, but the globalSettings table in the DB is empty. This indicates settings were not initialized into the DB during setup. Polling...');
        // }

        for (const definedKey of definedKeys) {
          if (!dbKeys.includes(definedKey)) {
            allFound = false;
            break;
          }
        }

        if (allFound && definedKeys.length > 0) { // Ensure definedKeys is not empty
          // Additionally, ensure that the number of keys in DB is at least the number of defined keys
          if (dbKeys.length >= definedKeys.length) {
            settingsFound = true;
            // console.log(`[Test 4] All ${definedKeys.length} defined settings found in DB after ${i + 1} attempt(s). DB keys: ${dbKeys.length}`);
            break;
          }
        }
      } catch (error) {
        console.error('[Test 4] Failed to query globalSettings table during poll:', error);
        // If query fails, likely a more significant issue, break and let assertions fail
        break;
      }

      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryInterval));
        // if (i % 4 === 0) { // Log progress periodically
        //     console.log(`[Test 4] Retrying DB check for global settings... Attempt ${i + 2}/${maxRetries}`);
        // }
      }
    }
    
    // console.log('[Test 4] Final keys found in DB globalSettings table after polling:', dbKeys.length, dbKeys);

    if (!settingsFound && definedKeys.length > 0) {
        console.error('[Test 4] FAILURE: After polling, not all defined global settings were found in the database.');
    }
    
    // Perform final assertions
    for (const definedKey of definedKeys) {
      expect(dbKeys).toContain(definedKey);
    }

    // Optional: A stricter check to ensure no unexpected keys are present.
    // This ensures that if settingsFound is true, the dbKeys array actually contains all definedKeys.
    // This assumes that only core settings should be in the DB at this stage of testing
    // and plugins (out of scope for this test) haven't added any.
    // For now, we'll stick to ensuring all defined keys are present.
    // expect(dbKeys.length).toEqual(definedKeys.length);
    // expect(dbKeys.sort()).toEqual(definedKeys.sort()); // Even stricter: exact match
  });
});
