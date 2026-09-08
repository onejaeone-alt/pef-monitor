/* News-only personal reader. Cloud mode is fail-closed; guest records are never uploaded automatically. */
(function(){
'use strict';
const C=window.NewsReaderCore,T=window.NewsTaxonomy,$=s=>document.querySelector(s);if(!C||!T)return;
const STORE='ib-news-reader-v2',LEGACY='ib-news-desk-v1',API='/api/news';
function el(tag,props={},...children){const n=document.createElement(tag);for(const[k,v]of Object.entries(props)){if(k==='text')n.textContent=v;else if(k==='class')n.className=v;else n.setAttribute(k,String(v));}children.flat().forEach(x=>{if(x!=null)n.append(x);});return n;}
const btn=(text,props={})=>el('button',{type:'button',text,...props});
const S={records:C.empty(),mode:'guest',user:null,authReady:false,view:'unread',category:'ALL',actor:'ALL',query:'',days:7,items:[],issues:[],rows:[],visible:[],selected:null,limit:30,loaded:false,pending:null,saving:false};
let controller,sequence=0,lastCheck=0,undo=null,toastTimer,epoch=0;
function notify(text){$('#toast').replaceChildren(document.createTextNode(text));$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{$('#toast').hidden=true;},6000);}
function readGuest(){let value=C.empty();try{const raw=localStorage.getItem(STORE);if(raw){const parsed=JSON.parse(raw);for(const kind of C.KINDS)for(const[key,v]of Object.entries(parsed[kind]||{})){try{value=C.apply(value,[{kind,key,value:v}]);}catch{}}}else value=C.legacy(JSON.parse(localStorage.getItem(LEGACY)||'{}'));}catch{notify('브라우저 기록을 읽지 못했습니다. 기존 기록은 지우지 않았습니다.');}return value;}

function fmt(value){return C.time(value)?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value)):'날짜 확인 필요';}
function original(item,text,className=''){const u=C.url(item.source_url);return u?el('a',{href:u,text,class:className,target:'_blank',rel:'noopener noreferrer','data-original':u}):el('span',{text:'원문 주소 확인 필요'});}
function classification(item){const c=T.classify(item),t=item.title||'';if(/운용인력.{0,15}(?:이동|퇴직)|해외거점|사무소\s*(?:신설|개소)/.test(t))return {...c,category_id:'people',category_label:'인사·조직'};return c;}
function options(view=S.view){return {view,category:S.category,actor:S.actor,query:S.query,classify:classification};}
function pool(view=S.view){return C.select(S.items,S.records,options(view));}
function selectedItem(){return S.rows.find(r=>r.id===S.selected);}
async function write(changes,{remember=true}={}){
 if(S.saving)return false;if(['blocked','checking'].includes(S.mode)){notify('계정 상태를 확인한 뒤 다시 시도해 주세요.');return false;}
 const operationEpoch=epoch;S.saving=true;
 const reverse=changes.map(c=>({kind:c.kind,key:c.key,value:S.records[c.kind]?.[c.key]||null}));
 try{
  for(let i=0;i<changes.length;i+=100){const chunk=changes.slice(i,i+100),next=C.apply(S.records,chunk);localStorage.setItem(STORE,JSON.stringify(next));if(epoch!==operationEpoch)return false;S.records=next;}
  if(remember){undo=reverse;$('#readerUndo').hidden=false;}render();return true;
 }catch(error){notify(error.message==='QuotaExceededError'?'브라우저 저장 공간이 부족합니다.':error.message||'기록을 저장하지 못했습니다.');return false;}
 finally{S.saving=false;}
}
function readChanges(items,read=true){return [...new Map(items.map(x=>[C.key(x),x])).values()].map(x=>({kind:'read',key:C.key(x),value:read?{revision:C.revision(x),at:new Date().toISOString()}:null}));}
function bookmarkChanges(items,on){return items.map(x=>({kind:'bookmark',key:C.key(x),value:on?{at:new Date().toISOString(),article:C.snapshot(x)}:null}));}
function hideChanges(items,on){return items.map(x=>({kind:'hidden',key:C.key(x),value:on?{at:new Date().toISOString(),article:C.snapshot(x)}:null}));}
function setView(view){S.view=view;S.selected=null;S.limit=30;render();}
function tab(text,view,count){return btn(text+(count!=null?' '+count:''),{'data-view':view,class:S.view===view?'is-active':'','aria-pressed':S.view===view});}
const top=el('div',{class:'reader-top'},el('div',{id:'readerTabs',class:'reader-tabs',role:'group','aria-label':'읽기 목록'}),btn('이 브라우저 저장',{id:'readerAccount',class:'nd-button'}));
$('.nd-feed').prepend(top);
const tools=el('div',{class:'reader-actions'},btn('표시된 기사 읽음',{id:'readerReadPage',class:'nd-text-button'}),btn('되돌리기',{id:'readerUndo',class:'nd-text-button',hidden:true}),btn('추적 추가',{id:'readerWatch',class:'nd-text-button'}));
$('.nd-list-heading').after(tools);
const status=el('div',{id:'readerStatus',class:'reader-status',role:'status','aria-live':'polite',text:'뉴스를 불러오는 중…'});$('.nd-toolbar').after(status);
const pendingButton=btn('새 보도 적용',{id:'readerPending',class:'reader-pending',hidden:true});status.after(pendingButton);
const period=el('div',{class:'nd-actor-filters',role:'group','aria-label':'조회 기간'},[[1,'24시간'],[3,'3일'],[7,'7일'],[14,'14일']].map(([n,t])=>btn(t,{class:'nd-filter','data-days':n})));
$('#period').closest('label').hidden=true;$('#period').closest('label').after(period);
const watchBox=el('div',{id:'readerWatches',class:'reader-watches'});$('#categories').after(watchBox);
const dialog=el('dialog',{id:'readerDialog',class:'reader-dialog','aria-labelledby':'readerDialogTitle'});document.body.append(dialog);
function openDialog(title,children){dialog.replaceChildren(el('header',{},el('h3',{id:'readerDialogTitle',text:title}),btn('×',{'data-close-dialog':'','aria-label':'닫기'})),...children);dialog.showModal();}
function accountDialog(){openDialog('현재 저장 범위',[el('p',{text:'지금은 이 기기의 이 브라우저에만 기록합니다. 같은 브라우저 프로필을 함께 쓰면 서로 볼 수 있습니다.'}),el('p',{text:'로그인·계정별 저장은 아직 적용되지 않았습니다. Supabase 인증과 개인 저장소를 연결한 뒤 별도로 켜야 합니다.'}),el('p',{class:'reader-fine',text:'기존 보관 기록을 지우거나 서버로 옮기지 않습니다. 뉴스 기록·취재 메모가 로그인으로 보호된다고 가정하면 안 됩니다.'})]);}
function watchDialog(item){const entities=item?.related_entities||[];const input=el('input',{id:'readerWatchQuery',type:'text',maxlength:120,placeholder:'예: 운용사 이름 + 3호 펀드','aria-label':'추적 검색어'});if(entities[0])input.value=entities[0].canonical_name;
 openDialog('후속 보도 추적',[el('p',{text:'여러 단어를 넣으면 모두 포함한 제목만 찾습니다. 특정 펀드는 운용사명과 펀드명을 함께 적어 주세요.'}),input,btn('이 검색어 추적',{id:'readerWatchSave',class:'nd-button'}),...entities.map(e=>btn(e.canonical_name+' 전체 소식 추적',{'data-watch-entity':e.entity_key,'data-watch-label':e.canonical_name,class:'nd-button'})),el('p',{class:'reader-fine',text:'현재 수집 범위에서 일치하는 보도를 찾습니다. 같은 사건인지, 새 사실인지는 본문 확인이 필요합니다.'})]);}
function render(){
 const classify=classification;
 const count=view=>C.select(S.items,S.records,{view,classify}).length;
 $('#readerTabs').replaceChildren(tab('새로 볼 뉴스','unread',count('unread')),tab('추적 중','tracked',count('tracked')),tab('전체 뉴스','all',count('all')));
 $('#readerAccount').textContent=S.mode==='account'?'계정 저장 · '+S.user.email:S.mode==='blocked'?'계정 연결 확인 필요':S.mode==='checking'?'저장 범위 확인 중':'이 브라우저 저장';
 $('#collections').replaceChildren(...[['saved','보관함'],['hidden','숨긴 기사'],['review','선별 검토']].map(([v,t])=>btn(t+' '+count(v),{'data-view':v,class:'nd-side-item'+(S.view===v?' is-active':'')})));
 $('#categories').replaceChildren(btn('사건 전체',{'data-category':'ALL',class:'nd-side-item'+(S.category==='ALL'?' is-active':'')}),...T.categories.map(c=>btn(c.label,{'data-category':c.id,class:'nd-side-item'+(S.category===c.id?' is-active':'')})));
 $('#actorFilters').replaceChildren(...[{id:'ALL',label:'기관 전체'},...T.actors].map(a=>btn(a.label,{'data-actor':a.id,class:'nd-filter'+(S.actor===a.id?' is-active':'')})));
 $('#readerWatches').replaceChildren(el('h4',{text:'내 추적 검색'}),...Object.entries(S.records.watch).map(([k,w])=>el('div',{},btn(w.label,{'data-watch-filter':k,class:'nd-text-button'}),btn('×',{'data-watch-remove':k,'aria-label':w.label+' 추적 해제',class:'nd-text-button'}))));
 const overrides=Object.fromEntries([...pool().map(x=>[C.key(x),classification(x).category_id]),...Object.entries(S.records.override).map(([k,v])=>[k,v.category])]);
 S.rows=T.buildRows(pool(),S.issues,{mode:S.listMode||'issues',days:['saved','hidden'].includes(S.view)?365000:S.days,overrides});
 S.visible=S.rows.slice(0,S.limit);if(!S.rows.some(x=>x.id===S.selected))S.selected=null;
 $('#listTitle').textContent=({unread:'새로 볼 뉴스',tracked:'추적 중인 보도',all:'전체 뉴스',saved:'보관함 · 기간 제한 없음',hidden:'숨긴 기사',review:'선별 검토'})[S.view];
 $('#resultCount').textContent=S.rows.length+'개 묶음 · '+pool().length+'건';
 $('#newsList').replaceChildren(...S.visible.map(rowNode));
 if(!S.rows.length)$('#newsList').append(el('div',{class:'nd-empty'},el('strong',{text:S.view==='unread'?'현재 조건의 읽지 않은 뉴스를 모두 봤습니다.':'조건에 맞는 보도가 없습니다.'}),el('p',{text:S.view==='tracked'?'추적할 이름·펀드·거래 검색어를 추가해 주세요.':'다른 분류나 전체 뉴스에서도 확인할 수 있습니다.'})));
 $('#readerReadPage').textContent='표시된 '+S.visible.flatMap(x=>x.items).length+'건 읽음';$('#readerReadPage').disabled=!S.visible.length;
 $('#more').hidden=S.rows.length<=S.limit;$('#more').textContent='더 보기 · '+Math.max(0,S.rows.length-S.limit)+'개';
 $('#reset').hidden=S.category==='ALL'&&S.actor==='ALL'&&!S.query;
 document.querySelectorAll('[data-days]').forEach(b=>{b.classList.toggle('is-active',Number(b.dataset.days)===S.days);b.setAttribute('aria-pressed',Number(b.dataset.days)===S.days);});
 document.querySelectorAll('[data-mode]').forEach(b=>{const active=(S.listMode||'issues')===(b.dataset.mode==='articles'?'articles':'issues');b.classList.toggle('is-active',active);b.setAttribute('aria-pressed',active);});
 $('.nd-local-note').textContent=S.mode==='account'?'뉴스 개인 기록은 로그인한 계정에 저장합니다. 기존 브라우저 기록·취재 메모는 자동으로 옮기지 않습니다.':'읽음·보관·추적은 현재 브라우저에만 저장합니다. 같은 브라우저 프로필을 공유하면 기록을 서로 볼 수 있습니다. 계정 보호는 아직 적용되지 않습니다.';
 const row=selectedItem();if(row)detail(row);else{$('#detailPanel').classList.remove('is-open');$('#detailPanel').replaceChildren(el('div',{class:'nd-detail-placeholder'},el('h3',{text:'뉴스를 선택하세요'}),el('p',{text:'원문·관련 보도·읽음·보관·추적을 여기서 관리합니다.'})));}
}
function rowNode(row){
 const x=row.lead,read=row.items.every(i=>!C.unread(i,S.records)),kept=row.items.some(i=>S.records.bookmark[C.key(i)]),a=x.relevance||C.assess(x),watched=row.items.some(i=>C.matchingWatches(i,S.records).length),def=T.definition(row.category_id);
 const badges=el('span',{class:'nd-row-top'},el('span',{class:'nd-category-pill','data-category':def.id,text:def.short}),el('span',{class:'reader-read-state',text:read?'읽음':watched?'추적 검색어 일치 · 안 읽음':'안 읽음'}));
 if(a.status!=='relevant')badges.append(el('span',{class:'reader-review',text:a.reason}));
 if(S.records.opened[C.key(x)]&&!read)badges.append(el('span',{class:'reader-fine',text:'원문 열어봄'}));
 return el('article',{class:'nd-row reader-row'+(read?' is-read':'')+(S.selected===row.id?' is-selected':'')},el('button',{type:'button',class:'nd-row-main','data-open':row.id},badges,el('span',{class:'nd-row-title',text:row.title}),el('span',{class:'nd-row-meta',text:(x.source_name||'출처 확인 필요')+' · '+fmt(x.published_at)+(row.items.length>1?' · 관련 보도 '+row.items.length+'건':'' )})),el('div',{class:'reader-row-actions'},btn(read?'↶':'✓',{'data-read':row.id,title:read?'읽지 않음으로 되돌리기':'이 묶음 읽음 표시','aria-label':read?'읽지 않음으로 되돌리기':'이 묶음 읽음 표시',class:'reader-icon'}),btn(kept?'★':'☆',{'data-save':row.id,title:kept?'보관 해제':'보관','aria-label':kept?'보관 해제':'보관',class:'reader-icon'})));
}
function section(title,...children){return el('section',{class:'nd-detail-section'},el('h4',{text:title}),children);}
function detail(row){
 const read=row.items.every(i=>!C.unread(i,S.records)),kept=row.items.some(i=>S.records.bookmark[C.key(i)]),hidden=row.items.some(i=>S.records.hidden[C.key(i)]),def=T.definition(row.category_id),watched=C.matchingWatches(row.lead,S.records);
 const classify=el('select',{id:'readerReclassify',class:'nd-reclassify','aria-label':'개인 분류 변경'},el('option',{value:'AUTO',text:'자동 분류로 보기'}),...T.categories.map(c=>el('option',{value:c.id,text:c.label})));classify.value=S.records.override[C.key(row.lead)]?.category||'AUTO';
 $('#detailPanel').replaceChildren(el('div',{class:'nd-detail-head'},el('span',{text:'보도 확인'}),btn('×',{'data-close':'',class:'nd-close','aria-label':'상세 닫기'})),el('div',{class:'nd-detail-body'},el('span',{class:'nd-category-pill',text:def.label}),el('h3',{text:row.title}),el('p',{class:'reader-fine',text:'[보도] '+fmt(row.latest)+' · 본문 비교 전'}),original(row.lead,'기사 원문 ↗','nd-original'),el('div',{class:'reader-detail-actions'},btn(read?'읽지 않음':'읽음 표시',{'data-read':row.id,class:'nd-button'}),btn(kept?'★ 보관 해제':'☆ 보관',{'data-save':row.id,class:'nd-button'}),btn('후속 보도 추적',{'data-follow':row.id,class:'nd-button'}),btn(hidden?'숨김 해제':'숨기기',{'data-hide':row.id,class:'nd-button'})),section('다시 읽을 이유',el('p',{text:watched.length?'추적 검색어와 일치합니다: '+watched.map(w=>w.label).join(' · ')+'. 내용 변화는 아직 비교하지 않았습니다.':(read?'이미 읽음 표시한 보도입니다.':'아직 읽음 표시하지 않은 보도입니다.')+' 본문 내용 변화는 비교 전입니다.'})),section('관련 보도 '+row.items.length+'건',el('ol',{class:'nd-timeline'},row.items.map(i=>el('li',{},el('small',{text:(i.source_name||'출처')+' · '+fmt(i.published_at)}),original(i,i.title))))),section('연결된 취재파일',el('div',{class:'nd-related'},row.related_entities.length?row.related_entities.map(e=>btn(e.canonical_name+' ↗',{'data-dossier-entity':e.entity_key,class:'nd-entity'})):el('p',{text:'상단 취재파일 검색에서 확인할 수 있습니다.'}))),section('내 화면에서 분류 변경',classify),el('p',{class:'nd-verification',text:'관련 보도 묶음은 제목을 바탕으로 합니다. 서로 다른 주장·금액을 하나의 사실로 합치지 않습니다. 읽음 표시는 사실 확인이나 기사화 판단이 아닙니다.'})));
}
function accept(data,days){const all=[...(data.items||[]),...(data.review_items||[])];S.items=[...new Map(all.map(x=>[C.key(x),x])).values()];S.issues=data.issues||[];S.days=days;S.loaded=true;S.pending=null;$('#readerPending').hidden=true;S.limit=Math.max(30,S.limit);render();$('#status').textContent='뉴스 '+S.items.length+'건';const review=S.items.filter(x=>(x.relevance||C.assess(x)).status!=='relevant').length;$('#sourceNote').textContent='[보도] · 선별 검토 '+review+'건 · 현재 수집 범위 기준'+(data.collection_status?.partial?' · 일부 검색 실패: 누락 가능':'')+(data.collection_status?.truncated?' · 수집 상한 도달: 전체 보도가 아닙니다.':'')+(data.source_policy?.member_source==='fallback'?' · 매체 기준은 저장된 목록 사용':'');}
async function load({fresh=false,days=S.days,hold=false}={}){
 const n=++sequence;controller?.abort();controller=new AbortController();const active=controller;const timeout=setTimeout(()=>active.abort(),35000);const previous=new Set(S.items.map(C.key));
 $('#refresh').disabled=true;$('#refresh').textContent='조회 중…';$('#newsList').setAttribute('aria-busy','true');status.textContent='수집원에 조회 중… 읽고 있는 목록은 유지합니다.';
 try{
  const params=new URLSearchParams({days,limit:400,feed:'reader'});if(fresh){params.set('refresh','1');params.set('_r',Date.now()+'-'+n);}
  const r=await fetch(API+'?'+params,{signal:active.signal,cache:fresh?'no-store':'default'}),data=await r.json();if(n!==sequence)return;if(!r.ok||!data.ok||!Array.isArray(data.items))throw Error('뉴스를 불러오지 못했습니다.');
  const added=[...data.items,...(data.review_items||[])].filter(x=>!previous.has(C.key(x))).length;lastCheck=Date.now();
  if(hold&&S.loaded&&added){S.pending={data,days};$('#readerPending').textContent='새 보도 '+added+'건 · 눌러서 목록에 적용';$('#readerPending').hidden=false;}
  else if(!hold||!S.loaded)accept(data,days);
  status.textContent='조회 '+fmt(new Date().toISOString())+' · '+(S.loaded&&previous.size?(added?'이전 목록보다 추가 '+added+'건':'추가된 기사 없음'):'목록 갱신')+' · 수집 '+fmt(data.fetched_at)+(data.collection_status?.partial?' · 일부 수집 실패':'');$('#updatedAt').textContent='확인 '+fmt(new Date().toISOString());
 }catch(e){if(n!==sequence)return;status.textContent='조회 실패 · '+(S.loaded?'이전 목록을 유지합니다.':'새로고침을 눌러 다시 시도해 주세요.');}
 finally{clearTimeout(timeout);if(n===sequence){$('#refresh').disabled=false;$('#refresh').textContent='↻ 새로고침';$('#newsList').setAttribute('aria-busy','false');}}
}
async function action(event){
 const a=event.target.closest('[data-original]');if(a){const item=S.items.find(i=>C.key(i)===a.dataset.original);if(item)write([{kind:'opened',key:C.key(item),value:{at:new Date().toISOString()}}],{remember:false});return;}
 const b=event.target.closest('button');if(!b)return;const row=S.rows.find(x=>x.id===(b.dataset.read||b.dataset.save||b.dataset.hide||b.dataset.follow||b.dataset.open));
 try{
 if(b.hasAttribute('data-close-dialog'))dialog.close();
 else if(b.id==='readerAccount')accountDialog();
 else if(b.id==='readerWatch')watchDialog();
 else if(b.id==='readerWatchSave'){const query=C.clean($('#readerWatchQuery').value);if(query.length<2){notify('두 글자 이상 입력해 주세요.');return;}if(await write([{kind:'watch',key:'query:'+query,value:{query,label:query}}])){dialog.close();setView('tracked');}}
 else if(b.dataset.watchEntity){if(await write([{kind:'watch',key:'entity:'+b.dataset.watchEntity,value:{entity_key:b.dataset.watchEntity,label:b.dataset.watchLabel}}])){dialog.close();setView('tracked');}}
 else if(b.dataset.watchRemove)await write([{kind:'watch',key:b.dataset.watchRemove,value:null}]);
 else if(b.dataset.watchFilter){const w=S.records.watch[b.dataset.watchFilter];S.query=w.query||w.label;$('#search').value=S.query;setView('tracked');}
 else if(b.id==='readerUndo'&&undo){const old=undo;undo=null;$('#readerUndo').hidden=true;if(await write(old,{remember:false}))notify('직전 변경을 되돌렸습니다.');}
 else if(b.id==='readerReadPage'){const items=S.visible.flatMap(x=>x.items);if(items.length&&await write(readChanges(items)))notify('현재 표시된 '+items.length+'건에 읽음 표시를 남겼습니다.');}
 else if(b.id==='readerPending'&&S.pending){const p=S.pending;accept(p.data,p.days);}
 else if(b.dataset.days)load({fresh:true,days:Number(b.dataset.days)});
 else if(b.dataset.view)setView(b.dataset.view);
 else if(b.dataset.category){S.category=b.dataset.category;S.limit=30;S.selected=null;render();}
 else if(b.dataset.actor){S.actor=b.dataset.actor;S.limit=30;S.selected=null;render();}
 else if(b.dataset.mode){S.listMode=b.dataset.mode;S.limit=30;S.selected=null;render();}
 else if(b.dataset.open&&row){S.selected=row.id;render();$('#detailPanel').classList.add('is-open');$('#detailPanel').scrollTop=0;$('#detailPanel').focus({preventScroll:true});}
 else if(b.dataset.read&&row){const items=row.items;if(await write(readChanges(items,items.some(i=>C.unread(i,S.records)))))notify('읽기 상태를 바꿨습니다.');}
 else if(b.dataset.save&&row){if(await write(bookmarkChanges(row.items,!row.items.some(i=>S.records.bookmark[C.key(i)]))))notify(S.mode==='account'?'개인 보관함을 갱신했습니다.':'이 브라우저 보관함을 갱신했습니다.');}
 else if(b.dataset.hide&&row)await write(hideChanges(row.items,!row.items.some(i=>S.records.hidden[C.key(i)])));
 else if(b.dataset.follow&&row)watchDialog(row.lead);
 else if(b.hasAttribute('data-close')){S.selected=null;render();}
 }catch(e){const m=$('#readerAuthMessage');if(m)m.textContent=e.message;else notify(e.message);}
}
document.addEventListener('click',action);
$('#refresh').onclick=()=>load({fresh:true});$('#search').oninput=e=>{S.query=e.target.value;S.limit=30;S.selected=null;render();};$('#more').onclick=()=>{S.limit+=30;render();};$('#reset').onclick=()=>{S.query='';S.actor='ALL';S.category='ALL';$('#search').value='';render();};
$('#detailPanel').addEventListener('change',e=>{if(e.target.id!=='readerReclassify')return;const row=selectedItem();if(row)write(row.items.map(i=>({kind:'override',key:C.key(i),value:e.target.value==='AUTO'?null:{category:e.target.value}})));});
document.addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||'')||dialog.open||e.metaKey||e.ctrlKey||e.altKey)return;if(e.key==='/'){e.preventDefault();$('#search').focus();}else if(['j','k'].includes(e.key)){e.preventDefault();let i=S.visible.findIndex(x=>x.id===S.selected);i=Math.max(0,Math.min(S.visible.length-1,i+(e.key==='j'?1:-1)));if(S.visible[i]){S.selected=S.visible[i].id;render();$('#detailPanel').classList.add('is-open');}}else if(e.key==='r'&&selectedItem()){const x=selectedItem();write(readChanges(x.items,x.items.some(i=>C.unread(i,S.records))));}else if(e.key==='s'&&selectedItem()){const x=selectedItem();write(bookmarkChanges(x.items,!x.items.some(i=>S.records.bookmark[C.key(i)])));}else if(e.key==='Escape'){S.selected=null;render();}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&S.loaded&&Date.now()-lastCheck>120000)load({hold:true});});
window.addEventListener('storage',e=>{if(e.key===STORE&&S.mode==='guest'&&!S.saving){S.records=readGuest();render();}});
const offset=()=>$('.news-desk').style.setProperty('--nd-header-offset',Math.ceil($('.topbar').getBoundingClientRect().height+15)+'px');if(window.ResizeObserver)new ResizeObserver(offset).observe($('.topbar'));offset();
S.records=readGuest();render();load();
})();
