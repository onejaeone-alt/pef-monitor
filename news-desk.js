/* Event-first news desk. DOM rendering only; source data and canonical records are read-only. */
(function () {
  'use strict';
  const T=window.NewsTaxonomy, $=s=>document.querySelector(s);
  if(!T)return;
  function node(tag,props={},...children){
    const n=document.createElement(tag);
    for(const [key,value] of Object.entries(props)){
      if(key==='text')n.textContent=value;
      else if(key==='class')n.className=value;
      else n.setAttribute(key,String(value));
    }
    children.flat().forEach(child=>{if(child!=null)n.append(child);});
    return n;
  }
  function button(text,props={}){return node('button',{type:'button',text,...props});}
  function safeURL(value){try{const u=new URL(value);return /^https?:$/.test(u.protocol)?u.href:'';}catch{return '';}}
  function link(item,text,className=''){
    const url=safeURL(item.source_url);
    return url?node('a',{href:url,text,class:className,target:'_blank',rel:'noopener noreferrer'}):node('span',{text:text+' · 원문 주소 확인 필요'});
  }
  const STORE='ib-news-desk-v1',prefs={saved:Object.create(null),overrides:Object.create(null)};
  let storageOK=true,controller,sequence=0,toastTimer;
  try{
    const value=JSON.parse(localStorage.getItem(STORE)||'{}');
    Object.entries(value.saved||{}).slice(-3000).forEach(([k,v])=>{if(typeof v==='number')prefs.saved[k]=v;});
    Object.entries(value.overrides||{}).slice(-3000).forEach(([k,v])=>{if(T.categories.some(c=>c.id===v))prefs.overrides[k]=v;});
  }catch{storageOK=false;}
  const state={items:[],issues:[],rows:[],query:'',category:'ALL',actor:'ALL',collection:'all',mode:'issues',days:7,loadedDays:7,limit:50,selectedKeys:[],selected:null};
  function toast(text){$('#toast').textContent=text;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{$('#toast').hidden=true;},4000);}
  function persist(){try{localStorage.setItem(STORE,JSON.stringify(prefs));return true;}catch{toast('브라우저 저장을 사용할 수 없어 이번 화면에서만 유지합니다.');return false;}}
  const saved=row=>row.keys.some(k=>!!prefs.saved[k]);
  const kstDay=value=>T.time(value)?new Date(T.time(value)+32400000).toISOString().slice(0,10):'';
  function dateText(value,full=false){
    if(!T.time(value))return '날짜 확인 필요';
    return new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',...(full?{year:'numeric'}:{}),month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value));
  }
  function heading(value){
    const day=kstDay(value);if(!day)return '날짜 확인 필요';
    const today=kstDay(new Date().toISOString()),yesterday=kstDay(new Date(Date.now()-86400000).toISOString());
    return (day===today?'오늘 · ':day===yesterday?'어제 · ':'')+new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',weekday:'short'}).format(new Date(value));
  }
  function matches(row,ignoreCollection=false){
    if(state.actor!=='ALL'&&!row.actor_ids.includes(state.actor))return false;
    if(!ignoreCollection&&state.collection==='saved'&&!saved(row))return false;
    const text=[...row.items.map(x=>x.title),...row.sources,...row.related_entities.map(x=>x.canonical_name),T.definition(row.category_id).label].join(' ').toLowerCase();
    return state.query.trim().toLowerCase().split(/\s+/).every(q=>text.includes(q));
  }
  function side(id,label,count,attribute,active,icon){
    return node('button',{type:'button',class:'nd-side-item'+(active?' is-active':''),[attribute]:id,'aria-pressed':active},node('span',{class:'nd-cat-symbol','aria-hidden':true,text:icon}),node('span',{text:label}),node('span',{class:'nd-count',text:count}));
  }
  function sidebar(){
    const any=state.rows.filter(row=>matches(row,true)),scoped=state.rows.filter(row=>matches(row));
    $('#collections').replaceChildren(side('all','모든 뉴스',any.length,'data-collection',state.collection==='all'&&state.category==='ALL','▤'),side('saved','보관한 뉴스',any.filter(saved).length,'data-collection',state.collection==='saved','☆'));
    $('#categories').replaceChildren(...T.categories.map(c=>side(c.id,c.label,scoped.filter(x=>x.category_id===c.id).length,'data-category',state.category===c.id,c.icon)));
    $('#actorFilters').replaceChildren(...[{id:'ALL',label:'기관 전체'},...T.actors].map(a=>button(a.label,{class:'nd-filter'+(state.actor===a.id?' is-active':''),'data-actor':a.id,'aria-pressed':state.actor===a.id})));
    $('#reset').hidden=state.category==='ALL'&&state.actor==='ALL'&&!state.query&&state.collection==='all';
  }
  function rowNode(row){
    const active=state.selected===row.id,def=T.definition(row.category_id),kept=saved(row);
    const top=node('span',{class:'nd-row-top'},node('span',{class:'nd-category-pill','data-category':def.id,text:def.short}),row.actor_ids.slice(0,3).map(x=>node('span',{class:'nd-actor-tag',text:x})));
    if(row.manual)top.append(node('span',{class:'nd-actor-tag',text:'직접 분류'}));
    if(T.time(row.latest)&&Date.now()-T.time(row.latest)<86400000)top.append(node('span',{class:'nd-new',text:'24h'}));
    const meta=node('span',{class:'nd-row-meta'},node('span',{class:'nd-source',text:row.lead.source_name||'출처 확인 필요'}),node('span',{text:'·'}),node('span',{text:dateText(row.latest)}));
    if(row.items.length>1)meta.append(node('span',{text:'· 관련 보도 '+row.items.length+'건'}));
    return node('article',{class:'nd-row'+(active?' is-selected':''),'data-row':row.id},node('button',{type:'button',class:'nd-row-main','data-open':row.id,'aria-controls':'detailPanel','aria-expanded':active},top,node('span',{class:'nd-row-title',text:row.title}),meta),button(kept?'★':'☆',{class:'nd-save'+(kept?' is-saved':''),'data-save':row.id,'aria-label':(kept?'보관 해제: ':'뉴스 보관: ')+row.title,'aria-pressed':kept,title:kept?'보관 해제':'이 브라우저에 보관'}));
  }
  function section(title,...children){return node('section',{class:'nd-detail-section'},node('h4',{text:title}),children);}
  function clearDetail(){
    $('#detailPanel').classList.remove('is-open');
    $('#detailPanel').replaceChildren(node('div',{class:'nd-detail-placeholder'},node('span',{'aria-hidden':true,text:'↗'}),node('h3',{text:'뉴스를 선택하세요'}),node('p',{text:'관련 보도와 연결된 취재파일을 여기서 확인할 수 있습니다.'}),node('div',{text:'원문은 새 탭으로 열립니다.'})));
  }
  function detail(row){
    const def=T.definition(row.category_id);
    const select=node('select',{id:'reclassify',class:'nd-reclassify','aria-label':'선택한 뉴스의 사건 분류'},node('option',{value:'AUTO',text:'자동 분류 · '+T.definition(row.auto.category_id).label}),T.categories.map(c=>node('option',{value:c.id,text:c.label})));
    select.value=row.manual?row.category_id:'AUTO';
    const files=row.related_entities.length?node('div',{class:'nd-related'},row.related_entities.map(e=>button((e.canonical_name||e.entity_key)+' ↗',{class:'nd-entity','data-dossier-entity':e.entity_key}))):node('p',{text:'연결된 취재파일이 없습니다. 상단 취재파일 검색에서 찾아보세요.'});
    const body=node('div',{class:'nd-detail-body'},node('span',{class:'nd-category-pill','data-category':def.id,text:def.label}),node('h3',{text:row.title}),node('div',{class:'nd-detail-meta',text:'[보도] '+(row.lead.source_name||'출처 확인 필요')+' · '+dateText(row.latest,true)}),node('div',{class:'nd-detail-actions'},link(row.lead,'기사 원문 ↗','nd-original'),button(saved(row)?'★ 보관 중':'☆ 보관',{class:'nd-button','data-save':row.id,'aria-pressed':saved(row)})),section('관련 보도 '+row.items.length+'건 · '+row.sources.length+'개 매체',node('ol',{class:'nd-timeline'},row.items.map(item=>node('li',{},node('small',{text:(item.source_name||'출처 확인 필요')+' · '+dateText(item.published_at)}),link(item,item.title||'제목 확인 필요'))))),section('연결된 취재파일',files),section('분류 바꾸기',select,node('p',{text:(row.manual?'현재 브라우저에서 직접 바꾼 분류입니다.':'자동 분류 근거: '+row.auto.classification_basis+'.')+' 분류 변경은 현재 묶음에 표시된 기사에만 적용합니다.'})),node('div',{class:'nd-verification',text:'기사의 발행 시각을 기준으로 정렬합니다. 관련 보도 묶음은 자동 분류이며, 동일 사건인지는 원문 확인이 필요합니다. 사건 발생일·새 사실·기사화 여부는 별도로 확인해야 합니다.'}));
    $('#detailPanel').replaceChildren(node('div',{class:'nd-detail-head'},node('span',{text:'선택한 뉴스'}),button('×',{class:'nd-close','data-close':'','aria-label':'뉴스 상세 닫기'})),body);
  }
  function list(){
    const rows=state.rows.filter(row=>matches(row)&&(state.category==='ALL'||row.category_id===state.category));
    const current=rows.find(row=>row.keys.some(k=>state.selectedKeys.includes(k)));
    state.selected=current?.id||null;if(!current)state.selectedKeys=[];
    $('#listTitle').textContent=state.category==='ALL'?(state.collection==='saved'?'보관한 뉴스':'모든 뉴스'):T.definition(state.category).label;
    $('#resultCount').textContent=rows.length+'건'+(state.mode==='issues'?' · 최신 보도순':'');
    const content=[];let previous=null;
    rows.slice(0,state.limit).forEach(row=>{const day=kstDay(row.latest);if(day!==previous)content.push(node('div',{class:'nd-day',text:heading(row.latest)}));previous=day;content.push(rowNode(row));});
    if(!content.length)content.push(node('div',{class:'nd-empty'},node('strong',{text:state.collection==='saved'?'현재 조회 범위에 보관한 뉴스가 없습니다.':'조건에 맞는 뉴스가 없습니다.'}),state.collection==='saved'?'뉴스 오른쪽의 ☆를 누르거나 조회 기간을 넓혀보세요.':'기간을 넓히거나 다른 분류를 선택해 보세요.'));
    $('#newsList').replaceChildren(...content);$('#more').hidden=rows.length<=state.limit;$('#more').textContent='더 보기 · '+Math.max(0,rows.length-state.limit)+'건 남음';
    if(current)detail(current);else clearDetail();
  }
  function render(){sidebar();list();document.querySelectorAll('[data-mode]').forEach(b=>{const active=b.dataset.mode===state.mode;b.classList.toggle('is-active',active);b.setAttribute('aria-pressed',active);});}
  function rebuild(){state.rows=T.buildRows(state.items,state.issues,{days:state.loadedDays,mode:state.mode,overrides:prefs.overrides});render();}
  function filterChanged(){state.limit=50;state.selectedKeys=[];render();}
  function reset(){state.category='ALL';state.actor='ALL';state.collection='all';state.query='';$('#search').value='';filterChanged();}
  function close(){const id=state.selected;state.selectedKeys=[];state.selected=null;list();[...document.querySelectorAll('[data-open]')].find(b=>b.dataset.open===id)?.focus({preventScroll:true});}
  async function load(){
    const n=++sequence;controller?.abort();controller=new AbortController();const signal=controller.signal,days=state.days;
    const timeout=setTimeout(()=>{if(controller.signal===signal)controller.abort();},35000);
    $('#refresh').disabled=true;$('#newsList').setAttribute('aria-busy','true');$('#status').textContent='뉴스 가져오는 중…';$('#notice').hidden=true;
    try{
      const response=await fetch('/api/news?days='+days+'&limit=400',{signal}),data=await response.json();
      if(n!==sequence)return;
      if(!response.ok||!data.ok||!Array.isArray(data.items)||data.providers?.google_news_rss===false)throw new Error('뉴스 연결 실패');
      state.items=data.items;state.issues=Array.isArray(data.issues)?data.issues:[];state.loadedDays=days;state.limit=50;rebuild();
      $('#status').textContent='뉴스 '+state.items.length+'건';$('#updatedAt').textContent='조회 '+dateText(data.fetched_at||new Date().toISOString());
      $('#sourceNote').textContent='한국기자협회 회원사 수집 기준 유지 · [보도] · 한국시간 기준'+(state.items.length>=400?' · 최대 400건 표시':'')+(data.source_policy?.member_source==='fallback'||data.providers?.jak_members===false?' · 회원사 기준은 저장된 목록을 사용 중':'');
    }catch(error){
      if(n!==sequence)return;state.days=state.loadedDays;$('#period').value=String(state.loadedDays);
      $('#notice').textContent=(error.name==='AbortError'?'뉴스 응답이 늦어 요청을 중단했습니다.':'뉴스를 불러오지 못했습니다.')+(state.items.length?' 이전에 가져온 목록을 유지합니다.':' 새로고침을 눌러 다시 시도해 주세요.');$('#notice').hidden=false;$('#status').textContent='뉴스 연결 확인 필요';
      if(!state.items.length)$('#newsList').replaceChildren(node('div',{class:'nd-empty',text:'뉴스를 불러오지 못했습니다. 위의 새로고침 버튼으로 다시 시도해 주세요.'}));
    }finally{clearTimeout(timeout);if(n===sequence){$('#refresh').disabled=false;$('#newsList').setAttribute('aria-busy','false');}}
  }
  $('#refresh').addEventListener('click',load);$('#search').addEventListener('input',e=>{state.query=e.target.value;filterChanged();});$('#period').addEventListener('change',e=>{state.days=Number(e.target.value);load();});$('#reset').addEventListener('click',reset);$('#more').addEventListener('click',()=>{state.limit+=50;list();});
  $('.news-desk').addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.category){state.category=b.dataset.category;filterChanged();}
    else if(b.dataset.collection){state.collection=b.dataset.collection;state.category='ALL';filterChanged();}
    else if(b.dataset.actor){state.actor=b.dataset.actor;filterChanged();}
    else if(b.dataset.mode){state.mode=b.dataset.mode;state.limit=50;rebuild();}
    else if(b.dataset.open){const row=state.rows.find(x=>x.id===b.dataset.open);if(!row)return;state.selectedKeys=row.keys.slice();list();$('#detailPanel').classList.add('is-open');$('#detailPanel').scrollTop=0;$('#detailPanel').focus({preventScroll:true});}
    else if(b.dataset.save){const row=state.rows.find(x=>x.id===b.dataset.save);if(!row)return;const kept=saved(row);row.keys.forEach(k=>{if(kept)delete prefs.saved[k];else prefs.saved[k]=Date.now();});const ok=persist();render();if(ok)toast(kept?'보관을 해제했습니다.':'현재 브라우저에 보관했습니다.');}
    else if(b.hasAttribute('data-close'))close();
    else if(b.dataset.dossierEntity)$('#detailPanel').classList.remove('is-open');
  });
  $('#detailPanel').addEventListener('change',e=>{
    if(e.target.id!=='reclassify')return;const row=state.rows.find(x=>x.id===state.selected);if(!row)return;const category=e.target.value;
    row.keys.forEach(k=>{if(category==='AUTO')delete prefs.overrides[k];else prefs.overrides[k]=category;});const ok=persist();rebuild();if(ok)toast(category==='AUTO'?'자동 분류로 되돌렸습니다.':'이 브라우저에서 분류를 바꿨습니다.');
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#detailPanel').classList.contains('is-open'))close();if(e.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||'')){e.preventDefault();$('#search').focus();}});
  const offset=()=>$('.news-desk').style.setProperty('--nd-header-offset',Math.ceil($('.topbar').getBoundingClientRect().height+15)+'px');if(window.ResizeObserver)new ResizeObserver(offset).observe($('.topbar'));offset();
  $('.nd-local-note').textContent='보관·분류 변경은 현재 브라우저에만 저장합니다. 보관 목록도 조회 기간·수집 범위 안에서 표시하며, 취재 원장과 원문은 바꾸지 않습니다.';
  sidebar();if(!storageOK)toast('브라우저 저장을 사용할 수 없어 보관·분류 변경은 이번 화면에서만 유지합니다.');load();
})();
