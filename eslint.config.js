const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

const typeScriptParser = expoConfig.find(
  (config) => config.languageOptions?.parser?.meta?.name === 'typescript-eslint/parser',
).languageOptions.parser;

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
    ignores: ['dist/*', 'references/*', '.agent-worktrees/*', '.expo/*'],
  },
  {
    files: ['**/*.cts', '**/*.mts'],
    languageOptions: {
      parser: typeScriptParser,
    },
  },
  {
    rules: {
      complexity: ['error', { max: 10 }],
    },
  },
]);
