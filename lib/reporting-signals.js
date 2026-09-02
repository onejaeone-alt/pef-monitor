const crypto = require("crypto");
const { parseGoogleNewsRss } = require("./context-sources");
const { NEWS_TARGETS, OFFICIAL_SOURCES, WATCH_TARGETS, findWatchTarget } = require("./watch-config");

const GOOGLE_NEWS_URL = "https://news.google.com/rss/search";
const MONEY_PATTERN = /\d[\d,]*(?:\.\d+)?\s*(?:조\s*원|억원|백만원|만원|원|달러|million|billion)/gi;
const DATE_PATTERN = /(?:20\d{2}[.\/-]\d{1,2}[.\/-]\d{1,2}|\d{1,2}월\s*\d{1,2}일)/g;

function decodeEntities(value) {
  const named = { amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: '"' };
  return String(value || "").replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, key) => {
    if (key[0] === "#") {
      const hex = key[1]?.toLowerCase() === "x";
      const code = parseInt(key.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return named[key.toLowerCase()] || whole;
  });
}

function cleanText(value) {
  return decodeEntities(String(value || "").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDate(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const isoLike = text.match(/(20\d{2})[.\/-](\d{1,2})[.\/-](\d{1,2})/);
  const date = isoLike
    ? new Date(`${isoLike[1]}-${isoLike[2].padStart(2, "0")}-${isoLike[3].padStart(2, "0")}T00:00:00+09:00`)
    : new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function absoluteUrl(href, baseUrl) {
  try {
    const url = new URL(decodeEntities(href), baseUrl);
    if (!/^https?:$/.test(url.protocol)) return "";
    url.hash = "";
    return url.toString();
  } catch (_) {
    return "";
  }
}

function classifyEvent(title, sourceType = "") {
  const text = cleanText(title);
  if (/선정\s*(결과|완료)|최종\s*선정|위탁운용사.*선정/.test(text)) return "selection_result";
  if (/출자|위탁운용사.*모집|제안서.*접수|숏리스트|접수현황/.test(text)) return "capital_call";
  if (/회생|파산|워크아웃|채무불이행|상장폐지/.test(text)) return "distress";
  if (/공개매수|최대주주|경영권|인수|매각|우선협상|본입찰|예비입찰|SPA/.test(text)) return "deal_process";
  if (/펀드.*(결성|조성|클로징)|신규\s*펀드|블라인드펀드/.test(text)) return "fund_formation";
  if (/회수|엑시트|IPO|상장|블록딜|세컨더리/.test(text)) return "exit";
  if (/대표|파트너|심사역|본부장|인사|영입|퇴사|독립/.test(text)) return "people_move";
  if (/투자|유상증자|전환사채|지분/.test(text)) return "investment";
  if (sourceType === "capital_call") return "capital_call";
  return "general";
}

function eventLabel(eventType) {
  return ({
    capital_call: "출자공고",
    selection_result: "운용사 선정",
    distress: "회생·위험",
    deal_process: "M&A 절차",
    fund_formation: "펀드 결성",
    exit: "회수",
    people_move: "핵심 인사",
    investment: "투자",
    general: "관련 뉴스",
  })[eventType] || "관련 뉴스";
}

function parseOfficialPage(html, source) {
  const anchorPattern = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const results = [];
  const seen = new Set();
  let match;
  while ((match = anchorPattern.exec(String(html || "")))) {
    const title = cleanText(match[2]);
    if (title.length < 5 || !source.include.test(title)) continue;
    const sourceUrl = absoluteUrl(match[1], source.url);
    if (!sourceUrl || seen.has(sourceUrl)) continue;
    seen.add(sourceUrl);
    const vicinity = cleanText(String(html).slice(Math.max(0, match.index - 220), match.index + match[0].length + 220));
    const dateMatch = vicinity.match(/20\d{2}[.\/-]\d{1,2}[.\/-]\d{1,2}/);
    const eventType = classifyEvent(title, source.category);
    const target = findWatchTarget(source.name, WATCH_TARGETS);
    results.push({
      source_type: eventType === "selection_result" ? "selection_result" : "capital_call",
      source_name: source.name,
      title,
      source_url: sourceUrl,
      published_at: normalizeDate(dateMatch?.[0]),
      snippet: "",
      provider: source.id,
      target,
    });
  }
  return results.slice(0, 30);
}

function factsFromTitle(title) {
  return {
    amounts: [...new Set(String(title || "").match(MONEY_PATTERN) || [])].slice(0, 4),
    dates: [...new Set(String(title || "").match(DATE_PATTERN) || [])].slice(0, 4),
  };
}

function alertGrade(score) {
  if (score >= 90) return "P1";
  if (score >= 70) return "P2";
  if (score >= 50) return "P3";
  return "P4";
}

function scoreSignal(item) {
  const base = ({
    selection_result: 65,
    capital_call: 55,
    distress: 75,
    deal_process: 60,
    fund_formation: 50,
    exit: 55,
    people_move: 35,
    investment: 40,
    general: 30,
  })[item.event_type] || 30;
  const facts = item.facts || factsFromTitle(item.title);
  const additions = {
    a_target: item.target?.priority === "A" ? 20 : 0,
    amount: facts.amounts.length ? 10 : 0,
    deadline: facts.dates.length ? 5 : 0,
    official: ["capital_call", "selection_result"].includes(item.source_type) ? 10 : 0,
  };
  const score = Math.min(100, base + Object.values(additions).reduce((sum, value) => sum + value, 0));
  return { score, additions, grade: alertGrade(score) };
}

function interpretationFor(item) {
  const target = item.target?.name || item.source_name || "해당 기관";
  const amounts = item.facts?.amounts || [];
  const dates = item.facts?.dates || [];
  const factText = [amounts.length ? `제목에 나온 금액은 ${amounts.join(", ")}` : "금액은 원문 확인 필요", dates.length ? `일정은 ${dates.join(", ")}` : "마감일은 원문 확인 필요"].join(". ");
  if (item.event_type === "selection_result") return `${target}의 GP 선정 결과입니다. 선정 하우스별 배정액을 접수 명단과 대조하면 펀드레이징 승패와 다음 투자 여력이 드러납니다. ${factText}.`;
  if (item.event_type === "capital_call") return `${target}의 출자 절차가 열렸거나 진전됐습니다. 총 출자액·전략별 GP 수·제안 마감일을 직전 계획과 비교해야 운용사별 수혜를 가를 수 있습니다. ${factText}.`;
  if (item.event_type === "fund_formation") return `${target}의 펀드 결성 신호입니다. 발표한 목표액이 실제 약정액인지, 앵커 LP와 1차·최종 클로징 시점을 확인해야 합니다. ${factText}.`;
  if (item.event_type === "exit") return `${target}의 회수 신호입니다. 매각·상장 후 실제 회수액, 잔여 지분, 투자원가를 확인하면 MOIC와 펀드 성과를 추정할 수 있습니다. ${factText}.`;
  if (item.event_type === "deal_process") return `${target}이 얽힌 거래 절차가 움직였습니다. 매각 단계, 경쟁 원매자, 가격 기대치와 인수금융 확약 여부를 확인해야 성사 가능성을 판단할 수 있습니다. ${factText}.`;
  if (item.event_type === "people_move") return `${target}의 핵심 인력 변화입니다. 이동한 인력이 담당하던 펀드·LP·포트폴리오와 새 조직의 독립계 설립 가능성을 따라가야 합니다.`;
  if (item.event_type === "investment") return `${target}의 신규 투자 신호입니다. 투자 대상·라운드·구주 포함 여부와 공동투자자를 확인하면 밸류에이션과 후속 자금 수요를 읽을 수 있습니다. ${factText}.`;
  if (item.event_type === "distress") return `${target}의 회생·재무 위험 신호입니다. 법원 일정, 담보권자와 주요 채권자, 대주주 추가 지원 여부가 통제권과 매각 일정에 미칠 영향이 핵심입니다.`;
  return `${target} 관련 새 자료입니다. 제목을 반복하는 대신 원문에서 거래 상대방·금액·일정 가운데 새로 확인되는 사실이 있는지 먼저 가려야 합니다.`;
}

function checkpointsFor(eventType) {
  return ({
    selection_result: ["선정 GP와 탈락 GP", "GP별 실제 배정액", "결성 시한과 조건"],
    capital_call: ["총 출자액과 전략별 배분", "제안 마감일", "선정 GP 수와 최소 결성액"],
    fund_formation: ["실제 약정액", "앵커 LP", "1차·최종 클로징 시점"],
    exit: ["실제 회수액", "투자원가와 잔여 지분", "MOIC·IRR"],
    deal_process: ["현재 매각 단계", "가격과 원매자", "인수금융 확약"],
    people_move: ["기존 담당 펀드", "함께 이동한 인력", "신설 하우스·전략"],
    investment: ["투자금액과 라운드", "신주·구주 비중", "공동투자자와 후속 자금"],
    distress: ["법원·채권단 일정", "담보권자와 채무액", "대주주 추가 지원"],
    general: ["새 거래 상대방", "새 금액", "새 일정"],
  })[eventType] || ["새 거래 상대방", "새 금액", "새 일정"];
}

function signalId(item) {
  return crypto.createHash("sha1").update(`${item.source_url}|${item.title}`).digest("hex").slice(0, 20);
}

function enrichSignal(item) {
  const target = item.target || findWatchTarget(`${item.title} ${item.snippet || ""}`, WATCH_TARGETS);
  const eventType = classifyEvent(item.title, item.source_type);
  const facts = factsFromTitle(item.title);
  const scored = scoreSignal({ ...item, target, event_type: eventType, facts });
  const enriched = {
    ...item,
    signal_id: signalId(item),
    target: target ? { id: target.id, name: target.name, category: target.category, priority: target.priority } : null,
    event_type: eventType,
    event_label: eventLabel(eventType),
    facts,
    story_score: scored.score,
    alert_grade: scored.grade,
    score_breakdown: scored.additions,
    checkpoints: checkpointsFor(eventType),
  };
  return { ...enriched, interpretation: interpretationFor(enriched) };
}

function googleNewsUrl(query) {
  const params = new URLSearchParams({ q: query, hl: "ko", gl: "KR", ceid: "KR:ko" });
  return `${GOOGLE_NEWS_URL}?${params}`;
}

async function fetchText(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "IB-Reporting-Radar/2.0" } });
    if (!response.ok) throw new Error(`Source HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function newsQueries(days) {
  const groups = [];
  for (let index = 0; index < NEWS_TARGETS.length; index += 5) groups.push(NEWS_TARGETS.slice(index, index + 5));
  return groups.map((group) => {
    const names = group.map((target) => `"${target.name}"`).join(" OR ");
    return `(${names}) (펀드 OR 출자 OR 투자 OR 회수 OR 매각 OR 인수 OR 파트너) when:${days}d`;
  });
}

async function collectOfficialSource(source) {
  const html = await fetchText(source.url);
  return parseOfficialPage(html, source);
}

async function collectNews(days) {
  const results = await Promise.allSettled(newsQueries(days).map(async (query) => {
    const xml = await fetchText(googleNewsUrl(query));
    return parseGoogleNewsRss(xml, "domestic", "ko");
  }));
  return {
    items: results.flatMap((result) => result.status === "fulfilled" ? result.value : []),
    ok: results.some((result) => result.status === "fulfilled"),
  };
}

function dedupeSignals(items) {
  const seenUrls = new Set();
  const seenTitles = new Set();
  return items.filter((item) => {
    const url = String(item.source_url || "").replace(/[?#].*$/, "");
    const title = cleanText(item.title).toLowerCase().replace(/[^0-9a-z가-힣]/g, "").slice(0, 120);
    if (!url || !title || seenUrls.has(url) || seenTitles.has(title)) return false;
    seenUrls.add(url);
    seenTitles.add(title);
    return true;
  });
}

async function collectReportingSignals({ days = 7 } = {}) {
  const safeDays = Math.min(Math.max(Number(days) || 7, 1), 14);
  const [officialSettled, news] = await Promise.all([
    Promise.allSettled(OFFICIAL_SOURCES.map(collectOfficialSource)),
    collectNews(safeDays),
  ]);
  const official = officialSettled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const rawNews = news.items.map((item) => ({
    ...item,
    source_type: /보도자료|press release/i.test(`${item.title} ${item.snippet || ""}`) ? "press_release" : "domestic_news",
    target: findWatchTarget(`${item.title} ${item.snippet || ""}`, NEWS_TARGETS),
  })).filter((item) => item.target);
  const items = dedupeSignals([...official, ...rawNews])
    .map(enrichSignal)
    .sort((a, b) => b.story_score - a.story_score || String(b.published_at || "").localeCompare(String(a.published_at || "")));
  return {
    items,
    providers: {
      official: Object.fromEntries(OFFICIAL_SOURCES.map((source, index) => [source.id, officialSettled[index].status === "fulfilled"])),
      google_news_rss: news.ok,
    },
  };
}

module.exports = {
  alertGrade,
  classifyEvent,
  collectReportingSignals,
  dedupeSignals,
  enrichSignal,
  factsFromTitle,
  interpretationFor,
  parseOfficialPage,
  scoreSignal,
};
