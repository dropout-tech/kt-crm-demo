'use strict';
const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const url=process.env.CRM_SCHEDULE_URL || (process.env.CRM_BASE_URL || 'http://127.0.0.1:4173/')+'weekly-plan.html';
const artifacts=process.env.CRM_ARTIFACT_DIR || path.resolve(__dirname,'../artifacts/schedule');
fs.mkdirSync(artifacts,{recursive:true});
async function run(){
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const report={testedAt:new Date().toISOString(),checks:[],errors:[]};
 try{
  for(const width of [1440,390]){
   const page=await browser.newPage({viewport:{width,height:width<900?844:1000},locale:'zh-TW'});page.on('pageerror',e=>report.errors.push(e.message));await page.goto(url);await page.evaluate(()=>document.fonts.ready);
   assert.equal(await page.locator('.week').count(),11);assert.equal(await page.locator('.table-wrap').first().locator('tbody tr').count(),9);assert.match(await page.locator('.intro aside').innerText(),/合成定位/);assert.match(await page.locator('.intro aside').innerText(),/測試 PDF/);assert.match(await page.locator('.notice').innerText(),/正式共用連結目前尚未達成/);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));assert.equal(await page.locator('header img').evaluate(i=>i.complete&&i.naturalWidth>0),true);await page.screenshot({path:path.join(artifacts,width+'px-weekly-draft.png')});
   await page.locator('details summary').click();assert.equal(await page.locator('details tbody tr').count(),10);const text=await page.locator('details').innerText();assert.match(text,/ERP 庫存查詢[\s\S]*2–4/);assert.match(text,/ERP 成交建單與寫入後核對[\s\S]*5–8/);assert.match(text,/15–24 人日/);assert.equal(await page.locator('.button').getAttribute('href'),'https://dropout-tech.github.io/kt-crm-demo/');
   report.checks.push({name:width+'px weekly draft shows 11 checkpoints, 9 readiness rows, 10 conditional estimates and company demo link',result:'passed'});await page.close();
  }
  assert.deepEqual(report.errors,[]);report.result='passed';
 }finally{await browser.close();fs.writeFileSync(path.join(artifacts,'schedule-report.json'),JSON.stringify(report,null,2));}
 console.log(JSON.stringify(report,null,2));
}
run().catch(e=>{console.error(e);process.exit(1);});
