/* Display taxonomy, used by the news desk; also testable in Node. Not an article-value score. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NewsTaxonomy = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const categories = [
    { id: 'lp_selection', label: '출자·GP 선정', short: '출자·선정', hint: '출자공고, 심사, 운용사 선정', icon: '↗' },
    { id: 'fund_formation', label: '펀드 결성', short: '펀드 결성', hint: '결성 추진, 클로징, 결성 지연', icon: '◈' },
    { id: 'deal', label: '인수·매각·경영권', short: '인수·매각', hint: '입찰, 인수계약, 경영권 변화', icon: '⇄' },
    { id: 'investment_exit', label: '투자·회수', short: '투자·회수', hint: '투자유치, IPO, 세컨더리', icon: '↔' },
    { id: 'credit', label: '자금조달·신용', short: '조달·신용', hint: '회사채, 차환, PF, 회생', icon: '≋' },
    { id: 'people', label: '인사·조직', short: '인사·조직', hint: '운용역 이동, 대표 교체, 독립', icon: '♧' },
    { id: 'policy', label: '정책·제도', short: '정책·제도', hint: '법령, 감독, 출자 기준 변화', icon: '§' },
    { id: 'review', label: '분류 검토', short: '분류 검토', hint: '제목만으로 분류하기 어려운 보도', icon: '·' },
  ];
  const actors = [
    { id: 'PEF', label: 'PEF' }, { id: 'VC', label: 'VC·CVC' },
    { id: 'AC', label: 'AC' }, { id: 'LP', label: 'LP' }, { id: 'IB', label: '증권·은행' },
  ];
  function clean(value) { return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); }
  function definition(id) { return categories.find(x => x.id === id) || categories[categories.length - 1]; }
  function signals(text) {
    const t = clean(text), out = [];
    const add = (id, pattern) => { if (pattern.test(t)) out.push(id); };
    add('policy', /법률|법안|시행령|시행규칙|규제|감독규정|제도\s*(?:개편|개선|변경)|세제|과세|금투세|출자\s*(?:기준|규정|제한)|선정\s*기준|운용사.{0,16}가점|국민연금.{0,16}가점|주목적\s*투자\s*비율/i);
    add('people', /영입|선임|취임|사임|퇴사|승진|인사\s*(?:단행|개편)|조직\s*개편|대표\s*교체|운용역.{0,12}(?:이동|이탈|독립)|파트너.{0,12}(?:이동|이탈|독립)|신생\s*(?:운용사|VC|PEF)/i);
    if (/(?:대표|파트너|운용역|본부장|심사역|상무|전무).{0,20}합류/.test(t)) out.push('people');
    add('credit', /회생|파산|워크아웃|채무불이행|부도|디폴트|신용등급|회사채|공모채|\bDCM\b|환헤지|전환사채|교환사채|신주인수권부사채|메자닌|인수금융|리파이낸싱|차환|유상증자|자금\s*조달|유동성\s*(?:위기|부족)|채무\s*조정|\bPF\b|프로젝트\s*파이낸싱/i);
    const isFund = /펀드|조합|블라인드|GP|벤처캐피탈/.test(t);
    if (isFund && /결성|조성|펀드레이징|클로징|약정\s*총액|드라이파우더/.test(t)) out.push('fund_formation');
    add('lp_selection', /출자\s*(?:사업|공고|요청|확약|약정|승인|계획|규모|액|모집)|출자한다|출자키로|출자에\s*나|(?:GP|운용사|위탁운용사).{0,16}(?:선정|선발|모집)|(?:선정|선발).{0,12}(?:GP|운용사)|앵커\s*LP/i);
    // Remove financing/support phrases before looking for an acquisition event.
    if (/매각/.test(t.replace(/미매각/g, ''))) out.push('deal');
    add('deal', /매물|M&A|인수합병|공개매수|경영권|우선협상|본입찰|예비입찰|주식매매계약|바이아웃|주주행동|행동주의|의결권|주주총회|주총|표대결|합병/i);
    if (/인수/.test(t.replace(/예상인수결과|인수결과|보험\s*인수|인수단|인수금융|인수인계|인수위(?:원회)?|인수증|인수\s*주선/g, ''))) out.push('deal');
    add('investment_exit', /투자\s*유치|투자\s*참여|투자\s*결정|신규\s*투자|후속\s*투자|투자한다|투자했다|시리즈\s*[A-F]|프리\s*A|시드\s*투자|IPO|상장|블록딜|세컨더리|회수|엑시트|사모투자|지분\s*(?:투자|처분)/i);
    add('policy', /\b(?:regulat\w+|antitrust|legislation|tax rules)\b/i);
    add('people', /\b(?:appoints?|appointed|hires?|hired|steps down|resigns?|depart\w+)\b|\bpartner\b.{0,25}\b(?:joins?|leaves?)\b/i);
    add('credit', /\b(?:private credit|private debt|refinanc\w+|bankrupt\w+|default\w+|leveraged loans?|debt financing|acquisition financing)\b/i);
    if(/\bfund\b/i.test(t)&&/\b(?:rais\w+|clos\w+|launch\w+|fundrais\w+|target\w+)\b/i.test(t))out.push('fund_formation');
    add('lp_selection', /\b(?:commits?|commitments?|allocat\w+|manager selection)\b/i);
    add('deal', /\b(?:acquir\w+|acquisition\w*|mergers?|buyouts?|takeovers?|take-private|buys?|sells?|sale|bids?|activist)\b/i);
    add('investment_exit', /\b(?:funding|series [a-f]|seed round|IPO|initial public offering|secondar\w+|exits?|continuation fund)\b/i);
    const order = ['policy','people','credit','lp_selection','fund_formation','deal','investment_exit'];
    return [...new Set(out)].sort((a,b) => order.indexOf(a)-order.indexOf(b));
  }
  function classify(item) {
    if (typeof item === 'string') item = { title: item };
    item = item || {};
    const title = clean(item.title || item.headline);
    const snippet = clean(item.snippet);
    const found = signals(title);
    // Headline events outrank background terms in the snippet. No forced institution-based category.
    const matches = found.length ? found : signals(snippet);
    const primary = matches[0] || 'review';
    const entities = Array.isArray(item.related_entities) ? item.related_entities : [];
    const text = [title, snippet, item.target?.category || '', ...entities.map(x => x.type_label || x.entity_type || x.type || '')].join(' ');
    const actorIds = [];
    if (/\bPEF?\b|사모펀드|프라이빗에쿼티|private equity|buyout|바이아웃/i.test(text)) actorIds.push('PEF');
    if (/\bVC\b|\bCVC\b|venture capital|벤처캐피탈|벤처투자|기업형\s*벤처/i.test(text)) actorIds.push('VC');
    if (/\bAC\b|accelerator|액셀러레이터|액셀러레이팅|창업기획자/i.test(text)) actorIds.push('AC');
    if (/\bLP\b|limited partners?|pension fund|sovereign wealth|모태펀드|한국벤처투자|한국성장금융|국민연금|공제회|연기금|출자기관/i.test(text)) actorIds.push('LP');
    if (/investment bank|증권|은행|투자은행|\bIB\b/i.test(text)) actorIds.push('IB');
    return { category_id: primary, category_label: definition(primary).label,
      secondary_categories: matches.slice(1), actor_ids: actorIds,
      classification_basis: found.length ? '제목의 사건 표현' : matches.length ? '수집 요약의 사건 표현' : '판단할 표현 부족' };
  }
  function key(item) { return String(item?.source_url || '') || clean(item?.title) + '|' + String(item?.published_at || ''); }
  function time(value) { const n = Date.parse(value || ''); return Number.isFinite(n) ? n : 0; }
  function within(item, days, now) { const n = time(item.published_at); return !n || (n <= now + 300000 && n >= now - days * 86400000); }
  // Require headline evidence beyond a shared institution. Prefer extra rows to false merges.
  const generic = new Set('PEF PE VC LP GP IB 펀드 조합 결성 조성 인수 매각 투자 출자 선정 회사 기업 운용사 국민연금 산업은행 공제회 모태펀드 한국벤처투자 주총 주주총회 의결권 추진 완료 마무리 본격 올해 신규 최대 규모'.toLowerCase().split(' '));
  function headlineTokens(item) {
    return [...new Set(clean(item.title).replace(/\[[^\]]*\]/g,' ').toLowerCase()
      .replace(/주주총회/g,'주총').match(/[a-z0-9가-힣]{2,}/g) || [])]
      .map(x=>x.length>3?x.replace(/(?:에서는|에서|으로|은|는|을|를|의|도|에|서)$/,''):x);
  }
  function relatedHeadlines(a,b) {
    const normalized=x=>clean(x.title).toLowerCase().replace(/[^a-z0-9가-힣]/g,'');
    if (normalized(a)===normalized(b)) return true;
    const af=(a.title||'').match(/\d+호/g)||[], bf=(b.title||'').match(/\d+호/g)||[];
    if(af.length&&bf.length&&!af.some(n=>bf.includes(n)))return false;
    const left=headlineTokens(a), right=new Set(headlineTokens(b));
    const shared=left.filter(x=>right.has(x));
    const targetTokens=new Set([a.target?.name,b.target?.name].filter(Boolean).flatMap(name=>headlineTokens({title:name})));
    const meaningful=shared.filter(x=>!generic.has(x)&&!targetTokens.has(x)&&!/^\d+(?:억|조|만|원|년|월|일)/.test(x));
    return shared.length>=2 && meaningful.length>=1 && shared.length/Math.max(1,Math.min(left.length,right.size))>=0.35;
  }
  // API groups are display suggestions, never canonical event IDs. Split category conflicts; never drop an article.
  function buildRows(items, issues, options = {}) {
    const now = options.now || Date.now(), days = options.days || 7;
    const overrides = options.overrides || {};
    const memberships = new Map();
    (issues || []).forEach((issue, i) => (issue.items || []).forEach(item => {
      const k = key(item); if (!memberships.has(k)) memberships.set(k, 'g' + i);
    }));
    const unique = new Map();
    (items || []).forEach(item => { if (item && key(item) && within(item, days, now)) unique.set(key(item), item); });
    const groups = new Map();
    [...unique.values()].sort((a, b) => time(b.published_at) - time(a.published_at)).forEach(item => {
      const k = key(item), auto = classify(item);
      const category = categories.some(x => x.id === overrides[k]) ? overrides[k] : auto.category_id;
      const groupKey = options.mode === 'articles' || category === 'review' ? k : (memberships.get(k) || k) + '|' + category;
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      const candidates = groups.get(groupKey);
      let row = candidates.find(x => relatedHeadlines(x.items[0], item));
      if (!row) { row = { id: groupKey + '|' + candidates.length, items: [], category_id: category, auto, manual: false }; candidates.push(row); }
      row.items.push(item); row.manual ||= categories.some(x => x.id === overrides[k]);
    });
    return [...groups.values()].flat().map(row => {
      const lead = row.items[0], related = new Map();
      row.items.forEach(item => (item.related_entities || []).forEach(entity => {
        if (entity.entity_key) related.set(entity.entity_key, entity);
      }));
      return { ...row, title: lead.title || '제목 확인 필요', latest: lead.published_at, lead,
        keys: row.items.map(key), related_entities: [...related.values()],
        actor_ids: [...new Set(row.items.flatMap(item => classify(item).actor_ids))],
        sources: [...new Set(row.items.map(item => item.source_name || '출처 확인 필요'))] };
    }).sort((a, b) => time(b.latest) - time(a.latest));
  }
  return { categories, actors, clean, definition, classify, key, time, buildRows };
});
