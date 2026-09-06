// The previous config listed only `**/*.js` files, so `eslint .` never looked
// at a single TypeScript file of a TypeScript application.
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const nextPlugin = require('@next/eslint-plugin-next');
const prettier = require('eslint-config-prettier');

module.exports = [
  { ignores: ['.next/**', 'node_modules/**', 'coverage/**', 'next-env.d.ts', 'public/**'] },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: 'module', ecmaFeatures: { jsx: true } }
    },
    plugins: { '@typescript-eslint': tsPlugin, '@next/next': nextPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
    }
  },
  {
    files: ['**/*.{js,cjs,mjs}'],
    rules: { 'prefer-const': 'warn', 'no-constant-binary-expression': 'error' }
  },
  prettier
];
