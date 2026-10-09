const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const extensions = new Set(['.html', '.css']);
const ignored = new Set(['.git', '.venv', '.pytest_cache', '.codex', '.agents', '.artifacts', 'node_modules']);
const missing = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(filename);
    else if (extensions.has(path.extname(filename))) inspect(filename);
  }
}

function check(filename, raw) {
  const value = raw.trim().replace(/^['"]|['"]$/g, '').split(/[?#]/)[0];
  if (!value || /^(?:[a-z][a-z\d+.-]*:|#|\/\/)/i.test(value) || value.includes('${')) return;
  const target = value.startsWith('/') ? path.resolve(root, '.' + value) : path.resolve(path.dirname(filename), value);
  if (!fs.existsSync(target)) missing.push(`${path.relative(root, filename)} -> ${raw}`);
}

function inspect(filename) {
  const content = fs.readFileSync(filename, 'utf8');
  if (filename.endsWith('.html')) {
    for (const match of content.matchAll(/\b(?:src|href|poster|action)\s*=\s*["']([^"']+)["']/gi)) check(filename, match[1]);
    for (const match of content.matchAll(/\bsrcset\s*=\s*["']([^"']+)["']/gi)) {
      for (const entry of match[1].split(',')) check(filename, entry.trim().split(/\s+/)[0]);
    }
  } else {
    for (const match of content.matchAll(/url\(\s*([^)]+)\)/gi)) check(filename, match[1]);
    for (const match of content.matchAll(/@import\s+["']([^"']+)["']/gi)) check(filename, match[1]);
  }
}

walk(root);
console.log(missing.length ? missing.join('\n') : 'No missing static HTML/CSS references.');
if (missing.length) process.exitCode = 1;
