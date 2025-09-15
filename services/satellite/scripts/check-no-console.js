#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Script to check for console.* statements in TypeScript source files
 * Excludes test files and only checks src/ directory
 */

const CONSOLE_PATTERNS = [
  /console\.log\s*\(/,
  /console\.error\s*\(/,
  /console\.warn\s*\(/,
  /console\.debug\s*\(/,
  /console\.info\s*\(/,
  /console\.trace\s*\(/,
  /console\.dir\s*\(/,
  /console\.table\s*\(/
];

const SRC_DIR = path.join(__dirname, '..', 'src');
const violations = [];

/**
 * Recursively find all .ts files in a directory
 */
function findTsFiles(dir) {
  const files = [];
  
  function traverse(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        traverse(fullPath);
      } else if (item.endsWith('.ts') && !item.endsWith('.d.ts')) {
        files.push(fullPath);
      }
    }
  }
  
  traverse(dir);
  return files;
}

/**
 * Check a file for console statements
 */
function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const fileViolations = [];
  
  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    
    // Skip comments
    if (trimmedLine.startsWith('//') || trimmedLine.startsWith('*') || trimmedLine.startsWith('/*')) {
      return;
    }
    
    // Check for console patterns
    for (const pattern of CONSOLE_PATTERNS) {
      if (pattern.test(line)) {
        fileViolations.push({
          file: path.relative(process.cwd(), filePath),
          line: index + 1,
          content: line.trim(),
          column: line.indexOf('console') + 1
        });
        break; // Only report one violation per line
      }
    }
  });
  
  return fileViolations;
}

/**
 * Main execution
 */
function main() {
  console.log('🔍 Checking for console.* statements in satellite source code...\n');
  
  if (!fs.existsSync(SRC_DIR)) {
    console.error(`❌ Source directory not found: ${SRC_DIR}`);
    process.exit(1);
  }
  
  const tsFiles = findTsFiles(SRC_DIR);
  console.log(`📁 Checking ${tsFiles.length} TypeScript files in src/ directory...\n`);
  
  // Check each file
  for (const file of tsFiles) {
    const fileViolations = checkFile(file);
    violations.push(...fileViolations);
  }
  
  // Report results
  if (violations.length === 0) {
    console.log('✅ No console statements found in satellite source code.');
    console.log('✅ All checks passed!\n');
    process.exit(0);
  } else {
    console.log('❌ Console statements found in satellite source code:\n');
    
    violations.forEach(violation => {
      console.log(`${violation.file}:${violation.line}:${violation.column}`);
      console.log(`  ${violation.content}\n`);
    });
    
    console.log(`❌ Found ${violations.length} console statement(s) in satellite source code.`);
    console.log('Please use the Fastify logger instead: server.log.info(), server.log.error(), etc.');
    console.log('See: https://docs.deploystack.io/development/satellite/logging\n');
    console.log('💡 Note: console.* statements are allowed in test files, but not in source code.\n');
    console.log('Build failed due to console statements in source code.');
    
    process.exit(1);
  }
}

// Run the script
main();
