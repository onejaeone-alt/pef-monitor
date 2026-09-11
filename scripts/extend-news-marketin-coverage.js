'use strict';
const fs=require('node:fs'),path=require('node:path');
const MARK='// MARKETIN_POLICY_LP_COVERAGE_V1';
function patch(source){
  if(source.includes(MARK)) return source;
  let s=source;
  const q='`(산업은행 OR 한국성장금융 OR 모태펀드 OR 한국벤처투자 OR 국민연금 OR 공제회 OR 정책금융 OR 출자사업) ${suffix}`,';
  const q2='`(산업은행 OR 한국성장금융 OR 모태펀드 OR 한국벤처투자 OR 국민연금 OR 공제회 OR 정책금융 OR 출자사업 OR 한국투자공사 OR KIC OR 국부펀드 OR 인내자본 OR 전략투자계정 OR 앵커투자자) ${suffix}`,';
  if(!s.includes(q)) throw Error('MarketIN coverage: query anchor changed');
  s=s.replace(q,q2);
  const theme="if (/모태펀드|한국벤처투자|한국성장금융|산업은행|국민연금|공제회|정책금융|출자사업|앵커LP/.test(t)) return ['lp','LP·정책자금'];";
  const theme2="if (/모태펀드|한국벤처투자|한국성장금융|산업은행|국민연금|공제회|정책금융|출자사업|앵커LP|한국투자공사|\\bKIC\\b|국부펀드|인내자본|전략투자계정|전략산업\\s*투자계정|앵커투자자/.test(t)) return ['lp','LP·정책자금'];";
  if(!s.includes(theme)) throw Error('MarketIN coverage: theme anchor changed');
  s=s.replace(theme,theme2);
  const event="if (/출자|선정|모태펀드|공제회|국민연금|산업은행|한국성장금융/.test(t)) return 'LP·출자';";
  const event2="if (/출자|선정|모태펀드|공제회|국민연금|산업은행|한국성장금융|한국투자공사|\\bKIC\\b|국부펀드|인내자본|전략투자계정|앵커투자자/.test(t)) return 'LP·출자';";
  if(!s.includes(event)) throw Error('MarketIN coverage: event anchor changed');
  s=s.replace(event,event2);
  return MARK+'\n'+s;
}
function main(root=path.resolve(__dirname,'..')){
  const file=path.join(root,'lib/news-monitor.js');
  const before=fs.readFileSync(file,'utf8'),after=patch(before);
  if(after!==before)fs.writeFileSync(file,after);
}
if(require.main===module)main();
module.exports={patch,main};
