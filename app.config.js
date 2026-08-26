const { runtimeConfigurationExtra } = require('./scripts/runtime-public-environment.cjs');

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    ...runtimeConfigurationExtra(process.env),
  },
});
