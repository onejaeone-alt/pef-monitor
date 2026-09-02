const WATCH_TARGETS = [
  ["A-001", "regulator", "금융위원회", ["금융위", "FSC"]],
  ["A-002", "regulator", "금융감독원", ["금감원", "FSS"]],
  ["A-003", "regulator", "공정거래위원회", ["공정위", "KFTC"]],
  ["A-004", "market", "한국거래소", ["거래소", "KRX", "KIND"]],
  ["A-005", "lp", "한국산업은행", ["산업은행", "KDB"]],
  ["A-006", "lp", "한국성장금융투자운용", ["한국성장금융", "K-Growth"]],
  ["A-007", "lp", "한국벤처투자", ["KVIC", "모태펀드"]],
  ["A-008", "lp", "국민연금공단 기금운용본부", ["국민연금", "NPS"]],
  ["A-009", "lp", "우정사업본부", ["우본", "Korea Post"]],
  ["A-010", "lp", "한국교직원공제회", ["교직원공제회", "KTCU"]],
  ["A-011", "lp", "대한지방행정공제회", ["행정공제회", "POBA"]],
  ["A-012", "lp", "중소기업중앙회 노란우산", ["노란우산", "중소기업중앙회"]],
  ["A-013", "pef", "MBK파트너스", ["MBK", "MBK Partners"]],
  ["A-014", "pef", "한앤컴퍼니", ["한앤코", "Hahn & Company"]],
  ["A-015", "pef", "IMM프라이빗에쿼티", ["IMM PE"]],
  ["A-016", "pef", "VIG파트너스", ["VIG"]],
  ["A-017", "pef", "UCK파트너스", ["UCK", "유니슨캐피탈코리아"]],
  ["A-018", "pef", "JKL파트너스", ["JKL"]],
  ["A-019", "pef", "글랜우드프라이빗에쿼티", ["글랜우드PE", "Glenwood PE"]],
  ["A-020", "pef", "스틱인베스트먼트", ["STIC"]],
  ["A-021", "pef", "H&Q에쿼티파트너스", ["H&Q"]],
  ["A-022", "pef", "프랙시스캐피탈파트너스", ["프랙시스캐피탈", "Praxis Capital"]],
  ["A-023", "pef", "E&F프라이빗에쿼티", ["E&F PE", "이앤에프PE"]],
  ["A-024", "pef", "KKR코리아", ["KKR Korea", "KKR"]],
  ["A-025", "pef", "맥쿼리자산운용그룹 한국", ["맥쿼리", "Macquarie Korea"]],
  ["A-026", "pef", "어피니티에쿼티파트너스", ["어피니티", "Affinity Equity"]],
  ["A-027", "pef", "베인캐피탈", ["Bain Capital Korea", "Bain Capital"]],
  ["A-028", "ib", "KB증권", ["KB Securities"]],
  ["A-029", "ib", "한국투자증권", ["한투증권", "Korea Investment Securities"]],
  ["A-030", "ib", "NH투자증권", ["NH증권", "NH Investment"]],
  ["A-031", "ib", "골드만삭스", ["Goldman Sachs Korea", "Goldman Sachs"]],
  ["A-032", "advisor", "김·장 법률사무소", ["김앤장", "Kim & Chang"]],
  ["A-033", "special", "홈플러스", ["Homeplus"]],
  ["A-034", "special", "SK그룹", ["SK Group", "SK 리밸런싱"]],
  ["A-035", "special", "롯데그룹", ["Lotte Group"]],
  ["A-036", "special", "태광그룹", ["Taekwang Group"]],
  ["A-037", "vc", "한국투자파트너스", ["한투파", "Korea Investment Partners"]],
  ["A-038", "vc", "KB인베스트먼트", ["KB Investment"]],
  ["A-039", "vc", "SBVA", ["소프트뱅크벤처스", "SoftBank Ventures Asia"]],
  ["A-040", "vc", "IMM인베스트먼트", ["IMM Investment"]],
  ["A-041", "vc", "에이티넘인베스트먼트", ["에이티넘", "Atinum Investment"]],
  ["A-042", "vc", "DSC인베스트먼트", ["디에스씨인베스트먼트", "DSC Investment"]],
  ["A-043", "vc", "인터베스트", ["InterVest"]],
  ["A-044", "vc", "미래에셋벤처투자", ["Mirae Asset Venture Investment"]],
  ["A-045", "ac", "블루포인트파트너스", ["블루포인트", "Bluepoint Partners"]],
  ["A-046", "ac", "프라이머", ["Primer"]],
].map(([id, category, name, aliases]) => ({ id, category, name, aliases, priority: "A" }));

const NEWS_TARGETS = WATCH_TARGETS.filter((target) => ["vc", "ac"].includes(target.category));

const OFFICIAL_SOURCES = [
  {
    id: "kvic",
    name: "한국벤처투자",
    category: "capital_call",
    url: "https://www.kvic.or.kr/notice",
    include: /(출자|선정|접수현황|위탁운용사|모태펀드)/,
  },
  {
    id: "kgrowth",
    name: "한국성장금융",
    category: "capital_call",
    url: "https://www.kgrowth.or.kr/notice.asp",
    include: /(출자|선정|접수현황|위탁운용사|펀드)/,
  },
  {
    id: "kvca",
    name: "한국벤처캐피탈협회",
    category: "capital_call",
    url: "https://www.kvca.or.kr/Program/invest/list.html?a_cd=8&a_gb=board&a_item=0&sm=2_2_2",
    include: /(출자|선정|접수|위탁운용사|PEF|VC|펀드)/i,
  },
];

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/주식회사|유한회사|유한책임회사|사모투자합자회사|\(주\)|㈜/g, "")
    .replace(/[^0-9a-z가-힣]/g, "");
}

function findWatchTarget(text, targets = WATCH_TARGETS) {
  const haystack = normalize(text);
  return targets.find((target) => [target.name, ...target.aliases]
    .map(normalize)
    .filter((term) => term.length >= 2)
    .some((term) => haystack.includes(term))) || null;
}

module.exports = {
  NEWS_TARGETS,
  OFFICIAL_SOURCES,
  WATCH_TARGETS,
  findWatchTarget,
};
