const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {patch}=require('../scripts/extend-news-marketin-coverage');

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

const JAK=['한국경제','매일경제','연합뉴스'];
const item=(title,source='한국경제',snippet='')=>({title,source_name:source,snippet});

test('KIC 한국판 국부펀드 전략은 LP 정책자금 범위에 남긴다',()=>{
  const M=loadPatchedMonitor();
  const row=item('박일영 사장 "한국판 국부펀드, 초장기 인내자본으로 키울 것"');
  assert.equal(M.shouldKeep(row,null,JAK),true);
  assert.deepEqual(M.theme(row.title),['lp','LP·정책자금']);
});

test('단순 자사주 소각 주가 급등 기사는 제외한다',()=>{
  const M=loadPatchedMonitor();
  assert.equal(M.shouldKeep(item('샘표, 자사주 소각에 18% 급등'),null,JAK),false);
  assert.equal(M.shouldKeep(item('[특징주] 샘표, 자사주 소각 결정에 강세'),null,JAK),false);
});

test('단독 자사주 매입·소각 홍보성 기사는 제외한다',()=>{
  const M=loadPatchedMonitor();
  assert.equal(M.shouldKeep(item('하나투어 대표, 취임 직후 자사주 매입'),null,JAK),false);
  assert.equal(M.shouldKeep(item('A사, 300억원 규모 자사주 소각 결정'),null,JAK),false);
});

test('자사주가 경영권·행동주의 또는 자금조달 사건과 결합하면 남긴다',()=>{
  const M=loadPatchedMonitor();
  assert.equal(M.shouldKeep(item('행동주의 압박에 A사 자사주 소각·이사회 개편 결정'),null,JAK),true);
  assert.equal(M.shouldKeep(item('BKV, 4억 달러 전환사채 발행·자사주 매입 병행'),null,JAK),true);
});

test('한국 연결 없는 해외 국부펀드 일반 기사는 국내 레이더에서 제외한다',()=>{
  const M=loadPatchedMonitor();
  assert.equal(M.shouldKeep(item('아부다비 국부펀드, 중국 커피업체에 1조원 투자','연합뉴스'),null,JAK),false);
});

test('API는 reader relevance가 hard scope를 다시 열지 않도록 구성한다',()=>{
  const api=fs.readFileSync(path.join(__dirname,'../api/news.js'),'utf8');
  assert.doesNotMatch(api,/!shouldKeep\(item, target, jak\.names\) && !\(relevance\?\.status === 'relevant'/);
  assert.match(api,/const inScope = shouldKeep\(item, target, jak\.names\);/);
  assert.match(api,/if \(!inScope && !directProbe\) continue;/);
});
