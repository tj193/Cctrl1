const {chromium} = require('C:/Users/lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 await context.route('**/*',async r=>{const u=new URL(r.request().url()); if(u.hostname!=='127.0.0.1')return r.abort(); if(u.port==='8000'){u.port='8009';const response=await r.fetch({url:u.toString()});return r.fulfill({response});}return r.continue();});
 const p=await context.newPage();
 const out=path.join(__dirname,'audit');fs.mkdirSync(out,{recursive:true});
 await p.goto('http://127.0.0.1:5199/index.html'); await p.waitForTimeout(800);await p.screenshot({path:path.join(out,'home.png')});
 await p.selectOption('#pickup-area','Al-Mansour');await p.selectOption('#university','University of Baghdad');await p.selectOption('#arrival-time','8:00 AM');await p.locator('#route-search button[type=submit]').click();await p.waitForTimeout(800);
 console.log('PUBLIC SEARCH:',await p.locator('#match-result').innerText());
 await p.goto('http://127.0.0.1:5199/register.html');await p.screenshot({path:path.join(out,'role.png')});await p.locator('.student-option').click();
 console.log('MAP selectors',await p.locator('[data-governorate]').evaluateAll(es=>es.filter(e=>e.dataset.governorate.includes('bag')).map(e=>({tag:e.tagName,id:e.dataset.governorate,box:e.getBoundingClientRect().toJSON()}))));
 await p.locator('text[data-governorate="baghdad"]').click();await p.screenshot({path:path.join(out,'map.png')});await p.locator('#nextStep').click();
 console.log('AREAS',await p.locator('#studentHomeArea').innerText());console.log('UNIVERSITIES',await p.locator('#studentUniversity').innerText());
 await p.selectOption('#studentHomeArea',{label:'المنصور'});await p.selectOption('#studentUniversity',{label:'جامعة بغداد'});await p.locator('[data-time="08:00"]').click();await p.screenshot({path:path.join(out,'journey.png')});await p.locator('#nextStep').click();
 await p.fill('#studentName','Demo Student');await p.fill('#studentEmail','student@example.invalid');await p.fill('#studentPhone','07000000000');await p.fill('#studentPassword','LocalDemoOnly2026!');await p.fill('#studentConfirmPassword','LocalDemoOnly2026!');await p.screenshot({path:path.join(out,'account.png')});await p.locator('#nextStep').click();await p.locator('#registrationSuccess:not([hidden])').waitFor();await p.locator('#registrationSuccess a').click();await p.fill('#loginIdentifier','student@example.invalid');await p.fill('#loginPassword','LocalDemoOnly2026!');await p.locator('.login-submit').click();await p.waitForURL('**/student/dashboard.html');await p.waitForTimeout(1000);await p.screenshot({path:path.join(out,'dashboard.png')});
 await p.locator('a[data-page="routes"]').first().click();await p.click('#panelFindRouteButton');await p.waitForSelector('.route-card');await p.waitForTimeout(800);await p.screenshot({path:path.join(out,'results.png')});console.log('RESULTS',await p.locator('.route-card').count());await p.locator('[data-route-id="route-101"] [data-action="details"]').click();await p.screenshot({path:path.join(out,'details.png')});await p.click('#dialogRequest');await p.waitForURL('**/requests.html');await p.screenshot({path:path.join(out,'pending.png')});console.log('NEW REQUEST',await p.locator('.request-card').first().innerText());
 await p.goto('http://127.0.0.1:5199/login.html');await p.fill('#loginIdentifier','driver@example.invalid');await p.fill('#loginPassword','LocalDemoOnly2026!');await p.click('.login-submit');await p.waitForURL('**/driver/driver_dashboard.html');await p.waitForTimeout(1000);await p.screenshot({path:path.join(out,'driver.png')});await p.locator('a[href="student_requests.html"]').click();await p.waitForTimeout(500);const before=await p.locator('.requests-list').innerHTML();await p.locator('.btn-accept').first().click();console.log('DRIVER ACCEPT CHANGES DOM:',before!==await p.locator('.requests-list').innerHTML());await p.screenshot({path:path.join(out,'driver-requests.png')});
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});




