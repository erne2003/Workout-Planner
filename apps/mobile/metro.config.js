const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [workspaceRoot];
// 2. Let Metro know where to resolve packages, checking local first then root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// 3. Ensure only ONE copy of react/react-native is used
//    This prevents the "Invalid hook call" error from duplicate React instances
config.resolver.extraNodeModules = {
  'react': path.resolve(require.resolve('react/package.json'), '..'),
  'react-dom': path.resolve(require.resolve('react-dom/package.json'), '..'),
  'react-native': path.resolve(require.resolve('react-native/package.json'), '..'),
};

module.exports = config;
