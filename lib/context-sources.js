const GOOGLE_NEWS_URL = "https://news.google.com/rss/search";
const GDELT_URL = "https://api.gdeltproject.org/api/v2/doc/doc";
const NAVER_NEWS_URL = "https://openapi.naver.com/v1/search/news.json";

const PRESS_DOMAINS = [
  "prnewswire.com",
  "businesswire.com",
  "globenewswire.com",
  "korea.kr",
  "fsc.go.kr",
  "fss.or.kr",
];

const PRESS_SOURCE_PATTERN = /(PR Newswire|Business Wire|GlobeNewswire|뉴스와이어|정책브리핑|금융위원회|금융감독원|공정거래위원회|한국거래소|기획재정부|산업통상자원부|중소벤처기업부)/i;

function decodeEntities(value) {
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return String(value || "").replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, key) => {
    if (key[0] === "#") {
      const hex = key[1]?.toLowerCase() === "x";
      const code = parseInt(key.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return named[key.toLowerCase()] || whole;
  });
}

function stripMarkup(value) {
  let text = String(value || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  // Google News 설명은 HTML이 한 번 더 엔티티로 감싸진 경우가 있어 두 번 정리한다.
  for (let index = 0; index < 2; index += 1) {
    text = decodeEntities(text).replace(/<[^>]+>/g, " ");
  }
  return text.replace(/\s+/g, " ").trim();
}

function tagValue(block, tag) {
  const match = String(block || "").match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? stripMarkup(match[1]) : "";
}

function sourceValue(block) {
  const match = String(block || "").match(/<source(?:\s[^>]*)?>([\s\S]*?)<\/source>/i);
  return match ? stripMarkup(match[1]) : "";
}

function normalizeDate(value) {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function cleanGoogleTitle(title, source) {
  const suffix = source ? ` - ${source}` : "";
  return suffix && title.endsWith(suffix) ? title.slice(0, -suffix.length).trim() : title;
}

function parseGoogleNewsRss(xml, category, language) {
  const blocks = String(xml || "").match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || [];
  return blocks.map((block) => {
    const sourceName = sourceValue(block) || "Google News";
    const title = cleanGoogleTitle(tagValue(block, "title"), sourceName);
    const sourceUrl = tagValue(block, "link");
    const rawDescription = tagValue(block, "description");
    const snippet = rawDescription.includes(title) ? "" : rawDescription;
    return {
      category,
      language,
      source_name: sourceName,
      title,
      source_url: sourceUrl,
      published_at: normalizeDate(tagValue(block, "pubDate")),
      snippet: snippet.slice(0, 500),
      provider: "google_news_rss",
    };
  }).filter((item) => item.title && item.source_url);
}

function cleanNaverTitle(value) {
  return stripMarkup(value);
}

function parseNaverItems(items) {
  return (items || []).map((item) => ({
    category: "domestic",
    language: "ko",
    source_name: (() => {
      try {
        return new URL(item.originallink || item.link).hostname.replace(/^www\./, "");
      } catch (_) {
        return "네이버 뉴스";
      }
    })(),
    title: cleanNaverTitle(item.title),
    source_url: item.originallink || item.link,
    published_at: normalizeDate(item.pubDate),
    snippet: stripMarkup(item.description).slice(0, 500),
    provider: "naver_news",
  })).filter((item) => item.title && item.source_url);
}

function isPressDomain(domain) {
  const normalized = String(domain || "").toLowerCase().replace(/^www\./, "");
  return PRESS_DOMAINS.some((value) => normalized === value || normalized.endsWith(`.${value}`));
}

function isPressReleaseItem(item) {
  if (item?.provider === "gdelt" && item?.category === "press_release") return true;
  const text = `${item?.source_name || ""} ${item?.title || ""} ${item?.snippet || ""}`;
  return PRESS_SOURCE_PATTERN.test(text) || /(^|[\[\s])(보도\s*자료|press release)([\]\s]|$)/i.test(text);
}

function parseGdeltArticles(articles) {
  return (articles || []).map((item) => {
    const domain = String(item.domain || "").toLowerCase();
    const language = String(item.language || "").toLowerCase();
    const category = isPressDomain(domain)
      ? "press_release"
      : language.includes("korean") || domain.endsWith(".kr")
        ? "domestic"
        : "foreign";
    return {
      category,
      language: category === "domestic" ? "ko" : "en",
      source_name: domain || "GDELT",
      title: stripMarkup(item.title),
      source_url: item.url,
      published_at: normalizeDate(item.seendate),
      snippet: "",
      provider: "gdelt",
    };
  }).filter((item) => item.title && item.source_url);
}

function uniqueTerms(values) {
  const seen = new Set();
  return values.map((value) => String(value || "").trim())
    .filter((value) => {
      const key = value.toLowerCase();
      if (value.length < 2 || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function quote(value) {
  return `"${String(value || "").replace(/["\\]/g, " ").trim()}"`;
}

function buildSearchQueries({ corpName, filerName, eventLabel }) {
  const terms = uniqueTerms([corpName, filerName]);
  const core = terms.length ? terms.map(quote).join(" OR ") : quote(eventLabel || "인수합병");
  const latinTerms = terms.filter((value) => /[A-Za-z]{2}/.test(value));
  const foreignCore = (latinTerms.length ? latinTerms : terms).map(quote).join(" OR ") || quote("private equity Korea");
  const event = String(eventLabel || "").replace(/["\\]/g, " ").trim();
  return {
    domestic: `(${core}) ${event} when:90d`.trim(),
    foreign: `(${foreignCore}) (${event || "acquisition OR investment"}) when:90d`.trim(),
    pressRelease: `(${core}) (보도자료 OR "press release" OR announces OR site:prnewswire.com OR site:businesswire.com OR site:globenewswire.com OR site:korea.kr OR site:fsc.go.kr OR site:fss.or.kr) when:180d`,
    gdelt: `(${foreignCore})`,
  };
}

function googleNewsUrl(query, locale) {
  const isKorean = locale === "ko";
  const params = new URLSearchParams({
    q: query,
    hl: isKorean ? "ko" : "en-US",
    gl: isKorean ? "KR" : "US",
    ceid: isKorean ? "KR:ko" : "US:en",
  });
  return `${GOOGLE_NEWS_URL}?${params}`;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": "IB-Reporting-Radar/1.0",
        ...(options.headers || {}),
      },
    });
    if (!response.ok) throw new Error(`Source HTTP ${response.status}`);
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchGoogleNews(query, category, language) {
  const response = await fetchWithTimeout(googleNewsUrl(query, language));
  return parseGoogleNewsRss(await response.text(), category, language);
}

async function fetchNaverNews(query) {
  const clientId = process.env.NAVER_CLIENT_ID || "";
  const clientSecret = process.env.NAVER_CLIENT_SECRET || "";
  if (!clientId || !clientSecret) return [];
  const params = new URLSearchParams({ query, display: "20", sort: "date" });
  const response = await fetchWithTimeout(`${NAVER_NEWS_URL}?${params}`, {
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    },
  });
  return parseNaverItems((await response.json()).items);
}

async function fetchGdelt(query) {
  const params = new URLSearchParams({
    query,
    mode: "artlist",
    maxrecords: "35",
    format: "json",
    sort: "datedesc",
    timespan: "3months",
  });
  const response = await fetchWithTimeout(`${GDELT_URL}?${params}`);
  return parseGdeltArticles((await response.json()).articles);
}

function dedupe(items) {
  const seenUrls = new Set();
  const seenTitles = new Set();
  return (items || []).filter((item) => {
    const urlKey = String(item.source_url || "").replace(/[?#].*$/, "");
    const titleKey = String(item.title || "").toLowerCase().replace(/[^0-9a-z가-힣]/g, "").slice(0, 120);
    if (!urlKey || !titleKey || seenUrls.has(urlKey) || seenTitles.has(titleKey)) return false;
    seenUrls.add(urlKey);
    seenTitles.add(titleKey);
    return true;
  });
}

function matchText(value) {
  return stripMarkup(value)
    .toLowerCase()
    .replace(/주식회사|유한회사|유한책임회사|사모투자합자회사|\(주\)|㈜/g, "")
    .replace(/[^0-9a-z가-힣]/g, "");
}

function matchesContext(item, context) {
  const hay = matchText(`${item.title || ""} ${item.snippet || ""}`);
  const terms = uniqueTerms([context.corpName, context.filerName])
    .map(matchText)
    .filter((value) => value.length >= 2);
  return terms.some((term) => hay.includes(term));
}

function sortNewest(items) {
  return [...items].sort((a, b) => String(b.published_at || "").localeCompare(String(a.published_at || "")));
}

async function collectSources(context) {
  const queries = buildSearchQueries(context);
  const tasks = await Promise.allSettled([
    fetchGoogleNews(queries.domestic, "domestic", "ko"),
    fetchNaverNews(`${context.corpName || ""} ${context.filerName || ""}`.trim()),
    fetchGoogleNews(queries.foreign, "foreign", "en"),
    fetchGoogleNews(queries.pressRelease, "press_release", "ko"),
    fetchGdelt(queries.gdelt),
  ]);
  const values = tasks
    .flatMap((result) => result.status === "fulfilled" ? result.value : [])
    .map((item) => item.category === "press_release" && !isPressReleaseItem(item)
      ? { ...item, category: item.language === "ko" ? "domestic" : "foreign" }
      : item)
    .filter((item) => matchesContext(item, context));
  const press = dedupe(values.filter((item) => item.category === "press_release")).slice(0, 8);
  const pressUrls = new Set(press.map((item) => item.source_url));
  const domestic = dedupe(values.filter((item) => item.category === "domestic" && !pressUrls.has(item.source_url))).slice(0, 10);
  const used = new Set([...pressUrls, ...domestic.map((item) => item.source_url)]);
  const foreign = dedupe(values.filter((item) => item.category === "foreign" && !used.has(item.source_url))).slice(0, 10);
  return {
    domestic: sortNewest(domestic),
    foreign: sortNewest(foreign),
    press_release: sortNewest(press),
    queries,
    providers: {
      google_news_rss: tasks[0].status === "fulfilled" || tasks[2].status === "fulfilled",
      naver_news: tasks[1].status === "fulfilled" && Boolean(process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET),
      gdelt: tasks[4].status === "fulfilled",
    },
  };
}

module.exports = {
  buildSearchQueries,
  collectSources,
  dedupe,
  isPressReleaseItem,
  matchesContext,
  parseGdeltArticles,
  parseGoogleNewsRss,
  parseNaverItems,
};
