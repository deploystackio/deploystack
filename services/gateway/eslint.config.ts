// services/gateway/eslint.config.ts
import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

const config = [
  {
    files: ['**/*.ts'],
    ignores: ['**/node_modules/**', '**/dist/**', '**/._*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': ts,
    },
    rules: {
      ...ts.configs.recommended.rules,
      // CLI-specific adjustments
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Console statements are essential for CLI user interaction
      'no-console': 'off',
      // Allow process.exit() in CLI applications
      'no-process-exit': 'off',
    },
  }
];

export default config;
