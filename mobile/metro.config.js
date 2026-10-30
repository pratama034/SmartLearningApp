const path = require('node:path')
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)
const mobileNodeModules = path.resolve(__dirname, 'node_modules')

config.watchFolders = [path.resolve(__dirname, '../src/data')]
config.resolver.nodeModulesPaths = [mobileNodeModules]
config.resolver.extraNodeModules = {
  react: path.resolve(mobileNodeModules, 'react'),
  'react-native': path.resolve(mobileNodeModules, 'react-native'),
  expo: path.resolve(mobileNodeModules, 'expo'),
}

module.exports = config
