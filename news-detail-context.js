(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.NewsDetailContext=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';

const clean=value=>String(value||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const norm=value=>clean(value).toLowerCase().replace(/[^0-9a-z가-힣]/g,'');
const time=value=>{const n=Date.parse(value||'');return Number.isFinite(n)?n:0;};

function contextText(row,maxLength=1800){
  const parts=[];
  for(const item of row?.items||[]){
    parts.push(item?.title||'',item?.snippet||'');
    for(const entity of item?.related_entities||[])parts.push(entity?.canonical_name||'');
  }
  return clean(parts.join(' ')).slice(0,Math.max(200,Number(maxLength)||1800));
}

function directEntityKeys(row){
  const seen=new Set(),keys=[];
  for(const entity of row?.related_entities||[]){
    const key=String(entity?.entity_key||'').trim();
    if(key&&!seen.has(key)){seen.add(key);keys.push(key);}
  }
  for(const item of row?.items||[]){
    for(const entity of item?.related_entities||[]){
      const key=String(entity?.entity_key||'').trim();
      if(key&&!seen.has(key)){seen.add(key);keys.push(key);}
    }
  }
  return keys;
}

function mergeEntityKeys(row,matched,limit=3){
  const cap=Math.min(Math.max(Number(limit)||3,1),6),seen=new Set(),out=[];
  const add=key=>{key=String(key||'').trim();if(key&&!seen.has(key)&&out.length<cap){seen.add(key);out.push(key);}};
  directEntityKeys(row).forEach(add);
  for(const item of matched||[])add(item?.entity_key);
  return out;
}

function relationKeys(dossiers,existing=[],limit=3){
  const cap=Math.min(Math.max(Number(limit)||3,1),6),seen=new Set(existing||[]),out=[];
  for(const dossier of dossiers||[]){
    for(const relation of dossier?.relations||[]){
      const key=String(relation?.counterpart_key||'').trim();
      if(!key||seen.has(key))continue;
      seen.add(key);out.push(key);
      if(out.length>=cap)return out;
    }
  }
  return out;
}

function currentKeys(items){
  const urls=new Set(),titles=new Set();
  for(const item of items||[]){
    if(item?.source_url)urls.add(String(item.source_url));
    const title=norm(item?.title);if(title)titles.add(title);
  }
  return {urls,titles};
}

function mergeRelatedNews(dossiers,currentItems=[],limit=8){
  const cap=Math.min(Math.max(Number(limit)||8,1),12),current=currentKeys(currentItems),map=new Map();
  for(const dossier of dossiers||[]){
    const dossierName=clean(dossier?.entity?.canonical_name);
    for(const item of dossier?.related_news||[]){
      const url=String(item?.source_url||''),title=clean(item?.title),titleKey=norm(title);
      if(!title)continue;
      if((url&&current.urls.has(url))||(titleKey&&current.titles.has(titleKey)))continue;
      const key=url||titleKey+'|'+String(item?.published_at||'');
      if(!key)continue;
      const previous=map.get(key);
      if(previous){
        const names=new Set(previous.dossier_names||[]);
        if(dossierName)names.add(dossierName);
        previous.dossier_names=[...names];
        continue;
      }
      map.set(key,{...item,dossier_names:dossierName?[dossierName]:[]});
    }
  }
  return [...map.values()].sort((a,b)=>time(b.published_at)-time(a.published_at)).slice(0,cap);
}

function previewText(dossier){
  const status=(dossier?.current_status||[]).find(item=>clean(item?.text))?.text;
  const deal=(dossier?.deals||[]).find(item=>clean(item?.summary))?.summary;
  const service=dossier?.profile_overview?.service_description;
  return clean(status||deal||service||dossier?.summary||'');
}

return {clean,norm,time,contextText,directEntityKeys,mergeEntityKeys,relationKeys,mergeRelatedNews,previewText};
});