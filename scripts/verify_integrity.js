const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const jsFiles = [
  'js/config.js',
  'js/utils.js',
  'js/state.js',
  'js/data.js',
  'js/render.js',
  'js/app.js'
];

const jsAll = jsFiles.map(f => fs.readFileSync(f, 'utf8')).join('\n');

const idRegex = /getElementById\(['"]([^'"]+)['"]\)/g;
let match;
const ids = new Set();
while ((match = idRegex.exec(jsAll)) !== null) {
  ids.add(match[1]);
}

const missing = [];
for (const id of ids) {
  if (!html.includes('id="' + id + '"') && !html.includes("id='" + id + "'")) {
    missing.push(id);
  }
}

console.log('Checked ' + ids.size + ' element IDs referenced across JS modules.');
if (missing.length > 0) {
  console.error('Missing IDs in index.html:', missing);
  process.exit(1);
} else {
  console.log('SUCCESS: All element IDs exist in index.html!');
}

// Verify css/style.css exists and is non-empty
const css = fs.readFileSync('css/style.css', 'utf8');
if (css.length < 100) {
  console.error('css/style.css seems too small or empty!');
  process.exit(1);
}
console.log('SUCCESS: css/style.css verified (' + css.length + ' bytes).');
