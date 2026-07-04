// DART OpenAPI 프록시 — 최근 N일 공시 중 PEF·VC 관련 건만 선별
// 요청한 1번 수정은 제외: 환경변수 전환 없이 기존 방식 유지.
// 아래 값에는 본인 DART 키를 넣어두면 됩니다. 공개 채팅에는 실제 키를 재노출하지 않았습니다.
const DART_KEY = "여기에_기존_DART_KEY_그대로_붙여넣기";
const LIST_URL = "https://opendart.fss.or.kr/api/list.json";

const STRONG_PEF_KEYWORDS = [
  "기관전용", "사모집합투자기구", "사모투자합자회사", "PEF", "피이에프",
  "프라이빗에쿼티", "프라이빗 에쿼티", "경영참여형", "바이아웃",
  "투자목적회사", "투자목적", "특수목적회사", "SPC"
];

const STRONG_VC_KEYWORDS = [
  "벤처캐피탈", "벤처캐피", "벤처투자", "벤처투자조합", "창업투자",
  "창업투자회사", "창투", "신기술사업금융", "신기술금융", "신기술투자",
  "신기술사업투자조합", "투자조합", "액셀러레이터", "엑셀러레이터", "씨브이씨"
];

// 단독 매칭 시 오탐이 있을 수 있는 약한 키워드. 다른 단서와 함께 있을 때만 통과시킨다.
const WEAK_PEF_KEYWORDS = ["사모", "에쿼티", "파트너스"];
const WEAK_VC_KEYWORDS = ["인베스트", "인베스트먼트", "벤처스", "기술투자", "투자파트너스", "파트너스"];

const KEYWORD_META = [
  ...STRONG_PEF_KEYWORDS.map((word) => ({ word, category: "PEF", weight: "strong" })),
  ...STRONG_VC_KEYWORDS.map((word) => ({ word, category: "VC", weight: "strong" })),
  ...WEAK_PEF_KEYWORDS.map((word) => ({ word, category: "PEF", weight: "weak" })),
  ...WEAK_VC_KEYWORDS.map((word) => ({ word, category: "VC", weight: "weak" })),
];

const ABBR_PATTERNS = [
  { label: "PE", category: "PEF", weight: "strong", re: /(^|[^A-Za-z])PE([^A-Za-z]|$)/ },
  { label: "PEF", category: "PEF", weight: "strong", re: /(^|[^A-Za-z])PEF([^A-Za-z]|$)/ },
  { label: "VC", category: "VC", weight: "strong", re: /(^|[^A-Za-z])VC([^A-Za-z]|$)/ },
  { label: "CVC", category: "VC", weight: "strong", re: /(^|[^A-Za-z])CVC([^A-Za-z]|$)/ },
  // 아주IB투자·나우IB 등은 잡되 IBK기업은행, 아이비김영 등은 최대한 제외
  { label: "IB", category: "VC", weight: "weak", re: /[가-힣0-9]IB(?![a-z])/ },
  { label: "아이비", category: "VC", weight: "weak", re: /[가-힣A-Za-z0-9]아이비/ },
];

const REPORT_RULES = [
  { tag: "최대주주변경", score: 45, hint: "최대주주 변동 가능성", re: /최대주주.*변경|최대주주변경/ },
  { tag: "대량보유", score: 42, hint: "지분율·보유목적 변화 확인", re: /주식등의대량보유|대량보유/ },
  { tag: "임원·주요주주", score: 34, hint: "주요주주 지분 변동 확인", re: /임원ㆍ주요주주|임원·주요주주|주요주주/ },
  { tag: "공개매수", score: 46, hint: "경영권·상장폐지 가능성 확인", re: /공개매수/ },
  { tag: "합병", score: 36, hint: "거래 구조·밸류에이션 확인", re: /합병|분할|분할합병/ },
  { tag: "영업양수도", score: 34, hint: "사업부 매각·인수 가능성 확인", re: /영업양수|영업양도|자산양수|자산양도/ },
  { tag: "주요사항", score: 28, hint: "주요 경영사항 확인", re: /주요사항보고서|주요경영사항/ },
  { tag: "증권신고", score: 26, hint: "자금조달·투자자 구성 확인", re: /증권신고서|투자설명서/ },
  { tag: "유상증자", score: 24, hint: "제3자배정·투자자 확인", re: /유상증자|제3자배정/ },
  { tag: "CB/BW", score: 18, hint: "전환권·인수자 확인", re: /전환사채|신주인수권|교환사채|CB|BW|EB/ },
  { tag: "사모사채", score: -18, hint: "일반 사채 발행 여부 확인", re: /사모사채/ },
  { tag: "정기보고", score: 8, hint: "본문 내 단어 출현 가능성", re: /사업보고서|반기보고서|분기보고서/ },
];

function unique(arr) {
  return [...new Set(arr.filter(Boolean))];
}

function kstDate(offsetDays = 0) {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function keywordHitsByField(item) {
  const fields = {
    corp_name: item.corp_name || "",
    report_nm: item.report_nm || "",
    flr_nm: item.flr_nm || "",
  };
  const hits = [];

  for (const [field, text] of Object.entries(fields)) {
    for (const meta of KEYWORD_META) {
      if (text.includes(meta.word)) hits.push({ ...meta, field });
    }
    for (const meta of ABBR_PATTERNS) {
      if (meta.re.test(text)) hits.push({ label: meta.label, word: meta.label, category: meta.category, weight: meta.weight, field });
    }
  }

  return hits;
}

function getReportTags(reportName = "") {
  return REPORT_RULES.filter((rule) => rule.re.test(reportName)).map((rule) => ({
    tag: rule.tag,
    score: rule.score,
    hint: rule.hint,
  }));
}

function categoryFromHits(hits) {
  const pef = hits.filter((h) => h.category === "PEF");
  const vc = hits.filter((h) => h.category === "VC");
  const pefStrong = pef.filter((h) => h.weight === "strong").length;
  const vcStrong = vc.filter((h) => h.weight === "strong").length;
  if (pefStrong !== vcStrong) return pefStrong > vcStrong ? "PEF" : "VC";
  if (pef.length !== vc.length) return pef.length > vc.length ? "PEF" : "VC";
  return pef.length ? "PEF" : "VC";
}

function shouldKeep(item, hits, reportTags) {
  if (!hits.length) return false;

  const hasStrong = hits.some((h) => h.weight === "strong");
  const hasEntityHit = hits.some((h) => h.field === "corp_name" || h.field === "flr_nm");
  const hasImportantReport = reportTags.some((t) => t.score >= 24);
  const onlyWeak = hits.every((h) => h.weight === "weak");
  const hitWords = unique(hits.map((h) => h.word));
  const reportName = item.report_nm || "";

  // '사모' 하나만 걸린 일반 사채·정기보고서는 대부분 노이즈라 제외
  if (hitWords.length === 1 && hitWords[0] === "사모" && /사모사채|전환사채|사업보고서|분기보고서|반기보고서/.test(reportName)) {
    return false;
  }

  // 파트너스·인베스트 같은 약한 단어만 있고 보고서 단서도 없으면 제외
  if (onlyWeak && !hasEntityHit && !hasImportantReport) return false;

  // 약한 단어만 있지만 제출자/회사명에 들어가 있으면 유지
  if (onlyWeak && hasEntityHit) return true;

  return hasStrong || hasImportantReport || hasEntityHit;
}

function scoreItem(item, hits, reportTags) {
  let score = 10;
  const strongCount = hits.filter((h) => h.weight === "strong").length;
  const weakCount = hits.filter((h) => h.weight === "weak").length;
  const entityHit = hits.some((h) => h.field === "corp_name" || h.field === "flr_nm");

  score += Math.min(strongCount * 16, 36);
  score += Math.min(weakCount * 5, 14);
  if (entityHit) score += 18;
  if (item.corp_cls === "Y" || item.corp_cls === "K") score += 6;

  for (const t of reportTags) score += t.score;
  if (reportTags.length === 0) score -= 4;
  if (hits.every((h) => h.weight === "weak")) score -= 12;

  score = Math.max(0, Math.min(99, score));
  return score;
}

function grade(score) {
  if (score >= 80) return "최우선";
  if (score >= 60) return "우선";
  if (score >= 40) return "검토";
  return "낮음";
}

function makeReason(item, hits, reportTags) {
  const fieldLabel = { corp_name: "회사명", report_nm: "보고서명", flr_nm: "제출자명" };
  const byField = {};
  for (const h of hits) {
    (byField[h.field] ||= []).push(h.word);
  }

  const parts = Object.entries(byField).map(([field, words]) =>
    `${fieldLabel[field]}(${unique(words).slice(0, 4).join(", ")})`
  );
  const tagText = reportTags.length ? ` / 유형: ${reportTags.map((t) => t.tag).join(", ")}` : "";
  return `포착 사유: ${parts.join(" · ")}${tagText}`;
}

function storyHint(reportTags, score) {
  const hints = unique(reportTags.map((t) => t.hint));
  if (hints.length) return hints.slice(0, 2).join(" / ");
  if (score >= 60) return "하우스·투자자 관련성 우선 확인";
  return "키워드 출현 맥락 확인";
}

function refineItem(it) {
  const hits = keywordHitsByField(it);
  const reportTags = getReportTags(it.report_nm || "");
  if (!shouldKeep(it, hits, reportTags)) return null;

  const hitWords = unique(hits.map((h) => h.word));
  const score = scoreItem(it, hits, reportTags);
  const category = categoryFromHits(hits);

  return {
    rcept_no: it.rcept_no,
    rcept_dt: it.rcept_dt,
    corp_name: it.corp_name,
    corp_cls: it.corp_cls,
    report_nm: (it.report_nm || "").trim(),
    flr_nm: it.flr_nm,
    rm: it.rm,
    hits: hitWords,
    report_tags: reportTags.map((t) => t.tag),
    category,
    score,
    grade: grade(score),
    reason: makeReason(it, hits, reportTags),
    story_hint: storyHint(reportTags, score),
    pef_entity: hits.some((h) => h.field === "corp_name" || h.field === "flr_nm"),
    url: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${it.rcept_no}`,
  };
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
    if (e.name === "AbortError") throw new Error("DART 응답 지연(15초 초과)");
    throw e;
  } finally {
    clearTimeout(t);
  }
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=180, stale-while-revalidate=300");

  try {
    if (!DART_KEY || DART_KEY.includes("여기에_")) {
      return res.status(500).json({
        ok: false,
        error: "api/dart.js의 DART_KEY에 본인 OpenDART 키를 넣어주세요.",
      });
    }

    const days = Math.min(Math.max(parseInt(req.query.days || "7", 10), 1), 7);
    const bgn = kstDate(-(days - 1));
    const end = kstDate(0);

    if (req.query.debug) {
      const d = await fetchPage(bgn, end, 1);
      return res.status(200).json({
        ok: d.status === "000" || d.status === "013",
        dart_status: d.status,
        dart_message: d.message,
        total_count: d.total_count,
        total_page: d.total_page,
        sample: (d.list || []).slice(0, 2),
        range: { bgn, end },
      });
    }

    const first = await fetchPage(bgn, end, 1);

    if (first.status === "013") {
      return res.status(200).json({
        ok: true,
        items: [],
        scanned: 0,
        total_count: 0,
        total_pages: 0,
        failed_pages: [],
        failed_count: 0,
        range: { bgn, end },
        fetched_at: new Date().toISOString(),
      });
    }

    if (first.status !== "000") {
      return res.status(502).json({ ok: false, error: `DART 오류 ${first.status}: ${first.message || ""}` });
    }

    const totalPage = Math.min(Number(first.total_page || 1), 120);
    let all = [...(first.list || [])];
    const failedPages = [];

    const pages = [];
    for (let p = 2; p <= totalPage; p++) pages.push(p);

    const BATCH = 10;
    for (let i = 0; i < pages.length; i += BATCH) {
      const batch = pages.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map(async (p) => {
          try {
            return { page: p, data: await fetchPage(bgn, end, p) };
          } catch (error) {
            return { page: p, error: error.message || String(error) };
          }
        })
      );

      for (const r of results) {
        if (r.data && r.data.status === "000" && r.data.list) {
          all.push(...r.data.list);
        } else {
          failedPages.push(r.page);
        }
      }
    }

    const seen = new Set();
    const items = [];
    for (const it of all) {
      if (!it.rcept_no || seen.has(it.rcept_no)) continue;
      seen.add(it.rcept_no);
      const refined = refineItem(it);
      if (refined) items.push(refined);
    }

    items.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.rcept_no.localeCompare(a.rcept_no);
    });

    res.status(200).json({
      ok: true,
      items,
      scanned: all.length,
      total_count: Number(first.total_count || all.length),
      total_pages: totalPage,
      failed_pages: failedPages,
      failed_count: failedPages.length,
      range: { bgn, end },
      fetched_at: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
};
