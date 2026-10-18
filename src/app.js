(function () {
  'use strict';
  const M = window.CRM;
  const app = document.querySelector('#app');
  const dialog = document.querySelector('#dialog');
  const labels = { home: '工作總覽', company: '企業與聯絡人', case: '案件進度', memo: '往來紀錄', quote: '報價流程', review: '功能大全' };
  let state = M.seed(), storageOk = true, storageMessage = '', page = 'home', selectedCompany = 'co1', role = 'u1', filter = '', scope = 'mine', companyDetailOpen = false, caseFilter = 'all', homeQuery = '', companyScroll = 0, catalogGroup = 'all', catalogQuery = '';
  try {
    const raw = localStorage.getItem(M.STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (M.validState(parsed)) state = M.normalizeState(parsed);
      else storageMessage = '舊的本機資料格式無法讀取，已載入示範資料；重新保存後會取代舊版。';
    }
  } catch { storageOk = false; storageMessage = '此瀏覽器無法保存資料，操作僅保留於本次開啟期間。'; }
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const user = id => state.users.find(x => x.id === id)?.name || '待指派';
  const company = id => state.companies.find(x => x.id === id)?.name || '企業待確認';
  const contact = id => state.contacts.find(x => x.id === id)?.name || '未關聯聯絡人';
  const date = value => value ? new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)) : '尚無紀錄';
  const userOptions = id => state.users.map(u => `<option value="${u.id}" ${id === u.id ? 'selected' : ''}>${u.name}</option>`).join('');
  const companyOptions = id => state.companies.map(c => `<option value="${c.id}" ${id === c.id ? 'selected' : ''}>${esc(c.name)}（模擬）</option>`).join('');
  const stateOptions = status => M.STATUSES.map(s => `<option ${s === status ? 'selected' : ''}>${s}</option>`).join('');
  const pill = status => `<span class="pill status-${M.STATUSES.indexOf(status)}">${esc(status)}</span>`;
  let memoCheckIn = null;
  const checkInLabels = {success:'合成定位成功', 'permission-denied':'模擬拒絕權限', timeout:'模擬逾時', unsupported:'模擬裝置不支援'};
  const icons = {
    home: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    company: '<path d="M4 21V5h12v16M16 11h4v10M8 9h4M8 13h4M8 17h4M2 21h20"/>',
    case: '<rect x="3" y="6" width="18" height="15" rx="2"/><path d="M8 6V3h8v3M3 12h18M10 12v3h4v-3"/>',
    memo: '<path d="M5 3h14v18H5zM8 7h8M8 11h8M8 15h5"/>',
    quote: '<path d="M5 3h14v18H5zM8 8h8M8 12h8M8 16h4"/>',
    review: '<path d="M9 4h6l1 3h4v14H4V7h4zM8 12l2 2 5-5M8 18h8"/>',
    arrow: '<path d="M5 12h14M14 7l5 5-5 5"/>', plus: '<path d="M12 5v14M5 12h14"/>', check: '<path d="M5 12l4 4L19 6"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.arrow}</svg>`;
  function toast(text) {
    const node = document.querySelector('#toast'); node.textContent = text; node.classList.add('show');
    clearTimeout(toast.timer); toast.timer = setTimeout(() => node.classList.remove('show'), 4200);
  }
  function persist() {
    state.updatedAt = new Date().toISOString();
    try { localStorage.setItem(M.STORAGE_KEY, JSON.stringify(state)); storageOk = true; }
    catch { storageOk = false; storageMessage = '本機保存失敗，操作僅保留於本次開啟期間。'; toast(storageMessage); }
    const badge = document.querySelector('#save-state');
    if (badge) badge.textContent = storageOk ? '已存於此瀏覽器' : '本次操作尚未保存';
  }
  function visibleCases() { return state.cases.filter(c => scope !== 'mine' || M.caseFollowUps(state, c.id).some(step => step.ownerId === role)); }
  function filtered(list, getter) { const q = filter.trim().toLowerCase(); return list.filter(x => !q || getter(x).toLowerCase().includes(q)); }
  function empty(text, action = '') { return `<div class="empty">${icon('memo')}<b>${text}</b><p>調整篩選條件，或新增一筆模擬情境試用。</p>${action}</div>`; }
  function stepSummary(item) {
    const steps = M.caseFollowUps(state, item.id);
    return steps.length ? steps.map(step => `<span class="step-preview"><b>${esc(step.title)}</b><small>${esc(user(step.ownerId))}${step.dueDate ? ' · ' + esc(step.dueDate) : ''}</small></span>`).join('') : '<span class="subtle">目前沒有下一步</span>';
  }
  function caseRows(items) {
    return items.map(c => `<button class="case-row" data-action="case-detail" data-id="${c.id}"><div class="row-title"><span class="row-company">${esc(company(c.companyId))}</span><b>${esc(c.title)}</b><span>Account ${esc(user(state.companies.find(co => co.id === c.companyId)?.ownerId))}</span></div>${pill(c.status)}<div class="next-cell"><span class="overline">${M.caseFollowUps(state, c.id).length} 項下一步</span>${stepSummary(c)}</div><div class="date-cell"><span>最近聯繫 ${date(c.lastContactAt)}</span></div>${icon('arrow')}</button>`).join('');
  }
  function homeSearchResults() {
    if (!homeQuery.trim()) return '';
    const q = homeQuery.toLowerCase();
    const found = state.companies.filter(c => (c.name + state.contacts.filter(ct => ct.companyId === c.id).map(ct => ct.name).join('')).toLowerCase().includes(q));
    return found.length ? found.map(c => `<button class="search-result" data-action="company" data-id="${c.id}"><span><b>${esc(c.name)}</b><small>${esc(user(c.ownerId))} · ${state.contacts.filter(ct => ct.companyId === c.id).length} 位聯絡人</small></span>${icon('arrow')}</button>`).join('') : '<p class="search-empty">沒有符合的企業或聯絡人</p>';
  }
  function memoCards(items) {
    return items.map(m => {
      const steps = M.memoFollowUps(state, m);
      return `<article class="memo-item"><div class="timeline-dot"></div><div class="memo-meta"><span>${date(m.occurredAt)}</span><span>${esc(m.channel)}${m.category ? ' · ' + esc(m.category) : ''} · ${esc(user(m.authorId))}</span></div><h3>${esc(company(m.companyId))}<span>／${esc(contact(m.contactId))}</span></h3><p>${esc(m.summary)}</p>${m.checkIn ? `<div class="checkin-record"><b>${esc(checkInLabels[m.checkIn.status])} · 非實際位置</b><small>${m.checkIn.position ? `合成座標 ${m.checkIn.position.latitude.toFixed(4)}, ${m.checkIn.position.longitude.toFixed(4)} · 測試精度 ${m.checkIn.position.accuracyMeters} m` : '未取得座標'} · ${date(m.checkIn.attemptedAt)}</small></div>` : ''}<div class="memo-steps"><b class="overline">下一步 · ${steps.filter(step => step.active).length} 項</b>${steps.length ? steps.map(step => `<div class="memo-step ${step.active ? '' : 'inactive'}"><span>${esc(step.title)}</span><small>${esc(user(step.ownerId))}${step.dueDate ? ' · ' + esc(step.dueDate) : ''}${step.active ? '' : ' · 已移除追蹤'}</small></div>`).join('') : '<span class="subtle">這次聯繫沒有後續事項</span>'}</div>${m.caseId ? `<button class="text-btn" data-action="case-detail" data-id="${m.caseId}">查看關聯案件 ${icon('arrow')}</button>` : `<button class="text-btn" data-action="link-memo" data-id="${m.id}">建立或關聯商機 ${icon('arrow')}</button>`}</article>`;
    }).join('');
  }
  function unlinkedFollowUps() {
    const steps = state.followUps.filter(step => step.active && !step.caseId && (scope !== 'mine' || step.ownerId === role));
    return steps.length ? `<section class="panel work-section"><div class="section-head"><div><h2>企業後續事項</h2><p>${steps.length} 項尚未關聯案件的下一步</p></div></div>${steps.map(step => `<button class="unlinked-step" data-action="company" data-id="${step.companyId}"><span><b>${esc(step.title)}</b><small>${esc(company(step.companyId))} · ${esc(user(step.ownerId))}${step.dueDate ? ' · ' + esc(step.dueDate) : ''}</small></span>${icon('arrow')}</button>`).join('')}</section>` : '';
  }
  function homeView() {
    const cases = visibleCases(), active = cases.filter(c => c.status !== '已完成' && M.caseFollowUps(state, c.id).length);
    const recent = state.memos.filter(m => scope !== 'mine' || m.authorId === role).sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)).slice(0, 3);
    return `<div class="page-heading home-heading"><div><span class="eyebrow">${role === 'u3' ? '主管總覽' : '我的工作'}</span><h1>工作台</h1><p>記錄往來，接續下一步。</p></div><button class="btn primary quick-entry" data-action="new-memo">${icon('plus')} 快記一筆</button></div><section class="home-search"><label for="home-search">找企業或聯絡人</label><div class="search-field">${icon('company')}<input id="home-search" type="search" placeholder="企業、聯絡人" value="${esc(homeQuery)}"></div><div id="home-search-results">${homeSearchResults()}</div></section><section class="panel work-section"><div class="section-head"><div><h2>下一步</h2><p>${active.reduce((count, item) => count + M.caseFollowUps(state, item.id).length, 0)} 項下一步 · ${active.length} 個案件</p></div><div class="segmented"><button data-action="scope" data-scope="all" class="${scope === 'all' ? 'active' : ''}">全部</button><button data-action="scope" data-scope="mine" class="${scope === 'mine' ? 'active' : ''}">我的</button></div></div>${active.length ? caseRows(active.sort((a, b) => a.dueDate.localeCompare(b.dueDate))) : empty('目前沒有待追蹤的案件')}<div class="panel-footer"><button class="text-btn" data-action="nav" data-page="case">全部案件 ${icon('arrow')}</button><button class="text-btn" data-action="nav" data-page="quote">報價流程 ${icon('arrow')}</button></div></section>${unlinkedFollowUps()}<section class="panel work-section"><div class="section-head"><h2>最近聯繫</h2><button class="text-btn" data-action="nav" data-page="memo">全部紀錄 ${icon('arrow')}</button></div><div class="timeline">${recent.length ? memoCards(recent) : empty('目前角色尚無業務紀錄')}</div></section>`;
  }
  function companyView() {
    const companies = filtered(state.companies, c => c.name + user(c.ownerId));
    const selected = state.companies.find(c => c.id === selectedCompany) || state.companies[0];
    selectedCompany = selected.id;
    const contacts = state.contacts.filter(c => c.companyId === selected.id);
    const cases = state.cases.filter(c => c.companyId === selected.id);
    const memos = state.memos.filter(m => m.companyId === selected.id).sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
    return `<div class="page-heading company-heading ${companyDetailOpen ? 'detail-active' : ''}"><div><span class="eyebrow">企業與聯絡人</span><h1>企業與聯絡人</h1><p>企業是往來紀錄的起點，聯絡人與負責業務清楚歸屬。</p></div><button class="btn" data-action="new-company">${icon('plus')} 新增模擬企業</button></div><div class="company-layout ${companyDetailOpen ? 'detail-open' : ''}"><section class="panel company-list"><label class="search-label">搜尋企業或業務<input id="search" type="search" placeholder="輸入企業或業務名稱" value="${esc(filter)}"></label><div class="list-caption">${companies.length} 間模擬企業</div>${companies.map(c => `<button class="company-item ${selected.id === c.id ? 'selected' : ''}" data-action="company" data-id="${c.id}"><span class="company-initial">${esc(c.name.charAt(0))}</span><div><b>${esc(c.name)}</b><span>Account ${esc(user(c.ownerId))}</span><small>${esc(state.contacts.find(ct => ct.companyId === c.id)?.name || '尚無聯絡人')} · 最近 ${date(M.lastContact(state, c.id))}</small></div>${icon('arrow')}</button>`).join('') || empty('沒有符合的企業')}</section><div class="company-detail"><button class="text-btn company-back" data-action="company-back">‹ 企業清單</button><section class="panel"><div class="company-title"><div><button class="tag neutral category-button" data-action="category" data-id="${selected.id}" aria-label="編輯客戶分類">${esc(selected.category || '未分類')} · 編輯</button><h2>${esc(selected.name)}</h2><p>聯絡窗口 ${esc(contact(memos[0]?.contactId || contacts[0]?.id))} · 模擬資料</p></div><button class="btn primary" data-action="new-memo" data-id="${selected.id}">${icon('plus')} 記錄聯繫</button></div><div class="company-summary"><div><span>Account 負責業務</span><b>${esc(user(selected.ownerId))}</b><button class="text-btn" data-action="reassign" data-id="${selected.id}">調整歸屬</button></div><div><span>最近聯繫</span><b>${date(M.lastContact(state, selected.id))}</b></div><div><span>所屬聯絡人</span><b>${contacts.length} 位</b></div></div></section><section class="panel"><div class="section-head"><h2>所屬聯絡人</h2><button class="btn small" data-action="new-contact" data-id="${selected.id}">${icon('plus')} 新增聯絡人</button></div><div class="contacts-grid">${contacts.map(c => `<div class="contact-card"><span class="avatar">${esc(c.name.slice(-1))}</span><div><h3>${esc(c.name)}</h3><p>${esc(c.title)}</p><span>${esc(c.contactMethod)}</span><small>負責業務：${esc(user(c.ownerId))}</small></div><button class="icon-btn" title="為${esc(c.name)}新增紀錄" aria-label="為${esc(c.name)}新增紀錄" data-action="new-memo" data-id="${selected.id}" data-contact="${c.id}">${icon('plus')}</button></div>`).join('') || empty('此企業尚無聯絡人')}</div></section><section class="panel"><div class="section-head"><h2>關聯案件</h2><button class="btn small" data-action="new-case" data-id="${selected.id}">${icon('plus')} 新增案件</button></div>${cases.length ? caseRows(cases) : empty('此企業尚無案件')}</section><section class="panel"><div class="section-head"><h2>往來時間序</h2><span class="subtle">${memos.length} 筆模擬紀錄</span></div><div class="timeline">${memos.length ? memoCards(memos) : empty('留下第一筆聯繫紀錄')}</div></section></div></div>`;
  }
  function productNames(item) { return (item.productIds || []).map(id => M.CATALOG_PRODUCTS.find(product => product.id === id)?.name).filter(Boolean).join('、') || '產品未定'; }
  function caseView() {
    const cases = filtered(state.cases, c => c.title + company(c.companyId) + productNames(c) + M.caseFollowUps(state, c.id).map(step => step.title + user(step.ownerId)).join(' ')).filter(c => caseFilter === 'all' || c.status === caseFilter);
    return `<div class="page-heading"><div><span class="eyebrow">進度與歸屬</span><h1>案件與商機</h1><p>先記下需求，再逐步補齊；沒有報價也能建立商機。</p></div><button class="btn" data-action="new-case">${icon('plus')} 新增商機</button></div><div class="toolbar"><label class="search-label">搜尋案件<input id="search" type="search" placeholder="企業、案件、負責人" value="${esc(filter)}"></label><label class="status-filter">案件狀態<select id="case-filter"><option value="all">全部狀態</option>${M.STATUSES.map(v => `<option ${v === caseFilter ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div><section class="case-list">${cases.map(c => `<article class="case-shell"><button class="kanban-card" data-action="case-detail" data-id="${c.id}"><div class="case-card-top"><span>${esc(company(c.companyId))}</span>${pill(c.status)}</div><h3>${esc(c.title)}</h3><p class="case-products">${esc(productNames(c))}</p><div class="card-next"><span class="overline">${M.caseFollowUps(state, c.id).length} 項下一步</span>${stepSummary(c)}</div><div class="case-ownership"><span>Account ${esc(user(state.companies.find(co => co.id === c.companyId)?.ownerId))}</span></div><div class="card-date">最近聯繫 ${date(c.lastContactAt)}</div></button><button class="btn small case-quick" data-action="case-memo" data-id="${c.id}">${icon('plus')} 記錄聯繫</button><button class="btn small quote-entry" data-action="new-quote" data-id="${c.id}" ${state.users.find(u => u.id === role).role !== 'sales' ? 'disabled' : ''}>報價草稿</button></article>`).join('') || empty('沒有符合的案件')}</section>`;
  }
  function memoView() {
    const memos = filtered(state.memos, m => company(m.companyId) + contact(m.contactId) + m.summary + (m.category || '') + m.channel + M.memoFollowUps(state, m).map(step => step.title).join(' ')).sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
    return `<div class="page-heading"><div><span class="eyebrow">往來紀錄</span><h1>往來紀錄</h1><p>業務回報與 Call memo 集中留存，接手時不用重新拼湊。</p></div><button class="btn primary" data-action="new-memo">${icon('plus')} 新增業務紀錄</button></div><div class="toolbar"><label class="search-label">搜尋往來內容<input id="search" type="search" placeholder="企業、聯絡人或紀錄關鍵字" value="${esc(filter)}"></label><span class="subtle">${memos.length} 筆紀錄 · 依聯繫時間排序</span></div><section class="panel"><div class="timeline memo-page">${memos.length ? memoCards(memos) : empty('沒有符合的業務紀錄')}</div></section>`;
  }
  function checkInEditor() {
    return `<section class="checkin-editor" hidden><div class="section-head"><div><h3>定位打卡</h3><p>合成測試 · 不請求裝置位置</p></div><span class="tag neutral">非實際位置</span></div><label for="checkin-scenario">測試情境<select id="checkin-scenario"><option value="success">定位成功</option><option value="permission-denied">拒絕權限</option><option value="timeout">定位逾時</option><option value="unsupported">裝置不支援</option></select></label><div class="inline-actions"><button type="button" class="btn small" data-action="simulate-checkin">執行合成測試</button><button type="button" class="text-btn" data-action="clear-checkin">清除</button></div><p id="checkin-status" role="status"></p><p class="form-note">失敗或未測試仍可保存此示範記事；正式提交規則待確認。</p></section>`;
  }
  function updateCheckInStatus() {
    const node = document.querySelector('#checkin-status'); if (!node) return;
    node.textContent = memoCheckIn ? checkInLabels[memoCheckIn.status] + ' · ' + (memoCheckIn.position ? `合成座標 ${memoCheckIn.position.latitude.toFixed(4)}, ${memoCheckIn.position.longitude.toFixed(4)} · 測試精度 ${memoCheckIn.position.accuracyMeters} m` : '未取得座標') + ' · ' + date(memoCheckIn.attemptedAt) : '尚未執行合成測試';
  }
  function quoteView() {
    const quotes = state.quotes || [], sales = state.users.find(u => u.id === role).role === 'sales';
    return `<div class="page-heading"><div><span class="eyebrow">業務確認與主管審核</span><h1>報價流程</h1><p>從草稿開始，逐版確認後再產生測試樣張。</p></div><button class="btn primary" data-action="new-quote" ${sales ? '' : 'disabled'}>${icon('plus')} 新增報價草稿</button></div><div class="test-notice"><b>本機流程測試 · 正式伺服器授權未完成</b><p>使用合成品項與測試價格。PDF 標示「測試樣張／範本待確認／不可對外正式報價」。${sales ? '' : '請切換示範業務建立草稿。'}</p></div><div class="quote-flow" aria-label="測試報價流程"><span>01 草稿</span><span>02 業務確認</span><span>03 主管審核</span><span>04 測試 PDF</span></div><section class="quote-list">${quotes.length ? quotes.map(q => `<button class="panel quote-card" data-action="quote-detail" data-id="${q.id}"><div class="quote-card-top"><span>${esc(company(q.companyId))}</span><span class="quote-status">${esc(q.status)} · v${q.version}</span></div><h2>${esc(q.title)}</h2><p>${esc(state.cases.find(c => c.id === q.caseId)?.title)}</p><div class="quote-card-bottom"><span>${esc(user(q.createdBy))}</span><b>${esc(q.currency)} ${M.formatQuoteMoney(q.totalMinor)}</b>${icon('arrow')}</div></button>`).join('') : `<div class="panel">${empty('還沒有測試報價', '<p>從案件建立一份合成報價草稿。</p>')}</div>`}</section>`;
  }
  function quoteItemRow(item = {}) {
    return `<div class="quote-item-editor"><div class="step-row-head"><span class="overline">合成品項</span><button type="button" class="text-btn" data-action="remove-quote-item">移除</button></div><label>品項說明<input name="description" required maxlength="200" value="${esc(item.description || '')}" placeholder="例如：示範地板系列（測試）"></label><div class="quote-numbers"><label>數量<input name="quantity" inputmode="decimal" required pattern="(0|[1-9][0-9]{0,8})([.][0-9]{1,3})?" value="${esc(item.quantity || '1')}" placeholder="最多三位小數"></label><label>單位<input name="unit" maxlength="20" value="${esc(item.unit || '式')}"></label><label>測試單價<input name="unitPrice" inputmode="decimal" required pattern="(0|[1-9][0-9]{0,8})([.][0-9]{1,2})?" value="${esc(item.unitPrice || '0')}" placeholder="最多兩位小數"></label></div></div>`;
  }
  function quoteForm(id = '', caseId = '') {
    const q = state.quotes.find(item => item.id === id);
    modal(q ? '修改報價草稿' : '新增報價草稿', `<form id="quote-form" class="quick-memo" data-id="${esc(id)}"><div class="test-notice"><b>合成報價 · 非正式客戶版</b><p>${q ? '保存修改會建立新版本，先前確認與核准失效，需重新送審。' : '請填測試品項與價格。正式範本、計價與稅額規則待確認。'}</p></div>${q ? `<p class="form-note">${esc(company(q.companyId))} · ${esc(state.cases.find(c => c.id === q.caseId)?.title)} · v${q.version}</p>` : `<label>關聯案件<select name="caseId" required>${state.cases.map(c => `<option value="${c.id}" ${c.id === caseId ? 'selected' : ''}>${esc(company(c.companyId))}／${esc(c.title)}</option>`).join('')}</select></label>`}<label>報價名稱<input name="title" required maxlength="200" value="${esc(q?.title || '示範場域報價（測試）')}"></label><div class="form-grid"><label>測試幣別<select name="currency"><option>TWD</option></select></label><label>測試有效日期（選填）<input type="date" name="validUntil" value="${esc(q?.validUntil || '')}"></label></div><div id="quote-items">${(q?.items || [{}]).map(quoteItemRow).join('')}</div><button type="button" class="btn small" data-action="add-quote-item">${icon('plus')} 新增品項</button><label>測試備註（選填）<textarea name="note" maxlength="2000" rows="3">${esc(q?.note || '')}</textarea></label><p class="form-note">每品項金額以測試數量 × 測試單價四捨五入至小數二位後加總，未計算稅額。正式規則待確認。</p>${formFooter(q ? '保存為新版本草稿' : '保存測試草稿')}</form>`);
  }
  function quoteDetail(id) {
    const q = state.quotes.find(item => item.id === id), maker = q.createdBy === role, supervisor = state.users.find(u => u.id === role).role === 'supervisor';
    modal('報價內容', `<div class="quote-detail"><div class="quote-card-top"><span class="quote-status">${esc(q.status)} · v${q.version}</span><span>本機合成測試</span></div><h3>${esc(q.title)}</h3><p class="subtle">${esc(company(q.companyId))}／${esc(state.cases.find(c => c.id === q.caseId)?.title)}</p><div class="test-notice"><b>測試樣張／範本待確認／不可對外正式報價</b><p>角色切換僅試走流程，正式登入與伺服器授權尚未完成。此頁示範由草稿建立人修改與確認，主管另行核准；正式權限矩陣待確認。</p></div><ol class="quote-progress"><li class="done">草稿 v${q.version}</li><li class="${q.salesConfirmation ? 'done' : ''}">業務確認${q.salesConfirmation ? ' · ' + esc(user(q.salesConfirmation.actorId)) : ' · 待處理'}</li><li class="${q.status === '已核准' ? 'done' : ''}">主管審核${q.review ? ' · ' + esc(q.status) : ' · 待處理'}</li></ol><div class="quote-lines">${q.items.map(row => `<div><b>${esc(row.description)}</b><span>${esc(row.quantity)} ${esc(row.unit)} × ${esc(row.unitPrice)}</span><strong>${M.formatQuoteMoney(row.amountMinor)}</strong></div>`).join('')}</div><div class="quote-total"><span>測試小計 ${esc(q.currency)}</span><b>${M.formatQuoteMoney(q.totalMinor)}</b></div><p class="form-note">未計算稅額；價格、計價與正式報價範本待確認。${q.validUntil ? '測試有效日期 ' + esc(q.validUntil) : ''}</p>${q.note ? `<p class="quote-note">${esc(q.note)}</p>` : ''}${q.review?.reason ? `<p class="test-notice">主管測試說明：${esc(q.review.reason)}</p>` : ''}<div class="quote-actions">${maker ? `<button class="btn" data-action="edit-quote" data-id="${q.id}">修改並建立新版本</button>${q.status === '草稿' ? `<button class="btn primary" data-action="confirm-quote" data-id="${q.id}">業務確認並送審</button>` : ''}` : ''}${supervisor && q.status === '待主管審核' ? `<label for="quote-review-reason">審核說明（退回時必填）<textarea id="quote-review-reason" maxlength="1000" rows="2"></textarea></label><button class="btn" data-action="return-quote" data-id="${q.id}">退回修改</button><button class="btn primary" data-action="approve-quote" data-id="${q.id}">主管模擬核准 v${q.version}</button>` : ''}<button class="btn ${q.status === '已核准' ? 'primary' : ''}" data-action="quote-pdf" data-id="${q.id}" ${q.status === '已核准' && (maker || supervisor) ? '' : 'disabled'}>下載測試 PDF</button></div><p class="form-note">${q.status === '已核准' ? '僅目前已模擬核准版本可下載；修改後需重新確認與核准。' : '目前版本需完成業務確認與主管模擬核准後才能下載。'}</p><p id="quote-error" role="alert"></p><details class="quote-history"><summary>版本與操作紀錄 · ${q.history.length} 筆</summary>${q.history.slice().reverse().map(event => `<p><b>v${event.version} · ${esc(event.action)}</b><span>${esc(user(event.actorId))} · ${date(event.at)}${event.reason ? ' · ' + esc(event.reason) : ''}</span></p>`).join('')}</details></div>`);
  }
  function mutateQuote(id, action) {
    try { action(); persist(); render(); quoteDetail(id); toast('已保存此瀏覽器的報價測試狀態'); }
    catch (error) { document.querySelector('#quote-error').textContent = error.message; }
  }
  function catalogView() {
    const groups = [...new Set(M.FEATURES.map(f => f.group))];
    const ordered = groups.flatMap(g => M.FEATURES.filter(f => f.group === g));
    const items = ordered.filter(f => (catalogGroup === 'all' || f.group === catalogGroup) && (!catalogQuery || [String(ordered.indexOf(f) + 1).padStart(2, '0'), f.name, f.group, f.description].join(' ').toLowerCase().includes(catalogQuery.toLowerCase())));
    return `<div class="page-heading catalog-heading"><div><h1>功能大全</h1><p>${M.FEATURES.length} 項功能簡表 · 常見 CRM 功能與 KT 會議需求</p></div></div><p class="catalog-note">供需求討論參考。可試用項目使用模擬資料；其餘尚未實作或未串接。報價為本期優先；ERP 建單與庫存查詢分項排程。成本與獎金先預留資料，計算規則待確認。</p><div class="catalog-filters"><label>搜尋功能<input id="catalog-search" type="search" value="${esc(catalogQuery)}" placeholder="編號、功能或關鍵字"></label><label>功能群組<select id="catalog-group"><option value="all">全部群組</option>${groups.map(g => `<option ${g === catalogGroup ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select></label></div><div class="catalog-results"><span>${items.length} 項功能</span><button class="text-btn" data-action="catalog-clear">清除篩選</button></div><table class="catalog-table"><caption class="sr-only">KT 與常見 CRM 功能簡表，編號 01 至 50</caption><thead><tr><th scope="col">編號</th><th scope="col">功能與說明</th><th scope="col">目前狀態</th></tr></thead>${groups.filter(g => items.some(f => f.group === g)).map(g => `<tbody><tr class="catalog-group-row"><th scope="rowgroup" colspan="3">${esc(g)}</th></tr>${items.filter(f => f.group === g).map(f => `<tr class="catalog-row" id="feature-${f.id}"><td class="catalog-number">${String(ordered.indexOf(f) + 1).padStart(2, '0')}</td><td><b>${esc(f.name)}</b><span class="catalog-description">${esc(f.description)}</span><small>${esc(f.origin.startsWith('會議') ? 'KT ' + f.origin : f.origin === '另行評估' ? '另行評估' : '常見 CRM 候選')}</small></td><td><span class="catalog-status ${f.status === '可試用' ? 'operative' : ''}">${esc(f.status)}</span></td></tr>`).join('')}</tbody>`).join('')}</table>${items.length ? '' : '<div class="empty"><b>沒有符合的功能</b><p>調整關鍵字或清除篩選。</p></div>'}`;
  }
  function render() {
    const view = ({ home: homeView, company: companyView, case: caseView, memo: memoView, quote: quoteView, review: catalogView })[page];
    const short = {home:'工作',company:'企業',case:'案件',memo:'紀錄',quote:'報價',review:'功能'};
    app.innerHTML = `<aside class="sidebar"><div class="brand"><img src="assets/kingtile-logo.svg" alt="KING TILE 鉅成" width="181" height="42"><small>業務工作台 · CRM</small></div><nav aria-label="主選單">${Object.entries(labels).map(([id, text]) => `<button data-action="nav" data-page="${id}" class="nav-item ${page === id || ['memo','quote'].includes(page) && id === 'home' && window.innerWidth < 900 ? 'active' : ''}" ${page === id ? 'aria-current="page"' : ''}>${icon(id)}<span class="nav-full">${text}</span><span class="nav-short">${short[id]}</span></button>`).join('')}</nav><div class="sidebar-bottom"><p>需求確認用原型<br>模擬資料 · 本機保存</p><button class="text-btn" data-action="about">使用說明 ${icon('arrow')}</button></div></aside><div class="workspace"><header class="topbar"><div class="mobile-brand"><img src="assets/kingtile-logo.svg" alt="KING TILE 鉅成" width="181" height="42"></div><div class="breadcrumb">鉅成 CRM <span>/</span> ${labels[page]}</div><div class="role-control"><label for="role">角色示意</label><select id="role" aria-label="切換示範角色">${userOptions(role)}</select></div></header><div class="prototype-banner"><b>需求確認用原型／模擬資料</b><span>角色僅示意，尚無正式權限。請勿輸入真實客戶資料。本機保存，不跨人同步。</span></div>${storageMessage ? `<div class="storage-warning">${esc(storageMessage)}</div>` : ''}<main id="main" tabindex="-1">${view()}</main><footer class="footer"><span id="save-state">${storageOk ? '已存於此瀏覽器' : '本次操作尚未保存'}</span><button class="text-btn" data-action="about">使用說明</button><button class="text-btn" data-action="reset">重設示範資料</button></footer></div>`;
  }
  function modal(title, content) {
    dialog.innerHTML = `<div class="dialog-heading"><div><span class="eyebrow">模擬情境</span><h2 id="dialog-title">${title}</h2></div><button class="icon-btn" data-action="close" aria-label="關閉">×</button></div>${content}`;
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    dialog.querySelector('[autofocus]')?.focus({ preventScroll: true });
  }
  const formFooter = text => `<p id="form-error" role="alert"></p><div class="form-footer"><button type="button" class="btn" data-action="close">取消</button><button class="btn primary" type="submit">${text}</button></div>`;
  const candidateNote = '<div class="form-note">所有欄位皆為候選，請只輸入合成情境，不填真實客戶個資或機密。</div>';
  let stepSequence = 0;
  function stepEditorRow(step = {}, ownerId = role) {
    const key = 'step-' + (++stepSequence);
    return `<div class="step-editor-row" data-step-id="${esc(step.id || '')}"><div class="step-row-head"><span class="overline">後續事項</span><button type="button" class="text-btn remove-step" data-action="remove-step" aria-label="移除此項下一步">移除</button></div><label for="${key}-title">要做什麼<textarea id="${key}-title" name="stepTitle" rows="2" maxlength="2000" required placeholder="例如：確認現場可拜訪時段">${esc(step.title || '')}</textarea></label><div class="form-grid"><label for="${key}-owner">負責人<select id="${key}-owner" name="stepOwner">${userOptions(step.ownerId || ownerId)}</select></label><label for="${key}-date">預計日期（選填）<input id="${key}-date" type="date" name="stepDueDate" value="${esc(step.dueDate || '')}"></label></div></div>`;
  }
  function stepsEditor(steps = [], ownerId = role) {
    return `<fieldset class="steps-editor" data-default-owner="${esc(ownerId)}"><legend>下一步 <span class="required-hint">選填 · 可新增多項</span></legend><p class="steps-empty" ${steps.length ? 'hidden' : ''}>這次沒有後續事項，也能直接保存。</p><div class="step-editor-list">${steps.map(step => stepEditorRow(step, ownerId)).join('')}</div><button class="btn small add-step" data-action="add-step" type="button">${icon('plus')} 新增下一步</button></fieldset>`;
  }
  function readSteps(form) {
    return [...form.querySelectorAll('.step-editor-row')].map(row => ({ ...(row.dataset.stepId ? { id: row.dataset.stepId } : {}), title: row.querySelector('[name="stepTitle"]').value, ownerId: row.querySelector('[name="stepOwner"]').value, dueDate: row.querySelector('[name="stepDueDate"]').value }));
  }
  function caseOptions(companyId, selected = '') {
    return '<option value="">不關聯，僅記錄企業往來</option><option value="__new__">由這筆記事建立新商機…</option>' + state.cases.filter(c => c.companyId === companyId).map(c => `<option value="${c.id}" ${c.id === selected ? 'selected' : ''}>${esc(c.title)}</option>`).join('');
  }
  function productsEditor(selected = []) {
    return `<fieldset class="product-editor"><legend>產品需求 <span class="required-hint">可多選，也可未定</span></legend><p class="form-note">先選系列，花色與型號可後補。</p><div class="product-options">${M.CATALOG_PRODUCTS.map(product => `<label class="product-choice"><input type="checkbox" name="productIds" value="${product.id}" ${selected.includes(product.id) ? 'checked' : ''}><span>${esc(product.name)}</span></label>`).join('')}</div><p class="product-selection-status subtle">${selected.length ? '已選 ' + selected.length + ' 種系列' : '產品未定'}</p></fieldset>`;
  }
  function customerSearchResults(query) {
    const q = query.trim().toLowerCase();
    const matches = state.companies.filter(item => (item.name + user(item.ownerId) + (item.category || '') + state.contacts.filter(contact => contact.companyId === item.id).map(contact => contact.name).join(' ')).toLowerCase().includes(q)).slice(0, 12);
    return (matches.length ? matches.map(item => `<button type="button" class="customer-result" data-action="memo-customer" data-id="${item.id}"><b>${esc(item.name)}</b><small>${esc(item.category || '未分類')} · ${esc(user(item.ownerId))}</small></button>`).join('') : '<p class="form-note">沒有符合的客戶，請調整搜尋文字。</p>') + '<button type="button" class="text-btn" data-action="memo-customer-reset">保留目前客戶</button>';
  }
  function memoForm(companyId = selectedCompany, contactId = '', caseId = '') {
    memoCheckIn = null;
    const localTime = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 16);
    const ownerId = state.companies.find(c => c.id === companyId)?.ownerId || role;
    modal('記錄聯繫', `<form id="memo-form" class="quick-memo"><div class="memo-context"><span id="memo-context-name"></span><button type="button" class="text-btn" data-action="memo-details">調整聯絡資料</button></div><label>搜尋客戶<input id="memo-customer-search" type="search" autocomplete="off" value="${esc(company(companyId))}" aria-describedby="memo-customer-help"></label><p id="memo-customer-help" class="subtle">可輸入客戶或聯絡人名稱，再從結果選取。</p><div id="memo-customer-results" class="customer-results" aria-label="客戶搜尋結果" hidden></div><div class="form-grid memo-classification"><label>記事類別（選填）<input name="category" list="memo-category-examples" maxlength="120" placeholder="選常用類別，或自行輸入"><datalist id="memo-category-examples">${M.MEMO_CATEGORY_EXAMPLES.map(value => `<option value="${esc(value)}">`).join('')}</datalist></label><label>聯繫方式<select name="channel"><option>電話</option><option value="拜訪">現場拜訪</option><option>LINE</option><option>線上會議</option><option>其他</option></select></label></div>${checkInEditor()}<label>這次聯繫的重點 <span class="required-hint">必填</span><textarea name="summary" rows="3" maxlength="2000" required placeholder="談到什麼？確認了什麼？" autofocus></textarea></label><div class="memo-linkage"><label>關聯商機（選填）<select name="caseId" id="memo-case"></select></label><div class="new-case-fields" hidden><label>案件名稱 <span class="required-hint">必填</span><input name="newCaseTitle" maxlength="200" placeholder="例如：示範場域的初步需求"></label>${productsEditor()}</div></div><div id="memo-update-scope" class="memo-update-scope" role="status"></div>${stepsEditor([], ownerId)}<p id="memo-defaults-visible" class="memo-defaults-visible"></p><details class="memo-details"><summary>企業、聯絡人與紀錄資料</summary><div class="form-grid"><label>企業<select name="companyId" id="memo-company">${companyOptions(companyId)}</select></label><label>實際聯絡人<select name="contactId" id="memo-contact" required></select></label><div id="memo-new-contact" class="inline-contact" hidden><label>新增聯絡人名稱<input name="newContactName" maxlength="120" placeholder="只填合成情境中的名稱"></label><label>這位聯絡人的角色（選填）<input name="newContactRole" maxlength="120" placeholder="可自行輸入角色，不限定職稱"></label><label>聯絡方式示意（選填）<input name="newContactMethod" maxlength="200" placeholder="可稍後補充，勿填真實個資"></label></div><label>紀錄人<select name="authorId">${userOptions(role)}</select></label><label>聯繫時間（台灣）<input name="occurredAt" type="datetime-local" value="${localTime}" required></label></div></details><p class="form-note">只填合成情境，不填真實個資或機密。資料僅存此瀏覽器。</p>${formFooter('保存紀錄')}</form>`);
    syncMemoSelects(companyId, contactId, caseId);
  }
  function syncMemoSelects(companyId, contactId = '', caseId = '') {
    memoCheckIn = null;
    const contacts = state.contacts.filter(c => c.companyId === companyId);
    const latest = state.memos.filter(m => m.companyId === companyId && (!caseId || m.caseId === caseId)).sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))[0];
    const preferredContact = contactId || latest?.contactId || contacts[0]?.id;
    document.querySelector('#memo-contact').innerHTML = contacts.map(c => `<option value="${c.id}" ${c.id === preferredContact ? 'selected' : ''}>${esc(c.name)} · ${esc(c.title || '角色待補')}</option>`).join('') + '<option value="__new__">新增聯絡人…</option>';
    const search = document.querySelector('#memo-customer-search'); search.value = company(companyId); search.setCustomValidity('');
    document.querySelector('#memo-customer-results').hidden = true;
    if (!contacts.length) document.querySelector('.memo-details').open = true;
    document.querySelector('#memo-case').innerHTML = caseOptions(companyId, caseId);
    document.querySelector('.steps-editor').dataset.defaultOwner = state.companies.find(c => c.id === companyId)?.ownerId || role;
    syncMemoContext();
  }
  function syncMemoContext() {
    const form = document.querySelector('#memo-form');
    form.querySelector('.checkin-editor').hidden = form.elements.channel.value !== '拜訪';
    updateCheckInStatus();
    const linked = state.cases.find(c => c.id === form.elements.caseId.value);
    const creating = form.elements.caseId.value === '__new__';
    form.querySelector('.new-case-fields').hidden = !creating;
    const creatingContact = form.elements.contactId.value === '__new__';
    form.querySelector('#memo-new-contact').hidden = !creatingContact; form.elements.newContactName.required = creatingContact;
    form.elements.newCaseTitle.required = creating;
    const notice = document.querySelector('#memo-update-scope');
    notice.classList.toggle('unlinked', !linked && !creating);
    notice.textContent = creating ? '保存記事時一起建立商機，尚未報價也能建立。' : linked ? `關聯 ${linked.title}；新增後續事項並保留原有下一步，最近聯繫依時間更新。` : '僅存企業往來；沒有下一步或案件也能保存，不會更動其他案件。';
    form.querySelector('button[type="submit"]').textContent = creating ? '保存並建立商機' : linked ? '保存關聯記事' : '保存企業往來';
    document.querySelector('#memo-context-name').textContent = company(form.elements.companyId.value) + ' · ' + (creatingContact ? '新增聯絡人' : contact(form.elements.contactId.value));
    document.querySelector('#memo-defaults-visible').textContent = `${user(form.elements.authorId.value)} · ${form.elements.channel.value} · ${form.querySelectorAll('.step-editor-row').length} 項下一步`;
  }
  function caseForm(id = '', companyId = selectedCompany) {
    const c = state.cases.find(x => x.id === id);
    const ownerId = state.companies.find(co => co.id === (c?.companyId || companyId))?.ownerId || role;
    modal(c ? '案件進度與下一步' : '新增模擬商機', `<form id="case-form" data-id="${id}">${candidateNote}${c ? `<div class="case-modal-title"><h3>${esc(c.title)}</h3><p>${esc(company(c.companyId))} · 最近聯繫 ${date(c.lastContactAt)}</p><button type="button" class="btn case-memo-entry" data-action="case-memo" data-id="${c.id}">${icon('plus')} 新增此案件紀錄</button><small>下方如有進度修改，請先保存。</small></div>` : `<label>企業<select name="companyId">${companyOptions(companyId)}</select></label><label>案件名稱<input name="title" required maxlength="200" placeholder="例如：示範場域的需求確認"></label><p class="form-note">可先建立商機，再逐步補齊資料。</p>`}${productsEditor(c?.productIds || [])}<label>案件進度<select name="status">${stateOptions(c?.status || '需求確認')}</select></label>${stepsEditor(c ? M.caseFollowUps(state, c.id) : [], ownerId)}${c ? `<div class="linked-memos"><b>關聯紀錄 ${state.memos.filter(m => m.caseId === id).length} 筆</b>${state.memos.filter(m => m.caseId === id).sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)).slice(0, 3).map(m => `<p><span>${date(m.occurredAt)}</span>${esc(m.summary)}</p>`).join('')}</div>` : ''}${formFooter('保存案件')}</form>`);
  }
  function linkMemoForm(id) {
    const memo = state.memos.find(m => m.id === id);
    modal('建立或關聯商機', `<form id="memo-link-form" data-id="${id}"><p class="form-note">${esc(company(memo.companyId))} · ${esc(memo.summary)}</p><label>關聯到<select name="caseId" id="link-case" required><option value="">選擇商機或案件</option>${caseOptions(memo.companyId).replace('<option value="">不關聯，僅記錄企業往來</option>', '')}</select></label><div class="new-case-fields" hidden><label>案件名稱<input name="newCaseTitle" maxlength="200" placeholder="為這次需求取個名稱"></label>${productsEditor()}</div><p class="form-note">記事與既有下一步會一起關聯，內容保留。</p>${formFooter('保存關聯')}</form>`);
  }
  function about() {
    modal('使用說明', `<div class="about-content"><h3>先試用業務流程</h3><p>找企業與聯絡人，記錄聯繫重點、下一步與案件進度。「功能大全」以編號簡表列出常見 CRM 功能與 KT 會議需求，僅供討論參考。</p><h3>本機保存</h3><p>新增的模擬操作只存在目前瀏覽器，不同人、瀏覽器、裝置或網址不會同步。清除瀏覽器資料或確認重設會移除本機模擬紀錄。</p><h3>範圍與角色</h3><p>企業、人物與往來均為合成情境，角色切換只示範視角。報價可試走草稿、業務確認、主管模擬核准及測試 PDF；現場拜訪只用合成座標，不會請求定位權限。正式報價範本、真實定位、共享後端與伺服器授權未完成。ERP 建單與庫存分項排程，成本與獎金先預留欄位，不做未確認的公式。沒有生產 API、發訊、下單或正式登入與權限。</p><h3>品牌</h3><p>使用 KING TILE 鉅成官網原始 Logo，並以原圖的深棕與米金安排介面。</p></div><div class="form-footer"><button class="btn primary" data-action="close">了解</button></div>`);
  }
  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-action]'); if (!button) return;
    const { action, id } = button.dataset;
    if (action === 'close') { dialog.close(); return; }
    if (action === 'nav') { page = button.dataset.page; filter = ''; if (page === 'company') companyDetailOpen = false; render(); window.scrollTo(0, 0); }
    else if (action === 'company') { companyScroll = window.scrollY; page = 'company'; selectedCompany = id; companyDetailOpen = true; render(); if (window.innerWidth < 900) window.scrollTo(0, 0); }
    else if (action === 'company-back') { companyDetailOpen = false; render(); window.scrollTo(0, companyScroll); }
    else if (action === 'memo-details') { const d = document.querySelector('.memo-details'); d.open = true; d.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    else if (action === 'add-step') { const editor = button.closest('.steps-editor'), limit = button.form?.id === 'case-form' ? 1000 : 50; if (editor.querySelectorAll('.step-editor-row').length >= limit) { toast('每次最多新增 ' + limit + ' 項下一步'); return; } editor.querySelector('.step-editor-list').insertAdjacentHTML('beforeend', stepEditorRow({}, editor.dataset.defaultOwner)); editor.querySelector('.steps-empty').hidden = true; editor.querySelector('.step-editor-row:last-child textarea').focus(); if (document.querySelector('#memo-form')) syncMemoContext(); }
    else if (action === 'remove-step') { const editor = button.closest('.steps-editor'); button.closest('.step-editor-row').remove(); editor.querySelector('.steps-empty').hidden = !!editor.querySelector('.step-editor-row'); if (document.querySelector('#memo-form')) syncMemoContext(); }
    else if (action === 'memo-customer') { document.querySelector('#memo-company').value = id; syncMemoSelects(id); }
    else if (action === 'memo-customer-reset') { const search = document.querySelector('#memo-customer-search'); search.value = company(document.querySelector('#memo-company').value); search.setCustomValidity(''); document.querySelector('#memo-customer-results').hidden = true; }
    else if (action === 'simulate-checkin') { memoCheckIn = M.simulateCheckIn(document.querySelector('#checkin-scenario').value); updateCheckInStatus(); }
    else if (action === 'clear-checkin') { memoCheckIn = null; updateCheckInStatus(); }
    else if (action === 'new-quote') quoteForm('', id || state.cases[0]?.id);
    else if (action === 'quote-detail') quoteDetail(id);
    else if (action === 'edit-quote') quoteForm(id);
    else if (action === 'add-quote-item') { const list = document.querySelector('#quote-items'); if (list.children.length >= 50) { toast('測試報價最多 50 個品項'); return; } list.insertAdjacentHTML('beforeend', quoteItemRow()); list.lastElementChild.querySelector('input').focus(); }
    else if (action === 'remove-quote-item') { const row = button.closest('.quote-item-editor'); if (row.parentElement.children.length === 1) { toast('測試報價至少保留一個品項'); return; } row.remove(); }
    else if (action === 'confirm-quote') mutateQuote(id, () => M.confirmQuote(state, id, role));
    else if (action === 'approve-quote' || action === 'return-quote') mutateQuote(id, () => M.reviewQuote(state, id, role, action === 'approve-quote' ? 'approve' : 'return', document.querySelector('#quote-review-reason').value));
    else if (action === 'quote-pdf') {
      button.disabled = true; button.textContent = '正在產生測試樣張…';
      try {
        const data = M.approvedQuoteData(state, id, role), blob = await window.CRMQuotePDF.renderApprovedQuote(data);
        const url = URL.createObjectURL(blob), link = document.createElement('a');
        link.href = url; link.download = 'TEST-報價樣張-v' + data.version + '.pdf'; document.body.append(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30000); toast('已產生測試樣張；範本待確認，不可對外正式報價');
      } catch (error) { const node = document.querySelector('#quote-error'); if (node) node.textContent = error.message; else toast(error.message); }
      finally { if (button.isConnected) { button.disabled = false; button.textContent = '下載測試 PDF'; } }
    }
    else if (action === 'category') modal('客戶分類', `<form id="category-form" data-id="${id}"><p>${esc(company(id))}</p><label>分類<input name="category" maxlength="120" value="${esc(state.companies.find(c => c.id === id).category || '')}" placeholder="保留實際分類，可自行輸入"></label>${formFooter('保存分類')}</form>`);
    else if (action === 'link-memo') linkMemoForm(id);
    else if (action === 'scope') { scope = button.dataset.scope; render(); }
    else if (action === 'new-memo') memoForm(id || selectedCompany, button.dataset.contact);
    else if (action === 'case-memo') { const item = state.cases.find(c => c.id === id); memoForm(item.companyId, '', item.id); }
    else if (action === 'case-detail') caseForm(id);
    else if (action === 'new-case') caseForm('', id || selectedCompany);
    else if (action === 'new-company') modal('新增模擬企業', `<form id="company-form">${candidateNote}<label>示範企業名稱<input name="name" required maxlength="120" placeholder="僅填虛構企業名稱"></label><label>客戶分類（選填）<input name="category" maxlength="120" placeholder="沿用實際分類，可自行輸入"></label><label>Account 負責業務<select name="ownerId">${userOptions('u1')}</select></label>${formFooter('新增模擬企業')}</form>`);
    else if (action === 'new-contact') modal('新增示範聯絡人', `<form id="contact-form" data-id="${id}">${candidateNote}<p>${esc(company(id))} · 模擬企業</p><label>示範聯絡人名稱<input name="name" required maxlength="120" placeholder="例如：示範聯絡人 F"></label><div class="form-grid"><label>窗口角色<input name="title" maxlength="120" placeholder="例如：採購窗口"></label><label>負責業務<select name="ownerId">${userOptions(state.companies.find(c => c.id === id).ownerId)}</select></label></div><label>聯絡方式示意（選填）<input name="contactMethod" maxlength="200" placeholder="例如：測試電話（未填號碼）"></label>${formFooter('新增示範聯絡人')}</form>`);
    else if (action === 'reassign') modal('調整 Account 歸屬', `<form id="owner-form" data-id="${id}">${candidateNote}<h3>${esc(company(id))}</h3><label>新的負責業務<select name="ownerId">${userOptions(state.companies.find(c => c.id === id).ownerId)}</select></label><p class="subtle">本示意僅調整企業的負責業務。聯絡人與下一步負責人保留原指派，實際交接規則待確認。</p>${formFooter('保存歸屬')}</form>`);
    else if (action === 'catalog-clear') { catalogGroup = 'all'; catalogQuery = ''; render(); }
    else if (action === 'about') about();
    else if (action === 'reset') modal('重設此瀏覽器的示範資料？', '<p class="reset-note">會清除此瀏覽器新增的模擬企業、案件與往來紀錄，恢復最初情境。</p><div class="form-footer"><button class="btn" data-action="close">保留現有資料</button><button class="btn danger" data-action="confirm-reset">確認重設</button></div>');
    else if (action === 'confirm-reset') { state = M.seed(); selectedCompany = 'co1'; storageMessage = ''; persist(); dialog.close(); render(); toast('已恢復最初示範情境'); }
  });
  document.addEventListener('input', event => {
    if (event.target.id === 'catalog-search') { const start = event.target.selectionStart; catalogQuery = event.target.value; render(); const node = document.querySelector('#catalog-search'); node.focus(); node.setSelectionRange(start, start); }
    if (event.target.id === 'memo-customer-search') { const results = document.querySelector('#memo-customer-results'); results.innerHTML = customerSearchResults(event.target.value); results.hidden = false; event.target.setCustomValidity(event.target.value === company(document.querySelector('#memo-company').value) ? '' : '請從搜尋結果選取客戶，或保留目前客戶'); }
    if (event.target.id === 'home-search') { homeQuery = event.target.value; document.querySelector('#home-search-results').innerHTML = homeSearchResults(); }
    if (event.target.id === 'search') {
      const start = event.target.selectionStart; filter = event.target.value; render();
      const input = document.querySelector('#search'); input.focus(); input.setSelectionRange(start, start);
    }
  });
  document.addEventListener('change', event => {
    if (event.target.name === 'productIds') { const editor = event.target.closest('.product-editor'), count = editor.querySelectorAll('input:checked').length; editor.querySelector('.product-selection-status').textContent = count ? '已選 ' + count + ' 種系列' : '產品未定'; }
    if (event.target.id === 'catalog-group') { catalogGroup = event.target.value; render(); }
    if (event.target.id === 'role') { role = event.target.value; scope = role === 'u3' ? 'all' : 'mine'; render(); toast('已切換示範視角；此功能不代表正式權限'); }
    if (event.target.id === 'case-filter') { caseFilter = event.target.value; render(); }
    if (event.target.id === 'memo-company') syncMemoSelects(event.target.value);
    else if (event.target.id === 'memo-case') syncMemoContext();
    else if (event.target.id === 'link-case') { const form = event.target.form, creating = event.target.value === '__new__'; form.querySelector('.new-case-fields').hidden = !creating; form.elements.newCaseTitle.required = creating; }
    else if (event.target.closest('#memo-form')) { if (event.target.name === 'channel') memoCheckIn = null; syncMemoContext(); }
  });
  document.addEventListener('submit', event => {
    if (!event.target.closest('#dialog')) return; event.preventDefault();
    const form = event.target, input = Object.fromEntries(new FormData(form));
    try {
      let savedMessage = '已保存模擬操作至此瀏覽器';
      if (form.id === 'memo-form') {
        input.occurredAt += ':00+08:00';
        input.checkIn = input.channel === '拜訪' ? memoCheckIn : null;
        input.nextSteps = readSteps(form);
        input.productIds = [...form.querySelectorAll('[name="productIds"]:checked')].map(node => node.value);
        input.createContact = input.contactId === '__new__';
        if (input.createContact) { input.contactId = ''; input.newContact = { name: input.newContactName, title: input.newContactRole, contactMethod: input.newContactMethod }; }
        input.createCase = input.caseId === '__new__';
        if (input.createCase) input.caseId = '';
        const memo = M.addMemo(state, input); selectedCompany = memo.companyId;
        savedMessage = input.createCase ? '已保存記事並建立關聯商機' : memo.caseId ? `已保存關聯記事及 ${input.nextSteps.length} 項下一步；原有下一步保留` : `已保存企業往來及 ${input.nextSteps.length} 項下一步；其他案件未變動`;
      }
      else if (form.id === 'quote-form') {
        input.items = [...form.querySelectorAll('.quote-item-editor')].map(row => Object.fromEntries(['description','quantity','unit','unitPrice'].map(name => [name, row.querySelector('[name="' + name + '"]').value])));
        const quote = form.dataset.id ? M.updateQuote(state, form.dataset.id, input, role) : M.createQuote(state, input, role);
        persist(); page = 'quote'; render(); quoteDetail(quote.id); toast('測試草稿已保存；需先由業務確認再送主管審核'); return;
      }
      else if (form.id === 'case-form') { input.productIds = [...form.querySelectorAll('[name="productIds"]:checked')].map(node => node.value); input.nextSteps = readSteps(form); if (form.dataset.id) M.updateCase(state, form.dataset.id, input); else M.addCase(state, input); }
      else if (form.id === 'memo-link-form') { if (input.caseId === '__new__') M.createCaseFromMemo(state, form.dataset.id, input.newCaseTitle, [...form.querySelectorAll('[name="productIds"]:checked')].map(node => node.value)); else M.linkMemo(state, form.dataset.id, input.caseId); savedMessage = '記事、下一步與案件已關聯並存於此瀏覽器'; }
      else if (form.id === 'company-form') { selectedCompany = M.addCompany(state, input).id; page = 'company'; companyDetailOpen = true; }
      else if (form.id === 'contact-form') M.addContact(state, { ...input, companyId: form.dataset.id });
      else if (form.id === 'category-form') M.updateCompanyCategory(state, form.dataset.id, input.category);
      else if (form.id === 'owner-form') state.companies.find(c => c.id === form.dataset.id).ownerId = input.ownerId;
      persist(); dialog.close(); render(); toast(storageOk ? savedMessage : '本次操作尚未保存，請稍後重新保存');
    } catch (error) { form.querySelector('#form-error').textContent = error.message; }
  });
  dialog.addEventListener('invalid', event => { const details = event.target.closest('details'); if (details) details.open = true; }, true);
  render();
})();
