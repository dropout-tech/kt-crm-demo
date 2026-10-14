(function () {
  'use strict';
  const M = window.CRM;
  const app = document.querySelector('#app');
  const dialog = document.querySelector('#dialog');
  const labels = { home: '工作總覽', company: '企業與聯絡人', case: '案件進度', memo: '往來紀錄', review: '功能大全' };
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
  const icons = {
    home: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    company: '<path d="M4 21V5h12v16M16 11h4v10M8 9h4M8 13h4M8 17h4M2 21h20"/>',
    case: '<rect x="3" y="6" width="18" height="15" rx="2"/><path d="M8 6V3h8v3M3 12h18M10 12v3h4v-3"/>',
    memo: '<path d="M5 3h14v18H5zM8 7h8M8 11h8M8 15h5"/>',
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
  function visibleCases() { return state.cases.filter(c => scope !== 'mine' || c.nextOwnerId === role); }
  function filtered(list, getter) { const q = filter.trim().toLowerCase(); return list.filter(x => !q || getter(x).toLowerCase().includes(q)); }
  function empty(text, action = '') { return `<div class="empty">${icon('memo')}<b>${text}</b><p>調整篩選條件，或新增一筆模擬情境試用。</p>${action}</div>`; }
  function caseRows(items) {
    return items.map(c => `<button class="case-row" data-action="case-detail" data-id="${c.id}"><div class="row-title"><span class="row-company">${esc(company(c.companyId))}</span><b>${esc(c.title)}</b><span>Account ${esc(user(state.companies.find(co => co.id === c.companyId)?.ownerId))}</span></div>${pill(c.status)}<div class="next-cell"><span class="overline">下一步 · ${esc(user(c.nextOwnerId))}</span><span>${esc(c.nextAction)}</span></div><div class="date-cell"><span>最近聯繫 ${date(c.lastContactAt)}</span><b>${c.dueDate ? '預計 ' + esc(c.dueDate.slice(5)) : '未訂日期'}</b></div>${icon('arrow')}</button>`).join('');
  }
  function homeSearchResults() {
    if (!homeQuery.trim()) return '';
    const q = homeQuery.toLowerCase();
    const found = state.companies.filter(c => (c.name + state.contacts.filter(ct => ct.companyId === c.id).map(ct => ct.name).join('')).toLowerCase().includes(q));
    return found.length ? found.map(c => `<button class="search-result" data-action="company" data-id="${c.id}"><span><b>${esc(c.name)}</b><small>${esc(user(c.ownerId))} · ${state.contacts.filter(ct => ct.companyId === c.id).length} 位聯絡人</small></span>${icon('arrow')}</button>`).join('') : '<p class="search-empty">沒有符合的企業或聯絡人</p>';
  }
  function memoCards(items) {
    return items.map(m => `<article class="memo-item"><div class="timeline-dot"></div><div class="memo-meta"><span>${date(m.occurredAt)}</span><span>${esc(m.channel)} · ${esc(user(m.authorId))}</span></div><h3>${esc(company(m.companyId))}<span>／${esc(contact(m.contactId))}</span></h3><p>${esc(m.summary)}</p><div class="memo-next"><b>下一步</b><span>${esc(m.nextAction)}</span><span class="subtle">${esc(user(m.nextOwnerId))}${m.dueDate ? ' · ' + esc(m.dueDate) : ''}</span></div>${m.caseId ? `<button class="text-btn" data-action="case-detail" data-id="${m.caseId}">查看關聯案件 ${icon('arrow')}</button>` : '<span class="subtle">僅企業往來，未更新案件下一步</span>'}</article>`).join('');
  }
  function homeView() {
    const cases = visibleCases(), active = cases.filter(c => c.status !== '已完成');
    const recent = state.memos.filter(m => scope !== 'mine' || m.authorId === role).sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)).slice(0, 3);
    return `<div class="page-heading home-heading"><div><span class="eyebrow">${role === 'u3' ? '主管總覽' : '我的工作'}</span><h1>工作台</h1><p>記錄往來，接續下一步。</p></div><button class="btn primary quick-entry" data-action="new-memo">${icon('plus')} 快記一筆</button></div><section class="home-search"><label for="home-search">找企業或聯絡人</label><div class="search-field">${icon('company')}<input id="home-search" type="search" placeholder="企業、聯絡人" value="${esc(homeQuery)}"></div><div id="home-search-results">${homeSearchResults()}</div></section><section class="panel work-section"><div class="section-head"><div><h2>下一步</h2><p>${active.length} 個待追蹤 · ${cases.filter(c => c.status === '待回覆').length} 個待回覆</p></div><div class="segmented"><button data-action="scope" data-scope="all" class="${scope === 'all' ? 'active' : ''}">全部</button><button data-action="scope" data-scope="mine" class="${scope === 'mine' ? 'active' : ''}">我的</button></div></div>${active.length ? caseRows(active.sort((a, b) => a.dueDate.localeCompare(b.dueDate))) : empty('目前沒有待追蹤的案件')}<div class="panel-footer"><button class="text-btn" data-action="nav" data-page="case">全部案件 ${icon('arrow')}</button></div></section><section class="panel work-section"><div class="section-head"><h2>最近聯繫</h2><button class="text-btn" data-action="nav" data-page="memo">全部紀錄 ${icon('arrow')}</button></div><div class="timeline">${recent.length ? memoCards(recent) : empty('目前角色尚無業務紀錄')}</div></section>`;
  }
  function companyView() {
    const companies = filtered(state.companies, c => c.name + user(c.ownerId));
    const selected = state.companies.find(c => c.id === selectedCompany) || state.companies[0];
    selectedCompany = selected.id;
    const contacts = state.contacts.filter(c => c.companyId === selected.id);
    const cases = state.cases.filter(c => c.companyId === selected.id);
    const memos = state.memos.filter(m => m.companyId === selected.id).sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
    return `<div class="page-heading company-heading ${companyDetailOpen ? 'detail-active' : ''}"><div><span class="eyebrow">企業與聯絡人</span><h1>企業與聯絡人</h1><p>企業是往來紀錄的起點，聯絡人與負責業務清楚歸屬。</p></div><button class="btn" data-action="new-company">${icon('plus')} 新增模擬企業</button></div><div class="company-layout ${companyDetailOpen ? 'detail-open' : ''}"><section class="panel company-list"><label class="search-label">搜尋企業或業務<input id="search" type="search" placeholder="輸入企業或業務名稱" value="${esc(filter)}"></label><div class="list-caption">${companies.length} 間模擬企業</div>${companies.map(c => `<button class="company-item ${selected.id === c.id ? 'selected' : ''}" data-action="company" data-id="${c.id}"><span class="company-initial">${esc(c.name.charAt(0))}</span><div><b>${esc(c.name)}</b><span>Account ${esc(user(c.ownerId))}</span><small>${esc(state.contacts.find(ct => ct.companyId === c.id)?.name || '尚無聯絡人')} · 最近 ${date(M.lastContact(state, c.id))}</small></div>${icon('arrow')}</button>`).join('') || empty('沒有符合的企業')}</section><div class="company-detail"><button class="text-btn company-back" data-action="company-back">‹ 企業清單</button><section class="panel"><div class="company-title"><div><span class="tag neutral">${esc(selected.category)}</span><h2>${esc(selected.name)}</h2><p>聯絡窗口 ${esc(contact(memos[0]?.contactId || contacts[0]?.id))} · 模擬資料</p></div><button class="btn primary" data-action="new-memo" data-id="${selected.id}">${icon('plus')} 記錄聯繫</button></div><div class="company-summary"><div><span>Account 負責業務</span><b>${esc(user(selected.ownerId))}</b><button class="text-btn" data-action="reassign" data-id="${selected.id}">調整歸屬</button></div><div><span>最近聯繫</span><b>${date(M.lastContact(state, selected.id))}</b></div><div><span>所屬聯絡人</span><b>${contacts.length} 位</b></div></div></section><section class="panel"><div class="section-head"><h2>所屬聯絡人</h2><button class="btn small" data-action="new-contact" data-id="${selected.id}">${icon('plus')} 新增聯絡人</button></div><div class="contacts-grid">${contacts.map(c => `<div class="contact-card"><span class="avatar">${esc(c.name.slice(-1))}</span><div><h3>${esc(c.name)}</h3><p>${esc(c.title)}</p><span>${esc(c.contactMethod)}</span><small>負責業務：${esc(user(c.ownerId))}</small></div><button class="icon-btn" title="為${esc(c.name)}新增紀錄" aria-label="為${esc(c.name)}新增紀錄" data-action="new-memo" data-id="${selected.id}" data-contact="${c.id}">${icon('plus')}</button></div>`).join('') || empty('此企業尚無聯絡人')}</div></section><section class="panel"><div class="section-head"><h2>關聯案件</h2><button class="btn small" data-action="new-case" data-id="${selected.id}">${icon('plus')} 新增案件</button></div>${cases.length ? caseRows(cases) : empty('此企業尚無案件')}</section><section class="panel"><div class="section-head"><h2>往來時間序</h2><span class="subtle">${memos.length} 筆模擬紀錄</span></div><div class="timeline">${memos.length ? memoCards(memos) : empty('留下第一筆聯繫紀錄')}</div></section></div></div>`;
  }
  function caseView() {
    const cases = filtered(state.cases, c => c.title + company(c.companyId) + c.nextAction + user(c.nextOwnerId)).filter(c => caseFilter === 'all' || c.status === caseFilter);
    return `<div class="page-heading"><div><span class="eyebrow">進度與歸屬</span><h1>案件</h1><p>最近聯繫、下一步與接手的人。</p></div><button class="btn" data-action="new-case">${icon('plus')} 新增案件</button></div><div class="toolbar"><label class="search-label">搜尋案件<input id="search" type="search" placeholder="企業、案件、負責人" value="${esc(filter)}"></label><label class="status-filter">案件狀態<select id="case-filter"><option value="all">全部狀態</option>${M.STATUSES.map(v => `<option ${v === caseFilter ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div><section class="case-list">${cases.map(c => `<article class="case-shell"><button class="kanban-card" data-action="case-detail" data-id="${c.id}"><div class="case-card-top"><span>${esc(company(c.companyId))}</span>${pill(c.status)}</div><h3>${esc(c.title)}</h3><div class="card-next"><span class="overline">下一步</span><p>${esc(c.nextAction)}</p></div><div class="case-ownership"><span>Account ${esc(user(state.companies.find(co => co.id === c.companyId)?.ownerId))}</span><span>接手 ${esc(user(c.nextOwnerId))}</span></div><div class="card-date">最近聯繫 ${date(c.lastContactAt)}${c.dueDate ? ' · 預計 ' + esc(c.dueDate.slice(5)) : ''}</div></button><button class="btn small case-quick" data-action="case-memo" data-id="${c.id}">${icon('plus')} 記錄聯繫</button></article>`).join('') || empty('沒有符合的案件')}</section>`;
  }
  function memoView() {
    const memos = filtered(state.memos, m => company(m.companyId) + contact(m.contactId) + m.summary + m.nextAction).sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
    return `<div class="page-heading"><div><span class="eyebrow">往來紀錄</span><h1>往來紀錄</h1><p>業務回報與 Call memo 集中留存，接手時不用重新拼湊。</p></div><button class="btn primary" data-action="new-memo">${icon('plus')} 新增業務紀錄</button></div><div class="toolbar"><label class="search-label">搜尋往來內容<input id="search" type="search" placeholder="企業、聯絡人或紀錄關鍵字" value="${esc(filter)}"></label><span class="subtle">${memos.length} 筆紀錄 · 依聯繫時間排序</span></div><section class="panel"><div class="timeline memo-page">${memos.length ? memoCards(memos) : empty('沒有符合的業務紀錄')}</div></section>`;
  }
  function catalogView() {
    const groups = [...new Set(M.FEATURES.map(f => f.group))];
    const ordered = groups.flatMap(g => M.FEATURES.filter(f => f.group === g));
    const items = ordered.filter(f => (catalogGroup === 'all' || f.group === catalogGroup) && (!catalogQuery || [String(ordered.indexOf(f) + 1).padStart(2, '0'), f.name, f.group, f.description].join(' ').toLowerCase().includes(catalogQuery.toLowerCase())));
    return `<div class="page-heading catalog-heading"><div><h1>功能大全</h1><p>${M.FEATURES.length} 項功能簡表 · 常見 CRM 功能與 KT 會議需求</p></div></div><p class="catalog-note">供需求討論參考。可試用項目使用模擬資料；其餘尚未實作或未串接。ERP、報價與財務另行評估，時程與費用另議。</p><div class="catalog-filters"><label>搜尋功能<input id="catalog-search" type="search" value="${esc(catalogQuery)}" placeholder="編號、功能或關鍵字"></label><label>功能群組<select id="catalog-group"><option value="all">全部群組</option>${groups.map(g => `<option ${g === catalogGroup ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select></label></div><div class="catalog-results"><span>${items.length} 項功能</span><button class="text-btn" data-action="catalog-clear">清除篩選</button></div><table class="catalog-table"><caption class="sr-only">KT 與常見 CRM 功能簡表，編號 01 至 50</caption><thead><tr><th scope="col">編號</th><th scope="col">功能與說明</th><th scope="col">目前狀態</th></tr></thead>${groups.filter(g => items.some(f => f.group === g)).map(g => `<tbody><tr class="catalog-group-row"><th scope="rowgroup" colspan="3">${esc(g)}</th></tr>${items.filter(f => f.group === g).map(f => `<tr class="catalog-row" id="feature-${f.id}"><td class="catalog-number">${String(ordered.indexOf(f) + 1).padStart(2, '0')}</td><td><b>${esc(f.name)}</b><span class="catalog-description">${esc(f.description)}</span><small>${esc(f.origin.startsWith('會議') ? 'KT ' + f.origin : f.origin === '另行評估' ? '另行評估' : '常見 CRM 候選')}</small></td><td><span class="catalog-status ${f.status === '可試用' ? 'operative' : ''}">${esc(f.status)}</span></td></tr>`).join('')}</tbody>`).join('')}</table>${items.length ? '' : '<div class="empty"><b>沒有符合的功能</b><p>調整關鍵字或清除篩選。</p></div>'}`;
  }
  function render() {
    const view = ({ home: homeView, company: companyView, case: caseView, memo: memoView, review: catalogView })[page];
    const short = {home:'工作',company:'企業',case:'案件',memo:'紀錄',review:'功能'};
    app.innerHTML = `<aside class="sidebar"><div class="brand"><img src="assets/kingtile-logo.svg" alt="KING TILE 鉅成" width="181" height="42"><small>業務工作台 · CRM</small></div><nav aria-label="主選單">${Object.entries(labels).map(([id, text]) => `<button data-action="nav" data-page="${id}" class="nav-item ${page === id || page === 'memo' && id === 'home' && window.innerWidth < 900 ? 'active' : ''}" ${page === id ? 'aria-current="page"' : ''}>${icon(id)}<span class="nav-full">${text}</span><span class="nav-short">${short[id]}</span></button>`).join('')}</nav><div class="sidebar-bottom"><p>需求確認用原型<br>模擬資料 · 本機保存</p><button class="text-btn" data-action="about">使用說明 ${icon('arrow')}</button></div></aside><div class="workspace"><header class="topbar"><div class="mobile-brand"><img src="assets/kingtile-logo.svg" alt="KING TILE 鉅成" width="181" height="42"></div><div class="breadcrumb">鉅成 CRM <span>/</span> ${labels[page]}</div><div class="role-control"><label for="role">角色示意</label><select id="role" aria-label="切換示範角色">${userOptions(role)}</select></div></header><div class="prototype-banner"><b>需求確認用原型／模擬資料</b><span>角色僅示意，尚無正式權限。請勿輸入真實客戶資料。本機保存，不跨人同步。</span></div>${storageMessage ? `<div class="storage-warning">${esc(storageMessage)}</div>` : ''}<main id="main" tabindex="-1">${view()}</main><footer class="footer"><span id="save-state">${storageOk ? '已存於此瀏覽器' : '本次操作尚未保存'}</span><button class="text-btn" data-action="about">使用說明</button><button class="text-btn" data-action="reset">重設示範資料</button></footer></div>`;
  }
  function modal(title, content) {
    dialog.innerHTML = `<div class="dialog-heading"><div><span class="eyebrow">模擬情境</span><h2 id="dialog-title">${title}</h2></div><button class="icon-btn" data-action="close" aria-label="關閉">×</button></div>${content}`;
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    dialog.querySelector('[autofocus]')?.focus({ preventScroll: true });
  }
  const formFooter = text => `<p id="form-error" role="alert"></p><div class="form-footer"><button type="button" class="btn" data-action="close">取消</button><button class="btn primary" type="submit">${text}</button></div>`;
  const candidateNote = '<div class="form-note">所有欄位皆為候選，請只輸入合成情境，不填真實客戶個資或機密。</div>';
  function memoForm(companyId = selectedCompany, contactId = '', caseId = '') {
    const localTime = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 16);
    modal('記錄聯繫', `<form id="memo-form" class="quick-memo"><div class="memo-context"><span id="memo-context-name"></span><button type="button" class="text-btn" data-action="memo-details">調整</button></div><div id="memo-update-scope" class="memo-update-scope" role="status"></div><label>這次聯繫的重點 <span class="required-hint">必填</span><textarea name="summary" rows="3" maxlength="2000" required placeholder="談到什麼？確認了什麼？" autofocus></textarea></label><label>下一步 <span class="required-hint">必填</span><textarea name="nextAction" rows="2" maxlength="2000" required placeholder="接下來要做什麼？"></textarea></label><label>預計日期 <span class="required-hint">選填</span><input name="dueDate" type="date"></label><p id="memo-defaults-visible" class="memo-defaults-visible"></p><details class="memo-details"><summary>聯絡人、案件與紀錄資料</summary><div class="form-grid"><label>企業<select name="companyId" id="memo-company">${companyOptions(companyId)}</select></label><label>聯絡人<select name="contactId" id="memo-contact" required></select></label><label>關聯案件（選填）<select name="caseId" id="memo-case"></select></label><label>紀錄人<select name="authorId">${userOptions(role)}</select></label><label>聯繫時間（台灣）<input name="occurredAt" type="datetime-local" value="${localTime}" required></label><label>聯繫方式<select name="channel"><option>電話</option><option>拜訪</option><option>線上會議</option><option>其他</option></select></label><label>下一步負責人<select name="nextOwnerId">${userOptions(state.companies.find(c => c.id === companyId)?.ownerId || 'u1')}</select></label></div></details><p class="form-note">只填合成情境，不填真實個資或機密。資料僅存此瀏覽器。</p>${formFooter('保存紀錄')}</form>`);
    syncMemoSelects(companyId, contactId, caseId);
  }
  function syncMemoSelects(companyId, contactId = '', caseId = '') {
    const contacts = state.contacts.filter(c => c.companyId === companyId);
    const latest = state.memos.filter(m => m.companyId === companyId && (!caseId || m.caseId === caseId)).sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))[0];
    const preferredContact = contactId || latest?.contactId || contacts[0]?.id;
    document.querySelector('#memo-contact').innerHTML = contacts.length ? contacts.map(c => `<option value="${c.id}" ${c.id === preferredContact ? 'selected' : ''}>${esc(c.name)} · ${esc(user(c.ownerId))}</option>`).join('') : '<option value="">請先新增示範聯絡人</option>';
    document.querySelector('#memo-case').innerHTML = '<option value="">不關聯案件（僅企業往來）</option>' + state.cases.filter(c => c.companyId === companyId).map(c => `<option value="${c.id}" ${c.id === caseId ? 'selected' : ''}>${esc(c.title)}</option>`).join('');
    syncMemoContext(true);
  }
  function syncMemoContext(resetOwner = false) {
    const form = document.querySelector('#memo-form');
    const linked = state.cases.find(c => c.id === form.elements.caseId.value);
    if (resetOwner) {
      form.elements.nextOwnerId.value = linked?.nextOwnerId || state.companies.find(c => c.id === form.elements.companyId.value)?.ownerId || 'u1';
      form.elements.dueDate.value = linked?.dueDate || '';
    }
    const notice = document.querySelector('#memo-update-scope');
    notice.classList.toggle('unlinked', !linked);
    notice.textContent = linked ? `已關聯 ${linked.title} · 保存會更新案件下一步與最近聯繫` : '僅存企業聯繫，未關聯案件，不更新案件下一步。';
    form.querySelector('button[type="submit"]').textContent = linked ? '保存並更新案件' : '保存企業往來';
    const defaults = `下一步由 ${user(form.elements.nextOwnerId.value)} 接手 · ${form.elements.channel.value}`;
    document.querySelector('#memo-context-name').textContent = company(form.elements.companyId.value) + ' · ' + contact(form.elements.contactId.value);
    document.querySelector('#memo-defaults-visible').textContent = defaults;
  }
  function caseForm(id = '', companyId = selectedCompany) {
    const c = state.cases.find(x => x.id === id);
    modal(c ? '案件進度與下一步' : '新增模擬案件', `<form id="case-form" data-id="${id}">${candidateNote}${c ? `<div class="case-modal-title"><h3>${esc(c.title)}</h3><p>${esc(company(c.companyId))} · 最近聯繫 ${date(c.lastContactAt)}</p><button type="button" class="btn case-memo-entry" data-action="case-memo" data-id="${c.id}">${icon('plus')} 新增此案件紀錄</button><small>帶入已保存的企業與案件；下方進度修改請先保存。</small></div>` : `<label>企業<select name="companyId">${companyOptions(companyId)}</select></label><label>示範案件名稱<input name="title" required maxlength="200" placeholder="例如：示範場域的需求確認"></label>`}<div class="form-grid"><label>案件進度<select name="status">${stateOptions(c?.status || '需求確認')}</select></label><label>下一步負責人<select name="nextOwnerId">${userOptions(c?.nextOwnerId || 'u1')}</select></label></div><label>下一步<textarea name="nextAction" required maxlength="2000" rows="3">${esc(c?.nextAction || '')}</textarea></label><label>預計日期（選填）<input name="dueDate" type="date" value="${esc(c?.dueDate || '')}"></label>${c ? `<div class="linked-memos"><b>關聯紀錄 ${state.memos.filter(m => m.caseId === id).length} 筆</b>${state.memos.filter(m => m.caseId === id).sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)).slice(0, 3).map(m => `<p><span>${date(m.occurredAt)}</span>${esc(m.summary)}</p>`).join('')}</div>` : ''}${formFooter('保存案件')}</form>`);
  }
  function about() {
    modal('使用說明', `<div class="about-content"><h3>先試用業務流程</h3><p>找企業與聯絡人，記錄聯繫重點、下一步與案件進度。「功能大全」以編號簡表列出常見 CRM 功能與 KT 會議需求，僅供討論參考。</p><h3>本機保存</h3><p>新增的模擬操作只存在目前瀏覽器，不同人、瀏覽器、裝置或網址不會同步。清除瀏覽器資料或確認重設會移除本機模擬紀錄。</p><h3>範圍與角色</h3><p>企業、人物與往來均為合成情境，角色切換只示範視角。尚未實作或未串接的項目僅列功能說明；ERP、報價、成本、損益與付款另行評估。沒有生產 API、發訊、下單或正式登入與權限。</p><h3>品牌</h3><p>使用 KING TILE 鉅成官網原始 Logo，並以原圖的深棕與米金安排介面。</p></div><div class="form-footer"><button class="btn primary" data-action="close">了解</button></div>`);
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-action]'); if (!button) return;
    const { action, id } = button.dataset;
    if (action === 'close') { dialog.close(); return; }
    if (action === 'nav') { page = button.dataset.page; filter = ''; if (page === 'company') companyDetailOpen = false; render(); window.scrollTo(0, 0); }
    else if (action === 'company') { companyScroll = window.scrollY; page = 'company'; selectedCompany = id; companyDetailOpen = true; render(); if (window.innerWidth < 900) window.scrollTo(0, 0); }
    else if (action === 'company-back') { companyDetailOpen = false; render(); window.scrollTo(0, companyScroll); }
    else if (action === 'memo-details') { const d = document.querySelector('.memo-details'); d.open = true; d.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    else if (action === 'scope') { scope = button.dataset.scope; render(); }
    else if (action === 'new-memo') memoForm(id || selectedCompany, button.dataset.contact);
    else if (action === 'case-memo') { const item = state.cases.find(c => c.id === id); memoForm(item.companyId, '', item.id); }
    else if (action === 'case-detail') caseForm(id);
    else if (action === 'new-case') caseForm('', id || selectedCompany);
    else if (action === 'new-company') modal('新增模擬企業', `<form id="company-form">${candidateNote}<label>示範企業名稱<input name="name" required maxlength="120" placeholder="僅填虛構企業名稱"></label><label>Account 負責業務<select name="ownerId">${userOptions('u1')}</select></label>${formFooter('新增模擬企業')}</form>`);
    else if (action === 'new-contact') modal('新增示範聯絡人', `<form id="contact-form" data-id="${id}">${candidateNote}<p>${esc(company(id))} · 模擬企業</p><label>示範聯絡人名稱<input name="name" required maxlength="120" placeholder="例如：示範聯絡人 F"></label><div class="form-grid"><label>窗口角色<input name="title" maxlength="120" placeholder="例如：採購窗口"></label><label>負責業務<select name="ownerId">${userOptions(state.companies.find(c => c.id === id).ownerId)}</select></label></div><label>聯絡方式示意<input name="contactMethod" required maxlength="200" placeholder="例如：測試電話（未填號碼）"></label>${formFooter('新增示範聯絡人')}</form>`);
    else if (action === 'reassign') modal('調整 Account 歸屬', `<form id="owner-form" data-id="${id}">${candidateNote}<h3>${esc(company(id))}</h3><label>新的負責業務<select name="ownerId">${userOptions(state.companies.find(c => c.id === id).ownerId)}</select></label><p class="subtle">本示意僅調整企業的負責業務。聯絡人與下一步負責人保留原指派，實際交接規則待確認。</p>${formFooter('保存歸屬')}</form>`);
    else if (action === 'catalog-clear') { catalogGroup = 'all'; catalogQuery = ''; render(); }
    else if (action === 'about') about();
    else if (action === 'reset') modal('重設此瀏覽器的示範資料？', '<p class="reset-note">會清除此瀏覽器新增的模擬企業、案件與往來紀錄，恢復最初情境。</p><div class="form-footer"><button class="btn" data-action="close">保留現有資料</button><button class="btn danger" data-action="confirm-reset">確認重設</button></div>');
    else if (action === 'confirm-reset') { state = M.seed(); selectedCompany = 'co1'; storageMessage = ''; persist(); dialog.close(); render(); toast('已恢復最初示範情境'); }
  });
  document.addEventListener('input', event => {
    if (event.target.id === 'catalog-search') { const start = event.target.selectionStart; catalogQuery = event.target.value; render(); const node = document.querySelector('#catalog-search'); node.focus(); node.setSelectionRange(start, start); }
    if (event.target.id === 'home-search') { homeQuery = event.target.value; document.querySelector('#home-search-results').innerHTML = homeSearchResults(); }
    if (event.target.id === 'search') {
      const start = event.target.selectionStart; filter = event.target.value; render();
      const input = document.querySelector('#search'); input.focus(); input.setSelectionRange(start, start);
    }
  });
  document.addEventListener('change', event => {
    if (event.target.id === 'catalog-group') { catalogGroup = event.target.value; render(); }
    if (event.target.id === 'role') { role = event.target.value; scope = role === 'u3' ? 'all' : 'mine'; render(); toast('已切換示範視角；此功能不代表正式權限'); }
    if (event.target.id === 'case-filter') { caseFilter = event.target.value; render(); }
    if (event.target.id === 'memo-company') syncMemoSelects(event.target.value);
    else if (event.target.id === 'memo-case') syncMemoContext(true);
    else if (event.target.closest('#memo-form')) syncMemoContext();
  });
  document.addEventListener('submit', event => {
    if (!event.target.closest('#dialog')) return; event.preventDefault();
    const form = event.target, input = Object.fromEntries(new FormData(form));
    try {
      let savedMessage = '已保存模擬操作至此瀏覽器';
      if (form.id === 'memo-form') {
        input.occurredAt += ':00+08:00';
        const linked = state.cases.find(c => c.id === input.caseId);
        const historical = linked?.lastContactAt && Date.parse(input.occurredAt) < Date.parse(linked.lastContactAt);
        M.addMemo(state, input);
        savedMessage = !linked ? '已存企業往來；未關聯案件，不更新案件下一步' : historical ? '已加入往來時間序；較早紀錄未覆蓋案件下一步' : '已存於本機，並更新案件最近聯繫與下一步';
      }
      else if (form.id === 'case-form') { if (form.dataset.id) M.updateCase(state, form.dataset.id, input); else M.addCase(state, input); }
      else if (form.id === 'company-form') { selectedCompany = M.addCompany(state, input).id; page = 'company'; companyDetailOpen = true; }
      else if (form.id === 'contact-form') M.addContact(state, { ...input, companyId: form.dataset.id });
      else if (form.id === 'owner-form') state.companies.find(c => c.id === form.dataset.id).ownerId = input.ownerId;
      persist(); dialog.close(); render(); toast(storageOk ? savedMessage : '本次操作尚未保存，請稍後重新保存');
    } catch (error) { form.querySelector('#form-error').textContent = error.message; }
  });
  dialog.addEventListener('invalid', event => { const details = event.target.closest('details'); if (details) details.open = true; }, true);
  render();
})();
