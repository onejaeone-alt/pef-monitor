const test=require('node:test'),assert=require('node:assert/strict'),H=require('../scripts/integrate-site-header');
test('changed news renderer has its own cache version and stays linked only once',()=>{
 const source='<head></head><header class="topbar"><div class="brand"><h1>IB 취재 레이더</h1></div><nav class="nav"></nav></header><script src="/news-reader.js?v=20260908-r1&account=1"></script></body>';
 const page=H.page(source);assert.match(page,/news-reader\.js\?v=20260908-r1&account=1&header=20260908-topright1/);
 assert.equal(H.page(page),page);assert.equal((page.match(/src="\/news-reader\.js/g)||[]).length,1);
});
