'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const M=require('../lib/news-monitor');
const item=(title,source_name='한국경제신문',snippet='')=>({title,snippet,source_name});

test('박일영 한국판 국부펀드·인내자본 기사는 일반 레이더에 남긴다',()=>{
 const title='박일영 사장 "한국판 국부펀드, 초장기 인내자본으로 키울 것"';
 assert.equal(M.theme(title)[0],'lp');
 assert.equal(M.shouldKeep(item(title)),true);
});

test('KIC 전략투자계정과 앵커 역할의 구체 변화는 정책 LP 흐름으로 잡는다',()=>{
 for(const title of [
  '박일영 KIC 사장 “내년 전략투자계정 신설…한국판 전략형 국부펀드로 전환”',
  '한국투자공사, 전략산업 투자계정 신설',
  'KIC, 국내 펀드 앵커투자자로 참여 결정'
 ]){
  assert.equal(M.theme(title)[0],'lp');
  assert.equal(M.shouldKeep(item(title)),true);
 }
});

test('KIC 검색은 별도 쿼리로 넓히되 일반 국부펀드 전체를 검색하지 않는다',()=>{
 const joined=M.queries(7).join('\n');
 assert.match(joined,/한국투자공사 OR KIC OR 전략투자계정/);
 assert.match(joined,/"한국판 국부펀드"/);
 assert.doesNotMatch(joined,/OR 국부펀드 OR/);
});

test('샘표처럼 주가 반응이 제목인 자사주 기사는 제외한다',()=>{
 assert.equal(M.shouldKeep(item("샘표, 370억 규모 자사주 소각 소식에 연이틀 '급등'")),false);
 assert.equal(M.shouldKeep(item('[특징주] 샘표, 자사주 소각 발표에 강세')),false);
 assert.equal(M.shouldKeep(item('샘표, 자사주 30% 소각 결정에 상한가')),false);
});

test('주가 반응이 아니라 실제 자사주 의사결정 자체가 제목이면 남긴다',()=>{
 assert.equal(M.shouldKeep(item('샘표, 370억원 규모 자사주 소각 결정')),true);
});

test('국부펀드라는 단어만으로 해외 거래를 정책 LP 뉴스로 끌어오지 않는다',()=>{
 assert.equal(M.shouldKeep(item('사우디 국부펀드, EA·새비 게임즈 합병 검토','지디넷코리아')),false);
 assert.equal(M.shouldKeep(item('아부다비 국부펀드, 中루이싱커피에 1조3천억원 투자','연합뉴스')),false);
});

test('해외 국부펀드라도 한국 기업 거래가 직접 걸리면 M&A 신호로 남긴다',()=>{
 assert.equal(M.shouldKeep(item('사우디 국부펀드, 한국 A사 경영권 인수 추진','연합뉴스')),true);
});

test('IB 키워드만 있고 구체 변화가 없는 전망·해설은 제외한다',()=>{
 assert.equal(M.shouldKeep(item('IPO 시장 훈풍 기대…하반기 전망은','서울경제신문')),false);
 assert.equal(M.shouldKeep(item('PEF 업계, 금리 인하 기대감 커져','이데일리')),false);
 assert.equal(M.shouldKeep(item('회사채 시장 전망과 투자 전략','한국경제신문')),false);
});

test('실제 돈·지배력·위험·규칙·LP절차·인사 변화는 남긴다',()=>{
 for(const [title,source] of [
  ['MBK, 홈플러스 매각 본입찰 돌입','서울경제신문'],
  ['국민연금, 국내 사모펀드 출자 GP 선정','이데일리'],
  ['A사, 500억원 전환사채 발행 결정','한국경제신문'],
  ['금융위, PEF 제도 개편 시행','연합뉴스'],
  ['IMM프라이빗에쿼티, 김모 파트너 영입','서울경제신문']
 ]) assert.equal(M.shouldKeep(item(title,source)),true,title);
});

test('정책 용어만 넓히고 일반 인내·자본 문장은 잡지 않는다',()=>{
 assert.equal(M.theme('기업은 장기 인내가 필요하다')[0],'other');
 assert.equal(M.theme('기업 자본 효율성 개선')[0],'other');
});
