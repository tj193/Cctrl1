const { chromium } = require('playwright');
const path = require('node:path');

const base = 'http://127.0.0.1:5199';
const output = path.join(__dirname, 'public');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1') return route.abort();
    if (url.port === '8000') {
      url.port = '8009';
      return route.fulfill({ response: await route.fetch({ url: url.toString() }) });
    }
    return route.continue();
  });
  try {
    const student = await context.newPage();
    await student.goto(`${base}/index.html`);
    await student.evaluate(() => sessionStorage.setItem('loggedInUser', JSON.stringify({
      role: 'student', fullName: 'Demo Student', email: 'student@example.invalid',
      governorate: 'baghdad', homeArea: 'المنصور', university: 'جامعة بغداد', arrivalTime: '08:00'
    })));
    await student.goto(`${base}/student/dashboard.html`);
    await student.locator('#sceneMap[data-map-ready="true"]').waitFor();
    await student.screenshot({ path: path.join(output, 'search-map.png') });
    await student.close();

    const page = await context.newPage();
    await page.goto(`${base}/driver/register.html`);
    await page.fill('#driverName', 'Demo Applicant');
    await page.fill('#driverEmail', 'applicant@example.invalid');
    await page.fill('#driverPhone', '0700 000 0002');
    await page.fill('#driverPassword', 'LocalDemoOnly2026!');
    await page.fill('#driverConfirmPassword', 'LocalDemoOnly2026!');
    await page.selectOption('#vehicleType', 'Car');
    await page.fill('#vehicleModel', 'Demo vehicle');
    await page.fill('#plateNumber', 'DEMO-APP-02');
    await page.fill('#drivingLicense', 'DEMO-LICENSE-02');
    await page.fill('#idDocument', 'DEMO-ID-02');
    await page.locator('#driverForm button[type="submit"]').click();
    await page.locator('#driverRegistrationSuccess:not([hidden])').waitFor();
    await page.screenshot({ path: path.join(output, 'approval-waiting.png') });

    await page.goto(`${base}/admin/front-end/login.html`);
    await page.fill('#email', 'admin@example.invalid');
    await page.fill('#password', 'LocalDemoOnly2026!');
    await page.click('#loginBtn');
    await page.waitForURL('**/admin/front-end/index.html');
    await page.locator('a[href="adminApproval.html"]').first().click();
    await page.waitForURL('**/adminApproval.html');
    const row = page.locator('#approvalTableBody tr', { hasText: 'Demo Applicant' });
    await row.waitFor();
    await page.screenshot({ path: path.join(output, 'approval-table.png') });
    await row.locator('.review-btn').click();
    await page.locator('#approvalModal:not([hidden])').waitFor();
    await page.screenshot({ path: path.join(output, 'approval-review.png') });
    await page.locator('#approveBtn').click();
    await page.getByText('Approval saved').waitFor();
    await page.locator('#whatsAppDecisionLink:visible').waitFor();
    // The WhatsApp link is displayed but never opened; no message is sent.
    await page.screenshot({ path: path.join(output, 'approval-saved.png') });
  } finally {
    await context.close();
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
