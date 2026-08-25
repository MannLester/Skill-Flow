const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    files: ['jest.setup.js'],
    languageOptions: {
      globals: {
        jest: 'readonly',
        require: 'readonly',
      },
    },
  },
  {
    ignores: ['dist/*', 'references/*', '.agent-worktrees/*'],
  },
  {
    rules: {
      complexity: ['error', { max: 10 }],
    },
  },
]);
