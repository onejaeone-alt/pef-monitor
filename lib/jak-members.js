const JAK_MEMBERS_URL = 'https://www.journalist.or.kr/home/company.html?p_num=20';

// 한국기자협회 공식 회원사 안내가 일시적으로 열리지 않을 때 쓰는 서울·전국 주요 회원사 스냅샷.
// 실제 수집 시에는 공식 회원사 페이지를 먼저 읽고 이 목록은 폴백으로만 사용한다.
const FALLBACK_JAK_MEMBERS = [
  '경향신문','국민일보','내일신문','노컷뉴스','농민신문','뉴데일리','뉴스1','뉴스웨이','뉴스타파','뉴스토마토','뉴스핌','뉴시스',
  '대한경제','더벨','더팩트','데일리안','동아일보','동행미디어 시대','디지털데일리','디지털타임스','매경AX','매일경제신문','매일노동뉴스',
  '머니투데이','메트로미디어','문화일보','미디어펜','민중의소리','법률신문','브릿지경제','비즈워치','서울경제신문','서울신문','세계비즈앤스포츠월드',
  '세계일보','스포츠서울','시사위크','시사저널','시사저널e','시사IN','신아일보','아시아경제','아시아투데이','아이뉴스24','아주경제',
  '에너지경제신문','여성신문','연합뉴스','연합뉴스TV','연합인포맥스','오마이뉴스','이데일리','이투데이','일간스포츠','일요시사','일요신문',
  '전기신문','전자신문','조선비즈','조선일보','중앙일보','지디넷코리아','채널A','코리아중앙데일리','코리아타임스','코리아헤럴드','쿠키뉴스',
  '투데이신문','파이낸셜뉴스','프라임경제','프레시안','한겨레신문','한국경제신문','한국경제TV','한국금융신문','한국일보','한스경제','헤럴드경제',
  'BBS','CBS','CPBC','EBN','EBS','IT조선','JTBC','KBS','KPI뉴스','MBC','MBN','MTN','OSEN','SBS','SBS Biz','TBS','TV조선','YTN',
  '국제신문','부산일보','KNN','매일신문','영남일보','대구일보','대전일보','충청투데이','강원도민일보','강원일보','경인일보','경기일보',
  '광주일보','전북일보','전북도민일보','경남도민일보','제주일보','제주의소리','한라일보','헤드라인제주'
];

function stripMarkup(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSource(value) {
  return String(value || '')
    .replace(/\s+/g, '')
    .replace(/[()（）·.]/g, '')
    .replace(/신문사$|신문$|방송$|방송사$/g, '')
    .toLowerCase();
}

function parseJakMemberPage(html) {
  const rows = String(html || '').match(/<tr\b[\s\S]*?<\/tr>/gi) || [];
  const names = [];
  for (const row of rows) {
    const firstCell = row.match(/<td\b[^>]*>([\s\S]*?)<\/td>/i)?.[1];
    if (!firstCell) continue;
    const name = stripMarkup(firstCell);
    if (!name || name === '지회' || /^\d+$/.test(name) || name.length > 40) continue;
    names.push(name);
  }
  return [...new Set(names)];
}

function isJakMemberSource(sourceName, members = FALLBACK_JAK_MEMBERS) {
  const source = normalizeSource(sourceName);
  if (!source || source.length < 2) return false;
  return (members || []).some((member) => {
    const candidate = normalizeSource(member);
    if (!candidate || candidate.length < 2) return false;
    return source === candidate || source.includes(candidate) || candidate.includes(source);
  });
}

async function fetchJakMembers(timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(JAK_MEMBERS_URL, {
      signal: controller.signal,
      headers: { 'User-Agent': 'IB-News-Monitor/5.0' },
    });
    if (!response.ok) throw new Error(`JAK HTTP ${response.status}`);
    const names = parseJakMemberPage(await response.text());
    if (names.length < 50) throw new Error(`JAK member parse too small: ${names.length}`);
    return { names, source: 'official', count: names.length };
  } catch (_) {
    return { names: FALLBACK_JAK_MEMBERS, source: 'fallback', count: FALLBACK_JAK_MEMBERS.length };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  FALLBACK_JAK_MEMBERS,
  JAK_MEMBERS_URL,
  fetchJakMembers,
  isJakMemberSource,
  normalizeSource,
  parseJakMemberPage,
};
