import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import security from 'eslint-plugin-security';
import noSecrets from 'eslint-plugin-no-secrets';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

export default [
  {
    ignores: ['node_modules/**', 'dist/**', 'tests/**'],
  },
  eslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json',
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        clearTimeout: 'readonly',
        NodeJS: 'readonly',
        URLSearchParams: 'readonly',
        AbortController: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      security: security,
      'no-secrets': noSecrets,
      prettier: prettier,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...security.configs.recommended.rules,
      'prettier/prettier': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-secrets/no-secrets': 'error',
      'security/detect-object-injection': 'off',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-non-literal-regexp': 'warn',
      'no-unused-vars': 'off',
    },
  },
  prettierConfig,
];