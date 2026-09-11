const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {patch,patchApi}=require('../scripts/extend-news-marketin-coverage');

function loadPatchedMonitor(){
  const source=fs.readFileSync(path.join(__dirname,'../lib/news-monitor.js'),'utf8');
  const patched=patch(source);
  const Module=require('node:module');
  const m=new Module(path.join(__dirname,'../lib/__patched-news-monitor.js'),module);
  m.filename=path.join(__dirname,'../lib/__patched-news-monitor.js');
  m.paths=module.paths;
  m._compile(patched,m.filename);
  return m.exports;
}

const JAK=['한국경제','한국경제신문','매일경제','매일경제 마켓','연합뉴스','연합인포맥스'];
const item=(title,source='한국경제',snippet='')=>({title,source_name:source,snippet});

test('KIC 한국판 국부펀드 전략은 LP 정책자금 범위에 남긴다',()=>{
  const M=loadPatchedMonitor();
  for(const row of [
    item('박일영 사장 "한국판 국부펀드, 초장기 인내자본으로 키울 것"'),
    item('박일영 KIC 사장 "내년 전략투자계정 신설...한국판 전략형 국부펀드로 전환"','매일경제 마켓'),
    item('박일영 KIC 사장 "전략투자, 글로벌 자본 韓 향하는 마중물 될 것"','연합인포맥스')
  ]){
    assert.equal(M.shouldKeep(row,null,JAK),true,row.title);
    assert.deepEqual(M.theme(row.title),['lp','LP·정책자금']);
  }
});

test('단순 자사주 소각 주가 급등 기사는 제외한다',()=>{
  const M=loadPatchedMonitor();
  assert.equal(M.shouldKeep(item('샘표, 자사주 소각에 18% 급등'),null,JAK),false);
  assert.equal(M.shouldKeep(item('[특징주] 샘표, 자사주 소각 결정에 강세'),null,JAK),false);
});

test('단독 자사주 매입·소각·배당은 마켓인 취재 맥락이 없으면 제외한다',()=>{
  const M=loadPatchedMonitor();
  assert.equal(M.shouldKeep(item('하나투어 대표, 취임 직후 자사주 매입'),null,JAK),false);
  assert.equal(M.shouldKeep(item('A사, 300억원 규모 자사주 소각 결정'),null,JAK),false);
  assert.equal(M.shouldKeep(item('B사, 배당 확대·주주환원 강화 발표'),null,JAK),false);
});

test('자사주가 경영권·행동주의 또는 자금조달 사건과 결합하면 남긴다',()=>{
  const M=loadPatchedMonitor();
  assert.equal(M.shouldKeep(item('행동주의 압박에 A사 자사주 소각·이사회 개편 결정'),null,JAK),true);
  assert.equal(M.shouldKeep(item('BKV, 4억 달러 전환사채 발행·자사주 매입 병행','매일경제 마켓'),null,JAK),true);
});

test('지자체 용지 매각은 기업 M&A로 보지 않는다',()=>{
  const M=loadPatchedMonitor();
  assert.equal(M.shouldKeep(item('인천경제청, 송도 상업·근린생활시설용지 10필지 매각'),null,JAK),false);
});

test('한국 연결 없는 해외 일반 거래는 국내 레이더에서 제외하고 감시대상은 남긴다',()=>{
  const M=loadPatchedMonitor();
  assert.equal(M.shouldKeep(item('아부다비 국부펀드, 중국 커피업체에 1조원 투자','연합뉴스'),null,JAK),false);
  assert.equal(M.shouldKeep(item('아나로그디바이스, 美 알리프 세미컨덕터 13.5억달러에 인수','매일경제 마켓'),null,JAK),false);
  assert.equal(M.shouldKeep(item('MBK, 日 셰어링테크놀로지 공개매수 개시…3400억원 규모','연합뉴스'),{id:'A-013',name:'MBK파트너스'},JAK),true);
});

test('목표주가와 증권사 의견은 거래 키워드가 있어도 제외한다',()=>{
  const M=loadPatchedMonitor();
  assert.equal(M.shouldKeep(item('C사 인수 기대감에 목표주가 20% 상향…증권가 긍정'),null,JAK),false);
});

test('API 검색은 hard scope에서 제외한 기사를 다시 살리지 않는다',()=>{
  const api=fs.readFileSync(path.join(__dirname,'../api/news.js'),'utf8');
  const transformed=patchApi(api);
  assert.match(transformed,/const inScope = shouldKeep\(item, target, jak\.names\);/);
  assert.match(transformed,/if \(!inScope\) continue;/);
  assert.doesNotMatch(transformed,/if \(!inScope && !directProbe\) continue;/);
  assert.doesNotMatch(transformed,/relevance\?\.status === 'relevant'.*!directProbe/);
});
