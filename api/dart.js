// DART OpenAPI 프록시 — 최근 N일 공시 전체를 훑어 PEF 관련 건만 추려서 반환
const DART_KEY = "214069cf8c415506e21625495fad9eed172b41d4";
const LIST_URL = "https://opendart.fss.or.kr/api/list.json";

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
  const hay = `${item.corp_name || ""} ${item.report_nm || ""}`;
  const hits = findHits(hay);
  if (hits.length === 0) return null;
  for (const ex of EXCLUDE_REPORT) {
    if ((item.report_nm || "").includes(ex)) return null;
  }
  return hits;
}

async function fetchPage(bgn, end, pageNo) {
  const params = new URLSearchParams({
    crtfc_key: DART_KEY,
    bgn_de: bgn,
    end_de: end,
    page_no: String(pageNo),
    page_count: "100",
    sort: "date",
    sort_mth: "desc",
  });
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

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=180, stale-while-revalidate=300");

  try {
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

    const totalPage = Math.min(first.total_page || 1, 120); // 안전 상한
    let all = [...(first.list || [])];

    // 나머지 페이지를 10개씩 병렬 수집
    const pages = [];
    for (let p = 2; p <= totalPage; p++) pages.push(p);
    const BATCH = 10;
    for (let i = 0; i < pages.length; i += BATCH) {
      const batch = pages.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map((p) => fetchPage(bgn, end, p).catch(() => null))
      );
      for (const r of results) {
        if (r && r.status === "000" && r.list) all.push(...r.list);
      }
    }

    // PEF 키워드 필터링
    const seen = new Set();
    const items = [];
    for (const it of all) {
      if (seen.has(it.rcept_no)) continue;
      seen.add(it.rcept_no);
      const hits = matchKeywords(it);
      if (!hits) continue;
      items.push({
        rcept_no: it.rcept_no,
        rcept_dt: it.rcept_dt,
        corp_name: it.corp_name,
        corp_cls: it.corp_cls, // Y유가 K코스닥 N코넥스 E기타
        report_nm: (it.report_nm || "").trim(),
        flr_nm: it.flr_nm,
        rm: it.rm,
        hits,
        // PEF 계열 vs VC·창투·신기사 계열 분류 (필터 칩용)
        category: hits.some((k) => PEF_KEYWORDS.includes(k) || PEF_ABBR.includes(k))
          ? "PEF" : "VC",
        // 법인명 자체가 하우스(PEF·VC 법인)이면 entity 공시
        pef_entity: findHits(it.corp_name || "").length > 0,
        url: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${it.rcept_no}`,
      });
    }

    items.sort((a, b) => b.rcept_no.localeCompare(a.rcept_no));

    res.status(200).json({
      ok: true,
      items,
      scanned: all.length,
      total_count: first.total_count,
      range: { bgn, end },
      fetched_at: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
};
