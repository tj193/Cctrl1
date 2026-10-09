const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const root = process.cwd();
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = path.resolve(root, `.${pathname}`);
    if (!file.startsWith(`${root}${path.sep}`) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      response.writeHead(404).end(); return;
    }
    response.setHeader('Content-Type', ({ '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(response);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.DASHBOARD_BROWSER ? { channel: process.env.DASHBOARD_BROWSER } : {}) });
    const context = await browser.newContext();
    await context.addInitScript(() => sessionStorage.setItem('driverToken', 'test-token'));
    await context.route('http://127.0.0.1:8000/auth/driver-me', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ name: 'Test Driver', email: 'driver@example.test', status: 'approved' }) }));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const pages = ['driver_dashboard.html', 'my_routes.html', 'create_route.html', 'opportunities.html', 'student_requests.html', 'my_students.html', 'reports.html', 'profile.html'];
    for (const width of [360, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const file of pages) {
        await page.goto(`${base}/driver/${file}?demo=1`);
        await page.locator('#modeBanner').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#nav a').count(), 9);
        assert.equal(await page.locator('#nav a[aria-current="page"]').count(), 1);
        const overflow = await page.evaluate(() => ({ excess: document.documentElement.scrollWidth - document.documentElement.clientWidth, nodes: [...document.querySelectorAll('body *')].filter(element => element.getBoundingClientRect().right > innerWidth + 1).slice(0, 8).map(element => `${element.tagName}.${element.className}: ${Math.round(element.getBoundingClientRect().right)}`) }));
        assert.equal(overflow.excess, 0, `${file} overflows at ${width}px: ${overflow.nodes.join(', ')}`);
      }
    }
    await page.goto(`${base}/driver/student_requests.html?demo=1`);
    await page.getByRole('button', { name: 'Accept' }).first().click();
    await page.getByRole('button', { name: 'Confirm preview change' }).click();
    await page.goto(`${base}/driver/my_students.html?demo=1`);
    assert.match(await page.locator('#studentList').innerText(), /Sample Student A/);
    await page.goto(`${base}/driver/student_requests.html?demo=1`);
    await page.getByRole('button', { name: 'Decline' }).first().click();
    await page.getByRole('button', { name: 'Confirm preview change' }).click();
    assert.equal(await page.locator('#requestList .badge.declined').count(), 1);
    await page.goto(`${base}/driver/create_route.html?demo=1`);
    await page.locator('[name="area"]').selectOption('103');
    await page.locator('[name="university"]').selectOption('202');
    await page.locator('[name="departure"]').fill('06:40');
    await page.locator('[name="returnTime"]').fill('15:30');
    await page.locator('[name="capacity"]').fill('10');
    await page.locator('[name="price"]').fill('30000');
    await page.getByRole('button', { name: 'Create preview route' }).click();
    await page.waitForURL(/my_routes\.html\?demo=1/);
    assert.match(await page.locator('.stack').innerText(), /Sample East/);
    await page.goto(`${base}/driver/reports.html?demo=1`);
    await page.locator('[name="type"]').selectOption('route');
    await page.locator('[name="subject"]').fill('Sample route issue');
    await page.locator('[name="description"]').fill('This is a fictional driver preview report.');
    await page.getByRole('button', { name: 'Submit demo report' }).click();
    assert.match(await page.locator('#reportsList').innerText(), /Sample route issue/);
    await page.goto(`${base}/driver/driver_dashboard.html`);
    assert.match(await page.locator('.kpi-grid').innerText(), /Awaiting driver data API/);
    assert.doesNotMatch(await page.locator('.kpi-grid').innerText(), /Sample Student/);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${base}/driver/driver_dashboard.html?demo=1`);
    await page.screenshot({ path: path.join(root, '.artifacts', 'driver-dashboard-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${base}/driver/create_route.html?demo=1`);
    await page.screenshot({ path: path.join(root, '.artifacts', 'driver-create-mobile.png'), fullPage: true });
    await page.locator('#menuButton').click();
    assert.equal(await page.locator('#driverSidebar').evaluate(element => element.classList.contains('open')), true);
    await page.locator('#backdrop').click({ position: { x: 350, y: 200 } });
    assert.equal(await page.locator('#driverSidebar').evaluate(element => element.classList.contains('open')), false);
    await page.goto(`${base}/driver/create_route.html?demo=1&demand=demo-demand-2`);
    assert.equal(await page.locator('[name="area"]').inputValue(), '103');
    assert.equal(await page.locator('[name="university"]').inputValue(), '202');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${base}/driver/driver_dashboard.html`);
    await page.evaluate(() => document.addEventListener('click', event => { if (event.target.closest('.logout')) event.preventDefault(); }, true));
    await page.locator('.logout').click();
    assert.equal(await page.evaluate(() => sessionStorage.getItem('driverToken')), null);
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log(`PASS: ${pages.length} pages at 5 widths; navigation, overflow, mobile drawer, demo decisions, route creation/from demand, report submission, live empty state, logout, and console errors.`);
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
