// DART OpenAPI 프록시 — 최근 N일 공시 전체를 훑어 PEF 관련 건만 추려서 반환
const DART_KEY = process.env.DART_API_KEY || "";
const LIST_URL = "https://opendart.fss.or.kr/api/list.json";
const COMPANY_URL = "https://opendart.fss.or.kr/api/company.json";

// 매칭 키워드 (법인명 또는 보고서명, 단순 포함 매칭)
const PEF_KEYWORDS = [
  "사모",            // 사모펀드, 사모집합투자기구, 사모투자합자회사, 사모사채 등
  "기관전용",        // 기관전용 사모집합투자기구
  "PEF",
  "피이에프",
  "프라이빗에쿼티",
  "프라이빗 에쿼티",
  "경영참여형",
  "에쿼티",          // ○○에쿼티파트너스 등
  "투자목적",        // 인수 SPC (○○투자목적회사)
  "바이아웃",
];
const VC_KEYWORDS = [
  "인베스트",        // ○○인베스트먼트, ○○인베스트 모두 커버
  "벤처스",          // 소프트뱅크벤처스, 스톤브릿지벤처스 등
  "벤처캐피탈",
  "벤처캐피",
  "벤처투자",        // 벤처투자조합, 벤처투자회사 등
  "창업투자",        // 창투사
  "창투",
  "신기술사업금융",  // 신기사
  "신기술금융",
  "신기술투자",
  "기술투자",        // 포스코기술투자 등
  "투자조합",        // ○○투자조합 관련 공시
  "투자파트너스",
  "파트너스",        // ○○파트너스 (PE·VC 공용 명칭)
  "액셀러레이터",
  "엑셀러레이터",
  "씨브이씨",
];
const KEYWORDS = [...PEF_KEYWORDS, ...VC_KEYWORDS];

// 짧은 영문 약어: 단순 포함 매칭 시 오탐이 커서 경계·위치 조건으로만 매칭
// - PE/VC/CVC: 영문 단어 경계 (LIBRA 속 IB, SPECO 속 PE 같은 오탐 방지)
// - IB/아이비: 앞에 한글·숫자가 붙은 형태만 (아주IB투자·나우IB ○ / IBK기업은행·아이비김영 ✕)
const ABBR_PATTERNS = [
  { label: "PE",  re: /(^|[^A-Za-z])PE([^A-Za-z]|$)/ },
  { label: "IB",  re: /[가-힣0-9]IB(?![a-z])/ },
  { label: "아이비", re: /[가-힣A-Za-z0-9]아이비/ },
  { label: "VC",  re: /(^|[^A-Za-z])VC([^a-z]|$)/ },
  { label: "CVC", re: /(^|[^A-Za-z])CVC([^a-z]|$)/ },
];
const PEF_ABBR = ["PE"];

// 제목만 보고도 놓치지 말아야 할 IB·PEF 신호를 1차 판별하는 규칙.
// 금액·상대방 등 원문 확인이 필요한 사실은 단정하지 않고 "확인 필요"로 표현한다.
const DISCLOSURE_RULES = [
  {
    id: "control_change",
    label: "경영권·최대주주 변동",
    level: "핵심",
    patterns: [/최대주주.*변경/, /경영권/, /주식양수도/, /공개매수/, /최대주주등소유주식변동/],
    why: "경영권 이전이나 매각 절차와 연결될 수 있습니다. 매수·매도 주체, 지분율, 거래 종결 조건을 우선 확인할 공시입니다.",
    signals: ["M&A", "지배구조"],
  },
  {
    id: "equity_acquisition",
    label: "지분 취득·투자",
    level: "핵심",
    patterns: [/타법인.*주식.*취득/, /출자증권.*취득/, /주식.*취득결정/, /투자판단.*취득/, /신주인수/],
    why: "신규 투자나 인수, 추가 지분 확보 신호일 수 있습니다. 취득 목적과 거래 상대방, 인수 후 지분율을 확인할 필요가 있습니다.",
    signals: ["투자", "인수"],
  },
  {
    id: "equity_disposal",
    label: "지분 매각·회수",
    level: "핵심",
    patterns: [/타법인.*주식.*처분/, /출자증권.*처분/, /주식.*처분결정/, /투자판단.*처분/],
    why: "보유 지분 매각이나 투자금 회수와 연결될 수 있습니다. 처분 상대방과 잔여 지분, 회수 규모를 확인할 공시입니다.",
    signals: ["매각", "엑시트"],
  },
  {
    id: "merger_restructuring",
    label: "합병·분할·사업재편",
    level: "핵심",
    patterns: [/합병/, /분할/, /영업양수/, /영업양도/, /주식교환/, /주식이전/, /해산/, /회생절차/, /워크아웃/],
    why: "기업 구조나 자산 소유관계가 바뀌는 신호입니다. 거래 구조와 존속법인, 주주가치 변화를 함께 살펴볼 필요가 있습니다.",
    signals: ["구조개편", "M&A"],
  },
  {
    id: "capital_raise",
    label: "유상증자·자본 확충",
    level: "주시",
    patterns: [/유상증자/, /제3자배정/, /신주발행/, /증자결정/],
    why: "신규 자금 유입과 주주 구성 변화가 동시에 발생할 수 있습니다. 배정 대상이 PEF·VC 또는 인수 주체인지 확인할 필요가 있습니다.",
    signals: ["자금조달", "지분희석"],
  },
  {
    id: "mezzanine",
    label: "메자닌·사채 조달",
    level: "주시",
    patterns: [/전환사채/, /신주인수권부사채/, /교환사채/, /사모사채/, /사채권.*발행/],
    why: "메자닌 또는 사채를 통한 자금조달 신호입니다. 투자자, 전환 조건, 담보·풋옵션과 자금 사용처를 확인할 공시입니다.",
    signals: ["자금조달", "메자닌"],
  },
  {
    id: "financing_support",
    label: "담보·보증·차입",
    level: "주시",
    patterns: [/담보제공/, /채무보증/, /금전대여/, /차입결정/, /대출원리금/, /채무인수/],
    why: "인수금융이나 계열사 지원, 재무 부담 변화와 연결될 수 있습니다. 수혜자와 자금 목적, 보증 한도를 확인할 필요가 있습니다.",
    signals: ["인수금융", "재무부담"],
  },
  {
    id: "ownership_report",
    label: "대량보유·주주 변동",
    level: "주시",
    patterns: [/대량보유/, /주식등의대량/, /임원.*주요주주/, /특정증권등소유/, /소유상황보고/],
    why: "PEF·VC의 신규 진입, 추가 매수 또는 회수 움직임을 찾을 수 있습니다. 보유 목적과 직전 보고 대비 증감이 핵심입니다.",
    signals: ["지분변동", "주주동향"],
  },
  {
    id: "fund_change",
    label: "펀드·조합 변동",
    level: "주시",
    patterns: [/사모집합투자기구/, /투자합자회사/, /투자조합/, /벤처투자조합/, /집합투자/, /펀드/],
    why: "펀드 결성·변경·청산 또는 투자기구 자체의 변동일 수 있습니다. 운용사와 출자자, 존속기간, 투자 대상을 확인할 필요가 있습니다.",
    signals: ["펀드", "GP·LP"],
  },
  {
    id: "performance_risk",
    label: "실적·재무 위험",
    level: "주시",
    patterns: [/손상차손/, /영업실적/, /매출액.*손익.*변동/, /자본잠식/, /감사의견/, /부도/, /횡령/, /배임/],
    why: "기업가치와 투자 회수 가능성에 영향을 줄 수 있는 재무·통제 신호입니다. 발생 규모와 현금흐름 영향을 확인할 필요가 있습니다.",
    signals: ["재무위험", "밸류에이션"],
  },
  {
    id: "periodic",
    label: "정기·기초 공시",
    level: "참고",
    patterns: [/사업보고서/, /반기보고서/, /분기보고서/, /감사보고서/, /연결감사보고서/],
    why: "재무상태와 주주·관계회사 정보를 갱신할 수 있는 기초 공시입니다. 거래 신호보다는 누적 변화 확인에 유용합니다.",
    signals: ["기초자료"],
  },
];

// 노이즈 컷: '사모'가 걸려도 PEF와 무관한 보고서명 (원하면 여기서 조절)
const EXCLUDE_REPORT = [
  // "사모사채",  // 일반 회사 사모사채 발행도 보고 싶으면 주석 유지
];

function kstDate(offsetDays = 0) {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function findHits(text) {
  const hits = KEYWORDS.filter((k) => text.includes(k));
  for (const a of ABBR_PATTERNS) {
    if (a.re.test(text)) hits.push(a.label);
  }
  return hits;
}

function matchKeywords(item) {
  const hay = `${item.corp_name || ""} ${item.report_nm || ""} ${item.flr_nm || ""}`;
  const hits = findHits(hay);
  if (hits.length === 0) return null;
  for (const ex of EXCLUDE_REPORT) {
    if ((item.report_nm || "").includes(ex)) return null;
  }
  return hits;
}

function analyzeDisclosure(item) {
  const title = (item.report_nm || "").trim();
  const matched = DISCLOSURE_RULES.find((rule) =>
    rule.patterns.some((pattern) => pattern.test(title))
  );
  const rule = matched || {
    id: "general",
    label: "PEF·VC 관련 공시",
    level: "참고",
    why: "PEF·VC 관련 명칭이 포착된 공시입니다. 실제 거래 연관성은 공시 원문과 제출자를 함께 확인해야 합니다.",
    signals: ["원문확인"],
  };

  let stage = "공시";
  if (/정정|기재정정|첨부정정/.test(title)) stage = "조건·내용 변경";
  else if (/완료|결과|종료|해제|철회/.test(title)) stage = "완료·결과";
  else if (/계약|약정/.test(title)) stage = "계약·약정";
  else if (/결정|승인/.test(title)) stage = "의사결정";
  else if (/신고서|신청|예고/.test(title)) stage = "신고·검토";

  const isCorrection = /정정/.test(title) || /^\[?기재정정/.test(title);
  return {
    event_id: rule.id,
    event_label: rule.label,
    importance: rule.level,
    why: isCorrection
      ? `앞선 공시의 조건이나 내용이 바뀌었습니다. 변경 전후의 금액·일정·상대방을 비교해야 합니다. ${rule.why}`
      : rule.why,
    signals: [...new Set([...(rule.signals || []), ...(isCorrection ? ["정정공시"] : [])])],
    stage,
    is_correction: isCorrection,
  };
}

function normalizeName(name) {
  return (name || "")
    .replace(/주식회사|유한회사|유한책임회사|\(주\)|㈜|\s+/g, "")
    .toLowerCase();
}

function isExternalFiler(item) {
  const filer = normalizeName(item.flr_nm);
  const corp = normalizeName(item.corp_name);
  if (!filer || filer.length < 2 || !corp) return false;
  return filer !== corp && !filer.includes(corp) && !corp.includes(filer);
}

function toItem(it, hits = null) {
  const resolvedHits = hits || findHits(`${it.corp_name || ""} ${it.report_nm || ""} ${it.flr_nm || ""}`);
  return {
    rcept_no: it.rcept_no,
    rcept_dt: it.rcept_dt,
    corp_code: it.corp_code,
    stock_code: it.stock_code,
    corp_name: it.corp_name,
    corp_cls: it.corp_cls,
    report_nm: (it.report_nm || "").trim(),
    flr_nm: it.flr_nm,
    rm: it.rm,
    hits: resolvedHits,
    category: resolvedHits.some((k) => PEF_KEYWORDS.includes(k) || PEF_ABBR.includes(k))
      ? "PEF" : "VC",
    pef_entity: findHits(it.corp_name || "").length > 0,
    analysis: analyzeDisclosure(it),
    url: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${it.rcept_no}`,
  };
}

function attachConnections(items) {
  const byFiler = new Map();
  for (const item of items) {
    if (!isExternalFiler(item)) continue;
    const key = normalizeName(item.flr_nm);
    if (!byFiler.has(key)) byFiler.set(key, { filer: item.flr_nm, companies: new Set() });
    byFiler.get(key).companies.add(item.corp_name);
  }

  return items.map((item) => {
    const connections = [];
    if (isExternalFiler(item)) {
      const linked = byFiler.get(normalizeName(item.flr_nm));
      connections.push({
        name: item.flr_nm,
        relation: "이 회사 관련 공시 제출자",
        basis: "DART 제출자 정보",
        confidence: "공시확인",
      });
      for (const company of linked ? linked.companies : []) {
        if (company === item.corp_name) continue;
        connections.push({
          name: company,
          relation: `동일 제출자(${item.flr_nm})가 함께 공시한 회사`,
          basis: "동일 제출자 기반 연결 후보",
          confidence: "연결후보",
        });
      }
    }
    return { ...item, connections: connections.slice(0, 6) };
  });
}

async function fetchPage(bgn, end, pageNo, corpCode = "") {
  const paramObject = {
    crtfc_key: DART_KEY,
    bgn_de: bgn,
    end_de: end,
    page_no: String(pageNo),
    page_count: "100",
    sort: "date",
    sort_mth: "desc",
  };
  if (corpCode) paramObject.corp_code = corpCode;
  const params = new URLSearchParams(paramObject);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(`${LIST_URL}?${params}`, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`DART HTTP ${r.status}`);
    return await r.json();
  } catch (e) {
    if (e.name === "AbortError") throw new Error("DART 응답 지연(15초 초과) — 해외 IP 차단 또는 서버 지연 가능");
    throw e;
  } finally {
    clearTimeout(t);
  }
}

async function fetchCompanyProfile(corpCode) {
  const params = new URLSearchParams({ crtfc_key: DART_KEY, corp_code: corpCode });
  const r = await fetch(`${COMPANY_URL}?${params}`);
  if (!r.ok) throw new Error(`DART 기업개황 HTTP ${r.status}`);
  const profile = await r.json();
  return profile.status === "000" ? profile : null;
}

async function fetchAllPages(bgn, end, first, corpCode = "", pageLimit = 120) {
  const totalPage = Math.min(first.total_page || 1, pageLimit);
  const all = [...(first.list || [])];
  const pages = [];
  for (let p = 2; p <= totalPage; p++) pages.push(p);
  const batchSize = corpCode ? 5 : 10;
  for (let i = 0; i < pages.length; i += batchSize) {
    const batch = pages.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map((p) => fetchPage(bgn, end, p, corpCode).catch(() => null))
    );
    for (const page of results) {
      if (page && page.status === "000" && page.list) all.push(...page.list);
    }
  }
  return all;
}

function historyConnections(history) {
  const filers = new Map();
  for (const item of history) {
    if (!isExternalFiler(item)) continue;
    const key = normalizeName(item.flr_nm);
    const existing = filers.get(key) || {
      name: item.flr_nm,
      relation: "이 회사 관련 외부 공시 제출자",
      basis: "DART 제출자 정보",
      confidence: "공시확인",
      count: 0,
      latest_dt: item.rcept_dt,
    };
    existing.count += 1;
    if (item.rcept_dt > existing.latest_dt) existing.latest_dt = item.rcept_dt;
    filers.set(key, existing);
  }
  return [...filers.values()].sort((a, b) => b.count - a.count).slice(0, 12);
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=180, stale-while-revalidate=300");

  try {
    if (!DART_KEY) {
      return res.status(503).json({
        ok: false,
        code: "DART_API_KEY_MISSING",
        error: "Vercel 환경변수 DART_API_KEY가 필요합니다.",
      });
    }
    // 회사 상세: 최근 공시 타임라인과 외부 제출자 관계를 한 번에 반환
    if (req.query.action === "company") {
      const corpCode = String(req.query.corp_code || "");
      if (!/^\d{8}$/.test(corpCode)) {
        return res.status(400).json({ ok: false, error: "올바른 DART 고유번호가 필요합니다." });
      }
      const historyDays = Math.min(Math.max(parseInt(req.query.history_days || "365", 10), 30), 730);
      const bgn = kstDate(-(historyDays - 1));
      const end = kstDate(0);
      const [first, profile] = await Promise.all([
        fetchPage(bgn, end, 1, corpCode),
        fetchCompanyProfile(corpCode).catch(() => null),
      ]);

      if (first.status === "013") {
        return res.status(200).json({
          ok: true,
          profile,
          history: [],
          connections: [],
          range: { bgn, end },
        });
      }
      if (first.status !== "000") {
        return res.status(502).json({
          ok: false,
          error: `DART 오류 ${first.status}: ${first.message || ""}`,
        });
      }

      const rawHistory = await fetchAllPages(bgn, end, first, corpCode, 20);
      const seenHistory = new Set();
      const history = rawHistory
        .filter((item) => {
          if (seenHistory.has(item.rcept_no)) return false;
          seenHistory.add(item.rcept_no);
          return true;
        })
        .map((item) => toItem(item))
        .sort((a, b) => b.rcept_no.localeCompare(a.rcept_no));

      return res.status(200).json({
        ok: true,
        profile,
        history: history.slice(0, 150),
        connections: historyConnections(history),
        range: { bgn, end },
        fetched_at: new Date().toISOString(),
      });
    }

    const days = Math.min(Math.max(parseInt(req.query.days || "7", 10), 1), 7);
    const bgn = kstDate(-(days - 1));
    const end = kstDate(0);

    // 진단 모드: /api/dart?debug=1 → DART 1페이지만 호출해 상태코드 확인
    if (req.query.debug) {
      const d = await fetchPage(bgn, end, 1);
      return res.status(200).json({
        ok: d.status === "000",
        dart_status: d.status,
        dart_message: d.message,
        total_count: d.total_count,
        sample: (d.list || []).slice(0, 2),
        range: { bgn, end },
      });
    }

    // 1페이지로 전체 페이지 수 파악
    const first = await fetchPage(bgn, end, 1);

    if (first.status === "013") {
      // 조회 데이터 없음 (주말/공휴일 등)
      return res.status(200).json({
        ok: true, items: [], scanned: 0, range: { bgn, end },
        fetched_at: new Date().toISOString(),
      });
    }
    if (first.status !== "000") {
      return res.status(502).json({
        ok: false,
        error: `DART 오류 ${first.status}: ${first.message || ""}`,
      });
    }

    const all = await fetchAllPages(bgn, end, first);

    // PEF 키워드 필터링
    const seen = new Set();
    const items = [];
    for (const it of all) {
      if (seen.has(it.rcept_no)) continue;
      seen.add(it.rcept_no);
      const hits = matchKeywords(it);
      if (!hits) continue;
      items.push(toItem(it, hits));
    }

    items.sort((a, b) => b.rcept_no.localeCompare(a.rcept_no));
    const enrichedItems = attachConnections(items);

    res.status(200).json({
      ok: true,
      items: enrichedItems,
      scanned: all.length,
      total_count: first.total_count,
      range: { bgn, end },
      fetched_at: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
};
