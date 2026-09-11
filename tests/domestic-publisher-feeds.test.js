'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {parseRss,FEEDS}=require('../lib/domestic-publisher-feeds');
const M=require('../lib/news-monitor');

test('한국경제 공식 RSS 항목을 원문 주소와 발행시각으로 읽는다',()=>{
 const xml='<rss><channel><item><title><![CDATA[유암코·KHI, 케이조선 매각 재추진]]></title><link>https://www.hankyung.com/article/2026091074211</link><pubDate>Thu, 10 Sep 2026 08:58:00 GMT</pubDate><description><![CDATA[중견 조선사 매각 절차를 재개한다.]]></description></item></channel></rss>';
 const [x]=parseRss(xml,'한국경제신문','hankyung-all');
 assert.equal(x.source_url,'https://www.hankyung.com/article/2026091074211');
 assert.equal(x.source_name,'한국경제신문');assert.equal(x.provider,'publisher_rss');assert.ok(x.published_at);
});
test('공식 RSS 주소는 전체·증권·경제·부동산을 함께 본다',()=>{
 assert.deepEqual(FEEDS.map(x=>x.url),['https://www.hankyung.com/feed/all-news','https://www.hankyung.com/feed/finance','https://www.hankyung.com/feed/economy','https://www.hankyung.com/feed/realestate']);
});
test('마켓인 공통 레이더의 IPO·PF·대체투자·주주행동·정책 기사를 관련 기사로 본다',()=>{
 const rows=[
  '코스닥 상장예심 청구…IPO 공모 절차 돌입',
  '부동산 PF 사업장 재평가…신용위험 커지나',
  '기관투자가 해외 부동산 대체투자 리츠 회수 난항',
  '소액주주 행동주의에 인적분할 철회',
  '금융위 자본시장 규제 개편…초대형 IB 모험자본 의무 확대',
 ];
 for(const title of rows){const [id]=M.theme(title);assert.notEqual(id,'other',title);}
});
