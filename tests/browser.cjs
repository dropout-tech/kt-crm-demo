'use strict';
const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const M = require('../src/model.js');
const base = process.env.CRM_BASE_URL || 'http://127.0.0.1:4173/';
const artifacts = process.env.CRM_ARTIFACT_DIR || path.resolve(__dirname, '../artifacts/followups');
fs.mkdirSync(artifacts, { recursive: true });
const report = { testedAt: new Date().toISOString(), base, checks: [], screenshots: [], errors: [], externalRequests: [] };
async function run() {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'zh-TW', timezoneId: 'Asia/Taipei' });
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('request', request => { if (!request.url().startsWith(base)) report.externalRequests.push(request.url()); });
    async function check(name, action) { await action(); report.checks.push({ name, result: 'passed' }); console.log('PASS ' + name); }
    async function state() { return page.evaluate(() => JSON.parse(localStorage.getItem(window.CRM.STORAGE_KEY))); }
    async function nav(id) {
      if (id === 'memo' && page.viewportSize().width < 900) { await nav('home'); await page.locator('main [data-page="memo"]').click(); }
      else await page.locator(`.nav-item[data-page="${id}"]`).click();
    }
    async function newMemo(caseId = '') {
      if (caseId) { await nav('case'); await page.locator(`.case-quick[data-id="${caseId}"]`).click(); }
      else { await nav('home'); await page.locator('.quick-entry').click(); }
    }
    async function addStep(title, owner = 'u1', dueDate = '') {
      await page.locator('dialog [data-action="add-step"]').click();
      const row = page.locator('.step-editor-row').last();
      await row.locator('[name="stepTitle"]').fill(title);
      await row.locator('[name="stepOwner"]').selectOption(owner);
      await row.locator('[name="stepDueDate"]').fill(dueDate);
    }
    async function submit(id = 'memo-form') { await page.locator(`#${id} button[type="submit"]`).click(); await page.waitForFunction(() => !document.querySelector('dialog').open); }
    async function close() { await page.locator('dialog .dialog-heading [data-action="close"]').click(); }
    async function shot(name) { await page.screenshot({ path: path.join(artifacts, name + '.png') }); report.screenshots.push(name + '.png'); }
    await page.goto(base);
    await check('prototype label, original brand asset and 50-item catalog remain intact', async () => {
      assert.match(await page.locator('.prototype-banner').innerText(), /需求確認用原型／模擬資料/);
      assert.equal(await page.locator('.brand img').evaluate(image => image.complete && image.naturalWidth > 0), true);
      await nav('review'); assert.equal(await page.locator('.catalog-row').count(), 50);
      assert.deepEqual(await page.locator('.catalog-number').allTextContents(), Array.from({ length: 50 }, (_, i) => String(i + 1).padStart(2, '0')));
      assert.equal(await page.locator('main textarea').count(), 0);
    });
    await newMemo('ca1');
    await check('zero-step linked memo saves and preserves every existing case follow-up', async () => {
      assert.equal(await page.locator('.step-editor-row').count(), 0);
      await page.locator('[name="summary"]').fill('合成驗收：拜訪後沒有後續事項');
      await submit(); const s = await state(); assert.equal(s.memos[0].followUpIds.length, 0);
      assert.equal(M.caseFollowUps(s, 'ca1').length, 1); assert.equal(M.validState(s), true);
    });
    await newMemo('ca1');
    await page.locator('[name="summary"]').fill('合成驗收：五項後續 <img data-xss="test">');
    for (let i = 1; i <= 5; i++) await addStep('後續事項 ' + i, i % 2 ? 'u1' : 'u2', i === 2 ? '2026-10-20' : '');
    await check('five independent follow-ups append to the case without replacing original work', async () => {
      await submit(); const s = await state(); assert.equal(s.memos[0].followUpIds.length, 5);
      const steps = M.caseFollowUps(s, 'ca1'); assert.equal(steps.length, 6);
      assert.equal(steps.find(step => step.title === '後續事項 2').ownerId, 'u2');
      assert.equal(steps.find(step => step.title === '後續事項 2').dueDate, '2026-10-20');
      assert.equal(M.validState(s), true);
      await page.reload(); await nav('memo'); assert.equal(await page.locator('img[data-xss]').count(), 0);
      assert.match(await page.locator('main').innerText(), /後續事項 5/);
    });
    await newMemo(); await page.locator('[name="summary"]').fill('合成驗收：初訪直接建立商機'); await page.selectOption('#memo-case', '__new__');
    await check('new opportunity title is required and invalid submit preserves the written memo', async () => {
      const before = await state(); await page.locator('#memo-form button[type="submit"]').click();
      assert.equal(await page.locator('dialog[open]').count(), 1);
      assert.equal(await page.locator('[name="summary"]').inputValue(), '合成驗收：初訪直接建立商機'); assert.deepEqual(await state(), before);
    });
    await page.locator('[name="newCaseTitle"]').fill('合成商機：產品尚未確定'); await addStep('補充場域資料', 'u2');
    await check('initial memo creates a linked opportunity without quotation or pricing fields', async () => {
      await submit(); const s = await state(), memo = s.memos[0], item = s.cases.find(c => c.id === memo.caseId);
      assert.equal(item.title, '合成商機：產品尚未確定'); assert.equal(item.status, '需求確認');
      assert.equal(M.caseFollowUps(s, item.id).length, 1); assert.equal(M.validState(s), true);
    });
    await newMemo(); await page.locator('[name="summary"]').fill('合成驗收：先記事再建商機'); await addStep('稍後約時間', 'u1'); await addStep('整理初步需求', 'u2'); await submit();
    const unlinkedId = (await state()).memos[0].id, stepCount = (await state()).followUps.length;
    await check('unlinked follow-ups appear on the work page and retain enterprise context', async () => {
      await nav('home'); assert.match(await page.locator('.unlinked-step').first().innerText(), /稍後約時間/);
      assert.match(await page.locator('.unlinked-step').first().innerText(), /青禾商用空間/);
    });
    await nav('memo'); await page.locator(`[data-action="link-memo"][data-id="${unlinkedId}"]`).click(); await page.selectOption('#link-case', '__new__');
    await page.locator('[name="newCaseTitle"]').fill('合成商機：記事延伸');
    await check('saved memo creates an opportunity carrying both original follow-ups exactly once', async () => {
      await submit('memo-link-form'); const s = await state(), memo = s.memos.find(m => m.id === unlinkedId);
      assert.equal(s.cases.find(c => c.id === memo.caseId).title, '合成商機：記事延伸');
      assert.equal(M.caseFollowUps(s, memo.caseId).length, 2); assert.equal(s.followUps.length, stepCount);
      assert.equal(M.validState(s), true);
    });
    await newMemo(); await page.locator('[name="summary"]').fill('合成驗收：補關聯既有案件'); await submit();
    const toLink = (await state()).memos[0].id;
    await nav('memo'); await page.locator(`[data-action="link-memo"][data-id="${toLink}"]`).click();
    await check('link selector offers only opportunities from the memo company', async () => {
      const values = await page.locator('#link-case option').evaluateAll(options => options.map(o => o.value));
      assert.ok(values.includes('ca1')); assert.ok(!values.includes('ca2')); assert.ok(!values.includes('ca3'));
    });
    await page.selectOption('#link-case', 'ca1'); await submit('memo-link-form');
    await check('linking existing memo persists across reload', async () => {
      await page.reload(); assert.equal((await state()).memos.find(m => m.id === toLink).caseId, 'ca1');
      assert.equal(M.validState(await state()), true);
    });
    await nav('case'); await page.locator('.kanban-card[data-id="ca1"]').click();
    await page.selectOption('[name="status"]', '待回覆'); await page.locator('.step-editor-row [name="stepTitle"]').first().fill('已調整後續事項');
    await page.locator('.step-editor-row [data-action="remove-step"]').nth(1).click(); await addStep('新增另一個後續', 'u2');
    await check('case edits support multiple steps, stable references and removal without corrupting notes', async () => {
      await submit('case-form'); const s = await state(); assert.equal(M.caseFollowUps(s, 'ca1').length, 6);
      assert.equal(s.cases.find(c => c.id === 'ca1').status, '待回覆'); assert.equal(M.validState(s), true);
      assert.match(await page.locator('.kanban-card[data-id="ca1"]').innerText(), /已調整後續事項/);
    });
    await page.locator('[data-action="new-case"]').click(); await page.locator('[name="title"]').fill('合成驗收：沒有下一步的商機'); await submit('case-form');
    await check('standalone opportunity requires a name and allows zero steps', async () => {
      const s = await state(), item = s.cases.find(c => c.title === '合成驗收：沒有下一步的商機');
      assert.equal(M.caseFollowUps(s, item.id).length, 0); assert.equal(M.validState(s), true);
      assert.match(await page.locator(`.kanban-card[data-id="${item.id}"]`).innerText(), /目前沒有下一步/);
    });
    await newMemo(); await page.locator('[name="summary"]').fill('合成驗收：切換企業仍保留草稿'); await addStep('尚未送出的後續', 'u2');
    await page.locator('.memo-details summary').click(); await page.selectOption('#memo-company', 'co2');
    await check('changing memo company clears incompatible case and contact without discarding draft steps', async () => {
      assert.equal(await page.locator('#memo-case').inputValue(), ''); assert.equal(await page.locator('#memo-contact').inputValue(), 'ct3');
      assert.equal(await page.locator('[name="summary"]').inputValue(), '合成驗收：切換企業仍保留草稿');
      assert.equal(await page.locator('[name="stepTitle"]').inputValue(), '尚未送出的後續');
      assert.equal(await page.locator('[name="stepOwner"]').inputValue(), 'u2');
    });
    await close(); await page.locator('[data-action="reset"]').click(); await page.locator('dialog .dialog-heading [data-action="close"]').click();
    await check('cancelled reset preserves created notes and opportunities', async () => { assert.ok((await state()).memos.length > 7); });
    await page.locator('[data-action="reset"]').click(); await page.locator('[data-action="confirm-reset"]').click();
    await nav('company'); await page.locator('[data-action="new-company"]').click();
    await page.locator('[name="name"]').fill('合成驗收：設計客戶'); await page.locator('[name="category"]').fill('設計公司'); await submit('company-form');
    await check('new customer retains its classification and can edit it', async () => {
      assert.equal((await state()).companies.find(co => co.name === '合成驗收：設計客戶').category, '設計公司');
      await page.locator('.category-button').click(); await page.locator('[name="category"]').fill('工程設計'); await submit('category-form');
      assert.equal((await state()).companies.find(co => co.name === '合成驗收：設計客戶').category, '工程設計');
    });
    await page.setViewportSize({ width: 390, height: 844 }); await page.locator('.company-title [data-action="new-memo"]').click();
    await check('first interaction with a new customer exposes flexible inline contact fields', async () => {
      assert.equal(await page.locator('#memo-contact').inputValue(), '__new__'); assert.equal(await page.locator('#memo-new-contact').isVisible(), true);
      await page.locator('[name="newContactName"]').fill('合成窗口 <img data-xss="contact">');
      await page.locator('[name="newContactRole"]').fill('設計協調／現場代表');
      await page.locator('[name="category"]').fill('自行定義的拜訪類別'); await page.selectOption('[name="channel"]', 'LINE');
      await page.locator('[name="summary"]').fill('合成驗收：新客戶首次記事與產品多選');
      await page.selectOption('#memo-case', '__new__'); await page.locator('[name="newCaseTitle"]').fill('合成驗收：尚未報價的商機');
      await page.locator('[name="productIds"][value="series-spc-pro"]').check(); await page.locator('[name="productIds"][value="series-tile"]').check();
      assert.equal(await page.locator('.product-selection-status').innerText(), '已選 2 種系列');
      const size = await page.locator('dialog').evaluate(node => ({ client: node.clientWidth, scroll: node.scrollWidth })); assert.ok(size.scroll <= size.client + 1);
      await shot('390-new-customer-memo-products');
    });
    await submit();
    const productCaseId = (await state()).memos[0].caseId;
    await check('phone/LINE channel, custom category, new contact role and selected products survive reload', async () => {
      await page.reload(); const s = await state(), memo = s.memos[0], contact = s.contacts.find(ct => ct.id === memo.contactId);
      assert.equal(memo.channel, 'LINE'); assert.equal(memo.category, '自行定義的拜訪類別'); assert.equal(contact.title, '設計協調／現場代表');
      assert.deepEqual(s.cases.find(c => c.id === memo.caseId).productIds, ['series-spc-pro', 'series-tile']); assert.equal(M.validState(s), true);
      await nav('memo'); assert.equal(await page.locator('img[data-xss="contact"]').count(), 0);
      await page.fill('#search', '自行定義的拜訪類別'); assert.equal(await page.locator('.memo-item').count(), 1);
    });
    await nav('case'); await page.locator(`.kanban-card[data-id="${productCaseId}"]`).click();
    await check('case reopens product multi-selection and can return to undecided', async () => {
      assert.equal(await page.locator('[name="productIds"]:checked').count(), 2);
      while (await page.locator('[name="productIds"]:checked').count()) await page.locator('[name="productIds"]:checked').first().uncheck();
      assert.equal(await page.locator('.product-selection-status').innerText(), '產品未定'); await submit('case-form');
      assert.deepEqual((await state()).cases.find(c => c.id === productCaseId).productIds, []);
    });
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem(window.CRM.STORAGE_KEY));
      for (let i = 0; i < 150; i++) window.CRM.addCompany(s, { name: '合成企業 ' + String(i).padStart(3, '0'), ownerId: 'u1', category: '搜尋驗收' });
      localStorage.setItem(window.CRM.STORAGE_KEY, JSON.stringify(s));
    });
    await page.reload(); await newMemo(); await page.locator('[name="summary"]').fill('合成驗收：搜尋客戶後保存');
    const beforeSearch = await state(); await page.locator('#memo-customer-search').fill('不存在的合成客戶');
    await check('unselected search text cannot silently save to the previously selected customer', async () => {
      await page.locator('#memo-form button[type="submit"]').click(); assert.equal(await page.locator('dialog[open]').count(), 1);
      assert.deepEqual(await state(), beforeSearch); assert.equal(await page.locator('[name="summary"]').inputValue(), '合成驗收：搜尋客戶後保存');
    });
    await page.locator('#memo-customer-search').fill('合成企業 145');
    await check('typed customer search handles 150 customers and resets incompatible contact/case safely', async () => {
      assert.equal(await page.locator('.customer-result').count(), 1); await page.locator('.customer-result').click();
      assert.equal(await page.locator('#memo-contact').inputValue(), '__new__'); assert.equal(await page.locator('#memo-case').inputValue(), '');
      assert.equal(await page.locator('[name="summary"]').inputValue(), '合成驗收：搜尋客戶後保存');
      await page.locator('[name="newContactName"]').fill('合成窗口 145'); await page.locator('[name="newContactRole"]').fill('自由角色');
      await submit(); const s = await state(); assert.equal(s.companies.find(co => co.id === s.memos[0].companyId).name, '合成企業 145'); assert.equal(M.validState(s), true);
    });
    await check('separate browser contexts remain independent, demonstrating the shared-backend gap honestly', async () => {
      const other = await browser.newContext(); const otherPage = await other.newPage(); await otherPage.goto(base);
      assert.equal(await otherPage.evaluate(() => localStorage.getItem(window.CRM.STORAGE_KEY)), null);
      assert.match(await otherPage.locator('.prototype-banner').innerText(), /不跨人同步/); await other.close();
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('[data-action="reset"]').click(); await page.locator('[data-action="confirm-reset"]').click();
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 900 ? 844 : 1000 });
      for (const id of ['home', 'company', 'case', 'memo', 'review']) {
        await nav(id);
        await check(`${width}px ${id}: no horizontal overflow or review UI`, async () => {
          const size = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
          assert.ok(size.content <= size.viewport + 1, JSON.stringify(size));
          assert.doesNotMatch(await page.locator('body').innerText(), /評審此功能|原型流程評審/);
        });
        if (width === 390 || width === 1440) await shot(`${width}-${id}`);
      }
      if (width === 320 || width === 390 || width === 1440) {
        await newMemo('ca1'); await page.locator('[name="summary"]').fill('合成驗收：多筆下一步手機表單');
        for (let i = 1; i <= 3; i++) await addStep('手機後續事項 ' + i, i % 2 ? 'u1' : 'u2', '2026-10-20');
        await check(`${width}px multi-step modal stays inside viewport and save is reachable`, async () => {
          const size = await page.locator('dialog').evaluate(node => ({ w: node.clientWidth, scroll: node.scrollWidth })); assert.ok(size.scroll <= size.w + 1, JSON.stringify(size));
          const hint = await page.locator('.steps-editor legend .required-hint').boundingBox(), legend = await page.locator('.steps-editor legend').boundingBox();
          assert.ok(hint && legend && hint.x >= legend.x - 1 && hint.y >= legend.y - 1 && hint.y + hint.height <= legend.y + legend.height + 1, 'Optional hint must stay with its legend');
          const button = page.locator('#memo-form button[type="submit"]'); await button.scrollIntoViewIfNeeded();
          const box = await button.boundingBox(); assert.ok(box && box.width >= 44 && box.height >= 44 && box.y >= 0 && box.y + box.height <= page.viewportSize().height);
        });
        await page.locator('dialog').evaluate(node => { node.scrollTop = 0; }); await shot(`${width}-multi-step-memo`);
        await submit(); await nav('memo'); assert.match(await page.locator('main').innerText(), /手機後續事項 3/);
      }
    }
    const legacy = M.seed(); delete legacy.followUps; for (const memo of legacy.memos) delete memo.followUpIds;
    legacy.memos[0].summary = '合成驗收：舊版瀏覽器紀錄保留';
    const oldContext = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'zh-TW' });
    await oldContext.addInitScript(({ key, data }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(data)); }, { key: M.STORAGE_KEY, data: legacy });
    const oldPage = await oldContext.newPage(); await oldPage.goto(base);
    await check('legacy browser storage is read without resetting user notes', async () => {
      assert.equal(await oldPage.locator('.storage-warning').count(), 0);
      await oldPage.locator('.quick-entry').click(); await oldPage.locator('[name="summary"]').fill('合成驗收：轉換後第一次保存');
      await oldPage.locator('#memo-form button[type="submit"]').click(); await oldPage.waitForFunction(() => !document.querySelector('dialog').open);
      const saved = await oldPage.evaluate(() => JSON.parse(localStorage.getItem(window.CRM.STORAGE_KEY)));
      assert.ok(saved.memos.some(m => m.summary === '合成驗收：舊版瀏覽器紀錄保留')); assert.equal(saved.memos.length, 8);
      assert.equal(M.validState(saved), true); assert.ok(saved.followUps.length >= 4);
    });
    await oldContext.close();
    await check('no browser runtime errors or external API requests', async () => { assert.deepEqual(report.errors, []); assert.deepEqual(report.externalRequests, []); });
    report.result = 'passed';
  } finally {
    await browser.close(); fs.writeFileSync(path.join(artifacts, 'report.json'), JSON.stringify(report, null, 2));
  }
  console.log(report.checks.length + ' browser checks passed');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
