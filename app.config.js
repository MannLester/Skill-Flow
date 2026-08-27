const { runtimeConfigurationExtra } = require('./scripts/runtime-public-environment.cjs');

module.exports = ({ config }) => ({
  ...config,
  plugins: [...(config.plugins ?? []), 'expo-web-browser'],
  extra: {
    ...config.extra,
    ...runtimeConfigurationExtra(process.env),
  },
});
