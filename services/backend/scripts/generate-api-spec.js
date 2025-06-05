// Use ts-node to load TypeScript directly
require('ts-node/register');
const { createServer } = require('../src/server.ts');
const fs = require('fs');
const path = require('path');

async function generateApiSpec() {
  try {
    console.log('Starting server to generate API specification...');
    
    // Create the server
    const server = await createServer();
    
    // Start the server
    await server.listen({ port: 3000, host: '127.0.0.1' });
    console.log('Server started on http://localhost:3000');
    
    // Wait a moment for the server to be fully ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Fetch the OpenAPI specification
    const response = await fetch('http://localhost:3000/documentation/json');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch API spec: ${response.status} ${response.statusText}`);
    }
    
    const apiSpec = await response.json();
    
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
    
    console.log('\n📋 API Documentation URLs:');
    console.log('   Interactive Docs: http://localhost:3000/documentation');
    console.log('   JSON Spec: http://localhost:3000/documentation/json');
    console.log('   YAML Spec: http://localhost:3000/documentation/yaml');
    
    console.log('\n📦 Import into Postman:');
    console.log(`   Use the generated file: ${jsonPath}`);
    
    // Close the server
    await server.close();
    console.log('\n✅ Server closed. API specification generation complete!');
    
  } catch (error) {
    console.error('❌ Error generating API specification:', error);
    process.exit(1);
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
