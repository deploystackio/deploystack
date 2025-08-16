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
  
  // Plugins
  plugins: [
    // Copy email templates to dist directory
    new CopyPlugin({
      patterns: [
        {
          from: 'src/email/templates',
          to: 'email/templates',
          // Preserve directory structure including layouts/
          globOptions: {
            dot: true, // Include dotfiles if any
          },
        },
      ],
    }),
  ],
  
  // Mode will be set via CLI
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
};
