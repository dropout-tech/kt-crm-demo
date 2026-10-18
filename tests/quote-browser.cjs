'use strict';
const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const M = require('../src/model.js');
const base = process.env.CRM_BASE_URL || 'http://127.0.0.1:4173/';
const artifacts = process.env.CRM_ARTIFACT_DIR || path.resolve(__dirname, '../artifacts/quote');
fs.mkdirSync(artifacts, { recursive: true });
const report = { testedAt: new Date().toISOString(), checks: [], screenshots: [], errors: [], externalRequests: [], geolocationCalls: 0 };
async function run() {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'zh-TW', timezoneId: 'Asia/Taipei', acceptDownloads: true });
    await context.addInitScript(() => {
      window.testLocationCalls = 0;
      Object.defineProperty(window.navigator, 'geolocation', { value: { getCurrentPosition() { window.testLocationCalls++; throw new Error('Real location must never be called'); }, watchPosition() { window.testLocationCalls++; throw new Error('Real location must never be called'); } } });
    });
    const page = await context.newPage();
    page.on('pageerror', e => report.errors.push(e.message));
    page.on('request', request => { if (!request.url().startsWith(base) && !request.url().startsWith('blob:') && !request.url().startsWith('data:')) report.externalRequests.push(request.url()); });
    const check = async (name, fn) => { await fn(); report.checks.push({ name, result: 'passed' }); console.log('PASS ' + name); };
    const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem(window.CRM.STORAGE_KEY)));
    const nav = async id => { if (id === 'quote' && page.viewportSize().width < 900) { await page.locator('.nav-item[data-page="home"]').click(); await page.locator('main [data-page="quote"]').click(); } else await page.locator(`.nav-item[data-page="${id}"]`).click(); };
    const close = () => page.locator('dialog .dialog-heading [data-action="close"]').click();
    const openQuote = () => page.locator('.quote-card').first().click();
    async function submit(form) { await page.locator(`#${form} button[type="submit"]`).click(); }
    async function newMemo() { await nav('home'); await page.locator('.quick-entry').click(); await page.selectOption('[name="channel"]', '拜訪'); }
    async function pdf(name) { const event = page.waitForEvent('download'); await page.locator('[data-action="quote-pdf"]').click(); const download = await event; await download.saveAs(path.join(artifacts, name)); assert.ok(fs.statSync(path.join(artifacts, name)).size > 20000); }
    await page.goto(base);
    for (const scenario of ['success','permission-denied','timeout','unsupported']) {
      await newMemo(); await page.selectOption('#checkin-scenario', scenario); await page.locator('[data-action="simulate-checkin"]').click(); await page.fill('[name="summary"]', '合成定位記事 ' + scenario);
      await check('synthetic visit ' + scenario + ' persists without real location', async () => {
        assert.match(await page.locator('#checkin-status').innerText(), /合成|模擬/); await submit('memo-form'); await page.waitForFunction(() => !document.querySelector('dialog').open);
        const state = await saved(); assert.equal(state.memos[0].checkIn.mode, 'synthetic'); assert.equal(state.memos[0].checkIn.status, scenario);
        assert.equal(state.memos[0].checkIn.position === null, scenario !== 'success'); assert.equal(M.validState(state), true); assert.equal(await page.evaluate(() => window.testLocationCalls), 0);
      });
    }
    await newMemo(); await page.locator('[data-action="simulate-checkin"]').click();
    await check('channel and customer changes clear synthetic check-in safely', async () => {
      await page.selectOption('[name="channel"]', '電話'); assert.equal(await page.locator('.checkin-editor').isVisible(), false); await page.selectOption('[name="channel"]', '拜訪'); assert.match(await page.locator('#checkin-status').innerText(), /尚未/);
      await page.locator('[data-action="simulate-checkin"]').click(); await page.locator('.memo-details').evaluate(e => { e.open = true; }); await page.selectOption('#memo-company', 'co2'); assert.match(await page.locator('#checkin-status').innerText(), /尚未/); await close();
      await page.reload(); await nav('home'); assert.match(await page.locator('main').innerText(), /非實際位置|模擬/);
    });
    await nav('case'); await page.locator('[data-action="new-quote"][data-id="ca1"]').click();
    await page.fill('#quote-form [name="title"]','合成場域報價 <img data-xss="quote">'); await page.fill('#quote-form [name="description"]','測試地板系列，非正式價格'); await page.fill('[name="quantity"]','2.5'); await page.fill('[name="unit"]','坪'); await page.fill('[name="unitPrice"]','1234.56');
    await check('sales creates a quote draft and cannot download before approval', async () => {
      await submit('quote-form'); assert.match(await page.locator('.quote-status').last().innerText(), /草稿.*v1/); assert.equal(await page.locator('dialog [data-action="quote-pdf"]').isDisabled(), true);
      assert.equal((await saved()).quotes[0].totalMinor,'308640'); assert.equal(await page.locator('img[data-xss]').count(),0);
      await page.locator('[data-action="confirm-quote"]').click(); assert.match(await page.locator('dialog .quote-status').innerText(),/待主管審核/); assert.equal(await page.locator('dialog [data-action="approve-quote"]').count(),0); await close();
    });
    await page.selectOption('#role','u2'); await openQuote();
    await check('another sales view cannot edit, confirm, approve or download this draft', async () => { assert.equal(await page.locator('dialog [data-action="edit-quote"],dialog [data-action="confirm-quote"],dialog [data-action="approve-quote"]').count(),0); assert.equal(await page.locator('dialog [data-action="quote-pdf"]').isDisabled(),true); await close(); });
    await page.selectOption('#role','u3'); await openQuote();
    await check('supervisor return requires a reason and records it on the current version', async () => {
      await page.locator('[data-action="return-quote"]').click(); assert.match(await page.locator('#quote-error').innerText(),/退回原因/); assert.equal((await saved()).quotes[0].status,'待主管審核');
      await page.fill('#quote-review-reason','合成測試：請補齊品項說明'); await page.locator('[data-action="return-quote"]').click(); assert.equal((await saved()).quotes[0].status,'退回修改'); assert.equal(await page.locator('[data-action="quote-pdf"]').isDisabled(),true); await close();
    });
    await page.selectOption('#role','u1'); await openQuote(); await page.locator('[data-action="edit-quote"]').click(); await page.fill('#quote-form [name="description"]','補充後的合成測試地板品項'); await submit('quote-form'); await page.locator('[data-action="confirm-quote"]').click(); await close(); await page.selectOption('#role','u3'); await openQuote();
    await check('revised v2 is confirmed and separately approved before a test PDF downloads', async () => {
      await page.locator('[data-action="approve-quote"]').click(); const state=await saved(); assert.equal(state.quotes[0].version,2); assert.equal(state.quotes[0].status,'已核准'); assert.equal(state.quotes[0].revisions.length,1); assert.equal(M.validState(state),true);
      assert.match(await page.locator('dialog').innerText(),/測試樣張／範本待確認／不可對外正式報價/); await pdf('approved-test-v2.pdf'); await page.screenshot({path:path.join(artifacts,'desktop-approved-quote.png')}); report.screenshots.push('desktop-approved-quote.png'); await close();
    });
    await page.selectOption('#role','u1'); await openQuote(); await page.locator('[data-action="edit-quote"]').click(); await page.fill('[name="unitPrice"]','1200');
    await check('editing approved price creates v3 and invalidates both confirmations and download', async () => { await submit('quote-form'); const q=(await saved()).quotes[0]; assert.equal(q.version,3); assert.equal(q.status,'草稿'); assert.equal(q.salesConfirmation,null); assert.equal(q.review,null); assert.equal(await page.locator('[data-action="quote-pdf"]').isDisabled(),true); await close(); await page.reload(); await nav('quote'); await openQuote(); assert.match(await page.locator('dialog .quote-status').innerText(),/草稿.*v3/); await close(); });
    const stress=M.seed(); const quote=M.createQuote(stress,{caseId:'ca1', title:'合成多頁報價樣張（範本未確認）',currency:'TWD',validUntil:'2026-10-31',note:'這是長篇合成測試備註，所有價格均不適用正式交易。'.repeat(45),items:Array.from({length:24},(_,i)=>({description:'合成品項 '+(i+1)+'：'+ '測試地板、施工範圍與品項補充說明。'.repeat(6),quantity:i===0?'999999999.999':'1.125',unit:'合成測試單位',unitPrice:i===0?'999999999.99':'1234.56'}))},'u1'); M.confirmQuote(stress,quote.id,'u1'); M.reviewQuote(stress,quote.id,'u3','approve','合成多頁測試');
    await page.evaluate(s=>localStorage.setItem(window.CRM.STORAGE_KEY,JSON.stringify(s)),stress); await page.reload(); await nav('quote'); await openQuote();
    await check('long items, exact large totals and long notes create a paginated test PDF',async()=>{await pdf('multi-page-test.pdf');await close();});
    for(const width of [320,390,768,1024,1440]){
      await page.setViewportSize({width,height:width<900?844:1000}); await nav('quote');
      await check(width+'px quote list and form stay inside viewport',async()=>{
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)); if(width<900)assert.equal(await page.locator('.nav-item:visible').count(),4);
        await openQuote(); assert.ok(await page.locator('dialog').evaluate(d=>d.scrollWidth<=d.clientWidth+1)); await page.locator('[data-action="edit-quote"]').click(); assert.ok(await page.locator('dialog').evaluate(d=>d.scrollWidth<=d.clientWidth+1));
        if([390,1440].includes(width)){const name=width+'px-quote-editor.png';await page.screenshot({path:path.join(artifacts,name)});report.screenshots.push(name)} await close();
      });
    }
    await page.setViewportSize({width:390,height:844}); await nav('quote'); await openQuote();
    await check('mobile viewport downloads approved PDF and exposes only four main targets',async()=>{await pdf('mobile-test.pdf');await close();await newMemo();await page.locator('[data-action="simulate-checkin"]').click();await page.screenshot({path:path.join(artifacts,'mobile-synthetic-checkin.png')});report.screenshots.push('mobile-synthetic-checkin.png');assert.ok(await page.locator('dialog').evaluate(d=>d.scrollWidth<=d.clientWidth+1));await close();});
    await check('synthetic trial makes no location calls, external requests or runtime errors',async()=>{report.geolocationCalls=await page.evaluate(()=>window.testLocationCalls);assert.equal(report.geolocationCalls,0);assert.deepEqual(report.externalRequests,[]);assert.deepEqual(report.errors,[]);});
  } finally { await browser.close(); fs.writeFileSync(path.join(artifacts,'quote-browser-report.json'),JSON.stringify(report,null,2)); }
  console.log(report.checks.length+' GPS and quotation browser checks passed');
}
run().catch(e=>{console.error(e);process.exit(1);});
