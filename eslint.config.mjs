import js from '@eslint/js';
export default [
  { ignores: ['dist/**', 'node_modules/**', 'artifacts/**'] },
  js.configs.recommended,
  { files: ['src/**/*.js'], languageOptions: { sourceType: 'script', globals: Object.fromEntries(['window', 'document', 'localStorage', 'module', 'URL', 'Blob', 'Image', 'TextEncoder', 'Uint8Array', 'atob', 'FormData', 'setTimeout', 'clearTimeout', 'globalThis', 'Intl'].map(name => [name, 'readonly'])) } },
  { files: ['**/*.cjs'], languageOptions: { sourceType: 'commonjs', globals: Object.fromEntries(['process', '__dirname', 'console', 'URL', 'setTimeout'].map(name => [name, 'readonly'])) } },
  { files: ['tests/*browser.cjs'], languageOptions: { globals: Object.fromEntries(['window', 'document', 'localStorage', 'Storage'].map(name => [name, 'readonly'])) } }
];
