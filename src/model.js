(function (root) {
  'use strict';
  const STORAGE_KEY = 'jucheng-requirement-prototype-v1';
  const STATUSES = ['需求確認', '進行中', '待回覆', '已完成'];
  // Series names checked against the user's 2026 catalog; these IDs are not ERP SKUs.
  const CATALOG_PRODUCTS = [
    { id: 'series-spc-pro', name: '鈦晶 SPC Pro' },
    { id: 'series-spc', name: '鈦晶 SPC' },
    { id: 'series-lvt', name: '鈦晶 LVT' },
    { id: 'series-tile', name: '鈦晶磁磚' },
    { id: 'series-lvt-custom', name: 'LVT 訂製系列' }
  ];
  const MEMO_CATEGORY_EXAMPLES = ['初次聯繫', '需求確認', '現場勘查', '產品說明', '報價追蹤', '進度追蹤'];
  const QUOTE_STATUSES = ['草稿', '待主管審核', '已核准', '退回修改'];
  const MODULES = [
    { id: 'company', name: '企業與 Account 歸屬', kind: '核心流程', source: '需求確認候選', question: '同一企業會有多位負責業務嗎？交接時由誰調整歸屬？', flow: '找企業 → 看負責業務 → 調整 Account 歸屬' },
    { id: 'contact', name: '企業下的聯絡人', kind: '核心流程', source: '需求確認候選', question: '聯絡人與企業的負責業務可能不同嗎？需要哪些聯絡方式？', flow: '選企業 → 找所屬聯絡人 → 看聯絡與負責方式' },
    { id: 'memo', name: 'Call memo／業務報告', kind: '核心流程', source: '需求確認候選', question: '誰填寫、何時回報？主管需確認、退回或補充嗎？', flow: '選企業與聯絡人 → 記錄往來 → 留下下一步與負責人' },
    { id: 'case', name: '案件進度與下一步', kind: '核心流程', source: '需求確認候選', question: '案件如何開始、如何結束？「待回覆」與「進行中」符合現場嗎？', flow: '看案件 → 更新進度 → 交接下一步' },
    { id: 'supervisor', name: '主管檢視與角色', kind: '核心流程', source: '需求確認候選', question: '主管看全公司或只看部門？業務能看其他人的往來嗎？', flow: '切主管視角 → 看 Account、最近聯繫與未完成下一步' },
    { id: 'attendance', name: '打卡／外勤', kind: '延伸待選', source: '需求確認候選', question: '需要打卡，還是記錄拜訪時間已足夠？涉及哪些角色？', flow: '後續需求討論，尚未實作' },
    { id: 'recording', name: '錄音與快速備忘', kind: '延伸待選', source: '需求確認候選', question: '哪類情境需要錄音？保存、同意與查閱規則如何訂？', flow: '後續需求討論，尚未實作' },
    { id: 'integration', name: '企業大腦／LINE 共用入口', kind: '待核整合', source: '需求確認候選', question: '希望從同一入口查什麼？企業大腦與 LINE 的資料及權限由誰確認？', flow: '僅討論入口與資料邊界；尚未串接' }
  ];
  const FEATURE_DECISIONS = ['', '需要', '暫不需要', '待討論'];
  const PRIORITIES = ['', '優先確認', '第二階段', '之後再評估'];
  // Feature catalog is an interview aid, never an agreed delivery scope.
  const FEATURES = [
    ['account', '企業與聯絡人', '企業主檔與 Account 歸屬', '企業、負責業務及最近聯繫集中查看。', '企業交接由誰決定？一間企業能否多人共同負責？', '會議核心', '可試用', 'company'],
    ['contacts', '企業與聯絡人', '企業下的多位聯絡人', '保存窗口角色、聯絡方式示意與負責業務。', '同一人會對應多間企業嗎？哪些欄位是必要？', '會議核心', '可試用', 'company'],
    ['tags', '企業與聯絡人', '客戶分類與標籤', '保留與編輯客戶分類；區域、階段等複合篩選待補。', '分類由誰維護？現行有哪些實際分類？', '會議確認', '分類可試用／篩選待補'],
    ['dedupe', '企業與聯絡人', '重複資料檢查與合併', '匯入或新增時辨識疑似重複企業、聯絡人。', '用哪些資訊比對？誰有權合併？', 'B2B候選', '尚未實作'],
    ['memo', '拜訪與往來', 'Call memo／業務報告', '記錄聯繫重點、下一步、接手人及日期。', '誰填、何時填？哪些內容需要主管確認？', '會議核心', '可試用', 'memo'],
    ['timeline', '拜訪與往來', '企業往來時間序', '沿企業與聯絡人查看歷次往來脈絡。', '接手業務最需要看到哪些歷史？', '會議核心', '可試用', 'company'],
    ['visit', '拜訪與往來', '拜訪計畫與行事曆', '安排預計拜訪、參與人員與追蹤事項。', '已有行事曆嗎？需要共用哪些資訊？', 'B2B候選', '尚未實作'],
    ['attachments', '拜訪與往來', '照片、文件與附件', '將示意照片或文件關聯到企業、案件或往來。', '檔案種類、大小及保存年限為何？', 'B2B候選', '尚未實作'],
    ['attendance', '拜訪與往來', '現場拜訪定位打卡', '本機可試合成成功、拒絕、逾時及不支援情境；非實際位置。正式定位與手機權限測試未完成。', '定位使用與保存規則待確認。', '會議確認', '合成流程可試'],
    ['recording', '拜訪與往來', '錄音與快速備忘', '確認語音輸入、錄音或會議備忘的使用情境。', '錄音同意、保存及查閱規則由誰訂定？', '會議延伸', '尚未實作'],
    ['next-step', '追蹤與協作', '案件下一步與接手人', '每個案件記錄下一步、負責人與預計日期。', '交接是否需要接手人確認？', '會議核心', '可試用', 'case'],
    ['tasks', '追蹤與協作', '獨立待辦與多人協作', '管理不屬於案件的待辦、指派與完成回報。', '一件任務能否多人處理？完成如何判定？', 'B2B候選', '尚未實作'],
    ['reminders', '追蹤與協作', '到期與未回覆提醒', '依日期與閒置時間提醒追蹤。', '提醒誰、何時提醒？只在系統內或需要外部通知？', 'B2B候選', '尚未實作'],
    ['handover', '追蹤與協作', '業務交接清單', '整理企業、案件與未完成待辦供交接確認。', '交接要哪些簽核？舊負責人能否繼續查閱？', 'B2B候選', '尚未實作'],
    ['cases', '案件與商機', '案件進度管理', '查看需求確認、進行中、待回覆及已完成。', '目前狀態符合現場嗎？如何開始與結束案件？', '會議核心', '可試用', 'case'],
    ['pipeline', '案件與商機', '商機階段與成交／失單原因', '確認是否需要銷售漏斗、預估金額及成交判定。', '每階段的條件？金額來源與失單原因由誰填？', 'B2B候選', '尚未實作'],
    ['case-files', '案件與商機', '案件文件與版本', '整理案件文件及最新版本，避免接手用錯資料。', '哪些文件需版控？可以由哪些角色上傳？', 'B2B候選', '尚未實作'],
    ['supervisor', '主管與報表', '主管檢視歸屬與最近聯繫', '切換示範主管視角，查看業務及案件下一步。', '主管看全公司還是部門？哪些資料不應顯示？', '會議核心', '可試用', 'home'],
    ['activity-report', '主管與報表', '業務活動與追蹤報表', '按期間、業務或部門彙整拜訪及追蹤情況。', '主管實際用報表做何種決策？指標怎麼定義？', 'B2B候選', '尚未實作'],
    ['forecast', '主管與報表', '商機預測與目標', '評估是否需要預估成交與目標追蹤。', '需要什麼期間？概率、金額是否有可靠來源？', 'B2B候選', '尚未實作'],
    ['import', '資料與匯入', 'Excel／CSV 匯入與欄位對照', '將既有企業、聯絡人資料依欄位對照匯入。', '現有資料在哪？誰整理重複與缺漏？', 'B2B候選', '尚未實作'],
    ['export', '資料與匯入', '業務資料匯出', '依授權匯出企業、案件或往來資料。', '哪些角色可匯出？需留紀錄或遮蔽哪些欄位？', 'B2B候選', '尚未實作'],
    ['fields', '資料與匯入', '自訂欄位與必填規則', '依實際工作方式調整欄位、選項與檢查規則。', '哪些欄位必填？維護權限與改版方式為何？', 'B2B候選', '尚未實作'],
    ['roles', '權限與治理', '正式登入與三層角色權限', '登入帳號決定管理者、業務主管與業務身分；正式系統不可自行切換角色。', '聯絡方式、記事、案件與金額的細部權限待核。', '會議確認', '本期排程／未實作'],
    ['audit', '權限與治理', '異動與查閱紀錄', '保留歸屬、案件及重要資料異動歷程。', '哪些操作需追溯？需保存多久？', 'B2B候選', '尚未實作'],
    ['backup', '權限與治理', '備份與資料保存', '確認備份、復原、保存與刪除規則。', '可接受遺失多久的資料？誰負責復原？', 'B2B候選', '尚未實作'],
    ['inbox', '通知與入口', '系統內通知中心', '集中查看待辦、交接與需要確認的事項。', '哪些事件值得通知？如何避免干擾？', 'B2B候選', '尚未實作'],
    ['line', '通知與入口', 'LINE／共用入口', '討論從共用入口查詢或收集哪些資訊。', '誰管理帳號、權限與資料來源？需先核對可行性。', '會議待核整合', '未串接'],
    ['email-calendar', '通知與入口', 'Email／行事曆整合', '評估既有信箱與行事曆的讀寫需求。', '使用何種平台？需要唯讀還是寫入？', 'B2B候選', '未串接'],
    ['ai-summary', 'AI與資料整合', 'AI 往來摘要與待辦建議', '評估把指定紀錄整理成可人工確認的摘要。', '哪些資料可用？誰審查錯誤與建議？', 'B2B候選', '未串接'],
    ['brain', 'AI與資料整合', '企業大腦／Cyber Beasts 資料查詢', '示意知識查詢方向，來源與權限待核。', '要查哪些資料？Cyber Beasts 的介接與授權誰確認？', '會議待核整合', '未串接'],
    ['api', 'AI與資料整合', '外部系統資料交換', '確認必要資料來源、更新頻率與介接責任。', '有哪些API或匯出檔？資料主檔由哪個系統維護？', 'B2B候選', '未串接'],
    ['leads', '潛在客戶與行銷', '潛在客戶／線索管理', '集中收集展會、網站或業務開發的潛在客戶。', '', 'B2B候選', '尚未實作'],
    ['lead-routing', '潛在客戶與行銷', '線索資格評估與分派', '依條件評估線索，分配給對應業務並轉為商機。', '', 'B2B候選', '尚未實作'],
    ['campaigns', '潛在客戶與行銷', '行銷活動與成效追蹤', '關聯活動、客戶及商機，查看活動帶來的後續成果。', '', 'B2B候選', '尚未實作'],
    ['email-campaigns', '潛在客戶與行銷', '批次 Email 與郵件範本', '依授權名單使用範本溝通並追蹤回應；需確認同意與退訂規則。', '', 'B2B候選', '尚未實作'],
    ['service-tickets', '客戶服務與回訪', '客戶服務工單', '管理客戶提出的服務問題、負責人及處理進度。', '', 'B2B候選', '尚未實作'],
    ['complaints', '客戶服務與回訪', '客訴與處理歷程', '留下客訴原因、處理方式、交接及結案紀錄。', '', 'B2B候選', '尚未實作'],
    ['service-sla', '客戶服務與回訪', '服務回覆時限與升級', '依問題等級設定回覆期限，逾時提醒或交主管處理。', '', 'B2B候選', '尚未實作'],
    ['renewals', '客戶服務與回訪', '定期回訪與續約提醒', '追蹤客戶服務後回訪、合作到期與續約時程。', '', 'B2B候選', '尚未實作'],
    ['workflow', '追蹤與協作', '流程自動化規則', '依狀態或條件自動建立待辦、指派與提醒。', '', 'B2B候選', '尚未實作'],
    ['approvals', '追蹤與協作', '審核與簽核流程', '對重要異動、交接或特定業務流程設定確認關卡。', '', 'B2B候選', '尚未實作'],
    ['mobile', '拜訪與往來', '手機與外勤操作', '手機可查看企業、案件與往來，現場快速留下 Memo。', '', 'B2B候選', '可試用', 'home'],
    ['global-search', '資料與匯入', '全站搜尋', '跨企業、聯絡人、案件、紀錄及文件查找資訊。', '', 'B2B候選', '尚未實作'],
    ['dashboards', '主管與報表', '自訂儀表板', '按角色配置業務活動、商機及服務指標的檢視畫面。', '', 'B2B候選', '尚未實作'],
    ['products', '案件與商機', '型錄產品多選或未定', '依提供的型錄選擇產品系列，支援多選或未定；正式料號與庫存尚未對接。', '', '會議確認', '可試用'],
    ['erp', '本期排程與財務預留', 'CRM 成交建單與 ERP 串接', 'CRM 建單後送 ERP，寫入後人工核對；建單與庫存查詢分開估工。', '待 ERP API、料號對照與技術對口。', '會議確認', '本期排程／未串接'],
    ['quotation', '本期排程與財務預留', 'CRM 報價、主管審核與 PDF', '本機可試草稿、業務確認、主管模擬核准及測試 PDF；正式範本與伺服器授權未完成。不依賴 ERP 開報價。', '待報價樣式、價格規則與核准細節。', '會議確認', '合成流程可試'],
    ['cost-profit', '本期排程與財務預留', '原料、工班、運費與附屬成本欄位', '先預留資料結構，不做尚未確認的成本、利潤或抽成公式。', '資料來源與責任待確認。', '會議確認', '欄位設計／未實作'],
    ['payment', '本期排程與財務預留', '分階段獎金與收款欄位預留', '保留訂金、發票、收款等資料，實際獎金規則與追款責任待提供。', '不預設比例或自動結算。', '會議確認', '欄位設計／未實作']
  ].map(([id, group, name, description, question, origin, status, page]) => ({ id, group, name, description, question, origin, status, page }));
  function emptySelections() {
    return Object.fromEntries(FEATURES.map(f => [f.id, { decision: '', priority: '', role: '', note: '', updatedAt: null }]));
  }
  function selection(input) {
    if (!input || typeof input !== 'object' || !FEATURE_DECISIONS.includes(input.decision) || !PRIORITIES.includes(input.priority)) throw new Error('未知功能選擇或優先順序');
    return { decision: input.decision, priority: input.priority, role: String(input.role || '').slice(0, 200), note: String(input.note || '').slice(0, 2000), updatedAt: new Date().toISOString() };
  }
  function normalizeState(state) {
    state.featureSelections = { ...emptySelections(), ...(state.featureSelections || {}) };
    if (state.quotes === undefined) state.quotes = [];
    if (!Array.isArray(state.followUps)) {
      state.followUps = [];
      for (const item of state.cases) {
        if (!item.nextAction?.trim()) continue;
        const memo = state.memos.filter(m => m.caseId === item.id).sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))[0];
        const matches = memo?.nextAction === item.nextAction && memo.nextOwnerId === item.nextOwnerId && (memo.dueDate || '') === (item.dueDate || '');
        const step = { id: 'legacy-' + item.id, companyId: item.companyId, caseId: item.id, memoId: matches ? memo.id : '', title: item.nextAction, ownerId: item.nextOwnerId, dueDate: item.dueDate || '', active: true };
        state.followUps.push(step);
        if (matches) memo.followUpIds = [step.id];
      }
      for (const memo of state.memos.filter(item => !item.caseId && item.nextAction?.trim())) {
        const step = { id: 'legacy-memo-' + memo.id, companyId: memo.companyId, caseId: '', memoId: memo.id, title: memo.nextAction, ownerId: memo.nextOwnerId, dueDate: memo.dueDate || '', active: true };
        state.followUps.push(step);
        memo.followUpIds = [step.id];
      }
    }
    return state;
  }
  function saveFeature(state, id, input) {
    if (!FEATURES.some(f => f.id === id)) throw new Error('未知功能');
    const value = selection(input);
    normalizeState(state); state.featureSelections[id] = value;
  }
  function feedbackCSV(state) {
    const cell = value => {
      let text = String(value || '');
      if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
      return '"' + text.replace(/"/g, '""') + '"';
    };
    const rows = [['類型', '群組', '功能', '目前狀態', '需求判斷', '優先順序', '使用角色', '說明／意見', '更新時間']];
    for (const f of FEATURES) { const r = state.featureSelections?.[f.id] || {}; rows.push(['功能選擇', f.group, f.name, f.status, r.decision || '尚未選擇', r.priority || '尚未排序', r.role, r.note, r.updatedAt]); }
    for (const m of MODULES) { const r = state.reviews[m.id] || {}; rows.push(['原型評審', m.kind, m.name, m.flow, r.decision || '尚未評審', '', r.role, r.note, r.updatedAt]); }
    return '\uFEFF' + rows.map(r => r.map(cell).join(',')).join('\r\n');
  }
  function seed() {
    return normalizeState({
      schemaVersion: 1,
      updatedAt: null,
      users: [
        { id: 'u1', name: '示範業務 A', role: 'sales' },
        { id: 'u2', name: '示範業務 B', role: 'sales' },
        { id: 'u3', name: '示範主管', role: 'supervisor' }
      ],
      companies: [
        { id: 'co1', name: '青禾商用空間', ownerId: 'u1', category: '示範企業', note: '合成情境：了解商用空間的服務需求。' },
        { id: 'co2', name: '北辰設施管理', ownerId: 'u2', category: '示範企業', note: '合成情境：多個場域的往來紀錄與交接。' },
        { id: 'co3', name: '朗日居家通路', ownerId: 'u1', category: '示範企業', note: '合成情境：通路窗口的需求確認。' },
        { id: 'co4', name: '澄川工程團隊', ownerId: 'u2', category: '示範企業', note: '合成情境：工程窗口與現場條件確認。' }
      ],
      contacts: [
        { id: 'ct1', companyId: 'co1', name: '示範聯絡人 A', contactMethod: '測試電話（未填號碼）', ownerId: 'u1', title: '採購窗口' },
        { id: 'ct2', companyId: 'co1', name: '示範聯絡人 B', contactMethod: '測試信箱（未填地址）', ownerId: 'u1', title: '場域窗口' },
        { id: 'ct3', companyId: 'co2', name: '示範聯絡人 C', contactMethod: '測試電話（未填號碼）', ownerId: 'u2', title: '管理窗口' },
        { id: 'ct4', companyId: 'co3', name: '示範聯絡人 D', contactMethod: '聯絡方式待確認', ownerId: 'u1', title: '通路窗口' },
        { id: 'ct5', companyId: 'co4', name: '示範聯絡人 E', contactMethod: '聯絡方式待確認', ownerId: 'u2', title: '工程窗口' }
      ],
      cases: [
        { id: 'ca1', companyId: 'co1', title: '商用空間服務需求確認', status: '進行中', lastContactAt: '2026-10-13T10:30:00+08:00', nextAction: '確認現場條件與拜訪時段', nextOwnerId: 'u1', dueDate: '2026-10-14' },
        { id: 'ca2', companyId: 'co2', title: '場域資料與窗口交接', status: '待回覆', lastContactAt: '2026-10-12T14:00:00+08:00', nextAction: '追蹤窗口補充的場域資料', nextOwnerId: 'u2', dueDate: '2026-10-14' },
        { id: 'ca3', companyId: 'co3', title: '通路服務流程討論', status: '需求確認', lastContactAt: '2026-10-13T09:00:00+08:00', nextAction: '整理通路常見問題與分工', nextOwnerId: 'u1', dueDate: '2026-10-15' },
        { id: 'ca4', companyId: 'co4', title: '現場確認與紀錄歸檔', status: '已完成', lastContactAt: '2026-10-11T16:00:00+08:00', nextAction: '本次討論結束，紀錄留存', nextOwnerId: 'u2', dueDate: '' }
      ],
      memos: [
        { id: 'm1', companyId: 'co1', contactId: 'ct1', caseId: 'ca1', authorId: 'u1', occurredAt: '2026-10-12T11:00:00+08:00', summary: '窗口希望先釐清服務範圍；已記錄目前場域的初步需求。', nextAction: '向場域窗口確認現場條件', nextOwnerId: 'u1', channel: '電話', dueDate: '2026-10-13' },
        { id: 'm2', companyId: 'co1', contactId: 'ct2', caseId: 'ca1', authorId: 'u1', occurredAt: '2026-10-13T10:30:00+08:00', summary: '場域窗口已說明進場限制，希望先確認可拜訪的時段，再安排後續討論。', nextAction: '確認現場條件與拜訪時段', nextOwnerId: 'u1', channel: '拜訪', dueDate: '2026-10-14' },
        { id: 'm3', companyId: 'co2', contactId: 'ct3', caseId: 'ca2', authorId: 'u2', occurredAt: '2026-10-12T14:00:00+08:00', summary: '已完成第一次需求交流，尚待窗口補充場域資料。下一位接手可從本紀錄開始。', nextAction: '追蹤窗口補充的場域資料', nextOwnerId: 'u2', channel: '電話', dueDate: '2026-10-14' },
        { id: 'm4', companyId: 'co3', contactId: 'ct4', caseId: 'ca3', authorId: 'u1', occurredAt: '2026-10-13T09:00:00+08:00', summary: '已提供流程說明，目前等待對方確認合作需求。下一位接手可依時間序了解完整脈絡。', nextAction: '整理通路常見問題與分工', nextOwnerId: 'u1', channel: '線上會議', dueDate: '2026-10-15' },
        { id: 'm6', companyId: 'co3', contactId: 'ct4', caseId: 'ca3', authorId: 'u1', occurredAt: '2026-10-10T09:00:00+08:00', summary: '第一次交流，窗口提出希望釐清合作與服務分工。', nextAction: '整理初步合作需求', nextOwnerId: 'u1', channel: '電話', dueDate: '2026-10-11' },
        { id: 'm7', companyId: 'co3', contactId: 'ct4', caseId: 'ca3', authorId: 'u1', occurredAt: '2026-10-11T15:00:00+08:00', summary: '已向窗口提供示範流程說明，請對方整理需補充的條件。', nextAction: '追蹤對方回覆與合作需求', nextOwnerId: 'u1', channel: '線上會議', dueDate: '2026-10-13' },
        { id: 'm5', companyId: 'co4', contactId: 'ct5', caseId: 'ca4', authorId: 'u2', occurredAt: '2026-10-11T16:00:00+08:00', summary: '本次現場條件已確認，窗口已收到本次討論的重點摘要。', nextAction: '本次討論結束，紀錄留存', nextOwnerId: 'u2', channel: '拜訪', dueDate: '' }
      ],
      featureSelections: emptySelections(),
      reviews: Object.fromEntries(MODULES.map(m => [m.id, { decision: '', role: '', note: '', updatedAt: null }]))
    });
  }
  function clone(data) { return JSON.parse(JSON.stringify(data)); }
  function required(value, label) {
    if (typeof value !== 'string' || !value.trim()) throw new Error('請填寫' + label);
    if (value.length > 2000) throw new Error(label + '過長（上限 2,000 字）');
    return value.trim();
  }
  function shortText(value, limit, label) {
    if (value === undefined || value === '') return '';
    if (typeof value !== 'string' || value.length > limit) throw new Error(label + '格式錯誤或過長（上限 ' + limit + ' 字）');
    return value.trim();
  }
  function productSelection(value) {
    if (value === undefined) return [];
    if (!Array.isArray(value) || new Set(value).size !== value.length || !value.every(id => CATALOG_PRODUCTS.some(product => product.id === id))) throw new Error('請選擇有效的型錄產品，或保留未定');
    return [...value];
  }
  function simulateCheckIn(scenario = 'success') {
    if (!['success', 'permission-denied', 'timeout', 'unsupported'].includes(scenario)) throw new Error('未知定位測試情境');
    return { mode: 'synthetic', status: scenario, attemptedAt: new Date().toISOString(), position: scenario === 'success' ? { latitude: 25, longitude: 121.5, accuracyMeters: 20 } : null };
  }
  function checkInValue(value, channel) {
    if (value === undefined || value === null) return null;
    if (channel !== '拜訪') throw new Error('定位測試只可關聯現場拜訪記事');
    if (value.mode !== 'synthetic' || !['success', 'permission-denied', 'timeout', 'unsupported'].includes(value.status) || !Number.isFinite(Date.parse(value.attemptedAt))) throw new Error('請使用有效的合成定位測試資料');
    const point = value.position;
    if (value.status === 'success') {
      if (!point || typeof point.latitude !== 'number' || !Number.isFinite(point.latitude) || Math.abs(point.latitude) > 90 || typeof point.longitude !== 'number' || !Number.isFinite(point.longitude) || Math.abs(point.longitude) > 180 || typeof point.accuracyMeters !== 'number' || !Number.isFinite(point.accuracyMeters) || point.accuracyMeters < 0) throw new Error('合成定位座標或精度無效');
    } else if (point !== null) throw new Error('失敗的定位測試不可保留座標');
    return { mode: 'synthetic', status: value.status, attemptedAt: value.attemptedAt, position: point ? { latitude: point.latitude, longitude: point.longitude, accuracyMeters: point.accuracyMeters } : null };
  }
  function prepareContact(state, company, input) {
    reference(state.users, input.ownerId || company.ownerId, '負責業務');
    return { id: newId('ct'), companyId: company.id, name: required(shortText(input.name, 120, '聯絡人名稱'), '聯絡人名稱'), contactMethod: shortText(input.contactMethod, 200, '聯絡方式') || '聯絡方式待補', ownerId: input.ownerId || company.ownerId, title: shortText(input.title, 120, '窗口角色') || '角色待補' };
  }
  function reference(list, id, label) {
    const value = list.find(x => x.id === id);
    if (!value) throw new Error(label + '不存在，請重新選擇');
    return value;
  }
  function newId(prefix) { return prefix + '-' + (root.crypto?.randomUUID?.() || Date.now() + '-' + Math.random().toString(36).slice(2)); }
  function validDate(value) {
    if (value === undefined || value === '') return true;
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  }
  function prepareSteps(state, input, limit = 50) {
    const entries = input.nextSteps === undefined ? (input.nextAction?.trim() ? [{ title: input.nextAction, ownerId: input.nextOwnerId, dueDate: input.dueDate || '' }] : []) : input.nextSteps;
    if (!Array.isArray(entries) || entries.length > limit) throw new Error('下一步格式錯誤（每次上限 ' + limit + ' 筆）');
    const ids = new Set();
    return entries.map(entry => {
      if (!entry || typeof entry !== 'object') throw new Error('下一步格式錯誤');
      const title = required(entry.title, '下一步內容');
      reference(state.users, entry.ownerId, '下一步負責人');
      if (!validDate(entry.dueDate)) throw new Error('請填寫有效的下一步日期');
      if (entry.id && (typeof entry.id !== 'string' || ids.has(entry.id))) throw new Error('下一步識別碼重複或無效');
      if (entry.id) ids.add(entry.id);
      return { id: entry.id || newId('step'), title, ownerId: entry.ownerId, dueDate: entry.dueDate || '' };
    });
  }
  function caseFollowUps(state, caseId) { return (state.followUps || []).filter(step => step.caseId === caseId && step.active); }
  function memoFollowUps(state, memo) {
    if (Array.isArray(memo.followUpIds)) return memo.followUpIds.map(id => state.followUps.find(step => step.id === id)).filter(Boolean);
    return memo.nextAction ? [{ title: memo.nextAction, ownerId: memo.nextOwnerId, dueDate: memo.dueDate || '', active: true, legacy: true }] : [];
  }
  // Retain the old summary fields for existing saved data and integrations with this prototype.
  function syncCaseSummary(state, item) {
    const first = caseFollowUps(state, item.id)[0];
    Object.assign(item, { nextAction: first?.title || '', nextOwnerId: first?.ownerId || state.companies.find(co => co.id === item.companyId).ownerId, dueDate: first?.dueDate || '' });
  }
  function addMemo(state, input) {
    const company = reference(state.companies, input.companyId, '企業');
    if (input.createContact && input.contactId) throw new Error('請選既有聯絡人或新增聯絡人其中一種');
    const contact = input.createContact ? prepareContact(state, company, input.newContact || {}) : reference(state.contacts, input.contactId, '聯絡人');
    if (contact.companyId !== company.id) throw new Error('聯絡人必須屬於所選企業');
    let linked = input.caseId ? reference(state.cases, input.caseId, '案件') : null;
    if (linked && linked.companyId !== company.id) throw new Error('案件必須屬於所選企業');
    reference(state.users, input.authorId, '紀錄人');
    if (!input.occurredAt || !Number.isFinite(Date.parse(input.occurredAt))) throw new Error('請填寫有效的聯繫時間');
    const steps = prepareSteps(state, input);
    if (steps.some(step => (state.followUps || []).some(existing => existing.id === step.id))) throw new Error('新記事不可覆寫既有下一步');
    if (input.createCase) {
      if (linked) throw new Error('請選擇建立商機或關聯既有案件其中一種');
      linked = { id: newId('ca'), companyId: company.id, title: required(input.newCaseTitle, '案件名稱'), productIds: productSelection(input.productIds), status: '需求確認', lastContactAt: null, nextAction: '', nextOwnerId: company.ownerId, dueDate: '' };
    }
    const memo = {
      id: newId('m'),
      companyId: company.id, contactId: contact.id, caseId: linked?.id || '', authorId: input.authorId,
      occurredAt: input.occurredAt, summary: required(input.summary, '往來重點'), category: shortText(input.category, 120, '記事類別'),
      nextAction: steps[0]?.title || '', nextOwnerId: steps[0]?.ownerId || input.authorId,
      channel: required(input.channel, '聯繫方式'), dueDate: steps[0]?.dueDate || '', followUpIds: steps.map(step => step.id), checkIn: checkInValue(input.checkIn, input.channel)
    };
    normalizeState(state);
    if (input.createContact) state.contacts.push(contact);
    if (input.createCase) state.cases.push(linked);
    const additions = steps.map(step => ({ ...step, companyId: company.id, memoId: memo.id, caseId: memo.caseId, active: true }));
    if (linked?.lastContactAt && Date.parse(memo.occurredAt) < Date.parse(linked.lastContactAt)) state.followUps.push(...additions);
    else state.followUps.unshift(...additions);
    state.memos.unshift(memo);
    if (linked && (!linked.lastContactAt || Date.parse(memo.occurredAt) >= Date.parse(linked.lastContactAt))) {
      linked.lastContactAt = memo.occurredAt;
      syncCaseSummary(state, linked);
    }
    return memo;
  }
  function updateCase(state, id, input) {
    const item = reference(state.cases, id, '案件');
    if (!STATUSES.includes(input.status)) throw new Error('請選擇有效的案件進度');
    const productIds = productSelection(input.productIds === undefined ? item.productIds : input.productIds);
    const steps = prepareSteps(state, input, 1000);
    for (const step of steps) {
      const existing = (state.followUps || []).find(value => value.id === step.id);
      if (existing && (existing.caseId !== id || !existing.active)) throw new Error('下一步必須屬於此案件且仍在追蹤');
      if (input.nextSteps?.some(value => value.id === step.id) && !existing) throw new Error('既有下一步不存在');
    }
    normalizeState(state);
    const submitted = new Set(steps.map(step => step.id));
    for (const old of state.followUps.filter(step => step.caseId === id && step.active)) { if (!submitted.has(old.id)) old.active = false; }
    for (const step of steps) {
      const existing = state.followUps.find(value => value.id === step.id);
      if (existing) Object.assign(existing, step);
      else state.followUps.push({ ...step, companyId: item.companyId, caseId: id, memoId: '', active: true });
    }
    item.status = input.status;
    item.productIds = productIds;
    syncCaseSummary(state, item);
    return item;
  }
  function addCompany(state, input) {
    reference(state.users, input.ownerId, '負責業務');
    const item = { id: 'co-' + Date.now() + '-' + Math.random().toString(36).slice(2), name: required(input.name, '示範企業名稱'), ownerId: input.ownerId, category: shortText(input.category, 120, '客戶分類') || '未分類', note: '使用者新增的合成情境。' };
    state.companies.push(item);
    return item;
  }
  function addContact(state, input) {
    const company = reference(state.companies, input.companyId, '企業');
    const item = prepareContact(state, company, input);
    state.contacts.push(item);
    return item;
  }
  function updateCompanyCategory(state, id, value) {
    const item = reference(state.companies, id, '企業');
    item.category = shortText(value, 120, '客戶分類') || '未分類';
    return item;
  }
  function addCase(state, input) {
    const company = reference(state.companies, input.companyId, '企業');
    if (!STATUSES.includes(input.status)) throw new Error('請選擇有效的案件進度');
    const steps = prepareSteps(state, input);
    if (input.nextSteps?.some(step => step.id)) throw new Error('新案件不可使用既有下一步識別碼');
    const item = { id: newId('ca'), companyId: input.companyId, title: required(input.title, '案件名稱'), productIds: productSelection(input.productIds), lastContactAt: null, status: input.status, nextAction: '', nextOwnerId: company.ownerId, dueDate: '' };
    normalizeState(state);
    state.cases.push(item);
    state.followUps.push(...steps.map(step => ({ ...step, companyId: item.companyId, caseId: item.id, memoId: '', active: true })));
    syncCaseSummary(state, item);
    return item;
  }
  function linkMemo(state, memoId, caseId) {
    const memo = reference(state.memos, memoId, '記事');
    const item = reference(state.cases, caseId, '案件');
    if (memo.companyId !== item.companyId) throw new Error('記事與案件必須屬於同一企業');
    if (memo.caseId && memo.caseId !== caseId) throw new Error('記事已關聯其他案件，請保留原關聯');
    const legacySteps = !Array.isArray(memo.followUpIds) ? prepareSteps(state, memo) : [];
    normalizeState(state);
    if (!Array.isArray(memo.followUpIds)) {
      const steps = legacySteps;
      memo.followUpIds = steps.map(step => step.id);
      state.followUps.push(...steps.map(step => ({ ...step, companyId: memo.companyId, memoId, caseId: '', active: true })));
    }
    memo.caseId = caseId;
    for (const id of memo.followUpIds) state.followUps.find(step => step.id === id).caseId = caseId;
    if (!item.lastContactAt || Date.parse(memo.occurredAt) > Date.parse(item.lastContactAt)) item.lastContactAt = memo.occurredAt;
    syncCaseSummary(state, item);
    return memo;
  }
  function createCaseFromMemo(state, memoId, title, productIds = []) {
    const memo = reference(state.memos, memoId, '記事');
    if (memo.caseId) throw new Error('記事已有關聯案件');
    const copy = clone(state);
    const item = addCase(copy, { companyId: memo.companyId, title, productIds, status: '需求確認', nextSteps: [] });
    linkMemo(copy, memoId, item.id);
    Object.assign(state, copy);
    return item;
  }
  function decimalUnits(value, precision, label) {
    const text = typeof value === 'number' ? String(value) : value;
    if (typeof text !== 'string' || !new RegExp('^(0|[1-9]\\d{0,8})(\\.\\d{1,' + precision + '})?$').test(text)) throw new Error(label + '格式錯誤');
    const [whole, fraction = ''] = text.split('.');
    return BigInt(whole) * 10n ** BigInt(precision) + BigInt(fraction.padEnd(precision, '0'));
  }
  function prepareQuote(input) {
    const title = required(shortText(input.title, 200, '報價名稱'), '報價名稱');
    const currency = shortText(input.currency, 3, '測試幣別');
    if (!/^[A-Z]{3}$/.test(currency)) throw new Error('請填寫三碼測試幣別');
    if (!validDate(input.validUntil)) throw new Error('報價有效日期無效');
    if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 50) throw new Error('測試報價需有 1 至 50 個品項');
    const items = input.items.map(item => {
      if (!item || typeof item !== 'object') throw new Error('報價品項格式錯誤');
      const quantity = decimalUnits(item.quantity, 3, '數量'), price = decimalUnits(item.unitPrice, 2, '測試單價');
      if (quantity <= 0n) throw new Error('數量需大於零');
      const amountMinor = ((quantity * price + 500n) / 1000n).toString();
      return { description: required(shortText(item.description, 200, '品項說明'), '品項說明'), quantity: String(item.quantity), unit: shortText(item.unit, 20, '單位') || '式', unitPrice: String(item.unitPrice), amountMinor };
    });
    return { title, currency, validUntil: input.validUntil || '', note: shortText(input.note, 2000, '測試備註'), items, totalMinor: items.reduce((sum, item) => sum + BigInt(item.amountMinor), 0n).toString() };
  }
  function quoteActor(state, id) { return reference(state.users, id, '測試角色'); }
  function quoteRecord(state, id) { return reference(state.quotes || [], id, '報價'); }
  function quoteEvent(quote, action, actorId, extra = {}) { return { action, actorId, version: quote.version, at: new Date().toISOString(), testOnly: true, ...extra }; }
  function createQuote(state, input, actorId) {
    const actor = quoteActor(state, actorId);
    if (actor.role !== 'sales') throw new Error('此測試情境由示範業務建立草稿');
    const item = reference(state.cases, input.caseId, '案件');
    const prepared = prepareQuote(input);
    const quote = { id: newId('quote'), caseId: item.id, companyId: item.companyId, createdBy: actorId, testOnly: true, version: 1, status: '草稿', ...prepared, salesConfirmation: null, review: null, history: [], revisions: [] };
    quote.history.push(quoteEvent(quote, '建立草稿', actorId));
    normalizeState(state); state.quotes.unshift(quote);
    return quote;
  }
  function updateQuote(state, id, input, actorId) {
    const quote = quoteRecord(state, id), actor = quoteActor(state, actorId);
    if (actor.role !== 'sales' || quote.createdBy !== actorId) throw new Error('此測試情境限建立草稿的業務修改');
    const prepared = prepareQuote(input);
    const { history, revisions, ...snapshot } = quote;
    revisions.push(clone(snapshot));
    Object.assign(quote, prepared, { version: quote.version + 1, status: '草稿', salesConfirmation: null, review: null });
    history.push(quoteEvent(quote, '修改後重新確認', actorId));
    return quote;
  }
  function confirmQuote(state, id, actorId) {
    const quote = quoteRecord(state, id), actor = quoteActor(state, actorId);
    if (actor.role !== 'sales' || quote.createdBy !== actorId) throw new Error('此測試情境限建立草稿的業務確認');
    if (quote.status !== '草稿') throw new Error('請先保存草稿再送主管審核');
    prepareQuote(quote);
    quote.salesConfirmation = { actorId, version: quote.version, at: new Date().toISOString(), testOnly: true };
    quote.status = '待主管審核';
    quote.history.push(quoteEvent(quote, '業務確認並送審', actorId));
    return quote;
  }
  function reviewQuote(state, id, actorId, decision, reason = '') {
    const quote = quoteRecord(state, id), actor = quoteActor(state, actorId);
    if (actor.role !== 'supervisor' || actorId === quote.createdBy) throw new Error('此測試情境需由示範主管審核');
    if (quote.status !== '待主管審核' || quote.salesConfirmation?.version !== quote.version) throw new Error('需先完成目前版本的業務確認');
    if (!['approve', 'return'].includes(decision)) throw new Error('未知審核決定');
    const note = shortText(reason, 1000, '審核說明');
    if (decision === 'return' && !note) throw new Error('請填寫測試退回原因');
    quote.review = { actorId, version: quote.version, decision, reason: note, at: new Date().toISOString(), testOnly: true };
    quote.status = decision === 'approve' ? '已核准' : '退回修改';
    quote.history.push(quoteEvent(quote, decision === 'approve' ? '主管模擬核准' : '主管退回修改', actorId, { reason: note }));
    return quote;
  }
  function validQuote(state, quote) {
    try {
      const item = reference(state.cases, quote.caseId, '案件'), creator = quoteActor(state, quote.createdBy);
      if (quote.testOnly !== true || quote.companyId !== item.companyId || creator.role !== 'sales' || !QUOTE_STATUSES.includes(quote.status) || !Number.isInteger(quote.version) || quote.version < 1 || !Array.isArray(quote.history) || !Array.isArray(quote.revisions)) return false;
      const prepared = prepareQuote(quote);
      if (prepared.totalMinor !== quote.totalMinor || !prepared.items.every((row, index) => row.amountMinor === quote.items[index].amountMinor)) return false;
      if (quote.status === '草稿') return quote.salesConfirmation === null && quote.review === null;
      const confirm = quote.salesConfirmation;
      if (!confirm || confirm.actorId !== quote.createdBy || confirm.version !== quote.version || confirm.testOnly !== true || !Number.isFinite(Date.parse(confirm.at))) return false;
      if (quote.status === '待主管審核') return quote.review === null;
      const review = quote.review;
      return !!review && review.testOnly === true && review.version === quote.version && review.actorId !== quote.createdBy && quoteActor(state, review.actorId).role === 'supervisor' && Number.isFinite(Date.parse(review.at)) && (quote.status === '已核准' ? review.decision === 'approve' : review.decision === 'return' && !!review.reason);
    } catch { return false; }
  }
  function formatQuoteMoney(value) {
    if (!/^\d+$/.test(String(value))) throw new Error('測試金額格式無效');
    const digits = String(value).padStart(3, '0');
    return digits.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + digits.slice(-2);
  }
  function approvedQuoteData(state, id, actorId) {
    const quote = quoteRecord(state, id), actor = quoteActor(state, actorId);
    if (!validQuote(state, quote) || quote.status !== '已核准') throw new Error('目前版本尚未核准，不可下載測試 PDF');
    if (actor.role !== 'supervisor' && actor.id !== quote.createdBy) throw new Error('此測試情境不允許此業務下載');
    return { ...clone(quote), companyName: reference(state.companies, quote.companyId, '企業').name, caseTitle: reference(state.cases, quote.caseId, '案件').title, salesName: quoteActor(state, quote.createdBy).name, reviewerName: quoteActor(state, quote.review.actorId).name, watermark: '測試樣張／範本待確認／不可對外正式報價' };
  }
  function saveReview(state, id, input) {
    if (!MODULES.some(x => x.id === id)) throw new Error('未知評審模組');
    if (!['', '保留', '調整', '不需要'].includes(input.decision)) throw new Error('未知評審狀態');
    state.reviews[id] = { decision: input.decision, role: String(input.role || '').slice(0, 200), note: String(input.note || '').slice(0, 2000), updatedAt: new Date().toISOString() };
  }
  function lastContact(state, companyId) {
    return state.memos.filter(x => x.companyId === companyId).sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))[0]?.occurredAt || null;
  }
  function exportFeedback(state) {
    return { type: 'jucheng-prototype-feedback', schemaVersion: 1, exportedAt: new Date().toISOString(), notice: '需求確認用原型／模擬資料；欄位與功能待確認，並非正式規格。評審僅存在本機，不跨人同步。', reviews: clone(state.reviews), featureSelections: clone(state.featureSelections || emptySelections()), catalogVersion: 1 };
  }
  function importFeedback(state, data) {
    if (data?.type !== 'jucheng-prototype-feedback' || data.schemaVersion !== 1 || !data.reviews || typeof data.reviews !== 'object') throw new Error('請使用本原型匯出的回饋 JSON 檔');
    const copy = clone(state);
    for (const module of MODULES) {
      const review = data.reviews[module.id];
      if (review && typeof review === 'object') saveReview(copy, module.id, review);
    }
    if (data.featureSelections !== undefined) {
      if (!data.featureSelections || typeof data.featureSelections !== 'object' || Array.isArray(data.featureSelections)) throw new Error('功能選擇格式錯誤');
      for (const [id, value] of Object.entries(data.featureSelections)) saveFeature(copy, id, value);
    }
    state.reviews = copy.reviews;
    state.featureSelections = copy.featureSelections || emptySelections();
  }
  function validState(data) {
    if (data?.schemaVersion !== 1 || !['users', 'companies', 'contacts', 'cases', 'memos'].every(k => Array.isArray(data[k]) && data[k].length <= 10000) || !data.reviews) return false;
    try {
      const ids = list => new Set(list.map(x => required(x.id, '識別碼')));
      const users = ids(data.users), companies = ids(data.companies), contacts = ids(data.contacts), cases = ids(data.cases);
      if (users.size !== data.users.length || companies.size !== data.companies.length || contacts.size !== data.contacts.length || cases.size !== data.cases.length) return false;
      if (!data.companies.every(x => typeof x.name === 'string' && users.has(x.ownerId))) return false;
      if (!data.contacts.every(x => typeof x.name === 'string' && typeof x.contactMethod === 'string' && companies.has(x.companyId) && users.has(x.ownerId))) return false;
      if (!data.cases.every(x => typeof x.title === 'string' && typeof x.nextAction === 'string' && STATUSES.includes(x.status) && companies.has(x.companyId) && users.has(x.nextOwnerId))) return false;
      for (const item of data.cases) productSelection(item.productIds);
      for (const memo of data.memos) { shortText(memo.category, 120, '記事類別'); checkInValue(memo.checkIn, memo.channel); }
      if (data.quotes !== undefined && (!Array.isArray(data.quotes) || data.quotes.length > 10000 || ids(data.quotes).size !== data.quotes.length || !data.quotes.every(quote => validQuote(data, quote)))) return false;
      if (data.followUps !== undefined) {
        if (!Array.isArray(data.followUps) || data.followUps.length > 50000) return false;
        const stepIds = ids(data.followUps), memoIds = ids(data.memos);
        if (stepIds.size !== data.followUps.length || memoIds.size !== data.memos.length) return false;
        if (!data.followUps.every(step => typeof step.title === 'string' && !!required(step.title, '下一步') && users.has(step.ownerId) && companies.has(step.companyId) && typeof step.active === 'boolean' && validDate(step.dueDate) && (!step.caseId || cases.has(step.caseId) && data.cases.find(c => c.id === step.caseId).companyId === step.companyId) && (!step.memoId || memoIds.has(step.memoId) && data.memos.find(m => m.id === step.memoId).companyId === step.companyId && data.memos.find(m => m.id === step.memoId).caseId === step.caseId && data.memos.find(m => m.id === step.memoId).followUpIds?.includes(step.id)))) return false;
        if (!data.memos.every(memo => memo.followUpIds === undefined || Array.isArray(memo.followUpIds) && new Set(memo.followUpIds).size === memo.followUpIds.length && memo.followUpIds.every(id => stepIds.has(id) && data.followUps.find(step => step.id === id).memoId === memo.id))) return false;
      } else if (data.memos.some(memo => memo.followUpIds !== undefined)) return false;
      if (data.featureSelections !== undefined) {
        if (!data.featureSelections || typeof data.featureSelections !== 'object' || Array.isArray(data.featureSelections)) return false;
        for (const [id, value] of Object.entries(data.featureSelections)) { if (!FEATURES.some(f => f.id === id)) return false; selection(value); }
      }
      return data.memos.every(x => typeof x.summary === 'string' && typeof x.nextAction === 'string' && Number.isFinite(Date.parse(x.occurredAt)) && companies.has(x.companyId) && contacts.has(x.contactId) && users.has(x.authorId) && users.has(x.nextOwnerId) && (!x.caseId || cases.has(x.caseId)) && data.contacts.find(c => c.id === x.contactId).companyId === x.companyId && (!x.caseId || data.cases.find(c => c.id === x.caseId).companyId === x.companyId));
    } catch { return false; }
  }
  const api = { FEATURES, FEATURE_DECISIONS, PRIORITIES, normalizeState, saveFeature, feedbackCSV, STORAGE_KEY, STATUSES, CATALOG_PRODUCTS, MEMO_CATEGORY_EXAMPLES, QUOTE_STATUSES, MODULES, seed, clone, addMemo, updateCase, addCompany, addContact, updateCompanyCategory, addCase, caseFollowUps, memoFollowUps, linkMemo, createCaseFromMemo, simulateCheckIn, checkInValue, createQuote, updateQuote, confirmQuote, reviewQuote, approvedQuoteData, formatQuoteMoney, saveReview, lastContact, exportFeedback, importFeedback, validState };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CRM = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
