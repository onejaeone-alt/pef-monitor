const crypto = require("crypto");

const LIST_URL = "https://www.kvic.or.kr/notice/kvic-notice/investment-business-notice";

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
  return decodeEntities(String(value || "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteUrl(href, base = LIST_URL) {
  try {
    const url = new URL(decodeEntities(href), base);
    if (!/^https?:$/.test(url.protocol)) return "";
    url.hash = "";
    return url.toString();
  } catch (_) {
    return "";
  }
}

function normalizeDate(value) {
  const m = String(value || "").match(/(20\d{2})[.\/-](\d{1,2})[.\/-](\d{1,2})/);
  return m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : null;
}

function stageFromTitle(title, category = "") {
  const text = `${category} ${title}`;
  if (/선정\s*결과|최종\s*선정/.test(text)) return "selection";
  if (/서류\s*(심사)?\s*결과|1차\s*심의/.test(text)) return "document_review";
  if (/접수\s*(현황|결과)/.test(text)) return "application";
  if (/출자\s*(사업\s*)?(계획|공고)|계획\s*공고/.test(text)) return "plan";
  if (/질의응답/.test(text)) return "qa";
  return "other";
}

function categoryFromRow(text) {
  const m = String(text || "").match(/\[(출자계획|접수현황|서류결과|선정결과|질의응답|변경공고|재공고)\]/);
  return m ? m[1] : "";
}

function extractBusinessYear(title, postedDate = "") {
  const titleYear = String(title || "").match(/(20\d{2})년/)?.[1];
  return Number(titleYear || String(postedDate || "").slice(0, 4) || 0) || null;
}

function businessKey(title) {
  return cleanText(title)
    .replace(/\[(?:출자계획|접수현황|서류결과|선정결과|질의응답)\]/g, "")
    .replace(/(?:최종\s*)?선정\s*결과/g, "")
    .replace(/서류(?:심사)?\s*결과/g, "")
    .replace(/접수\s*(?:현황|결과)/g, "")
    .replace(/계획\s*공고|출자사업\s*계획/g, "출자사업")
    .replace(/\s+/g, " ")
    .trim();
}

function noticeIdFromHtml(rowHtml) {
  const patterns = [
    /investment-business-notice\?[^"']*\bid=(\d+)/i,
    /[?&]id=(\d+)/i,
    /boardDataNo=(\d+)/i,
    /(?:fn_view|goView|view)\s*\(\s*['"]?(\d+)/i,
  ];
  for (const pattern of patterns) {
    const m = String(rowHtml || "").match(pattern);
    if (m) return m[1];
  }
  return null;
}

function parseListPage(html, baseUrl = LIST_URL) {
  const notices = [];
  const seen = new Set();
  const rows = String(html || "").match(/<tr\b[\s\S]*?<\/tr>/gi) || [];
  for (const row of rows) {
    const id = noticeIdFromHtml(row);
    if (!id || seen.has(id)) continue;
    const rowText = cleanText(row);
    const date = normalizeDate(rowText);
    const category = categoryFromRow(rowText);
    const anchors = [...row.matchAll(/<a\b[^>]*?(?:href\s*=\s*["']([^"']*)["'])?[^>]*>([\s\S]*?)<\/a>/gi)];
    let title = "";
    for (const anchor of anchors) {
      const text = cleanText(anchor[2]);
      if (text.length > title.length && !/첨부파일|바로보기|내려받기|처음|이전|다음|마지막/.test(text)) title = text;
    }
    if (!title || title.length < 5) {
      title = rowText.replace(/^\d+\s*/, "").replace(/\b20\d{2}[.\/-]\d{1,2}[.\/-]\d{1,2}\b.*$/, "").trim();
    }
    const url = `${LIST_URL}?id=${id}`;
    notices.push({
      notice_id: id,
      title,
      category,
      stage: stageFromTitle(title, category),
      posted_date: date,
      business_year: extractBusinessYear(title, date),
      business_key: businessKey(title),
      source_url: url,
      source_name: "한국벤처투자",
    });
    seen.add(id);
  }

  const pageLinks = [];
  for (const m of String(html || "").matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = absoluteUrl(m[1], baseUrl);
    const text = cleanText(m[2]);
    if (!href || /[?&]id=\d+/.test(href)) continue;
    if (href.includes("investment-business-notice") && (/^\d+$/.test(text) || /다음|이전|마지막|처음/.test(text))) pageLinks.push(href);
  }

  return { notices, page_links: [...new Set(pageLinks)] };
}

function parseAttachments(html, noticeId) {
  const attachments = [];
  const seen = new Set();
  const anchors = [...String(html || "").matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  for (const anchor of anchors) {
    const href = absoluteUrl(anchor[1], LIST_URL);
    const text = cleanText(anchor[2]);
    if (!href) continue;
    const looksDownload = /fileDown|download|attach/i.test(href) || /내려받기|바로보기|\.pdf|\.hwp|\.hwpx|\.xls|\.xlsx|\.zip/i.test(text);
    if (!looksDownload) continue;
    if (/fileDown/i.test(href) && noticeId && !href.includes(`boardDataNo=${noticeId}`)) continue;
    const key = href;
    if (seen.has(key)) continue;
    seen.add(key);
    const vicinityStart = Math.max(0, anchor.index - 260);
    const vicinity = cleanText(String(html).slice(vicinityStart, anchor.index + anchor[0].length + 80));
    const filename = vicinity.match(/([^\s|]+\.(?:pdf|hwp|hwpx|xls|xlsx|zip|docx?))/i)?.[1] || text;
    attachments.push({ url: href, label: text, filename });
  }
  return attachments;
}

function pickMetric(text, labels) {
  for (const label of labels) {
    const pattern = new RegExp(`${label}\\s*[:：]?\\s*([0-9][0-9,.]*(?:\\s*(?:조\\s*원|억원|억\\s*원|백만원|만원|원|개|USD\\s*[0-9,.]+M))?)`, "i");
    const m = String(text || "").match(pattern);
    if (m) return cleanText(m[1]);
  }
  return null;
}

function extractAggregate(text) {
  const source = cleanText(text);
  return {
    selected_funds: pickMetric(source, ["선정 조합 수", "선정조합수", "선정 조합수"]),
    applied_funds: pickMetric(source, ["신청조합수", "신청 조합수", "접수 조합수"]),
    passed_funds: pickMetric(source, ["통과 조합수", "통과 조합 수"]),
    mother_commitment: pickMetric(source, ["모태출자액", "출자요청액", "출자 요청액", "출자요청금액"]),
    planned_formation: pickMetric(source, ["최소결성규모", "의무조합결성액", "결성 예정액", "결성예정액", "결성예정금액"]),
  };
}

function parseDetailPage(html, notice = {}) {
  const text = cleanText(html);
  const category = notice.category || text.match(/카테고리\s*\|?\s*(출자계획|접수현황|서류결과|선정결과|질의응답)/)?.[1] || "";
  const postedDate = notice.posted_date || normalizeDate(text.match(/작성일자[\s|:]*(20\d{2}[.\/-]\d{1,2}[.\/-]\d{1,2})/)?.[1] || "");
  return {
    ...notice,
    category,
    stage: notice.stage || stageFromTitle(notice.title, category),
    posted_date: postedDate,
    business_year: notice.business_year || extractBusinessYear(notice.title, postedDate),
    business_key: notice.business_key || businessKey(notice.title),
    aggregate: extractAggregate(text),
    attachments: parseAttachments(html, notice.notice_id),
    page_text: text.slice(0, 24000),
  };
}

function managerCandidates(text) {
  const lines = String(text || "").split(/\r?\n/).map((line) => cleanText(line)).filter(Boolean);
  const candidates = [];
  const seen = new Set();
  const orgPattern = /(인베스트먼트|벤처스|파트너스|캐피탈|기술투자|창업투자|벤처투자|액셀러레이터|Investment|Ventures|Partners|Capital)/i;
  for (let line of lines) {
    if (!orgPattern.test(line)) continue;
    line = line.replace(/^[-•·○◦□■◆◇\d.()\s]+/, "").trim();
    if (line.length < 2 || line.length > 100) continue;
    if (/한국벤처투자|출자사업|선정결과|운용사명|업무집행조합원|공고/.test(line)) continue;
    const pieces = line.split(/\s{2,}|\t|\|/).map((v) => v.trim()).filter(Boolean);
    for (const piece of pieces) {
      if (!orgPattern.test(piece) || piece.length < 2 || piece.length > 70) continue;
      const normalized = piece.replace(/[,:;]+$/, "").trim();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        candidates.push(normalized);
      }
    }
  }
  return candidates.slice(0, 80);
}

function toReportingLead(notice) {
  const eventType = notice.stage === "selection" ? "selection_result" : "capital_call";
  const amounts = Object.values(notice.aggregate || {}).filter((value) => value && /원|USD|억|백만|만/.test(String(value)));
  const dates = notice.posted_date ? [notice.posted_date] : [];
  return {
    signal_id: crypto.createHash("sha1").update(`kvic-notice:${notice.notice_id}`).digest("hex").slice(0, 20),
    source_type: eventType,
    source_name: "한국벤처투자",
    title: notice.title,
    source_url: notice.source_url,
    published_at: notice.posted_date ? `${notice.posted_date}T00:00:00+09:00` : null,
    subject_name: notice.business_key || notice.title,
    event_type: eventType,
    event_label: notice.stage,
    facts: { amounts, dates },
    interpretation: notice.stage === "selection"
      ? "KVIC 공식 선정결과입니다. 지원·서류심사 이력과 실제 펀드 결성 여부를 이어서 대조할 대상입니다."
      : "KVIC 공식 출자사업 진행자료입니다. 같은 사업의 다음 단계 발표와 비교할 대상입니다.",
    checkpoints: ["이전 단계와 GP 명단 비교", "출자액·결성예정액 변화", "선정 후 실제 결성 여부"],
    story_score: notice.stage === "selection" ? 80 : notice.stage === "document_review" ? 70 : 60,
    alert_grade: notice.stage === "selection" ? "P2" : "P3",
    verification_status: "confirmed",
    raw_data: notice,
  };
}

module.exports = {
  LIST_URL,
  absoluteUrl,
  businessKey,
  extractAggregate,
  extractBusinessYear,
  managerCandidates,
  parseDetailPage,
  parseListPage,
  stageFromTitle,
  toReportingLead,
};
