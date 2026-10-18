'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const output = path.resolve(process.argv[2] || path.join(root, 'artifacts/local-demo.html'));
let html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(dist, 'styles.css'), 'utf8');
const logo = 'data:image/svg+xml;base64,' + fs.readFileSync(path.join(dist, 'assets/kingtile-logo.svg')).toString('base64');
html = html.replace('<link rel="stylesheet" href="styles.css">', () => '<style>\n' + css + '\n</style>');
const scripts = ['model.js', 'quote-pdf.js', 'app.js'].map(name => {
  html = html.replace(`<script defer src="${name}"></script>`, '');
  return fs.readFileSync(path.join(dist, name), 'utf8').replaceAll('assets/kingtile-logo.svg', logo).replace(/<\/script/gi, '<\\/script');
});
// Inline scripts run after the DOM; defer has no effect on inline classic scripts.
html = html.replace('</body>', () => scripts.map(code => '<script>\n' + code + '\n</script>').join('\n') + '\n</body>');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, html);
console.log('Local-only standalone demo: ' + output);
