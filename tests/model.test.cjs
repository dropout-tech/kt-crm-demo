'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/model.js');
const input = () => ({ companyId: 'co1', contactId: 'ct1', caseId: 'ca1', authorId: 'u1', occurredAt: '2026-10-14T11:00:00+08:00', summary: '測試合成往來', nextAction: '測試下一步', nextOwnerId: 'u2', channel: '電話', dueDate: '2026-10-15' });
test('seed is valid and companies have independent contact ownership', () => {
  const s = M.seed(); assert.equal(M.validState(s), true);
  assert.equal(s.contacts.filter(x => x.companyId === 'co1').length, 2);
  assert.equal(s.companies.find(x => x.id === 'co1').ownerId, 'u1');
  assert.equal(s.companies.find(x => x.id === 'co2').ownerId, 'u2');
});
test('new memo updates matching case, next owner and last contact', () => {
  const s = M.seed(); const memo = M.addMemo(s, input());
  assert.equal(s.memos[0].id, memo.id); assert.equal(s.cases[0].nextOwnerId, 'u2');
  assert.equal(s.cases[0].nextAction, '測試下一步'); assert.equal(s.cases[0].lastContactAt, input().occurredAt);
  assert.equal(M.lastContact(s, 'co1'), input().occurredAt);
  assert.equal(M.validState(JSON.parse(JSON.stringify(s))), true);
});
test('cross-company contacts and cases are rejected without mutation', () => {
  const s = M.seed(); const before = JSON.stringify(s);
  assert.throws(() => M.addMemo(s, { ...input(), contactId: 'ct3' }), /聯絡人必須/);
  assert.throws(() => M.addMemo(s, { ...input(), caseId: 'ca2' }), /案件必須/);
  assert.equal(JSON.stringify(s), before);
});
test('historical memo stays in timeline but does not overwrite latest case next step', () => {
  const s = M.seed(); const original = M.clone(s.cases[0]);
  M.addMemo(s, { ...input(), occurredAt: '2026-10-01T11:00:00+08:00' });
  assert.deepEqual(s.cases[0], original); assert.equal(s.memos.length, 8);
});
test('unlinked memo preserves every case while updating enterprise history', () => {
  const s = M.seed(); const cases = M.clone(s.cases);
  M.addMemo(s, { ...input(), caseId: '' });
  assert.deepEqual(s.cases, cases);
  assert.equal(M.lastContact(s, 'co1'), input().occurredAt);
});
test('memo validates required content, references and timestamp before changing state', () => {
  const s = M.seed(); const count = s.memos.length;
  assert.throws(() => M.addMemo(s, { ...input(), summary: ' ' }), /往來重點/);
  assert.throws(() => M.addMemo(s, { ...input(), nextOwnerId: 'missing' }), /負責人不存在/);
  assert.throws(() => M.addMemo(s, { ...input(), occurredAt: 'invalid' }), /聯繫時間/);
  assert.equal(s.memos.length, count);
});
test('case updates persist, invalid statuses do not change the case', () => {
  const s = M.seed(); M.updateCase(s, 'ca1', { status: '待回覆', nextAction: '請業務 B 接手', nextOwnerId: 'u2', dueDate: '2026-10-15' });
  assert.equal(s.cases[0].status, '待回覆'); assert.equal(s.cases[0].nextOwnerId, 'u2');
  const before = JSON.stringify(s); assert.throws(() => M.updateCase(s, 'ca1', { status: '任意值' }), /案件進度/); assert.equal(JSON.stringify(s), before);
});
test('create a company, contact, case and memo as one coherent local flow', () => {
  const s = M.seed(); const co = M.addCompany(s, { name: '新增示範企業', ownerId: 'u2' });
  const ct = M.addContact(s, { companyId: co.id, name: '示範窗口', contactMethod: '示範聯絡方式', ownerId: 'u2' });
  const ca = M.addCase(s, { companyId: co.id, title: '新增示範案件', status: '需求確認', nextAction: '確認需求', nextOwnerId: 'u2' });
  M.addMemo(s, { ...input(), companyId: co.id, contactId: ct.id, caseId: ca.id });
  assert.equal(M.validState(s), true);
});
test('failed case creation rolls back without a dangling item', () => {
  const s = M.seed(); const before = JSON.stringify(s);
  assert.throws(() => M.addCase(s, { companyId: 'co1', title: '測試', status: 'invalid', nextAction: '測試', nextOwnerId: 'u1' }));
  assert.equal(JSON.stringify(s), before);
});
test('feedback export contains review only and import is atomic', () => {
  const s = M.seed(); M.saveReview(s, 'company', { decision: '調整', role: '主管', note: '企業多業務歸屬待確認' });
  const exported = M.exportFeedback(s); assert.equal(exported.type, 'jucheng-prototype-feedback');
  assert.equal(exported.companies, undefined); assert.equal(exported.memos, undefined);
  const destination = M.seed(); M.importFeedback(destination, exported); assert.equal(destination.reviews.company.decision, '調整');
  const before = JSON.stringify(destination); exported.reviews.contact.decision = '錯誤狀態';
  assert.throws(() => M.importFeedback(destination, exported), /未知評審狀態/); assert.equal(JSON.stringify(destination), before);
  assert.throws(() => M.importFeedback(destination, {}), /JSON/);
});
test('corrupt browser data is rejected without treating it as a valid state', () => {
  assert.equal(M.validState({}), false); const s = M.seed(); s.contacts[0].companyId = 'missing'; assert.equal(M.validState(s), false);
});
test('legacy storage migrates without touching reviews, records or storage key', () => {
  const legacy = M.seed(); delete legacy.featureSelections; legacy.reviews.memo.note = '原有回饋';
  const before = JSON.stringify(legacy); assert.equal(M.validState(legacy), true);
  M.normalizeState(legacy); assert.equal(legacy.reviews.memo.note, '原有回饋');
  assert.equal(Object.keys(legacy.featureSelections).length, 50); const restored = M.clone(legacy); delete restored.featureSelections;
  assert.equal(JSON.stringify(restored), before); assert.equal(M.STORAGE_KEY, 'jucheng-requirement-prototype-v1');
});
test('catalog decisions and priorities are explicit and invalid input is atomic', () => {
  const s = M.seed(); assert.ok(Object.values(s.featureSelections).every(r => !r.decision && !r.priority));
  M.saveFeature(s, 'account', { decision: '需要', priority: '優先確認', role: '業務', note: '交接時需要' });
  assert.equal(s.featureSelections.account.decision, '需要'); const before = JSON.stringify(s);
  assert.throws(() => M.saveFeature(s, 'account', { decision: 'wrong', priority: '' }), /未知功能/);
  assert.throws(() => M.saveFeature(s, 'missing', { decision: '需要', priority: '' }), /未知功能/);
  assert.equal(JSON.stringify(s), before);
});
test('combined feedback round-trips and old review imports preserve feature selections', () => {
  const s = M.seed(); M.saveReview(s, 'company', { decision: '保留', note: '既有' });
  M.saveFeature(s, 'payment', { decision: '待討論', priority: '之後再評估', note: '需另案評估' });
  const data = M.exportFeedback(s), dest = M.seed(); M.importFeedback(dest, data);
  assert.equal(dest.reviews.company.note, '既有'); assert.equal(dest.featureSelections.payment.note, '需另案評估');
  delete data.featureSelections; data.reviews.company.note = '舊格式更新'; M.importFeedback(dest, data);
  assert.equal(dest.reviews.company.note, '舊格式更新'); assert.equal(dest.featureSelections.payment.note, '需另案評估');
  const partial = { ...data, reviews: {}, featureSelections: { account: { decision: '需要', priority: '優先確認' } } }; M.importFeedback(dest, partial);
  assert.equal(dest.featureSelections.payment.decision, '待討論'); assert.equal(dest.featureSelections.account.decision, '需要');
});
test('invalid combined import never partially overwrites original feedback', () => {
  const s = M.seed(), data = M.exportFeedback(s); data.reviews.company.decision = '調整'; data.featureSelections.account.priority = 'invalid';
  const before = JSON.stringify(s); assert.throws(() => M.importFeedback(s, data)); assert.equal(JSON.stringify(s), before);
  s.featureSelections.account.decision = 'invalid'; assert.equal(M.validState(s), false);
});
test('CSV exports both review types, escapes quotes and neutralizes spreadsheet formulas', () => {
  const s = M.seed(); M.saveFeature(s, 'account', { decision: '需要', priority: '', note: '=1+1,"test"\n第二行' });
  const csv = M.feedbackCSV(s); assert.ok(csv.startsWith('\uFEFF')); assert.match(csv, /功能選擇/); assert.match(csv, /原型評審/);
  assert.match(csv, /"'=1\+1,""test""\n第二行"/); assert.ok(!csv.includes('青禾商用空間'));
});

test('zero follow-ups save without changing an existing case tracking list', () => {
  const s = M.seed(), before = M.clone(s.cases[0]), steps = M.clone(M.caseFollowUps(s, 'ca1'));
  const memo = M.addMemo(s, { ...input(), nextSteps: [] });
  assert.deepEqual(memo.followUpIds, []); assert.equal(memo.nextAction, '');
  assert.deepEqual(M.caseFollowUps(s, 'ca1'), steps); assert.equal(s.cases[0].nextAction, before.nextAction);
  assert.equal(s.cases[0].lastContactAt, memo.occurredAt); assert.equal(M.validState(s), true);
});
test('multiple follow-ups retain distinct owners and dates and append to existing case work', () => {
  const s = M.seed(), original = M.caseFollowUps(s, 'ca1')[0].id;
  const memo = M.addMemo(s, { ...input(), nextSteps: [{ title: '現場確認', ownerId: 'u1', dueDate: '2026-10-20' }, { title: '補充文件', ownerId: 'u2', dueDate: '' }, { title: '確認時段', ownerId: 'u1' }] });
  assert.equal(M.caseFollowUps(s, 'ca1').length, 4); assert.ok(M.caseFollowUps(s, 'ca1').some(step => step.id === original));
  assert.deepEqual(M.memoFollowUps(s, memo).map(step => [step.title, step.ownerId, step.dueDate]), [['現場確認', 'u1', '2026-10-20'], ['補充文件', 'u2', ''], ['確認時段', 'u1', '']]);
  assert.equal(M.validState(JSON.parse(JSON.stringify(s))), true);
});
test('invalid later follow-up does not partially save a memo or orphan a new case', () => {
  for (const invalid of [{ title: ' ', ownerId: 'u1' }, { title: '錯誤業務', ownerId: 'missing' }, { title: '錯誤日期', ownerId: 'u1', dueDate: '2026-02-30' }, { title: '日期類型錯誤', ownerId: 'u1', dueDate: false }]) {
    const s = M.seed(), before = JSON.stringify(s);
    assert.throws(() => M.addMemo(s, { ...input(), caseId: '', createCase: true, newCaseTitle: '不應留下的商機', nextSteps: [{ title: '第一項有效', ownerId: 'u1' }, invalid] }));
    assert.equal(JSON.stringify(s), before);
  }
});
test('initial memo creates a pre-quotation opportunity atomically and carries every follow-up', () => {
  const s = M.seed(); const memo = M.addMemo(s, { ...input(), caseId: '', createCase: true, newCaseTitle: '只知道初步需求', nextSteps: [{ title: '補需求', ownerId: 'u2' }, { title: '約拜訪', ownerId: 'u1' }] });
  const item = s.cases.find(c => c.id === memo.caseId);
  assert.equal(item.title, '只知道初步需求'); assert.equal(item.status, '需求確認'); assert.equal(item.lastContactAt, memo.occurredAt);
  assert.equal(M.caseFollowUps(s, item.id).length, 2); assert.equal(M.validState(s), true);
  const before = JSON.stringify(s);
  assert.throws(() => M.addMemo(s, { ...input(), caseId: '', createCase: true, newCaseTitle: ' ', nextSteps: [] }), /案件名稱/);
  assert.throws(() => M.addMemo(s, { ...input(), createCase: true, newCaseTitle: '衝突模式', nextSteps: [] }), /其中一種/);
  assert.equal(JSON.stringify(s), before);
});
test('existing enterprise memo links to a same-company opportunity with all follow-ups exactly once', () => {
  const s = M.seed(); const memo = M.addMemo(s, { ...input(), caseId: '', nextSteps: [{ title: '待確認一', ownerId: 'u1' }, { title: '待確認二', ownerId: 'u2' }] });
  const beforeCount = s.followUps.length;
  const item = M.createCaseFromMemo(s, memo.id, '由記事延伸的商機');
  const updated = s.memos.find(m => m.id === memo.id);
  assert.equal(updated.caseId, item.id); assert.equal(updated.summary, memo.summary);
  assert.equal(s.followUps.length, beforeCount); assert.equal(M.caseFollowUps(s, item.id).length, 2);
  M.linkMemo(s, memo.id, item.id); assert.equal(s.followUps.length, beforeCount);
  assert.equal(M.validState(s), true);
});
test('cross-company linking and moving an already linked memo are rejected without mutation', () => {
  const s = M.seed(); const memo = M.addMemo(s, { ...input(), caseId: '', nextSteps: [] }); const before = JSON.stringify(s);
  assert.throws(() => M.linkMemo(s, memo.id, 'ca2'), /同一企業/); assert.equal(JSON.stringify(s), before);
  M.linkMemo(s, memo.id, 'ca1'); const linked = JSON.stringify(s);
  const other = M.addCase(s, { companyId: 'co1', title: '同企業不同案件', status: '需求確認', nextSteps: [] }); const after = JSON.stringify(s);
  assert.throws(() => M.linkMemo(s, memo.id, other.id), /已關聯/); assert.equal(JSON.stringify(s), after);
  assert.ok(linked.includes('ca1')); assert.equal(M.validState(s), true);
});
test('case without follow-ups is valid and removing tracking preserves the original memo reference', () => {
  const s = M.seed(), memo = M.addMemo(s, { ...input(), nextSteps: [{ title: '保留可追溯紀錄', ownerId: 'u1' }] });
  M.updateCase(s, 'ca1', { status: '進行中', nextSteps: [] });
  assert.equal(M.caseFollowUps(s, 'ca1').length, 0); assert.equal(s.cases[0].nextAction, '');
  assert.equal(M.memoFollowUps(s, memo)[0].active, false); assert.equal(M.validState(s), true);
  const item = M.addCase(s, { companyId: 'co1', title: '只有名稱', status: '需求確認', nextSteps: [] });
  assert.equal(M.caseFollowUps(s, item.id).length, 0); assert.equal(M.validState(s), true);
});
test('case edits preserve stable step identities and reject IDs from another case atomically', () => {
  const s = M.seed(), step = M.caseFollowUps(s, 'ca1')[0];
  M.updateCase(s, 'ca1', { status: '待回覆', nextSteps: [{ ...step, title: '調整既有事項', ownerId: 'u2' }, { title: '第二事項', ownerId: 'u1' }] });
  assert.equal(M.caseFollowUps(s, 'ca1')[0].id, step.id); assert.equal(M.caseFollowUps(s, 'ca1').length, 2);
  const before = JSON.stringify(s), foreign = M.caseFollowUps(s, 'ca2')[0];
  assert.throws(() => M.updateCase(s, 'ca1', { status: '進行中', nextSteps: [foreign] }), /屬於此案件/);
  assert.throws(() => M.updateCase(s, 'ca1', { status: '進行中', nextSteps: [{ ...step, id: 'unknown' }] }), /不存在/);
  assert.equal(JSON.stringify(s), before); assert.equal(M.validState(s), true);
});
test('true legacy browser state migrates idempotently without losing history or feedback', () => {
  const legacy = M.seed(); delete legacy.followUps; for (const memo of legacy.memos) delete memo.followUpIds;
  legacy.reviews.memo.note = '先前保存的內容'; const memoSnapshot = M.clone(legacy.memos);
  legacy.memos.push({ ...input(), id: 'legacy-unlinked', caseId: '', nextAction: '企業後續事項' });
  assert.equal(M.validState(legacy), true); M.normalizeState(legacy);
  assert.equal(legacy.reviews.memo.note, '先前保存的內容'); assert.equal(legacy.followUps.length, 5);
  for (const [index, memo] of memoSnapshot.entries()) { const restored = { ...legacy.memos[index] }; delete restored.followUpIds; assert.deepEqual(restored, memo); }
  const once = JSON.stringify(legacy); M.normalizeState(legacy); assert.equal(JSON.stringify(legacy), once);
  M.linkMemo(legacy, 'legacy-unlinked', 'ca1'); assert.equal(M.validState(legacy), true);
  assert.equal(legacy.memos.find(m => m.id === 'legacy-unlinked').caseId, 'ca1');
});
test('corrupt follow-up ownership, dates and memo references are rejected before browser load', () => {
  for (const mutate of [s => { s.followUps[0].ownerId = 'missing'; }, s => { s.followUps[0].companyId = 'co2'; }, s => { s.followUps[0].dueDate = '2026-02-30'; }, s => { s.followUps[0].memoId = 'missing'; }, s => { s.memos.find(m => m.followUpIds?.length).followUpIds.push('missing'); }, s => { s.followUps.push(M.clone(s.followUps[0])); }]) {
    const s = M.seed(); mutate(s); assert.equal(M.validState(s), false);
  }
});
test('case can edit work accumulated across notes beyond the per-note entry limit', () => {
  const s = M.seed();
  for (let round = 0; round < 2; round++) M.addMemo(s, { ...input(), nextSteps: Array.from({ length: 30 }, (_, i) => ({ title: `後續 ${round}-${i}`, ownerId: 'u1' })) });
  const steps = M.clone(M.caseFollowUps(s, 'ca1'));
  M.updateCase(s, 'ca1', { status: '待回覆', nextSteps: steps });
  assert.equal(M.caseFollowUps(s, 'ca1').length, 61); assert.equal(M.validState(s), true);
});
test('customer classification remains editable and invalid changes are atomic', () => {
  const s = M.seed(), item = M.addCompany(s, { name: '合成分類企業', ownerId: 'u1', category: '設計公司' });
  assert.equal(item.category, '設計公司'); M.updateCompanyCategory(s, item.id, '工程承攬'); assert.equal(item.category, '工程承攬');
  const before = JSON.stringify(s); assert.throws(() => M.updateCompanyCategory(s, item.id, '長'.repeat(121)), /客戶分類/); assert.equal(JSON.stringify(s), before);
  M.updateCompanyCategory(s, item.id, ''); assert.equal(item.category, '未分類');
});
test('first interaction can add a flexible contact, category, opportunity and multiple products atomically', () => {
  const s = M.seed(), co = M.addCompany(s, { name: '沒有聯絡人的合成客戶', ownerId: 'u2', category: '通路' });
  const memo = M.addMemo(s, { ...input(), companyId: co.id, contactId: '', createContact: true, newContact: { name: '合成設計窗口', title: '設計協調／現場代表' }, caseId: '', createCase: true, newCaseTitle: '只有初步需求', productIds: ['series-spc-pro', 'series-tile'], nextSteps: [], category: '自行輸入的記事類別', channel: 'LINE' });
  const contact = s.contacts.find(ct => ct.id === memo.contactId), item = s.cases.find(c => c.id === memo.caseId);
  assert.equal(contact.companyId, co.id); assert.equal(contact.title, '設計協調／現場代表'); assert.equal(contact.contactMethod, '聯絡方式待補');
  assert.equal(memo.category, '自行輸入的記事類別'); assert.equal(memo.channel, 'LINE'); assert.deepEqual(item.productIds, ['series-spc-pro', 'series-tile']); assert.equal(M.validState(s), true);
});
test('invalid inline contact or product data never leaves partial contacts, memos or cases', () => {
  for (const change of [{ newContact: { name: ' ' } }, { newContact: { name: '示範', title: '長'.repeat(121) } }, { productIds: ['unverified-erp-sku'] }, { category: '長'.repeat(121) }]) {
    const s = M.seed(), before = JSON.stringify(s);
    assert.throws(() => M.addMemo(s, { ...input(), contactId: '', createContact: true, newContact: { name: '合成窗口' }, caseId: '', createCase: true, newCaseTitle: '不得留殘件', productIds: [], nextSteps: [], ...change }));
    assert.equal(JSON.stringify(s), before);
  }
});
test('opportunity products allow unknown, multiple series, changes and clearing without prices or area', () => {
  const s = M.seed(); const item = M.addCase(s, { companyId: 'co1', title: '先留未定', status: '需求確認', nextSteps: [] });
  assert.deepEqual(item.productIds, []);
  M.updateCase(s, item.id, { status: '進行中', productIds: ['series-spc', 'series-lvt'], nextSteps: [] }); assert.equal(item.productIds.length, 2);
  const before = JSON.stringify(s);
  assert.throws(() => M.updateCase(s, item.id, { status: '進行中', productIds: ['series-spc', 'series-spc'], nextSteps: [] }), /型錄產品/); assert.equal(JSON.stringify(s), before);
  M.updateCase(s, item.id, { status: '進行中', productIds: [], nextSteps: [] }); assert.deepEqual(item.productIds, []); assert.equal(M.validState(s), true);
});
test('saved memo can become an opportunity with catalog series and retains the same memo', () => {
  const s = M.seed(), memo = M.addMemo(s, { ...input(), caseId: '', nextSteps: [], category: '產品說明' });
  const item = M.createCaseFromMemo(s, memo.id, '由記事補上需求', ['series-lvt-custom']);
  assert.deepEqual(item.productIds, ['series-lvt-custom']); assert.equal(s.memos.find(m => m.id === memo.id).category, '產品說明'); assert.equal(M.validState(s), true);
});
test('corrupt product or category storage is rejected and old records remain compatible', () => {
  const s = M.seed(); assert.equal(M.validState(s), true);
  s.cases[0].productIds = ['not-in-catalog']; assert.equal(M.validState(s), false); delete s.cases[0].productIds;
  s.memos[0].category = {}; assert.equal(M.validState(s), false); delete s.memos[0].category; assert.equal(M.validState(s), true);
});

const quoteInput = () => ({ caseId: 'ca1', title: '合成測試報價', currency: 'TWD', validUntil: '', note: '範本待確認', items: [{ description: '示範品項', quantity: '2.5', unit: '坪', unitPrice: '1234.56' }] });
test('synthetic visit check-in saves success and failure without real location APIs', () => {
  for (const scenario of ['success', 'permission-denied', 'timeout', 'unsupported']) {
    const s = M.seed(), checkIn = M.simulateCheckIn(scenario), memo = M.addMemo(s, { ...input(), channel: '拜訪', checkIn, nextSteps: [] });
    assert.equal(memo.checkIn.mode, 'synthetic'); assert.equal(memo.checkIn.status, scenario);
    assert.equal(memo.checkIn.position === null, scenario !== 'success'); assert.equal(M.validState(s), true);
  }
});
test('real or invalid location payloads and non-visit check-ins are rejected atomically', () => {
  const s = M.seed(), before = JSON.stringify(s), point = M.simulateCheckIn();
  for (const change of [{ ...point, mode: 'device' }, { ...point, position: { ...point.position, latitude: 91 } }, { ...point, status: 'timeout' }, { ...point, attemptedAt: 'invalid' }]) assert.throws(() => M.addMemo(s, { ...input(), channel: '拜訪', checkIn: change }));
  assert.throws(() => M.addMemo(s, { ...input(), channel: '電話', checkIn: point }), /現場拜訪/); assert.equal(JSON.stringify(s), before);
});
test('test quotation requires sales confirmation and a separate supervisor before PDF', () => {
  const s = M.seed(), quote = M.createQuote(s, quoteInput(), 'u1');
  assert.equal(quote.status, '草稿'); assert.equal(quote.totalMinor, '308640'); assert.equal(M.formatQuoteMoney(quote.totalMinor), '3,086.40');
  const before = JSON.stringify(s);
  assert.throws(() => M.approvedQuoteData(s, quote.id, 'u1'), /尚未核准/);
  assert.throws(() => M.reviewQuote(s, quote.id, 'u3', 'approve'), /業務確認/); assert.equal(JSON.stringify(s), before);
  M.confirmQuote(s, quote.id, 'u1'); assert.equal(quote.status, '待主管審核');
  assert.throws(() => M.reviewQuote(s, quote.id, 'u1', 'approve'), /示範主管/);
  M.reviewQuote(s, quote.id, 'u3', 'approve'); const pdf = M.approvedQuoteData(s, quote.id, 'u1');
  assert.match(pdf.watermark, /測試樣張.*不可對外/); assert.equal(pdf.review.version, 1); assert.equal(pdf.testOnly, true); assert.equal(M.validState(s), true);
});
test('test role scenarios reject unrelated sales edits and downloads without mutation', () => {
  const s = M.seed(), quote = M.createQuote(s, quoteInput(), 'u1'), before = JSON.stringify(s);
  assert.throws(() => M.updateQuote(s, quote.id, quoteInput(), 'u2'), /限建立草稿/);
  assert.throws(() => M.confirmQuote(s, quote.id, 'u2'), /限建立草稿/); assert.equal(JSON.stringify(s), before);
  M.confirmQuote(s, quote.id, 'u1'); M.reviewQuote(s, quote.id, 'u3', 'approve');
  assert.throws(() => M.approvedQuoteData(s, quote.id, 'u2'), /不允許/);
});
test('editing an approved quotation invalidates approval until the new version is confirmed and reviewed', () => {
  const s = M.seed(), quote = M.createQuote(s, quoteInput(), 'u1');
  M.confirmQuote(s, quote.id, 'u1'); M.reviewQuote(s, quote.id, 'u3', 'approve');
  M.updateQuote(s, quote.id, { ...quoteInput(), items: [{ description: '修改品項', quantity: '1', unit: '式', unitPrice: '2000' }] }, 'u1');
  assert.equal(quote.version, 2); assert.equal(quote.status, '草稿'); assert.equal(quote.review, null); assert.equal(quote.salesConfirmation, null);
  assert.equal(quote.revisions[0].status, '已核准'); assert.equal(quote.revisions[0].version, 1);
  assert.throws(() => M.approvedQuoteData(s, quote.id, 'u1'), /尚未核准/);
  M.confirmQuote(s, quote.id, 'u1'); M.reviewQuote(s, quote.id, 'u3', 'approve');
  assert.equal(M.approvedQuoteData(s, quote.id, 'u3').version, 2); assert.equal(M.validState(s), true);
});
test('supervisor return requires a reason and a revised draft before reconfirmation', () => {
  const s = M.seed(), quote = M.createQuote(s, quoteInput(), 'u1'); M.confirmQuote(s, quote.id, 'u1'); const before = JSON.stringify(s);
  assert.throws(() => M.reviewQuote(s, quote.id, 'u3', 'return', ''), /退回原因/); assert.equal(JSON.stringify(s), before);
  M.reviewQuote(s, quote.id, 'u3', 'return', '請核對合成品項'); assert.equal(quote.status, '退回修改');
  assert.throws(() => M.confirmQuote(s, quote.id, 'u1'), /保存草稿/);
  M.updateQuote(s, quote.id, quoteInput(), 'u1'); M.confirmQuote(s, quote.id, 'u1'); assert.equal(quote.version, 2); assert.equal(M.validState(s), true);
});
test('invalid quotation fields never leave partial drafts or revision snapshots', () => {
  const s = M.seed(), before = JSON.stringify(s);
  for (const change of [{ items: [] }, { currency: 'long' }, { validUntil: '2026-02-30' }, { items: [{ description: '測試', quantity: '0', unitPrice: '1' }] }, { items: [{ description: '測試', quantity: '1', unitPrice: '-5' }] }]) assert.throws(() => M.createQuote(s, { ...quoteInput(), ...change }, 'u1'));
  assert.equal(JSON.stringify(s), before);
  const quote = M.createQuote(s, quoteInput(), 'u1'), created = JSON.stringify(s);
  assert.throws(() => M.updateQuote(s, quote.id, { ...quoteInput(), items: [] }, 'u1')); assert.equal(JSON.stringify(s), created);
});
test('test quotation rounding is decimal-safe and corrupted saved approval or totals are rejected', () => {
  const s = M.seed(), quote = M.createQuote(s, { ...quoteInput(), items: [{ description: '精度測試', quantity: '1.005', unitPrice: '1.00' }] }, 'u1');
  assert.equal(quote.totalMinor, '101'); M.confirmQuote(s, quote.id, 'u1'); M.reviewQuote(s, quote.id, 'u3', 'approve');
  const good = JSON.stringify(s); quote.review.version = 99; assert.equal(M.validState(s), false);
  const totals = JSON.parse(good); totals.quotes[0].totalMinor = '999'; assert.equal(M.validState(totals), false);
  assert.equal(M.validState(JSON.parse(good)), true);
});
