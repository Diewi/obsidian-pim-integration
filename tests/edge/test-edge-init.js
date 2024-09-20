/**
 * Test script to debug edge-js CoreCLR initialization
 * Run this from Node.js (not Electron) to see trace output
 *
 * Usage: node test-edge-init.js 2>&1
 */

const path = require('path');
const fs = require('fs');

// Set environment variables before loading edge
process.env.EDGE_USE_CORECLR = '1';
process.env.EDGE_DEBUG = '1';
process.env.COREHOST_TRACE = '1';

// Set EDGE_APP_ROOT to point to the msoffice_bin directory with deps.json
const msOfficeBinPath = path.join(__dirname, '..', '..', 'dist', 'outlookcombridge');
process.env.EDGE_APP_ROOT = msOfficeBinPath;
process.env.EDGE_USE_RUNTIME_CONFIG = '1';

console.log('=== Edge CoreCLR Debug Test ===');
console.log('EDGE_USE_CORECLR:', process.env.EDGE_USE_CORECLR);
console.log('EDGE_DEBUG:', process.env.EDGE_DEBUG);
console.log('COREHOST_TRACE:', process.env.COREHOST_TRACE);
console.log('EDGE_APP_ROOT:', process.env.EDGE_APP_ROOT);
console.log('EDGE_USE_RUNTIME_CONFIG:', process.env.EDGE_USE_RUNTIME_CONFIG);
console.log('DOTNET_ROOT:', process.env.DOTNET_ROOT);

// Check if deps.json exists
const depsFiles = fs.readdirSync(msOfficeBinPath).filter((f) => f.endsWith('.deps.json'));
console.log('deps.json files in EDGE_APP_ROOT:', depsFiles);

// Check if runtimeconfig.json exists
const configFiles = fs
  .readdirSync(msOfficeBinPath)
  .filter((f) => f.endsWith('.runtimeconfig.json'));
console.log('runtimeconfig.json files:', configFiles);

// Try to require edge-js
console.log('\n--- Loading edge-js ---');
console.log('stderr output below should show trace info:\n');

try {
  const edge = require('edge-js');
  console.log('\nedge-js loaded successfully');
  console.log('edge.func exists:', typeof edge.func === 'function');

  if (typeof edge.func === 'function') {
    console.log('\nTrying to call edge.func...');
    const testFunc = edge.func({
      assemblyFile: path.join(msOfficeBinPath, 'OutlookComBridge.dll'),
      typeName: 'OutlookContactBridge',
      methodName: 'ExportContacts',
    });
    console.log('edge.func returned:', typeof testFunc);
  }
} catch (err) {
  console.error('\nFailed to load edge-js:', err.message);
  console.error('Stack:', err.stack);
}

console.log('\n=== End of test ===');
