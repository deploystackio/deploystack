const fs = require('fs');
const path = require('path');

const packageJson = require('../package.json');
const versionInfo = {
  version: packageJson.version,
  buildTime: new Date().toISOString(),
  source: 'release'
};

// Read the current version.ts file
const versionTsPath = path.join(__dirname, '../src/config/version.ts');
let versionTsContent = fs.readFileSync(versionTsPath, 'utf8');

// Replace the versionData object
const newVersionData = `let versionData: VersionInfo = {
  version: '${versionInfo.version}',
  buildTime: '${versionInfo.buildTime}',
  source: '${versionInfo.source}'
};`;

// Use regex to replace the versionData assignment
versionTsContent = versionTsContent.replace(
  /let versionData: VersionInfo = \{[\s\S]*?\};/,
  newVersionData
);

// Write the updated file
fs.writeFileSync(versionTsPath, versionTsContent);
console.log(`Updated version.ts to version ${versionInfo.version}`);
