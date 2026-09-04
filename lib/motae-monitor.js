function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function canonicalBusinessKey(value) {
  return cleanText(value)
    .replace(/\[(?:출자계획|접수현황|서류결과|선정결과|질의응답|변경공고|재공고)\]/g, '')
    .replace(/^(?:변경|수정|재)\s*공고\s*/g, '')
    .replace(/(?:최종\s*)?선정\s*(?:결과|현황)/g, '')
    .replace(/서류(?:심사)?\s*(?:결과|통과\s*현황)/g, '')
    .replace(/접수\s*(?:현황|결과)/g, '')
    .replace(/(?:출자사업\s*)?계획\s*공고/g, '출자사업')
    .replace(/출자사업\s*계획/g, '출자사업')
    .replace(/(?:운용사|위탁운용사)\s*선정/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[·ㆍ]\s*$/g, '')
    .trim();
}

function accountFromTitle(title) {
  const text = cleanText(title);
  if (/LP\s*성장펀드/i.test(text)) {
    const track = text.match(/Track\s*([12])/i)?.[1];
    return track ? `LP 성장펀드 Track ${track}` : 'LP 성장펀드';
  }
  const paren = text.match(/(?:한국)?모태펀드\s*\(([^)]+)\)/)?.[1];
  if (paren) return cleanText(paren.replace(/소관/g, '').replace(/계정_/g, '계정 · '));
  if (/특허계정/.test(text)) return '특허계정';
  if (/문화/.test(text) && /관광/.test(text)) return '문화·관광';
  if (/중기부/.test(text)) return '중기부';
  if (/교육부/.test(text)) return '교육부';
  if (/보건복지부|복지부/.test(text)) return '보건복지부';
  if (/과기정통부|과학기술정보통신부/.test(text)) return '과기정통부';
  if (/해양수산부|해수부/.test(text)) return '해양수산부';
  return '기타';
}

function numberFromMetric(value) {
  const match = String(value || '').replace(/,/g, '').match(/[0-9]+(?:\.[0-9]+)?/);
  return match ? Number(match[0]) : null;
}

function normalizeManager(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/주식회사|유한회사|유한책임회사|㈜|\(주\)|창업투자회사|벤처투자회사/g, '')
    .replace(/[^0-9a-z가-힣]/g, '');
}

function managerCandidates(notice) {
  const seen = new Set();
  const rows = [];
  for (const value of notice?.manager_candidates || []) {
    const text = cleanText(value)
      .replace(/^(?:업무집행조합원|운용사명|운용사|GP)\s*[:：]?\s*/i, '')
      .replace(/\s+(?:선정|통과|예비|최종)$/g, '')
      .trim();
    const key = normalizeManager(text);
    if (!text || key.length < 2 || seen.has(key)) continue;
    seen.add(key);
    rows.push(text);
  }
  return rows;
}

function chooseLatest(left, right) {
  if (!left) return right;
  return String(right?.posted_date || '') >= String(left?.posted_date || '') ? right : left;
}

function groupNotices(notices) {
  const map = new Map();
  for (const notice of notices || []) {
    if (!notice || notice.fetch_error) continue;
    const stage = notice.stage;
    if (!['plan', 'application', 'document_review', 'selection'].includes(stage)) continue;
    const key = canonicalBusinessKey(notice.business_key || notice.title);
    if (!key) continue;
    const group = map.get(key) || {
      business_key: key,
      title: key,
      year: notice.business_year || null,
      account: accountFromTitle(notice.title),
      latest: notice,
      notices: [],
    };
    group.year = group.year || notice.business_year;
    if (group.account === '기타') group.account = accountFromTitle(notice.title);
    group[stage] = chooseLatest(group[stage], notice);
    group.latest = chooseLatest(group.latest, notice);
    group.notices.push(notice);
    map.set(key, group);
  }

  return [...map.values()].map((group) => {
    const application = group.application?.aggregate || {};
    const documentReview = group.document_review?.aggregate || {};
    const selection = group.selection?.aggregate || {};
    const plan = group.plan?.aggregate || {};
    const applied = numberFromMetric(application.applied_funds);
    const passed = numberFromMetric(documentReview.passed_funds);
    const selected = numberFromMetric(selection.selected_funds);
    const selectedManagers = managerCandidates(group.selection);
    const stage = group.selection ? 'selected' : group.document_review ? 'document_review' : group.application ? 'application' : 'plan';
    const competition = applied && selected ? applied / selected : null;
    return {
      ...group,
      stage,
      applied_count: applied,
      passed_count: passed,
      selected_count: selected,
      competition,
      selected_managers: selectedManagers,
      application_managers: managerCandidates(group.application),
      document_managers: managerCandidates(group.document_review),
      mother_commitment: selection.mother_commitment || documentReview.mother_commitment || plan.mother_commitment || null,
      planned_formation: selection.planned_formation || documentReview.planned_formation || plan.planned_formation || null,
      notices: [...group.notices].sort((a,b)=>String(b.posted_date||'').localeCompare(String(a.posted_date||''))),
    };
  }).sort((a,b)=>String(b.latest?.posted_date||'').localeCompare(String(a.latest?.posted_date||'')));
}

function fundMatchesManager(fund, manager) {
  const left = normalizeManager(fund?.manager);
  const right = normalizeManager(manager);
  if (!left || !right) return false;
  return left === right || (left.length >= 4 && right.length >= 4 && (left.includes(right) || right.includes(left)));
}

function fundYearEligible(groupYear, fundYear) {
  const gy = Number(String(groupYear || '').match(/(?:19|20)\d{2}/)?.[0] || 0);
  const fy = Number(String(fundYear || '').match(/(?:19|20)\d{2}/)?.[0] || 0);
  if (!gy || !fy) return true;
  return fy === gy || fy === gy + 1;
}

function attachFormation(groups, funds) {
  return (groups || []).map((group) => {
    const managers = group.selected_managers || [];
    const managerFormation = managers.map((manager) => {
      const matches = (funds || []).filter((fund) => fundYearEligible(group.year, fund.year) && fundMatchesManager(fund, manager));
      const groupYear = Number(String(group.year || '').match(/(?:19|20)\d{2}/)?.[0] || 0);
      const sameYear = matches.filter((fund)=>Number(String(fund.year || '').match(/(?:19|20)\d{2}/)?.[0] || 0) === groupYear);
      const nextYear = matches.filter((fund)=>Number(String(fund.year || '').match(/(?:19|20)\d{2}/)?.[0] || 0) === groupYear + 1);
      return {
        manager,
        confirmed: matches.length > 0,
        match_timing: sameYear.length ? 'same_year' : nextYear.length ? 'next_year' : null,
        funds: matches.slice(0, 5),
      };
    });
    const confirmed = managerFormation.filter((row) => row.confirmed).length;
    const formation_status = !group.selection || !managers.length
      ? 'not_applicable'
      : confirmed === managers.length
        ? 'confirmed'
        : confirmed > 0 ? 'partial' : 'unconfirmed';
    return { ...group, manager_formation: managerFormation, formation_status, formation_confirmed_count: confirmed };
  });
}

function buildGpStats(groups, funds = []) {
  const map = new Map();
  function rowFor(name) {
    const key = normalizeManager(name);
    if (!key) return null;
    let row = map.get(key);
    if (!row) {
      row = {
        manager: cleanText(name),
        applied: 0,
        document_pass: 0,
        selected: 0,
        formation_confirmed: 0,
        accounts: new Set(),
        businesses: [],
        source_types: new Set(),
        fund_names: new Set(),
      };
      map.set(key,row);
    }
    return row;
  }
  function add(name, field, group) {
    const row = rowFor(name);
    if (!row) return;
    row[field] += 1;
    row.accounts.add(group.account);
    row.source_types.add('selection_pipeline');
    row.businesses.push({ business_key: group.business_key, year: group.year, account: group.account, stage: field });
  }
  for (const group of groups || []) {
    for (const manager of group.application_managers || []) add(manager, 'applied', group);
    for (const manager of group.document_managers || []) add(manager, 'document_pass', group);
    for (const manager of group.selected_managers || []) add(manager, 'selected', group);
    for (const row of group.manager_formation || []) if (row.confirmed) add(row.manager, 'formation_confirmed', group);
  }

  // 선정 PDF가 아직 안 읽혔어도 KVIC 실제 펀드 API에 존재하는 운용사는 GP 목록에서 보조로 보여준다.
  for (const fund of funds || []) {
    const row = rowFor(fund.manager);
    if (!row) continue;
    row.source_types.add('fund_api');
    if (fund.field) row.accounts.add(fund.field);
    if (fund.association_name) row.fund_names.add(fund.association_name);
    if (!row.selected && !row.applied && !row.document_pass) {
      row.formation_confirmed = Math.max(row.formation_confirmed, row.fund_names.size || 1);
    }
  }

  return [...map.values()].map((row) => ({
    ...row,
    accounts: [...row.accounts],
    source_types: [...row.source_types],
    fund_names: [...row.fund_names],
    fund_api_only: row.source_types.has('fund_api') && !row.source_types.has('selection_pipeline'),
  })).sort((a,b)=>
    b.selected-a.selected || b.document_pass-a.document_pass || b.applied-a.applied || b.formation_confirmed-a.formation_confirmed || a.manager.localeCompare(b.manager,'ko')
  );
}

function buildAccountStats(groups) {
  const map = new Map();
  for (const group of groups || []) {
    const row = map.get(group.account) || { account: group.account, businesses: 0, selected: 0, selected_gp: new Set(), mother_commitments: [] };
    row.businesses += 1;
    if (group.selection) row.selected += 1;
    (group.selected_managers || []).forEach((name)=>row.selected_gp.add(name));
    if (group.mother_commitment) row.mother_commitments.push(group.mother_commitment);
    map.set(group.account,row);
  }
  return [...map.values()].map((row)=>({ ...row, selected_gp: [...row.selected_gp] }))
    .sort((a,b)=>b.businesses-a.businesses || a.account.localeCompare(b.account,'ko'));
}

module.exports = {
  accountFromTitle,
  attachFormation,
  buildAccountStats,
  buildGpStats,
  canonicalBusinessKey,
  fundMatchesManager,
  fundYearEligible,
  groupNotices,
  normalizeManager,
  numberFromMetric,
};
