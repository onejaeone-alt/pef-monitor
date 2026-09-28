'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const C=require('../news-detail-context');
const D=require('../lib/drive-dossiers');

test('news detail keeps direct dossier entities first and fills with matched dossiers',()=>{
  const row={related_entities:[{entity_key:'company:home',canonical_name:'홈플러스'}],items:[{related_entities:[{entity_key:'company:home'}]}]};
  const keys=C.mergeEntityKeys(row,[{entity_key:'pef:mbk'},{entity_key:'advisor:sam'}],3);
  assert.deepEqual(keys,['company:home','pef:mbk','advisor:sam']);
});

test('relation counterparts can fill remaining dossier slots without duplicates',()=>{
  const dossiers=[
    {relations:[{counterpart_key:'pef:mbk'},{counterpart_key:'company:home'}]},
    {relations:[{counterpart_key:'lp:kic'}]},
  ];
  assert.deepEqual(C.relationKeys(dossiers,['company:home'],2),['pef:mbk','lp:kic']);
});

test('dossier latest news adds other related coverage but excludes the already displayed event articles',()=>{
  const current=[{source_url:'https://news/current',title:'홈플러스 67개점 매각'}];
  const dossiers=[
    {entity:{canonical_name:'홈플러스'},related_news:[
      {source_url:'https://news/current',title:'홈플러스 67개점 매각',published_at:'2026-09-28T01:00:00Z'},
      {source_url:'https://news/older',title:'홈플러스 채권 회수 쟁점',source_name:'A',published_at:'2026-09-27T01:00:00Z'},
      {source_url:'https://news/shared',title:'홈플러스 인수금융',source_name:'B',published_at:'2026-09-28T02:00:00Z'},
    ]},
    {entity:{canonical_name:'MBK파트너스'},related_news:[
      {source_url:'https://news/shared',title:'홈플러스 인수금융',source_name:'B',published_at:'2026-09-28T02:00:00Z'},
      {source_url:'https://news/mbk',title:'MBK 새 펀드 결성',source_name:'C',published_at:'2026-09-26T01:00:00Z'},
    ]},
  ];
  const rows=C.mergeRelatedNews(dossiers,current,8);
  assert.deepEqual(rows.map(x=>x.source_url),['https://news/shared','https://news/older','https://news/mbk']);
  assert.deepEqual(rows[0].dossier_names,['홈플러스','MBK파트너스']);
  assert.ok(!rows.some(x=>x.source_url==='https://news/current'));
});

test('preview text prefers concrete dossier status and then deal context',()=>{
  assert.equal(C.previewText({current_status:[{text:'결성액 2000억원 확인'}],deals:[{summary:'거래 진행'}]}),'결성액 2000억원 확인');
  assert.equal(C.previewText({current_status:[],deals:[{summary:'홈플러스 재매각 진행'}]}),'홈플러스 재매각 진행');
});

test('Drive dossier matcher can return several files named in one news context',()=>{
  const candidates=D.DRIVE_DOSSIERS.filter(x=>String(x.canonical_name||'').length>=3).slice(0,2);
  assert.equal(candidates.length,2);
  const names=candidates.map(x=>x.canonical_name);
  const matched=D.matchDossiersInText(names.join(' 관련 거래 '),3).map(x=>x.canonical_name);
  for(const name of names)assert.ok(matched.includes(name),name+' should match');
});

test('news page loads dossier context before the desk and no longer sends users back to top search',()=>{
  const html=fs.readFileSync('index.html','utf8'),desk=fs.readFileSync('news-desk.js','utf8'),api=fs.readFileSync('api/entity.js','utf8');
  assert.ok(html.indexOf('/news-detail-context.js')>html.indexOf('/news-taxonomy.js'));
  // The production build replaces news-desk.js with news-reader.js.
  const entry=Math.max(html.indexOf('/news-desk.js'),html.indexOf('/news-reader.js'));
  assert.ok(entry>=0,'the news entrypoint must be present');
  assert.ok(html.indexOf('/news-detail-context.js')<entry);
  assert.match(desk,/연결된 취재파일 · 최대 3개/);
  assert.match(desk,/취재파일 관련 최신뉴스/);
  assert.doesNotMatch(desk,/상단 취재파일 검색에서/);
  assert.match(api,/action === 'match'/);
  assert.match(api,/matchDossiersInText/);
});
