const fs = require('node:fs');
const path = require('node:path');

const pages = ['.', 'student', 'driver', 'admin/front-end']
  .flatMap(dir => fs.readdirSync(dir)
    .filter(name => name.endsWith('.html'))
    .map(name => path.join(dir, name)));
const missing = [];
for (const page of pages) {
  const html = fs.readFileSync(page, 'utf8');
  for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    const target = match[1].split('#')[0];
    if (/^(?:https?:|mailto:|tel:|data:)/i.test(target)) continue;
    const local = path.resolve(path.dirname(page), target);
    if (!fs.existsSync(local)) missing.push(`${page}: ${target}`);
  }
}
if (missing.length) {
  console.error(`Missing local assets:\n${missing.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Checked local assets in ${pages.length} HTML pages.`);
}
