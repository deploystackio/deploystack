// Use ts-node to load TypeScript directly
require('ts-node/register');
const { createServer } = require('../src/server.ts');
const fs = require('fs');
const path = require('path');

async function waitForServer(url, maxAttempts = 30, delay = 1000) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        console.log(`✅ Server is ready after ${i + 1} attempts`);
        return true;
      }
    } catch (error) {
      // Server not ready yet
    }
    
    if (i < maxAttempts - 1) {
      console.log(`⏳ Waiting for server... (attempt ${i + 1}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  console.log(`❌ Server not ready after ${maxAttempts} attempts`);
  return false;
}

async function generateApiSpec() {
  let server = null;
  
  try {
    console.log('🚀 Starting server to generate API specification...');
    
    // Create the server
    server = await createServer();
    
    // Start the server
    await server.listen({ port: 3000, host: '127.0.0.1' });
    console.log('🌐 Server started on http://localhost:3000');
    
    // Wait for the server to be fully ready with proper health check
    console.log('⏳ Waiting for server to be fully initialized...');
    const serverReady = await waitForServer('http://localhost:3000/documentation/json');
    
    if (!serverReady) {
      throw new Error('Server did not become ready in time');
    }
    
    // Additional wait to ensure plugin initialization is complete
    console.log('⏳ Allowing additional time for plugin initialization...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check if any plugin routes are available by fetching a test route
    try {
      console.log('🔍 Checking plugin route availability...');
      const testResponse = await fetch('http://localhost:3000/api/plugin/example-plugin/examples');
      if (testResponse.ok || testResponse.status === 404) {
        console.log('✅ Plugin routes are registered');
      } else {
        console.log(`⚠️  Plugin routes may not be fully initialized (status: ${testResponse.status})`);
      }
    } catch (pluginError) {
      console.log('⚠️  Plugin routes check failed:', pluginError.message);
    }
    
    // Fetch the OpenAPI specification
    console.log('📥 Fetching API specification...');
    const response = await fetch('http://localhost:3000/documentation/json');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch API spec: ${response.status} ${response.statusText}`);
    }
    
    const apiSpec = await response.json();
    
    // Check if plugin routes are in the spec
    const pluginRoutes = Object.keys(apiSpec.paths || {}).filter(path => path.includes('/api/plugin/'));
    console.log(`📊 Found ${pluginRoutes.length} plugin routes in API spec:`, pluginRoutes);
    
    if (pluginRoutes.length === 0) {
      console.log('⚠️  WARNING: No plugin routes found in API specification!');
      console.log('    This might indicate plugin initialization issues.');
      console.log('    Check server logs for plugin-related errors.');
    }
    
    // Ensure output directory exists
    const outputDir = path.join(__dirname, '..');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Write JSON specification
    const jsonPath = path.join(outputDir, 'api-spec.json');
    fs.writeFileSync(jsonPath, JSON.stringify(apiSpec, null, 2));
    console.log(`✅ API specification saved to: ${jsonPath}`);
    
    // Also fetch and save YAML version
    try {
      const yamlResponse = await fetch('http://localhost:3000/documentation/yaml');
      if (yamlResponse.ok) {
        const yamlSpec = await yamlResponse.text();
        const yamlPath = path.join(outputDir, 'api-spec.yaml');
        fs.writeFileSync(yamlPath, yamlSpec);
        console.log(`✅ YAML specification saved to: ${yamlPath}`);
      }
    } catch (yamlError) {
      console.warn('⚠️  Could not generate YAML specification:', yamlError.message);
    }
    
    // Generate summary report
    const totalPaths = Object.keys(apiSpec.paths || {}).length;
    const corePaths = Object.keys(apiSpec.paths || {}).filter(path => !path.includes('/api/plugin/')).length;
    const pluginPaths = pluginRoutes.length;
    
    console.log('\n📊 API Specification Summary:');
    console.log(`   Total endpoints: ${totalPaths}`);
    console.log(`   Core endpoints: ${corePaths}`);
    console.log(`   Plugin endpoints: ${pluginPaths}`);
    
    console.log('\n📋 API Documentation URLs:');
    console.log('   Interactive Docs: http://localhost:3000/documentation');
    console.log('   JSON Spec: http://localhost:3000/documentation/json');
    console.log('   YAML Spec: http://localhost:3000/documentation/yaml');
    
    console.log('\n📦 Import into Postman:');
    console.log(`   Use the generated file: ${jsonPath}`);
    
    if (pluginPaths === 0) {
      console.log('\n⚠️  PLUGIN ROUTES MISSING:');
      console.log('   The generated API spec does not include plugin routes.');
      console.log('   This suggests plugin initialization failed.');
      console.log('   Recommendations:');
      console.log('   1. Check that the database is properly configured');
      console.log('   2. Review server logs for plugin initialization errors');
      console.log('   3. Ensure plugin tables are created in the database');
      console.log('   4. Verify plugin files are present in src/plugins/');
    }
    
  } catch (error) {
    console.error('❌ Error generating API specification:', error);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 Connection refused - server may not have started properly');
    } else if (error.message.includes('fetch')) {
      console.error('\n💡 Network error - check if server is responding');
    }
    
    process.exit(1);
  } finally {
    // Ensure server is closed
    if (server) {
      try {
        await server.close();
        console.log('\n✅ Server closed. API specification generation complete!');
      } catch (closeError) {
        console.error('⚠️  Error closing server:', closeError.message);
      }
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⚠️  Process interrupted. Exiting...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️  Process terminated. Exiting...');
  process.exit(0);
});

// Run the script
generateApiSpec();
