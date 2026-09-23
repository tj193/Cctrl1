const fs = require('node:fs');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require('playwright');
(async () => {
  const root = process.cwd();
  const server = http.createServer((req, res) => {
    const file = path.join(root, decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', ({'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png'})[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({headless:true, channel: process.env.DASHBOARD_BROWSER || 'msedge'});
    const page = await browser.newPage({viewport:{width:1440,height:1000}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route(/https:\/\//, route => route.abort());
    await page.addInitScript(() => sessionStorage.setItem('loggedInUser', JSON.stringify({role:'student',fullName:'Test Student',email:'dashboard-test@example.invalid',homeArea:'Al-Karrada',university:'University of Baghdad',arrivalTime:'08:00'})));
    const base = `http://127.0.0.1:${server.address().port}/student/`;
    await page.goto(base+'routes.html');
    assert(await page.locator('#searchStart').isVisible());
    assert.equal(await page.locator('.route-card').count(),0);
    assert.equal(await page.locator('#mainContent > section').count(),1);
    await page.click('#panelFindRouteButton');
    await page.waitForSelector('.route-card');
    assert.equal(await page.locator('.route-card').count(),6);
    await page.locator('[data-route-id="route-101"] [data-action="request"]').click();
    await page.waitForURL('**/requests.html');
    assert((await page.locator('#requestList').textContent()).includes('Ahmed Ali'));
    await page.locator('.student-sidebar a[data-page="routes"]').click();
    await page.waitForURL('**/routes.html');
    assert(await page.locator('#routeResults').isVisible());
    await page.locator('.student-sidebar a[data-page="upcoming"]').click();
    await page.waitForURL('**/upcoming.html');
    assert((await page.locator('#upcomingCard').textContent()).includes('No confirmed ride yet.'));
    await page.goto(base+'requests.html');
    assert.equal(await page.locator('.request-card .booking-confirmation button').count(), 1);
    assert.equal(await page.locator('.request-card:has(.status-badge.pending) [data-request-action="confirm"]').count(), 0);
    await page.locator('[data-request-id="request-202"] [data-request-action="confirm"]').click();
    await page.waitForURL('**/upcoming.html?request=request-202');
    assert((await page.locator('#upcomingCard').textContent()).includes('Zaid Raad'));
    assert(await page.locator('.whatsapp-button').isDisabled());
    await page.reload();
    assert((await page.locator('#upcomingCard').textContent()).includes('Zaid Raad'));
    await page.goto(base+'requests.html');
    assert.equal(await page.locator('[data-request-id="request-202"] .status-badge').textContent(), 'Confirmed');
    assert.equal(await page.locator('[data-request-id="request-202"] [data-request-action="confirm"]').count(), 0);
    await page.locator('[data-request-id="request-202"] .booking-confirmation a').click();
    await page.waitForURL('**/upcoming.html?request=request-202');
    await page.selectOption('#demoScenario','confirmed');
    assert(await page.locator('.whatsapp-button').isDisabled());
    await page.screenshot({path:path.join(os.tmpdir(),'darbgo-student-desktop-qa.png'),fullPage:true});
    // Supply a test-only phone through the network fixture; never contact it.
    await page.route('**/dashboard-data.js', async route => {
      const body = fs.readFileSync('student/dashboard-data.js','utf8').replace("name:'Ahmed Ali'", "whatsapp:'+964 770 123 4567', name:'Ahmed Ali'");
      await route.fulfill({contentType:'text/javascript',body});
    });
    await page.reload();
    assert.equal(await page.locator('a.whatsapp-button').getAttribute('href'),'https://wa.me/9647701234567');
    await page.setViewportSize({width:390,height:844});
    await page.click('#sidebarToggle');
    await page.locator('.student-sidebar a[data-page="waitlist"]').click();
    await page.waitForURL('**/waitlist.html');
    assert(await page.locator('#waitlistCard').isVisible());
    for (const file of ['dashboard','routes','requests','waitlist','upcoming']) {
      await page.goto(base+file+'.html');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), file+' mobile overflow');
    }
    await page.screenshot({path:path.join(os.tmpdir(),'darbgo-student-mobile-qa.png'),fullPage:true});
    await page.goto(base+'requests.html');
    await page.selectOption('#demoScenario','accepted');
    await page.screenshot({path:path.join(os.tmpdir(),'darbgo-booking-confirm-mobile.png'),fullPage:true});
    await page.locator('[data-request-action="confirm"]').click();
    await page.waitForURL('**/upcoming.html?request=request-202');
    assert((await page.locator('#upcomingCard').textContent()).includes('Zaid Raad'));
    await page.goto(base+'dashboard.html#requests');
    await page.waitForURL('**/requests.html');
    assert.deepEqual(errors,[]);
    console.log('Passed: student booking confirmation, reload persistence, confirmed request link, mobile confirmation, search gating, separate pages, persisted requests/results, WhatsApp missing/populated number, mobile sidebar, five mobile widths, legacy link, no JS errors.');
  } finally { await browser?.close(); server.close(); }
})().catch(error => {console.error(error); process.exitCode=1;});

