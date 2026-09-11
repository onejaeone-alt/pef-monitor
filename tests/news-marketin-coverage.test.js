'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const M=require('../lib/news-monitor');
const item=title=>({title,snippet:'',source_name:'한국경제신문'});

test('한국판 국부펀드·인내자본은 LP·정책자금 범위다',()=>{
 const title='한국판 국부펀드, 초장기 인내자본으로 키울 것';
 assert.equal(M.theme(title)[0],'lp');
 assert.equal(M.shouldKeep(item(title)),true);
});

test('KIC 전략투자계정과 앵커투자자도 정책 LP 흐름으로 잡는다',()=>{
 for(const title of ['KIC 전략투자계정 신설','한국투자공사 앵커투자자로 해외자본 유치','전략형 국부펀드 출범']){
  assert.equal(M.theme(title)[0],'lp');
 }
});

test('정책 용어만 넓히고 일반 인내·자본 문장은 잡지 않는다',()=>{
 assert.equal(M.theme('기업은 장기 인내가 필요하다')[0],'other');
 assert.equal(M.theme('기업 자본 효율성 개선')[0],'other');
});
