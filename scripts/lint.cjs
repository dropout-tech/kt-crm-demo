'use strict';
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const result = spawnSync(process.execPath, [path.join(root, 'node_modules/eslint/bin/eslint.js'), 'src', 'scripts', 'tests'], { cwd: root, stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status || 1);
const html = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');
for (const required of ['lang="zh-Hant-TW"', 'name="viewport"', 'aria-live="polite"', 'aria-labelledby="dialog-title"']) {
  if (!html.includes(required)) throw new Error('HTML contract missing: ' + required);
}
for (const asset of ['model.js', 'quote-pdf.js', 'app.js', 'styles.css']) {
  if (!html.includes(asset) || !fs.existsSync(path.join(root, 'src', asset))) throw new Error('Missing asset: ' + asset);
}
console.log('ESLint and static entry contracts passed.');
