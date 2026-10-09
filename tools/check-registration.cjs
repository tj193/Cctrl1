const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync('js/data/iraq-catalogue.js', 'utf8'), context);
vm.runInNewContext(fs.readFileSync('js/data/iraq-map.js', 'utf8'), context);
const { governorates, universities } = context.window.IraqCatalogue;
assert.equal(governorates.length, 19);
assert.equal(new Set(governorates.map(item => item.id)).size, 19);
for (const governorate of governorates) {
  assert(governorate.areas.length >= 5, governorate.id);
  assert(universities.some(item => item.governorate === governorate.id), governorate.id);
  const matches = context.window.IraqMapMarkup.match(new RegExp(`data-governorate="${governorate.id}"`, 'g'));
  assert.equal(matches.length, 2, `${governorate.id}: one path and one label`);
}
assert.equal(new Set(universities.map(item => `${item.governorate}:${item.name}`)).size, universities.length);
for (const university of universities) assert(governorates.some(item => item.id === university.governorate));
const htmlFiles = ['.', 'student', 'driver', 'admin']
  .flatMap(directory => fs.readdirSync(directory).filter(name => name.endsWith('.html')).map(name => path.join(directory, name)));
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    const target = match[1];
    if (/^(https?:|mailto:|tel:|data:)/.test(target)) continue;
    assert(fs.existsSync(path.resolve(path.dirname(file), target.split('#')[0])), `${file}: missing ${target}`);
  }
  // Keep the form's text checkmark; reject the original pictographic ranges.
  assert(!/[\u{1F000}-\u{1FAFF}\u2600-\u27BF]/u.test(html.replace(/\u2713/g, '')), `${file}: emoji found`);
}

async function checkAccounts() {
  const local = new Map();
  const session = new Map();
  const storage = map => ({ getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) });
  const sandbox = { window: { crypto: require('node:crypto').webcrypto }, crypto: require('node:crypto').webcrypto, TextEncoder, Uint8Array, localStorage: storage(local), sessionStorage: storage(session) };
  vm.runInNewContext(fs.readFileSync('js/auth/account-store.js', 'utf8'), sandbox);
  const accounts = sandbox.window.DarbAccounts;
  assert.equal(accounts.normalizePhone('٠٧٧٠ ١٢٣ ٤٥٦٧'), '+9647701234567');
  const profile = { fullName: 'Test Student', email: 'TEST@example.com', phone: '07701234567', role: 'student', status: 'active', governorate: 'baghdad', homeArea: 'Test area', university: 'Test campus', arrivalTime: '08:00' };
  await accounts.create(profile, 'test-only-password');
  assert(!local.get('darbgoDemoAccounts').includes('test-only-password'));
  const loggedIn = await accounts.login('test@example.com', 'test-only-password');
  assert.equal(loggedIn.arrivalTime, '08:00');
  assert(!session.get('loggedInUser').includes('passwordHash'));
  await assert.rejects(accounts.login('test@example.com', 'wrong-password'));
  await assert.rejects(accounts.create(profile, 'different-password'));
  await accounts.create({ ...profile, email: 'driver@example.com', phone: '07707654321', role: 'driver', status: 'pending' }, 'driver-password');
  await assert.rejects(accounts.login('driver@example.com', 'driver-password'), /pending/);
  local.set('darbgoUser', JSON.stringify({ ...profile, email: 'legacy@example.com', phone: '07702223333', password: 'legacy-password' }));
  await accounts.login('legacy@example.com', 'legacy-password');
  assert(!local.get('darbgoUser').includes('legacy-password'));
  await accounts.login('legacy@example.com', 'legacy-password');
  local.set('darbgoDemoAccounts', '{broken');
  await assert.rejects(accounts.login('test@example.com', 'test-only-password'));
  console.log(`Passed: 19 map regions/labels, ${universities.length} universities, local asset links, emoji removal, registration/login, duplicate rejection, pending driver, legacy migration and malformed storage.`);
}
checkAccounts().catch(error => { console.error(error); process.exitCode = 1; });
