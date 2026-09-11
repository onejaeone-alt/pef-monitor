'use strict';
const fs=require('node:fs'),path=require('node:path');
const MARK='// MARKETIN_EVENT_FIRST_COVERAGE_V2';
const API_MARK='// MARKETIN_HARD_SCOPE_READER_V1';

function replaceOnce(source,from,to,label){
  if(!source.includes(from)) throw Error(`MarketIN coverage: ${label} anchor changed`);
  return source.replace(from,to);
}

function patch(source){
  if(source.includes(MARK)) return source;
  let s=source;

  // Keep the existing policy-LP query and add a narrow KIC/Korean strategic-fund query.
  // Plain "국부펀드" is deliberately not a standalone discovery term: it pulled in
  // unrelated Saudi/Abu Dhabi sovereign-wealth-fund stories.
  const q='    `(산업은행 OR 한국성장금융 OR 모태펀드 OR 한국벤처투자 OR 국민연금 OR 공제회 OR 정책금융 OR 출자사업) ${suffix}`,';
  const q2=q+'\n    `(한국투자공사 OR KIC OR 전략투자계정 OR "한국판 국부펀드" OR 인내자본) ${suffix}`,';
  s=replaceOnce(s,q,q2,'query');

  const theme="  if (/모태펀드|한국벤처투자|한국성장금융|산업은행|국민연금|공제회|정책금융|출자사업|앵커LP/.test(t)) return ['lp','LP·정책자금'];";
  const theme2="  if (/모태펀드|한국벤처투자|한국성장금융|산업은행|국민연금|공제회|정책금융|출자사업|앵커LP|한국투자공사|\\bKIC\\b|한국판\\s*국부펀드|전략형\\s*국부펀드|인내자본|전략투자계정|전략산업\\s*투자계정|앵커투자자/.test(t)) return ['lp','LP·정책자금'];";
  s=replaceOnce(s,theme,theme2,'theme');

  const event="  if (/출자|선정|모태펀드|공제회|국민연금|산업은행|한국성장금융/.test(t)) return 'LP·출자';";
  const event2="  if (/출자|선정|모태펀드|공제회|국민연금|산업은행|한국성장금융|한국투자공사|\\bKIC\\b|한국판\\s*국부펀드|전략형\\s*국부펀드|인내자본|전략투자계정|앵커투자자/.test(t)) return 'LP·출자';";
  s=replaceOnce(s,event,event2,'event');

  const gateAnchor='function hasNoise(text) {';
  const gate=`// MARKETIN_EVENT_FIRST_GATE_V1\n// This is a reporting-scope gate, not an article-value score.\n// A headline must describe a concrete change in money, control, risk, rules,\n// LP/GP/fund process or relevant personnel. Market-price reaction headlines\n// are excluded even when they mention an otherwise relevant corporate action.\nconst PRICE_REACTION_HEADLINE = /(?:급등|급락|상한가|하한가|강세|약세|급반등|랠리|장중.{0,12}(?:상승|하락|급등|급락)|특징주|오늘의\\s*종목|52주\\s*신고가|주가.{0,16}(?:상승|하락|급등|급락|오르|내리|뛰)|시총.{0,16}(?:증가|감소|급증|급락))/i;\nconst KOREAN_POLICY_LP_STRATEGY = /한국판\\s*국부펀드|전략투자계정|전략산업\\s*투자계정|(?:정책|전략|산업|국부펀드).{0,24}인내자본|인내자본.{0,24}(?:정책|전략|산업|국부펀드)|(?:한국투자공사|\\bKIC\\b).{0,60}(?:전략투자|앵커투자자|인내자본|국부펀드)|(?:전략투자|앵커투자자|인내자본|국부펀드).{0,60}(?:한국투자공사|\\bKIC\\b)/i;\nconst GENERIC_SOVEREIGN_FUND = /국부펀드/i;\nconst KOREA_LINK = /한국|국내|코리아|Korea|한국기업|국내기업|국내\\s*기업|\\bKIC\\b|한국투자공사/i;\nconst CONCRETE_IB_EVENT = /(?:매각|인수|인수합병|공개매수|경영권.{0,12}(?:인수|매각|변경|분쟁|확보)|우선협상|본입찰|예비입찰|주식매매계약|\\bSPA\\b|합병.{0,12}(?:결정|추진|승인|완료)|분할.{0,12}(?:결정|추진|승인)|투자\\s*(?:유치|참여|집행|결정|확정|완료|단행)|(?:유치|조달).{0,16}\\d+(?:억|조)|\\d+(?:억|조)원?.{0,18}(?:투자|출자|유치)|출자|GP.{0,10}(?:선정|교체|해임)|운용사.{0,10}(?:선정|교체|해임)|펀드.{0,12}(?:결성|클로징|청산|해산)|펀드레이징|세컨더리|회수|엑시트|기업공개.{0,12}(?:추진|철회|승인)|\\bIPO\\b.{0,18}(?:추진|철회|승인|상장|예비심사|수요예측|공모가|주관)|상장.{0,12}(?:예비심사|철회|폐지|승인)|회사채.{0,16}(?:발행|수요예측|미매각|상환|차환)|(?:전환사채|교환사채|신주인수권부사채|메자닌|\\bCB\\b|\\bBW\\b|\\bEB\\b).{0,18}(?:발행|상환|전환|리픽싱|조달|결정)|유상증자.{0,16}(?:결정|추진|발표|공시|철회|납입|청약|실권|조달)|인수금융|리파이낸싱|차환|차입|대출.{0,14}(?:약정|만기|연장|실행)|(?:PF|프로젝트파이낸싱).{0,18}(?:대출|보증|우발채무|부실|연체|만기|차환|손실|충당금|매각|정리)|신용등급.{0,12}(?:상향|하향|강등|전망)|회생.{0,12}(?:신청|개시|인가|종결)|워크아웃.{0,12}(?:신청|개시|졸업)|구조조정.{0,12}(?:착수|합의|실시)|자사주.{0,14}(?:소각|처분|매입|취득|매각).{0,10}(?:결정|발표|공시)?|주주제안|행동주의|정책.{0,12}(?:발표|시행|개정|개편)|규정.{0,12}(?:개정|시행)|제도.{0,12}(?:개편|시행|도입)|기준.{0,12}(?:변경|개정)|신설|폐지|영입|선임|취임|사임|퇴사|이동|독립|합류|승진)/i;\n\nfunction isPriceReactionHeadline(title) {\n  return PRICE_REACTION_HEADLINE.test(String(title || ''));\n}\n\nfunction isUnrelatedForeignSovereignFund(text) {\n  const value=String(text || '');\n  return GENERIC_SOVEREIGN_FUND.test(value) && !KOREA_LINK.test(value) && !KOREAN_POLICY_LP_STRATEGY.test(value);\n}\n\nfunction hasConcreteIbEvent(text) {\n  return CONCRETE_IB_EVENT.test(String(text || ''));\n}\n\n`+gateAnchor;
  s=replaceOnce(s,gateAnchor,gate,'gate insertion');

  const keep=`function shouldKeep(item, target, jakMembers = FALLBACK_JAK_MEMBERS) {\n  const text = \`\${item.title || ''} \${item.snippet || ''}\`;\n  if (hasNoise(text)) return false;\n  const [themeId] = theme(text);\n  if (themeId === 'other') return false;\n  if (!isJakMemberSource(item.source_name, jakMembers)) return false;\n  return true;\n}`;
  const keep2=`function shouldKeep(item, target, jakMembers = FALLBACK_JAK_MEMBERS) {\n  const title = String(item.title || '');\n  const text = \`\${title} \${item.snippet || ''}\`;\n  if (hasNoise(text) || isPriceReactionHeadline(title)) return false;\n  if (isUnrelatedForeignSovereignFund(text)) return false;\n  const [themeId] = theme(text);\n  if (themeId === 'other') return false;\n  if (!isJakMemberSource(item.source_name, jakMembers)) return false;\n  // KIC/Korean strategic-fund mandate changes can be reporting signals even when\n  // the headline is phrased as an official strategy statement rather than a deal verb.\n  if (KOREAN_POLICY_LP_STRATEGY.test(text)) return true;\n  if (!hasConcreteIbEvent(text)) return false;\n  return true;\n}`;
  s=replaceOnce(s,keep,keep2,'shouldKeep');

  return MARK+'\n'+s;
}

function patchApi(source){
  if(source.includes(API_MARK)) return source;
  const old="      if (!shouldKeep(item, target, jak.names) && !(relevance?.status === 'relevant' && isJakMemberSource(item.source_name, jak.names)) && !directProbe) continue;";
  const next="      const inScope = shouldKeep(item, target, jak.names);\n      // The reader relevance layer may rank an in-scope story, but it must never\n      // reopen a story rejected by the MarketIN reporting-scope gate. A q= manual\n      // probe remains available for diagnostics without polluting the normal feed.\n      if (!inScope && !directProbe) continue;";
  return API_MARK+'\n'+replaceOnce(source,old,next,'reader hard scope');
}

function main(root=path.resolve(__dirname,'..')){
  const monitorFile=path.join(root,'lib/news-monitor.js');
  const monitorBefore=fs.readFileSync(monitorFile,'utf8'),monitorAfter=patch(monitorBefore);
  if(monitorAfter!==monitorBefore)fs.writeFileSync(monitorFile,monitorAfter);
  const apiFile=path.join(root,'api/news.js');
  const apiBefore=fs.readFileSync(apiFile,'utf8'),apiAfter=patchApi(apiBefore);
  if(apiAfter!==apiBefore)fs.writeFileSync(apiFile,apiAfter);
}
if(require.main===module)main();
module.exports={patch,patchApi,main};
