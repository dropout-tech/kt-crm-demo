'use strict';
const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const artifacts=process.env.CRM_ARTIFACT_DIR || path.resolve(__dirname,'../artifacts');
const base=process.env.CRM_BASE_URL || 'http://127.0.0.1:4173/';
async function run(){
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},locale:'zh-TW'});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const report={testedAt:new Date().toISOString(),features:50,mode:'numbered read-only table',checks:[],screenshots:[]};
 async function check(name,fn){await fn();report.checks.push({name,result:'passed'});console.log('PASS '+name)}
 await page.goto(base); await page.locator('.nav-item[data-page="review"]').click();
 await check('50 uniquely numbered read-only feature rows',async()=>{const numbers=await page.locator('.catalog-number').allTextContents();assert.deepEqual(numbers,Array.from({length:50},(_,i)=>String(i+1).padStart(2,'0')));assert.equal(await page.locator('.catalog-row').count(),50);assert.equal(await page.locator('[data-feature],[data-review],.feature-decisions,.review-card').count(),0);assert.equal(await page.locator('main textarea').count(),0)});
 await check('KT wishes and common CRM candidates both present with scope labels',async()=>{const t=await page.locator('.catalog-table').innerText();for(const text of ['Call memo','現場拜訪定位打卡','錄音與快速備忘','LINE／共用入口','企業大腦','潛在客戶','客戶服務工單','審核與簽核','KT 會議','常見 CRM 候選','合成流程可試'])assert.ok(t.includes(text),text)});
 const before=await page.evaluate(()=>localStorage.getItem(window.CRM.STORAGE_KEY));
 await page.fill('#catalog-search','錄音');
 await check('search retains stable feature number and records no preferences',async()=>{assert.equal(await page.locator('.catalog-row').count(),1);assert.equal(await page.locator('.catalog-number').innerText(),'10');const after=await page.evaluate(()=>localStorage.getItem(window.CRM.STORAGE_KEY));assert.equal(after,before)});
 await page.locator('[data-action="catalog-clear"]').click();await page.selectOption('#catalog-group','本期排程與財務預留');
 await check('ERP, quotation and reserved finance fields keep stable numbers 47 to 50',async()=>{assert.equal(await page.locator('.catalog-row').count(),4);assert.deepEqual(await page.locator('.catalog-number').allTextContents(),['47','48','49','50'])});
 await page.locator('[data-action="catalog-clear"]').click();
 for(const width of [320,390,768,1024,1440]){await page.setViewportSize({width,height:width<900?844:1000});await check(`table has no overflow at ${width}px`,async()=>{const size=await page.evaluate(()=>({w:window.innerWidth,doc:document.documentElement.scrollWidth}));assert.ok(size.doc<=size.w)});if([390,1440].includes(width)){const name=width===390?'simple-catalog-mobile.png':'simple-catalog-desktop.png';await page.screenshot({path:path.join(artifacts,name)});report.screenshots.push(name)}}
 for(const id of ['home','company','case','memo','review']){await page.locator(`.nav-item[data-page="${id}"]`).click();await check(`${id} page has no review entry or prototype evaluation text`,async()=>{assert.equal(await page.locator('.review-entry,[data-action="decision"],[data-action="review"]').count(),0);assert.doesNotMatch(await page.locator('body').innerText(),/評審此功能|原型流程評審|需求評審/)});}
 await page.setViewportSize({width:390,height:844});await page.locator('.nav-item[data-page="home"]').click();await page.screenshot({path:path.join(artifacts,'refined-mobile-home.png')});report.screenshots.push('refined-mobile-home.png');
 await page.locator('.nav-item[data-page="company"]').click();await page.locator('.company-item[data-id="co1"]').click();await page.screenshot({path:path.join(artifacts,'refined-mobile-company.png')});report.screenshots.push('refined-mobile-company.png');
 await page.locator('.nav-item[data-page="case"]').click();await page.screenshot({path:path.join(artifacts,'refined-mobile-case.png')});report.screenshots.push('refined-mobile-case.png');
 await check('four mobile nav targets remain at least 44px',async()=>{const nav=page.locator('.nav-item:visible');assert.equal(await nav.count(),4);for(const item of await nav.all()){const r=await item.boundingBox();assert.ok(r.width>=44&&r.height>=44)}});
 assert.deepEqual(errors,[]);await browser.close();fs.writeFileSync(path.join(artifacts,'catalog-browser-report.json'),JSON.stringify(report,null,2));console.log(report.checks.length+' read-only catalog checks passed');
}
run().catch(e=>{console.error(e);process.exit(1)});
