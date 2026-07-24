const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config')

const defaultConfig = getDefaultConfig(__dirname)

const config = {
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
  resolver: {
    sourceExts: [...defaultConfig.resolver.sourceExts, 'svg'],
  },
}

module.exports = mergeConfig(defaultConfig, config)
