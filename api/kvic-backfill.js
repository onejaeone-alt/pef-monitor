const {
  LIST_URL,
  managerCandidates,
  parseDetailPage,
  parseListPage,
  toReportingLead,
} = require("../lib/kvic-notices");
const { persistReportingLeads } = require("../lib/supabase");

async function fetchText(url, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml,application/pdf,*/*",
        "User-Agent": "Mozilla/5.0 (compatible; PEF-Monitor/2.0; +https://pef-monitor.vercel.app)",
      },
    });
    if (!response.ok) throw new Error(`KVIC HTTP ${response.status}: ${url}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchPdfText(url) {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 20000);
  try {
    const response = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PEF-Monitor/2.0)" },
    });
    if (!response.ok) throw new Error(`PDF HTTP ${response.status}`);
    const contentType = String(response.headers.get("content-type") || "");
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > 12 * 1024 * 1024) throw new Error("PDF 12MB 초과");
    if (!/pdf/i.test(contentType) && buffer.slice(0, 4).toString() !== "%PDF") throw new Error("PDF 형식 아님");
    // 구버전 CommonJS API를 고정해 Vercel 번들에서 안정적으로 사용한다.
    const pdfParse = require("pdf-parse");
    const parsed = await pdfParse(buffer);
    return String(parsed.text || "").slice(0, 60000);
  } finally {
    clearTimeout(timeout);
  }
}

function pageTemplateFromLinks(links) {
  for (const link of links || []) {
    try {
      const url = new URL(link);
      for (const [key, value] of url.searchParams.entries()) {
        if (/^\d{1,3}$/.test(value) && !/^id$/i.test(key)) {
          return { base: url, key };
        }
      }
    } catch (_) {
      // 다음 후보를 본다.
    }
  }
  return null;
}

function urlFromTemplate(template, page) {
  const url = new URL(template.base.toString());
  url.searchParams.set(template.key, String(page));
  return url.toString();
}

async function discoverPageTemplate(firstHtml) {
  const parsed = parseListPage(firstHtml, LIST_URL);
  const direct = pageTemplateFromLinks(parsed.page_links);
  if (direct) return direct;

  const firstIds = parsed.notices.map((item) => item.notice_id).join(",");
  const keys = ["page", "pageNo", "pageIndex", "currentPage", "currentPageNo", "pageNum"];
  for (const key of keys) {
    const candidate = new URL(LIST_URL);
    candidate.searchParams.set(key, "2");
    try {
      const html = await fetchText(candidate.toString());
      const next = parseListPage(html, candidate.toString());
      const nextIds = next.notices.map((item) => item.notice_id).join(",");
      if (next.notices.length && nextIds && nextIds !== firstIds) {
        return { base: candidate, key };
      }
    } catch (_) {
      // 다른 페이지 파라미터를 시도한다.
    }
  }
  return null;
}

function shouldReadPdf(notice, pdfMode) {
  if (pdfMode === "0" || pdfMode === "none") return false;
  if (pdfMode === "all") return ["selection", "document_review", "application"].includes(notice.stage);
  return notice.stage === "selection";
}

async function hydrateNotice(notice, pdfMode) {
  const html = await fetchText(notice.source_url);
  const detail = parseDetailPage(html, notice);
  detail.manager_candidates = [];
  detail.attachment_text = null;
  detail.attachment_parse_error = null;

  if (shouldReadPdf(detail, pdfMode)) {
    const pdf = (detail.attachments || []).find((item) => /\.pdf/i.test(item.filename || "") || /pdf|fileDown/i.test(`${item.label} ${item.url}`));
    if (pdf) {
      try {
        const text = await fetchPdfText(pdf.url);
        detail.attachment_text = text;
        detail.manager_candidates = managerCandidates(text);
      } catch (error) {
        detail.attachment_parse_error = String(error.message || error).slice(0, 300);
      }
    }
  }
  return detail;
}

async function mapLimited(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        results[index] = await worker(items[index]);
      } catch (error) {
        results[index] = { ...items[index], fetch_error: String(error.message || error).slice(0, 300) };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

function automaticHistoricalStart(pagesPerRun = 3) {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  const dayIndex = Math.floor(kst.getTime() / 86400000);
  const cyclePages = 90;
  return 1 + ((dayIndex * pagesPerRun) % cyclePages);
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");

  try {
    const currentYear = new Date(Date.now() + 9 * 3600 * 1000).getUTCFullYear();
    const pages = Math.min(Math.max(parseInt(req.query.pages || "2", 10), 1), 4);
    const autoHistorical = String(req.query.auto || "") === "historical";
    const startPage = autoHistorical
      ? automaticHistoricalStart(pages)
      : Math.max(parseInt(req.query.startPage || req.query.page || "1", 10), 1);
    const fromYear = Math.min(Math.max(parseInt(req.query.fromYear || "2020", 10), 2000), currentYear + 1);
    const toYear = Math.min(Math.max(parseInt(req.query.toYear || String(currentYear), 10), fromYear), currentYear + 1);
    const pdfMode = String(req.query.pdf || "selection").toLowerCase();
    const persist = String(req.query.persist || "1") !== "0";

    const firstHtml = await fetchText(LIST_URL);
    const firstParsed = parseListPage(firstHtml, LIST_URL);
    const pageTemplate = await discoverPageTemplate(firstHtml);
    if (!firstParsed.notices.length) throw new Error("KVIC 목록에서 게시물을 찾지 못했습니다.");
    if (startPage > 1 && !pageTemplate) throw new Error("KVIC 게시판 페이지 방식 자동 탐지 실패");

    const pageResults = [];
    for (let page = startPage; page < startPage + pages; page += 1) {
      const pageUrl = page === 1 ? LIST_URL : urlFromTemplate(pageTemplate, page);
      const html = page === 1 ? firstHtml : await fetchText(pageUrl);
      const parsed = parseListPage(html, pageUrl);
      pageResults.push({ page, page_url: pageUrl, count: parsed.notices.length, notices: parsed.notices });
    }

    const seen = new Set();
    const candidates = [];
    for (const page of pageResults) {
      for (const notice of page.notices) {
        if (seen.has(notice.notice_id)) continue;
        seen.add(notice.notice_id);
        if (!notice.business_year || notice.business_year < fromYear || notice.business_year > toYear) continue;
        if (!["plan", "application", "document_review", "selection"].includes(notice.stage)) continue;
        candidates.push(notice);
      }
    }

    const hydrated = await mapLimited(candidates, 4, (notice) => hydrateNotice(notice, pdfMode));
    const successful = hydrated.filter((item) => !item.fetch_error);
    const leads = successful.map(toReportingLead);
    const storage = persist ? await persistReportingLeads(leads) : { ready: false, saved: 0, code: "PERSIST_DISABLED" };

    return res.status(200).json({
      ok: true,
      range: { start_page: startPage, pages, from_year: fromYear, to_year: toYear, pdf: pdfMode },
      paginator: pageTemplate ? { detected: true, key: pageTemplate.key } : { detected: startPage === 1, key: null },
      scanned_pages: pageResults.map(({ page, page_url, count }) => ({ page, page_url, count })),
      candidates: candidates.length,
      parsed: successful.length,
      failed: hydrated.length - successful.length,
      storage,
      items: hydrated,
      next_start_page: startPage + pages,
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error.message || error) });
  }
};
