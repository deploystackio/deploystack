export default {
  modal: {
    title: 'MCP Client Configuration',
    description: 'Get configuration and install links to connect your MCP clients to the DeployStack Satellite service.',
    satelliteInfo: 'DeployStack Satellite Service',
    satelliteDescription: 'No installation required! Just configure your MCP client to connect to our hosted satellite service.',
    clientLabel: 'Select MCP Client',
    selectPlaceholder: 'Choose a client...',
    configLabel: 'Configuration',
    instructionsLabel: 'Setup Instructions',
    configPlaceholder: 'Configuration will appear here...',
    instructionsPlaceholder: 'Manual setup instructions will appear here...',
    loading: 'Loading configuration...',
    oneClickInstall: 'One-Click Installation',
    oneClickDescription: 'Click the install button above for automatic configuration (supported clients only).'
  },
  
  clients: {
    claudeDesktop: 'Claude Desktop',
    cline: 'Cline',
    vscode: 'VS Code',
    cursor: 'Cursor',
    windsurf: 'Windsurf'
  },
  
  button: {
    getConfiguration: 'Get Client Configuration',
    copyAndClose: 'Copy to clipboard and close',
    copyInstructionsAndClose: 'Copy Instructions & Close'
  },
  
  messages: {
    copySuccess: 'Client configuration copied to clipboard successfully',
    copyInstructionsSuccess: 'Setup instructions copied to clipboard successfully'
  }
}
