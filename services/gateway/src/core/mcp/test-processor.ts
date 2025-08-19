import { MCPInstallation } from '../../types/mcp';
import { processMCPInstallations, validateMCPInstallation, filterValidInstallations } from './config-processor';

/**
 * Test MCP configuration processing with sample data
 * This helps validate our logic before runtime
 */
export function testMCPProcessing(): void {
  console.log('🧪 Testing MCP configuration processing...');

  // Sample MCP installation data based on API spec
  const sampleInstallations: MCPInstallation[] = [
    {
      id: 'inst-001',
      team_id: 'team-123',
      server_id: 'server-001',
      user_id: 'user-001',
      installation_name: 'Bright Data MCP',
      installation_type: 'local',
      user_environment_variables: {
        'API_TOKEN': 'test-token-123',
        'API_URL': 'https://brightdata.example.com'
      },
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      last_used_at: null,
      server: {
        id: 'server-001',
        name: '@brightdata/mcp',
        description: 'BrightData web scraping MCP server',
        github_url: 'https://github.com/brightdata/mcp-server',
        runtime: 'node',
        installation_methods: [
          {
            command: 'npx',
            args: ['@brightdata/mcp']
          }
        ],
        environment_variables: [
          {
            name: 'API_TOKEN',
            required: true,
            description: 'BrightData API token'
          }
        ],
        transport_type: 'stdio'
      }
    },
    {
      id: 'inst-002',
      team_id: 'team-123',
      server_id: 'server-002',
      user_id: 'user-001',
      installation_name: 'Python File Manager',
      installation_type: 'local',
      user_environment_variables: {
        'BASE_PATH': '/home/user/files'
      },
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      last_used_at: null,
      server: {
        id: 'server-002',
        name: 'file-manager-mcp',
        description: 'Python-based file management MCP server',
        github_url: 'https://github.com/example/file-manager-mcp',
        runtime: 'python',
        installation_methods: [
          {
            command: 'python',
            args: ['-m', 'file_manager_mcp']
          }
        ],
        environment_variables: [
          {
            name: 'BASE_PATH',
            required: false,
            description: 'Base path for file operations',
            default_value: '/tmp'
          }
        ],
        transport_type: 'stdio'
      }
    },
    // Invalid installation (missing server name)
    {
      id: 'inst-003',
      team_id: 'team-123',
      server_id: 'server-003',
      user_id: 'user-001',
      installation_name: 'Invalid Server',
      installation_type: 'local',
      user_environment_variables: {},
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      last_used_at: null,
      server: {
        id: 'server-003',
        name: '', // Invalid: empty name
        description: 'Invalid server for testing',
        github_url: null,
        runtime: 'node',
        installation_methods: [],
        environment_variables: [],
        transport_type: 'stdio'
      }
    }
  ];

  // Test validation
  console.log('\n📋 Testing validation...');
  sampleInstallations.forEach((installation, index) => {
    const isValid = validateMCPInstallation(installation);
    console.log(`Installation ${index + 1} (${installation.installation_name}): ${isValid ? '✅ Valid' : '❌ Invalid'}`);
  });

  // Test filtering
  console.log('\n🔍 Testing filtering...');
  const validInstallations = filterValidInstallations(sampleInstallations);
  console.log(`Original installations: ${sampleInstallations.length}`);
  console.log(`Valid installations: ${validInstallations.length}`);

  // Test processing
  console.log('\n⚙️ Testing processing...');
  const config = processMCPInstallations('team-123', 'Test Team', validInstallations);
  
  console.log(`\nProcessed Configuration:`);
  console.log(`Team: ${config.team_name} (${config.team_id})`);
  console.log(`Installations: ${config.installations.length}`);
  console.log(`Servers: ${config.servers.length}`);
  console.log(`Last Updated: ${config.last_updated}`);
  
  console.log('\n🖥️ Server Configurations:');
  config.servers.forEach((server, index) => {
    console.log(`${index + 1}. ${server.installation_name}`);
    console.log(`   Name: ${server.name}`);
    console.log(`   Runtime: ${server.runtime}`);
    console.log(`   Command: ${server.command} ${server.args.join(' ')}`);
    console.log(`   Environment Variables: ${Object.keys(server.env).length}`);
    Object.entries(server.env).forEach(([key, value]) => {
      console.log(`     ${key}=${value}`);
    });
    console.log('');
  });

  console.log('🎉 MCP processing test completed!');
}
