const crypto = require('crypto');
const { FALLBACK_JAK_MEMBERS, isJakMemberSource } = require('./jak-members');

const NOISE_PATTERNS = [
  /폴리에틸렌|폴리프로필렌|\bPE\s*필름\b|석유화학.*\bPE\b/i,
  /바이닐|LP판|LP\s*음반|레코드판|턴테이블/i,
  /SI\s*단위|국제단위계|FI\s*공식/i,
  /펀드.*수익률.*ETF|ETF.*펀드.*수익률/i,
  /주식\s*추천|목표주가|오늘의\s*종목|재테크/i,
  /채용|공모전|교육생|세미나 참가자|이벤트.*증정/i,
];

const STOPWORDS = new Set([
  '단독','종합','속보','마켓인','투자','투자자','관련','시장','업계','국내','올해','지난해','최근','이번','위해','통해','대한','나선다','추진','진행','본격','확대','전망','주목','기대','한국','기업','회사','그룹','펀드','사모펀드','PEF','M&A','인수','매각','투자은행','자금조달','벤처캐피탈','스타트업','국민연금','산업은행','공제회','운용사','자산운용','증권사','금융','서울','기자','억원','조원'
]);

function queries(days) {
  const suffix = `when:${days}d`;
  return [
    `(벤처캐피탈 OR "벤처 투자" OR "기업형 벤처캐피탈" OR CVC OR "스타트업 투자") ${suffix}`,
    `(사모펀드 OR PEF OR 프라이빗에쿼티 OR "private equity" OR 바이아웃) ${suffix}`,
    `(M&A OR 인수합병 OR 경영권 OR 공개매수 OR 매각 OR 인수 OR 우선협상대상자 OR 본입찰 OR 예비입찰) ${suffix}`,
    `("투자은행" OR "IB업계" OR "IB 업계" OR 인수금융 OR "M&A 자문" OR 매각주관사) ${suffix}`,
    `(회사채 OR 전환사채 OR 교환사채 OR 신주인수권부사채 OR 메자닌 OR 리파이낸싱 OR 차환 OR 유상증자) ${suffix}`,
    `(산업은행 OR 한국성장금융 OR 모태펀드 OR 한국벤처투자 OR 국민연금 OR 공제회 OR 정책금융 OR 출자사업) ${suffix}`,
    `(펀드레이징 OR 블라인드펀드 OR "펀드 결성" OR "1차 클로징" OR "최종 클로징" OR 드라이파우더) ${suffix}`,
    `((자산운용 OR 자산운용사) (대체투자 OR 사모펀드 OR 인수 OR 블라인드펀드 OR 기관투자)) ${suffix}`,
    `("전략적 투자자" OR "재무적 투자자" OR "전략적투자자" OR "재무적투자자") ${suffix}`,
    `((엑시트 OR 회수 OR 블록딜 OR 세컨더리 OR IPO) (PEF OR VC OR 벤처캐피탈 OR 사모펀드 OR 투자자)) ${suffix}`,
    `((PEF OR 사모펀드 OR 벤처캐피탈 OR 투자은행) (대표 OR 파트너 OR 영입 OR 퇴사 OR 독립 OR 합류 OR 인사)) ${suffix}`,
  ];
}

function theme(text) {
  const t = String(text || '');
  if (/사모펀드|PEF|프라이빗에쿼티|private equity|바이아웃|M&A|인수합병|공개매수|경영권|우선협상|본입찰|예비입찰|매각|인수/.test(t)) return ['ma_pef','M&A·PEF'];
  if (/벤처캐피탈|벤처 투자|CVC|기업형 벤처캐피탈|스타트업|시리즈[A-D]?|벤처투자/.test(t)) return ['vc','VC·스타트업'];
  if (/모태펀드|한국벤처투자|한국성장금융|산업은행|국민연금|공제회|정책금융|출자사업|앵커LP/.test(t)) return ['lp','LP·정책자금'];
  if (/회사채|인수금융|투자은행|IB업계|IB 업계|전환사채|교환사채|신주인수권부사채|메자닌|리파이낸싱|차환|유상증자|자금조달|매각주관사/.test(t)) return ['ib','IB·자금조달'];
  if (/펀드레이징|블라인드펀드|펀드 결성|클로징|드라이파우더|자산운용/.test(t)) return ['fund','펀드레이징·운용'];
  if (/전략적 투자자|재무적 투자자|전략적투자자|재무적투자자/.test(t)) return ['investor','SI·FI'];
  return ['other','기타 IB'];
}

function eventLabel(text) {
  const t = String(text || '');
  if (/회생|파산|워크아웃|채무불이행|부도/.test(t)) return '회생·위험';
  if (/우선협상|본입찰|예비입찰|SPA|주식매매계약/.test(t)) return 'M&A 진행';
  if (/매각|인수|M&A|인수합병|공개매수|경영권/.test(t)) return 'M&A';
  if (/펀드레이징|결성|조성|블라인드펀드|클로징|드라이파우더/.test(t)) return '펀드레이징';
  if (/출자|선정|모태펀드|공제회|국민연금|산업은행|한국성장금융/.test(t)) return 'LP·출자';
  if (/회사채|전환사채|교환사채|신주인수권부사채|메자닌|인수금융|리파이낸싱|차환|유상증자|자금조달/.test(t)) return '자금조달';
  if (/투자 유치|투자유치|투자 참여|투자한다|투자 결정|후속 투자|시리즈[A-D]?/.test(t)) return '투자';
  if (/IPO|상장|블록딜|세컨더리|회수|엑시트/.test(t)) return '회수·IPO';
  if (/영입|선임|취임|사임|퇴사|이동|독립|합류|승진/.test(t)) return '인사';
  return 'IB 뉴스';
}

function hasNoise(text) {
  return NOISE_PATTERNS.some((pattern) => pattern.test(String(text || '')));
}

function shouldKeep(item, target, jakMembers = FALLBACK_JAK_MEMBERS) {
  const text = `${item.title || ''} ${item.snippet || ''}`;
  if (hasNoise(text)) return false;
  const [themeId] = theme(text);
  if (themeId === 'other') return false;
  // 뉴스 품질의 1차 문턱은 한국기자협회 가입 언론사 여부다.
  if (!isJakMemberSource(item.source_name, jakMembers)) return false;
  return true;
}

function normalizeTitle(value) {
  return String(value || '').toLowerCase().replace(/^\s*\[[^\]]{1,20}\]\s*/,'').replace(/[^0-9a-z가-힣]/g,'').slice(0,180);
}

function tokens(value) {
  return [...new Set((String(value || '').replace(/\[[^\]]+\]/g,' ').match(/[A-Za-z0-9가-힣]{2,}/g) || [])
    .map((x)=>x.toLowerCase())
    .filter((x)=>x.length >= 2 && !STOPWORDS.has(x) && !STOPWORDS.has(x.toUpperCase()))
    .filter((x)=>!/^\d+$/.test(x))
    .slice(0,24))];
}

function similarity(left, right) {
  const a = tokens(`${left.title} ${left.target?.name || ''}`);
  const b = new Set(tokens(`${right.title} ${right.target?.name || ''}`));
  const shared = a.filter((x)=>b.has(x));
  const denominator = Math.max(1, Math.min(a.length,b.size));
  let score = shared.length / denominator;
  if (left.target?.id && left.target.id === right.target?.id) score += 0.35;
  if (left.event_label === right.event_label) score += 0.12;
  if (left.theme_id === right.theme_id) score += 0.05;
  return { score, shared };
}

function sameIssue(left, right) {
  const { score, shared } = similarity(left,right);
  if (left.target?.id && left.target.id === right.target?.id && left.event_label === right.event_label && shared.length >= 1) return true;
  if (shared.some((x)=>x.length >= 5) && shared.length >= 2 && score >= 0.48) return true;
  return shared.length >= 3 && score >= 0.58;
}

function kstDay(value) {
  const time = new Date(value || '').getTime();
  if (!Number.isFinite(time)) return '';
  return new Date(time + 9*3600*1000).toISOString().slice(0,10);
}

function clusterIssues(items) {
  const ordered = [...items].sort((a,b)=>String(b.published_at||'').localeCompare(String(a.published_at||'')));
  const clusters = [];
  for (const item of ordered) {
    let cluster = clusters.find((candidate)=>sameIssue(candidate.items[0],item));
    if (!cluster) {
      cluster = { items: [] };
      clusters.push(cluster);
    }
    cluster.items.push(item);
  }
  return clusters.map((cluster)=>{
    const rows = cluster.items.sort((a,b)=>String(b.published_at||'').localeCompare(String(a.published_at||'')));
    const sources = [...new Set(rows.map((x)=>x.source_name).filter(Boolean))];
    const relatedEntities = [];
    const seenEntities = new Set();
    for (const item of rows) {
      for (const entity of item.related_entities || []) {
        if (!entity?.entity_key || seenEntities.has(entity.entity_key)) continue;
        seenEntities.add(entity.entity_key);
        relatedEntities.push(entity);
      }
    }
    const days = [...new Set(rows.map((x)=>kstDay(x.published_at)).filter(Boolean))];
    const latest = rows[0], oldest = rows[rows.length-1];
    const key = normalizeTitle(latest.title) || latest.source_url;
    return {
      issue_id: crypto.createHash('sha1').update(key).digest('hex').slice(0,16),
      headline: latest.title,
      latest_seen: latest.published_at,
      first_seen: oldest.published_at,
      coverage_days: days.length,
      article_count: rows.length,
      source_count: sources.length,
      sources: sources.slice(0,8),
      theme_id: latest.theme_id,
      theme_label: latest.theme_label,
      event_label: latest.event_label,
      target: latest.target || null,
      related_entities: relatedEntities.slice(0, 8),
      ongoing: rows.length >= 2 && sources.length >= 2,
      items: rows.slice(0,10),
    };
  }).sort((a,b)=>{
    if (a.ongoing !== b.ongoing) return Number(b.ongoing)-Number(a.ongoing);
    if (a.coverage_days !== b.coverage_days) return b.coverage_days-a.coverage_days;
    if (a.source_count !== b.source_count) return b.source_count-a.source_count;
    return String(b.latest_seen||'').localeCompare(String(a.latest_seen||''));
  });
}

module.exports = {
  clusterIssues,
  eventLabel,
  normalizeTitle,
  queries,
  shouldKeep,
  theme,
};
