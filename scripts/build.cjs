'use strict';
const fs = require('node:fs');
const path = require('node:path');
const project = path.resolve(__dirname, '..');
const output = path.join(project, 'dist');
fs.mkdirSync(output, { recursive: true });
for (const name of ['index.html', 'model.js', 'quote-pdf.js', 'app.js', 'styles.css', 'robots.txt', '_headers']) {
  fs.copyFileSync(path.join(project, 'src', name), path.join(output, name));
}
fs.cpSync(path.join(project, 'src/assets'), path.join(output, 'assets'), { recursive: true });
console.log('Static build ready: dist/index.html with official brand asset (no production API)');
