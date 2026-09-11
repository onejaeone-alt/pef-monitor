const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const {patch,patchApi}=require('../scripts/extend-news-marketin-coverage');

function loadPatchedMonitor(){
  const filename=path.resolve(__dirname,'../lib/news-monitor.js');
  const source=patch(fs.readFileSync(filename,'utf8'));
  const mod=new Module(filename,module);
  mod.filename=filename;
  mod.paths=Module._nodeModulePaths(path.dirname(filename));
  mod._compile(source,filename);
  return mod.exports;
}

const members=['한국경제','한국경제신문','연합인포맥스','매일경제','매일경제 마켓'];
function item(title,source_name='한국경제신문',snippet=''){return {title,source_name,snippet};}

test('KIC strategic-fund mandate stories stay in the reporting feed',()=>{
  const {shouldKeep,theme}=loadPatchedMonitor();
  const titles=[
    '박일영 사장 "한국판 국부펀드, 초장기 인내자본으로 키울 것"',
    '박일영 KIC 사장 "내년 전략투자계정 신설...한국판 전략형 국부펀드로 전환"',
    '박일영 KIC 사장 "전략투자, 글로벌 자본 韓 향하는 마중물 될 것"'
  ];
  for(const title of titles){
    assert.equal(shouldKeep(item(title,'연합인포맥스'),null,members),true,title);
    assert.equal(theme(title)[0],'lp');
  }
});

test('standalone treasury-share and stock-reaction stories are excluded',()=>{
  const {shouldKeep}=loadPatchedMonitor();
  assert.equal(shouldKeep(item("샘표, 370억 규모 자사주 소각 소식에 연이틀 '급등'"),null,members),false);
  assert.equal(shouldKeep(item('샘표, 자사주 30% 소각 결정에 상한가'),null,members),false);
  assert.equal(shouldKeep(item('A사, 1000억원 규모 자사주 소각 결정'),null,members),false);
  assert.equal(shouldKeep(item('B사, 배당 확대·주주환원 강화 발표'),null,members),false);
});

test('governance stays only when control or activism creates an IB reporting event',()=>{
  const {shouldKeep}=loadPatchedMonitor();
  assert.equal(shouldKeep(item('행동주의 펀드, A사에 주주제안...이사회 교체 요구'),null,members),true);
  assert.equal(shouldKeep(item('최대주주 변경 수반 B사 경영권 매각 본입찰'),null,members),true);
});

test('broker opinions and target-price headlines do not enter the feed',()=>{
  const {shouldKeep}=loadPatchedMonitor();
  assert.equal(shouldKeep(item('C사 목표주가 20% 상향...증권가 실적 전망 긍정'),null,members),false);
});

test('core MarketIN transactions, LP process and fund formation remain',()=>{
  const {shouldKeep}=loadPatchedMonitor();
  assert.equal(shouldKeep(item('D사 매각 본입찰에 국내 PEF 3곳 참여'),null,members),true);
  assert.equal(shouldKeep(item('한국성장금융 출자사업 최종 GP 선정'),null,members),true);
  assert.equal(shouldKeep(item('E벤처캐피탈, 2000억원 블라인드펀드 결성'),null,members),true);
  assert.equal(shouldKeep(item('F사 회사채 수요예측서 미매각 발생'),null,members),true);
});

test('reader classifier cannot reopen a story rejected by reporting scope',()=>{
  const api=fs.readFileSync(path.resolve(__dirname,'../api/news.js'),'utf8');
  const transformed=patchApi(api);
  assert.match(transformed,/const inScope = shouldKeep/);
  assert.match(transformed,/if \(!inScope && !directProbe\) continue/);
  assert.doesNotMatch(transformed,/relevance\?\.status === 'relevant'.*!directProbe/);
});
