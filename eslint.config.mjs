import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

/** @type {import('eslint').Linter.Config[]} */
const eslintConfig = [
  {
    ignores: [
      '.next/**',
      '**/.next/**',
      '.claude/**',
      'node_modules/**',
      '**/node_modules/**',
      'out/**',
      'build/**',
      'backups/**',
      'coverage/**',
      'output/**',
      'audit/**',
      'next-env.d.ts',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    // Build/tooling config files legitimately use CommonJS require().
    files: ['*.config.{js,cjs,mjs,ts}', '**/*.cjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
]

export default eslintConfig
