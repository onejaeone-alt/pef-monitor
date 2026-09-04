const fs = require("fs");
const path = require("path");

const inputDir = process.argv[2];
const sourceDir = inputDir ? path.resolve(inputDir) : null;
const outputFile = path.resolve(process.argv[3] || path.join(__dirname, "../lib/drive-dossier-data.json"));

if (!sourceDir || !fs.existsSync(sourceDir)) {
  console.error("사용법: node scripts/import-drive-dossiers.js <03_기업별 경로> [출력 파일]");
  process.exit(1);
}

function clean(value) {
  return String(value || "").replace(/`/g, "").trim();
}

function splitSections(markdown) {
  const sections = new Map();
  let current = "문서";
  sections.set(current, []);
  for (const line of String(markdown || "").split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      current = clean(heading[1]);
      sections.set(current, []);
      continue;
    }
    sections.get(current).push(line);
  }
  return sections;
}

function listItems(lines) {
  return (lines || [])
    .map((line) => line.match(/^\s*-\s+(.+)$/)?.[1])
    .filter(Boolean)
    .map(clean);
}

function numberedItems(lines) {
  return (lines || [])
    .map((line) => line.match(/^\s*\d+[.)]\s+(.+)$/)?.[1])
    .filter(Boolean)
    .map(clean);
}

function paragraphs(lines) {
  return (lines || [])
    .map(clean)
    .filter((line) => line && !/^[-*]\s/.test(line))
    .join(" ");
}

function metadata(lines) {
  const result = {};
  for (const item of listItems(lines)) {
    const match = item.match(/^([^:]+):\s*(.*)$/);
    if (match) result[clean(match[1])] = clean(match[2]);
  }
  return result;
}

function labeledItem(value) {
  const match = clean(value).match(/^\[([^\]]+)]\s*(.*)$/);
  return match ? { label: clean(match[1]), text: clean(match[2]) } : { label: null, text: clean(value) };
}

function sourceItem(value) {
  const text = clean(value);
  const labelMatch = text.match(/^([^:]+):\s*(.*)$/);
  const label = clean(labelMatch?.[1] || "근거");
  const rest = clean(labelMatch?.[2] || text);
  const markdownLink = rest.match(/^\[([^\]]+)]\((https?:\/\/[^)]+)\)/);
  const rawUrl = rest.match(/https?:\/\/\S+/)?.[0] || null;
  return {
    title: clean(markdownLink?.[1] || label),
    source_name: label,
    source_url: markdownLink?.[2] || rawUrl,
    fact: rawUrl ? null : rest,
    verification_status: null,
  };
}

function parseDate(value) {
  const text = String(value || "");
  const iso = [...text.matchAll(/(20\d{2})-(\d{1,2})(?:-(\d{1,2}))?/g)]
    .map((match) => `${match[1]}-${match[2].padStart(2, "0")}-${String(match[3] || "01").padStart(2, "0")}`);
  const korean = [...text.matchAll(/(20\d{2})년\s*(\d{1,2})월(?:\s*(\d{1,2})일)?/g)]
    .map((match) => `${match[1]}-${match[2].padStart(2, "0")}-${String(match[3] || "01").padStart(2, "0")}`);
  return [...iso, ...korean].sort().at(-1) || null;
}

function entityType(typeText) {
  const value = String(typeText || "");
  if (/PEF/.test(value)) return "pef";
  if (/VC|벤처|창업투자|기술지주/.test(value)) return "vc";
  if (/증권|캐피탈|투자금융/.test(value)) return "financial_institution";
  return "company";
}

function aliases(value) {
  return String(value || "")
    .split(/[,/]/)
    .map(clean)
    .filter(Boolean);
}

function parseCard(fileName) {
  const markdown = fs.readFileSync(path.join(sourceDir, fileName), "utf8");
  const sections = splitSections(markdown);
  const info = metadata(sections.get("기본정보"));
  const displaySections = [];
  for (const [title, lines] of sections.entries()) {
    if (["문서", "기본정보", "연결", "첫 취재 질문", "열려 있는 쟁점", "판단 경계", "근거", "다음 갱신 조건"].includes(title)) continue;
    const items = listItems(lines).map(labeledItem);
    if (items.length) displaySections.push({ title, items });
  }
  const currentStatus = displaySections.flatMap((section) => section.items);
  const questions = [...sections.entries()]
    .filter(([title]) => /질문|쟁점/.test(title))
    .flatMap(([, lines]) => numberedItems(lines).length ? numberedItems(lines) : listItems(lines));
  const basisDate = info["기준일"] || null;
  const latestIssueAt = parseDate(displaySections.flatMap((section) => section.items.map((item) => item.text)).join(" "));
  const standardName = info["표준명"] || fileName.replace(/^[^_]+_/, "").replace(/_기업카드\.md$/, "");

  return {
    company_id: info.company_id || fileName.split("_")[0],
    canonical_name: standardName,
    aliases: aliases(info["별칭"]),
    entity_type: entityType(info["유형"]),
    type_label: info["유형"] || "기업·운용사",
    identification_status: info["식별상태"] || null,
    basis_date: basisDate,
    latest_issue_at: latestIssueAt,
    source_system: "구글 드라이브 · 03_기업별",
    file_name: fileName,
    summary: currentStatus.slice(0, 2).map((item) => item.text).join(" "),
    current_status: currentStatus,
    drive_sections: displaySections,
    connections: listItems(sections.get("연결")),
    questions,
    decision_boundary: paragraphs(sections.get("판단 경계")),
    next_updates: listItems(sections.get("다음 갱신 조건")),
    sources: listItems(sections.get("근거")).map(sourceItem),
  };
}

const files = fs.readdirSync(sourceDir)
  .filter((fileName) => /_기업카드\.md$/.test(fileName))
  .sort((left, right) => left.localeCompare(right, "ko"));
const items = files.map(parseCard);
const payload = {
  source: "취재 에이전트/03_기업별",
  basis_date: items.map((item) => item.basis_date).filter(Boolean).sort().at(-1) || null,
  items,
};

fs.writeFileSync(outputFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`${items.length}개 기업카드를 ${outputFile}에 저장했습니다.`);
