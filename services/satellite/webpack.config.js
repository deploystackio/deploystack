const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

// This webpack config is only used for copying assets, not for bundling the application
module.exports = {
  // We don't need an entry point since we're only copying files
  entry: {},
  
  // Output configuration - just for webpack to be happy
  output: {
    path: path.resolve(__dirname, 'dist'),
    clean: false, // Don't clean since TypeScript will create files here
  },
  
  // Mode will be set via CLI
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
};
