#!/usr/bin/env node

/**
 * Simple test script to verify the new SSE endpoints are working
 * Run this after starting the gateway to test the migration
 */

const http = require('http');

const BASE_URL = 'http://localhost:9095';

async function testEndpoint(method, path, expectedStatus = 200) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 9095,
      path: path,
      method: method,
      headers: {
        'Accept': method === 'GET' && path === '/sse' ? 'text/event-stream' : 'application/json',
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      // For SSE connections, collect data for a short time then resolve
      if (method === 'GET' && path === '/sse') {
        const timeout = setTimeout(() => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data
          });
        }, 2000); // Wait 2 seconds for SSE data
        
        res.on('data', (chunk) => {
          data += chunk;
          // If we get the endpoint event, we can resolve early
          if (data.includes('event: endpoint')) {
            clearTimeout(timeout);
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data: data
            });
          }
        });
        
        res.on('error', () => {
          clearTimeout(timeout);
          reject(new Error('SSE connection error'));
        });
        
        return; // Don't set up normal data handlers for SSE
      }
      
      // Normal HTTP response handling
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    // For POST requests, send a basic JSON-RPC message
    if (method === 'POST') {
      const jsonRpcMessage = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          clientInfo: { name: 'test-client', version: '1.0.0' },
          protocolVersion: '2025-03-26',
          capabilities: {}
        }
      });
      req.write(jsonRpcMessage);
    }

    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing DeployStack Gateway endpoints...\n');

  // Add overall timeout to prevent hanging
  const testTimeout = setTimeout(() => {
    console.log('\n⏰ Test timeout reached (30 seconds)');
    console.log('❌ Tests may be hanging due to connection issues');
    process.exit(1);
  }, 30000);

  try {
    // Test root endpoint
    try {
      console.log('1. Testing root endpoint (GET /)...');
      const rootResponse = await testEndpoint('GET', '/');
      if (rootResponse.status === 200) {
        console.log('   ✅ Root endpoint working');
        const info = JSON.parse(rootResponse.data);
        console.log(`   📋 Gateway: ${info.name} v${info.version}`);
      } else {
        console.log(`   ❌ Root endpoint failed (${rootResponse.status})`);
      }
    } catch (error) {
      console.log(`   ❌ Root endpoint error: ${error.message}`);
    }

    // Test SSE endpoint
    try {
      console.log('\n2. Testing SSE endpoint (GET /sse)...');
      const sseResponse = await testEndpoint('GET', '/sse');
      if (sseResponse.status === 200 && sseResponse.headers['content-type'] === 'text/event-stream') {
        console.log('   ✅ SSE endpoint working');
        console.log('   📡 Content-Type: text/event-stream');
        
        // Check if we got an endpoint event
        if (sseResponse.data.includes('event: endpoint')) {
          console.log('   ✅ Endpoint event received');
          const match = sseResponse.data.match(/data: (\/message\?session=[A-Za-z0-9_-]+)/);
          if (match) {
            console.log(`   📨 Session endpoint: ${match[1]}`);
          }
        } else {
          console.log('   ⚠️  No endpoint event received');
        }
      } else {
        console.log(`   ❌ SSE endpoint failed (${sseResponse.status})`);
      }
    } catch (error) {
      console.log(`   ❌ SSE endpoint error: ${error.message}`);
    }

    // Test message endpoint (requires session)
    try {
      console.log('\n3. Testing message endpoint (POST /message - requires session)...');
      
      // First, we need to get a session from SSE
      console.log('   🔗 Getting session from SSE connection...');
      const sseResponse = await testEndpoint('GET', '/sse');
      
      if (sseResponse.status === 200 && sseResponse.data.includes('event: endpoint')) {
        // Extract session ID from the endpoint event
        const match = sseResponse.data.match(/data: \/message\?session=([A-Za-z0-9_-]+)/);
        if (match) {
          const sessionId = match[1];
          console.log(`   ✅ Session created: ${sessionId.substring(0, 8)}...`);
          console.log('   📝 Note: Full session-based testing would require keeping SSE connection open');
        } else {
          console.log('   ⚠️  Could not extract session ID from SSE response');
        }
      } else {
        console.log('   ❌ Failed to establish SSE connection for session');
      }
    } catch (error) {
      console.log(`   ❌ Message endpoint test error: ${error.message}`);
    }

    // Test health endpoint
    try {
      console.log('\n4. Testing health endpoint (GET /health)...');
      const healthResponse = await testEndpoint('GET', '/health');
      if (healthResponse.status === 200) {
        console.log('   ✅ Health endpoint working');
        const health = JSON.parse(healthResponse.data);
        console.log(`   💚 Status: ${health.status}`);
        console.log(`   ⏱️  Uptime: ${Math.round(health.uptime)}s`);
      } else {
        console.log(`   ❌ Health endpoint failed (${healthResponse.status})`);
      }
    } catch (error) {
      console.log(`   ❌ Health endpoint error: ${error.message}`);
    }

    console.log('\n🎉 Endpoint testing complete!');
    console.log('\n📋 Summary:');
    console.log('   • GET  /     - Gateway information');
    console.log('   • GET  /sse  - SSE connection for VS Code');  
    console.log('   • POST /message - Session-based JSON-RPC (requires SSE session)');
    console.log('   • GET  /health - Health check');
    console.log('   • GET  /status - Detailed status');
    
    console.log('\n🔧 Usage:');
    console.log('   VS Code/Cursor: http://localhost:9095/sse');
    
  } catch (error) {
    console.error('\n❌ Test suite error:', error);
  } finally {
    // Always clear the timeout and exit
    clearTimeout(testTimeout);
    process.exit(0);
  }
}

// Check if gateway is running first
const checkReq = http.request({
  hostname: 'localhost',
  port: 9095,
  path: '/health',
  method: 'GET'
}, (res) => {
  if (res.statusCode === 200) {
    runTests();
  } else {
    console.log('❌ Gateway not responding. Please start the gateway first with:');
    console.log('   deploystack start -f');
  }
});

checkReq.on('error', (error) => {
  console.log('❌ Gateway not running. Please start the gateway first with:');
  console.log('   deploystack start -f');
  console.log(`\nConnection error: ${error.message}`);
});

checkReq.end();
