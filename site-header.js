/* Shared header. News keeps its existing account controller; other pages only request auth status. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.SiteHeader = api; api.mount(); }
})(typeof globalThis === 'undefined' ? this : globalThis, function() {
  'use strict';
  const ACTIONS = new Set(['status', 'send-code', 'verify-code', 'logout']);

  function createAuth({ fetcher = globalThis.fetch, onChange = () => {} } = {}) {
    let mode = 'checking', user = null, generation = 0, busy = false;
    const state = () => ({ mode, user, busy });
    const emit = () => onChange(state());
    function invalidate() { generation++; user = null; mode = 'checking'; emit(); }
    async function request(action, body) {
      if (!ACTIONS.has(action)) throw Error('지원하지 않는 계정 요청입니다.');
      const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 20000);
      try {
        const response = await fetcher('/api/news?reader=' + action, {
          method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store',
          headers: { 'X-News-Reader': '1', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: abort.signal
        });
        let data; try { data = await response.json(); } catch { data = {}; }
        if (!response.ok || !data.ok) throw Error(data.error || '로그인 상태를 확인하지 못했습니다.');
        return data;
      } finally { clearTimeout(timer); }
    }
    async function sync() {
      if (busy) return state();
      invalidate(); const current = generation;
      try {
        const result = await request('status');
        if (generation !== current) return state();
        user = result.user && typeof result.user.id === 'string' && typeof result.user.email === 'string'
          ? { id: result.user.id, email: result.user.email } : null;
        mode = result.ready ? (user ? 'account' : 'signedout') : 'unavailable';
        emit(); return state();
      } catch (error) {
        if (generation === current) { mode = 'blocked'; user = null; emit(); }
        throw error;
      }
    }
    async function change(action, body, refresh) {
      if (busy) throw Error('앞선 요청이 끝난 뒤 다시 눌러 주세요.');
      if (refresh) invalidate();
      const current = generation; busy = true; emit();
      let result;
      try {
        result = await request(action, body);
        if (generation !== current) throw Error('다른 탭에서 계정이 바뀌었습니다. 로그인 상태를 다시 확인해 주세요.');
      } catch (error) {
        if (refresh && generation === current) { user = null; mode = 'blocked'; }
        throw error;
      } finally { busy = false; emit(); }
      if (refresh) await sync();
      return result;
    }
    return {
      state, sync, invalidate,
      sendCode: email => change('send-code', { email }, false),
      verifyCode: (email, code) => change('verify-code', { email, code }, true),
      logout: () => change('logout', {}, true)
    };
  }

  function mount() {
    const d = document, header = d.querySelector('[data-site-header]');
    if (!header || header.dataset.controllerReady) return;
    header.dataset.controllerReady = 'true';
    const make = (tag, props = {}, ...children) => {
      const n = d.createElement(tag);
      for (const [k, v] of Object.entries(props)) {
        if (k === 'text') n.textContent = v;
        else if (k === 'class') n.className = v;
        else n.setAttribute(k, String(v));
      }
      children.flat().forEach(x => { if (x != null) n.append(x); });
      return n;
    };
    const button = (text, action, extra = {}) => make('button', { type: 'button', class: 'site-account-action', text, 'data-account-action': action, ...extra });
    const input = d.getElementById('globalDossierSearch'), results = d.getElementById('globalDossierResults');
    let searchNumber = 0, searchAbort, searchTimer;
    function closeSearch() {
      searchNumber++; clearTimeout(searchTimer); searchAbort?.abort();
      results.hidden = true; input.setAttribute('aria-expanded', 'false');
    }
    async function search() {
      const query = input.value.trim(), current = ++searchNumber;
      searchAbort?.abort();
      if (!query) { closeSearch(); results.replaceChildren(); return; }
      searchAbort = new AbortController(); const active = searchAbort;
      const timeout = setTimeout(() => active.abort(), 12000);
      results.hidden = false; input.setAttribute('aria-expanded', 'true');
      results.replaceChildren(make('div', { class: 'global-dossier-empty', text: '검색 중…' }));
      try {
        const response = await fetch('/api/entity?action=search&q=' + encodeURIComponent(query) + '&limit=8', { signal: active.signal });
        const data = await response.json();
        if (current !== searchNumber) return;
        if (!response.ok || !data.ok || !Array.isArray(data.items)) throw Error('취재파일을 검색하지 못했습니다.');
        const rows = data.items.filter(x => x && typeof x.entity_key === 'string');
        results.replaceChildren(...(rows.length ? rows.map(x => make('button', {
          type: 'button', class: 'global-dossier-result', 'data-dossier-entity': x.entity_key
        }, make('b', { text: x.canonical_name || x.entity_key }), make('span', { text: x.type_label || '취재대상' }))) :
          [make('div', { class: 'global-dossier-empty', text: '일치하는 취재파일이 없습니다.' })]));
      } catch (error) {
        if (current === searchNumber) results.replaceChildren(make('div', { class: 'global-dossier-empty', text: '검색하지 못했습니다. 다시 입력해 주세요.' }));
      } finally { clearTimeout(timeout); }
    }
    input.addEventListener('input', () => { closeSearch(); searchTimer = setTimeout(search, 220); });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); clearTimeout(searchTimer); search(); }
      else if (e.key === 'Escape') closeSearch();
      else if (e.key === 'ArrowDown' && !results.hidden) { e.preventDefault(); results.querySelector('button')?.focus(); }
    });
    results.addEventListener('keydown', e => {
      const buttons = [...results.querySelectorAll('button')], index = buttons.indexOf(d.activeElement);
      if (e.key === 'Escape') { closeSearch(); input.focus(); }
      else if (['ArrowDown', 'ArrowUp'].includes(e.key) && buttons.length) {
        e.preventDefault(); buttons[(index + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length].focus();
      }
    });
    d.addEventListener('click', e => {
      if (!e.target.closest('.global-dossier-search')) closeSearch();
      if (e.target.closest('.global-dossier-result')) { closeSearch(); input.value = ''; }
    });

    // The relocated news button still uses the existing news account dialog and private-state machine.
    // Never create a second auth client or run a second login click handler on the news page.
    if (d.querySelector('.news-desk')) return;

    const login = d.getElementById('readerAccount');
    const dialog = make('dialog', { id: 'siteAccountDialog', class: 'site-account-dialog', 'aria-labelledby': 'siteAccountTitle' });
    d.body.append(dialog);
    login.setAttribute('aria-controls', dialog.id);
    let displayedUser = null, authError = '', uiBusy = false, dialogNumber = 0, recheckTimer;
    function scrubDialog() { dialogNumber++; if (dialog.open) dialog.close(); dialog.replaceChildren(); }
    const auth = createAuth({ onChange(s) {
      if (displayedUser && displayedUser !== s.user?.id) scrubDialog();
      displayedUser = s.user?.id || null;
      login.textContent = s.user ? '내 계정' : '로그인';
      login.title = s.user ? s.user.email : s.mode === 'checking' ? '로그인 상태 확인 중' : '로그인';
      login.setAttribute('aria-busy', String(s.mode === 'checking'));
      if (s.user && dialog.open && dialog.querySelector('#siteAccountEmail')) showDialog();
    }});
    let channel;
    try { if (window.BroadcastChannel) channel = new BroadcastChannel('ib-news-account-events'); } catch {}
    function broadcast() { channel?.postMessage({ changed: true }); }
    async function recheck() {
      clearTimeout(recheckTimer);
      if (document.hidden) return;
      if (auth.state().busy || uiBusy) { recheckTimer = setTimeout(recheck, 150); return; }
      try { await auth.sync(); authError = ''; }
      catch (error) { authError = error.message; }
    }
    function showDialog() {
      const s = auth.state();
      const parts = [make('header', {}, make('h2', { id: 'siteAccountTitle', text: s.user ? '내 계정' : '로그인' }),
        button('×', 'close', { class: 'site-dialog-close', 'aria-label': '로그인 창 닫기' }))];
      if (s.user) {
        parts.push(make('p', { text: s.user.email + ' 계정으로 로그인했습니다.' }),
          make('a', { href: '/', class: 'site-account-action', text: '뉴스 보관함 관리' }), button('로그아웃', 'logout'));
      } else {
        parts.push(make('p', { text: '뉴스에서 사용하는 계정으로 로그인하세요.' }),
          make('label', { for: 'siteAccountEmail', text: '이메일' }),
          make('input', { id: 'siteAccountEmail', type: 'email', autocomplete: 'email', maxlength: 254, placeholder: '이메일 주소' }),
          button('인증 메일 받기', 'send'),
          make('label', { for: 'siteAccountCode', text: '인증번호 또는 로그인 링크' }),
          make('input', { id: 'siteAccountCode', type: 'password', autocomplete: 'one-time-code', maxlength: 4096, placeholder: '메일의 인증번호 또는 링크 붙여넣기' }),
          button('인증하고 로그인', 'verify', { class: 'site-account-action site-account-primary' }), button('로그인 상태 다시 확인', 'sync'),
          make('p', { class: 'site-account-note', text: '번호 없이 링크만 오면 링크를 누르지 말고 주소를 복사해 붙여넣으세요. 인증번호와 링크는 다른 사람에게 보내지 마세요.' }));
      }
      parts.push(make('p', { id: 'siteAccountMessage', role: 'status', text: authError }),
        make('p', { class: 'site-account-note', text: '계정 저장은 뉴스 보관·읽음·추적 기록에 적용합니다. 진행중 취재 메모와 기존 브라우저 기록은 자동으로 옮기지 않습니다. 공용 기기에서는 로그아웃해 주세요.' }));
      dialogNumber++; dialog.replaceChildren(...parts);
      if (!dialog.open) dialog.showModal();
      if (!s.user) dialog.querySelector('input')?.focus();
    }
    login.addEventListener('click', showDialog);
    dialog.addEventListener('close', () => { dialogNumber++; dialog.replaceChildren(); login.focus({ preventScroll: true }); });
    dialog.addEventListener('click', async e => {
      const b = e.target.closest('[data-account-action]'); if (!b) return;
      const action = b.dataset.accountAction;
      if (action === 'close') { scrubDialog(); return; }
      if (uiBusy) return;
      const email = dialog.querySelector('#siteAccountEmail')?.value.trim();
      const code = dialog.querySelector('#siteAccountCode')?.value.trim();
      const message = dialog.querySelector('#siteAccountMessage');
      const currentDialog = dialogNumber;
      if (['send', 'verify'].includes(action) && !dialog.querySelector('#siteAccountEmail')?.reportValidity()) return;
      if (['send', 'verify'].includes(action) && !email) { message.textContent = '이메일 주소를 입력해 주세요.'; return; }
      if (action === 'verify' && !code) { message.textContent = '메일의 인증번호 또는 링크를 입력해 주세요.'; return; }
      if (action === 'verify') dialog.querySelector('#siteAccountCode').value = '';
      authError = ''; uiBusy = true; b.disabled = true; message.textContent = '처리 중…';
      try {
        if (action === 'send') {
          const result = await auth.sendCode(email);
          if (currentDialog === dialogNumber && message.isConnected) message.textContent = result.message || '인증 메일을 보냈습니다.';
        } else if (action === 'verify') {
          await auth.verifyCode(email, code); broadcast();
          if (!auth.state().user) throw Error('인증 후 로그인 상태를 확인하지 못했습니다. 다시 확인해 주세요.');
          if (dialog.open) showDialog();
        } else if (action === 'logout') {
          await auth.logout(); broadcast();
          if (auth.state().user) throw Error('로그아웃 상태를 확인하지 못했습니다.');
          scrubDialog();
        } else if (action === 'sync') { await auth.sync(); if (dialog.open) showDialog(); }
        authError = '';
      } catch (error) {
        authError = error.message;
        const currentMessage = dialog.querySelector('#siteAccountMessage');
        if (currentMessage) currentMessage.textContent = authError;
        else login.title = authError;
      } finally { uiBusy = false; if (b.isConnected) b.disabled = false; }
    });
    if (channel) channel.onmessage = () => { auth.invalidate(); scrubDialog(); recheck(); };
    window.addEventListener('pagehide', () => { auth.invalidate(); scrubDialog(); });
    window.addEventListener('pageshow', e => { if (e.persisted) recheck(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) recheck(); });
    recheck();
  }
  return { createAuth, mount };
});
