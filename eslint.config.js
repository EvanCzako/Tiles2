import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import globals from 'globals';
import prettierConfig from 'eslint-config-prettier';

export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // The app itself. Everything here is TypeScript — matching .js/.jsx (as this
    // config used to) silently linted zero files.
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooksPlugin,
    },
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      ...reactHooksPlugin.configs.recommended.rules,
    },
  },
  {
    // Node-side tooling: the balance simulator.
    files: ['scripts/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/**/*.test.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.jest } },
  },
  prettierConfig,
];
