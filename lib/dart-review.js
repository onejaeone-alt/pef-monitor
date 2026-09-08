'use strict';
// Read-only review of a single filing. Never pair filings by company/title alone.
const crypto = require('node:crypto');
const VERSION = 'dart-review-1';
const clean = v => String(v ?? '').replace(/\s+/g, ' ').trim();
const key = v => clean(v).replace(/[\s·ㆍ.:：()[\]①②③④⑤]/g, '');
const id = v => crypto.createHash('sha256').update(v).digest('hex').slice(0, 20);
const urlFor = n => `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${n}`;
function text(v) {
  return clean(String(v || '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]*>/g, ' ')
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n) => { const c = /^x/i.test(n) ? parseInt(n.slice(1), 16) : Number(n); return c > 0 && c <= 0x10ffff ? String.fromCodePoint(c) : ''; })
    .replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&apos;/gi, "'"));
}
function tables(markup) {
  const stack = [], found = [];
  for (const m of markup.matchAll(/<\/?TABLE\b[^>]*>/gi)) {
    if (!/^<\//.test(m[0])) { if (stack.length) stack[stack.length - 1].nested = true; stack.push({ start:m.index, at:m.index + m[0].length, nested:false }); }
    else if (stack.length) { const t=stack.pop(); if (!t.nested) found.push({start:t.start, html:markup.slice(t.at, m.index)}); }
  }
  return found.sort((a,b)=>a.start-b.start).map((t, ti) => ({ number:ti+1, start:t.start, rows:[...t.html.matchAll(/<TR\b[^>]*>([\s\S]*?)<\/TR>/gi)].map((m,ri)=>({ number:ri+1, cells:[...m[1].matchAll(/<(TD|TH)\b([^>]*)>([\s\S]*?)<\/\1>/gi)].map(c=>({value:text(c[3]),span:Math.max(1, Number(c[2].match(/COLSPAN\s*=\s*["']?(\d+)/i)?.[1]||1)),rowspan:Math.max(1,Number(c[2].match(/ROWSPAN\s*=\s*["']?(\d+)/i)?.[1]||1))})) })) }));
}
function header(row) {
  if(row.cells.some(c=>c.span!==1||c.rowspan!==1))return null;
  const names=row.cells.map(c=>key(c.value));
  const before=names.findIndex(x=>/^(정정전|변경전)(내용)?$/.test(x)), after=names.findIndex(x=>/^(정정후|변경후)(내용)?$/.test(x));
  const label=names.findIndex(x=>/^(정정|변경)?(대상)?(항목|사항)$/.test(x)), reason=names.findIndex(x=>/^(정정|변경)사유$/.test(x));
  return before>=0&&after>=0&&label>=0 ? {before,after,label,reason,count:names.length} : null;
}
function calendarDay(raw) {
  const m=clean(raw).match(/^(20\d{2})[.\-/년]\s*(\d{1,2})[.\-/월]\s*(\d{1,2})(?:일|\.)?$/);if(!m)return null;
  const [y,mo,d]=m.slice(1).map(Number),time=Date.UTC(y,mo-1,d),dt=new Date(time);
  return dt.getUTCFullYear()===y&&dt.getUTCMonth()===mo-1&&dt.getUTCDate()===d?time/86400000:null;
}
function sameValue(a,b) {
  if(clean(a)===clean(b))return true;
  const da=calendarDay(a), db=calendarDay(b);if(da!==null&&db!==null)return da===db;
  const numeric=/^[+-]?[\d,]+(?:\.\d+)?\s*(?:%|원|주|억원|백만원)?$/;
  return numeric.test(a)&&numeric.test(b)&&a.replace(/[,\s]/g,'')===b.replace(/[,\s]/g,'');
}
function topic(label) {
  if(/납입일|납입예정|만기일|청구기간|일정|예정일|종결일|지급일/.test(label))return 'schedule';
  if(/상대방|배정대상|인수자|대상회사|최대주주|보유목적/.test(label))return 'party';
  if(/목적|사용처/.test(label))return 'purpose';
  if(/비율|지분|주식수|주식총수|보유수량|희석/.test(label))return 'ownership';
  if(/금액|총액|자금|발행가|전환가|행사가|이자|대가/.test(label))return 'money';
  return 'terms';
}
const SPECS = [
  ['결정일', /^(?:이사회)?결의일(?:결정일)?$|^결정일$/, 'schedule'],
  ['납입일', /^납입일(?:자)?$/, 'schedule'],['거래 예정일', /^(양수|양도|취득|처분)예정일(?:자)?$/, 'schedule'],
  ['사채만기일', /^사채만기일$/, 'schedule'],['사채 회차', /^회차$|^사채회차$/, 'terms'],
  ['권면총액', /^(?:사채의?)?권면총액(?:원)?$/, 'money'],['전환가액', /^전환가액(?:원주|원)?$/, 'money'],
  ['신주 발행가액', /^신주발행가액(?:원)?$/, 'money'],['양수금액', /^양수금액(?:원)?$/, 'money'],['양도금액', /^양도금액(?:원)?$/, 'money'],
  ['운영자금', /^운영자금(?:원)?$/, 'money'],['채무상환자금', /^채무상환자금(?:원)?$/, 'money'],['증자방식', /^증자방식$/, 'terms'],
  ['표면이자율', /^표면이자율(?:%)?$/, 'money'],['만기이자율', /^만기이자율(?:%)?$/, 'money'],
];
function sourceRef(rcept, entry, table, row) {return {source_id:`dart:${rcept}`,url:urlFor(rcept),entry,table:table.number,row:row.number,location:`${entry} · 표 ${table.number} · 행 ${row.number}`};}
function extractCurrent(ts,rcept,entry,correctionTables) {
  const collected=new Map(), ambiguous=[];
  for(const t of ts){if(correctionTables.has(t.number))continue;
    for(const r of t.rows){if(r.cells.some(c=>c.rowspan!==1))continue;
      for(let i=0;i<r.cells.length-1;i++){
        const label=r.cells[i].value.replace(/^\s*\d+[.)]\s*/,'');const spec=SPECS.find(s=>s[1].test(key(label)));if(!spec)continue;
        const value=r.cells[i+1].value;if(!value||/해당사항없음/.test(key(value))||/^[-—]$/.test(value)||value.length>240)continue;
        // Units remain exactly as printed; no conversion or inference from a bare number.
        const row={evidence_id:id(`${rcept}|current|${t.number}|${r.number}|${spec[0]}`),label:spec[0],raw_label:label,value,topic:spec[2],fact_status:'단서',verification:'원문 자동 추출 · 검수 전',source:sourceRef(rcept,entry,t,r)};
        const prior=collected.get(spec[0]);if(!prior)collected.set(spec[0],row);else if(!sameValue(prior.value,value))ambiguous.push(spec[0]);
      }
    }
  }
  return {fields:[...collected.values()].filter(f=>!ambiguous.includes(f.label)),ambiguous:[...new Set(ambiguous)]};
}
function questionRows(changes,fields) {
  const refs=changes.length?changes:fields;const groups=[...new Set(refs.map(r=>r.topic))];
  const wording={
    schedule:['일정·이행','변경된 날짜가 계약상 예정일인가, 실제 이행일인가? 납입·거래 종결 여부와 일정이 달라진 사유를 각각 확인해달라.','일정 변경만으로 자금난이나 거래 무산을 단정할 수 없습니다.'],
    money:['금액·자금','변경 금액은 예정 조달액인가, 실제 납입·지급액인가? 단위와 변경 사유, 자금 사용계획의 영향을 확인해달라.','조달 목표와 실제 입금은 다릅니다. 손익이나 차환 여부는 별도 근거가 필요합니다.'],
    party:['상대방·지배력','거래 상대방·배정대상 또는 보유 목적은 왜 달라졌나? 계약 변경과 실제 지분·의결권 변동을 확인해달라.','상대방 명칭 변경과 실질적인 지배력 이동은 구분해야 합니다.'],
    ownership:['지분·희석','지분·전환비율 변화가 주식 수 변화 때문인가, 분모가 달라졌기 때문인가? 전환 조건과 실제 행사 여부를 확인해달라.','비율만으로 지배력이나 손실을 확정할 수 없습니다.'],
    purpose:['사용처','자금 사용처를 바꾼 이유는 무엇인가? 실제 집행 여부와 기존 계획에 미칠 영향을 확인해달라.','계획 변경과 실제 자금 이동을 구분해야 합니다.'],
    terms:['조건·효력','변경된 조항이 권리·의무를 바꾸는가, 기재오류를 바로잡은 것인가? 변경 사유와 적용 시점을 확인해달라.','표의 문구 차이만으로 경제적 영향을 단정하지 않습니다.']};
  if(!changes.length){
    wording.schedule[1]='기재된 날짜는 예정일인가, 실제 이행일인가? 납입·종결·만기의 해당 일정과 이행 상태를 확인해달라.';
    wording.money[1]='기재된 금액은 예정 조달액인가, 실제 납입·지급액인가? 단위·자금 사용처와 실제 이행 여부를 확인해달라.';
    wording.terms[1]='공시의 거래 대상·회차·계약 조건과 실제 진행 단계는 무엇인가? 변경 여부는 과거 원문을 확보한 뒤 확인해달라.';
  }
  return (groups.length?groups:['terms']).map(k=>({key:k,title:wording[k][0],target:'공시 담당자·해당 거래상대방',question:wording[k][1],still_needed:wording[k][2],evidence_ids:refs.filter(r=>r.topic===k).map(r=>r.evidence_id),resolved:false}));
}
function analyzeMarkup(markup,{rcept_no,entry='공시 원문'}={}) {
  if(!/^\d{14}$/.test(String(rcept_no||'')))throw Error('INVALID_RECEIPT');
  if(typeof markup!=='string'||markup.length>16000000)throw Error('DOCUMENT_SIZE');
  const ts=tables(markup),changes=[],correctionTables=new Set(),warnings=[];let skipped=0,hasTable=false;
  for(const t of ts){let h=null;
    for(const r of t.rows){const candidate=header(r);if(candidate){h=candidate;hasTable=true;correctionTables.add(t.number);continue;}if(!h)continue;
      if(r.cells.length!==h.count||r.cells.some(c=>c.span!==1||c.rowspan!==1)){skipped++;continue;}
      const label=r.cells[h.label].value,before=r.cells[h.before].value,after=r.cells[h.after].value;
      if(!label||!before||!after||sameValue(before,after))continue;
      if(label.length>260||before.length>800||after.length>800){skipped++;continue;}
      const a=calendarDay(before),b=calendarDay(after);
      changes.push({evidence_id:id(`${rcept_no}|delta|${t.number}|${r.number}`),label,before,after,topic:topic(label),reason:h.reason>=0?r.cells[h.reason].value:null,
        day_delta:a!==null&&b!==null?b-a:null,fact_status:'단서',verification:'정정표 자동 추출 · 검수 전',source:sourceRef(rcept_no,entry,t,r)});
    }
  }
  const current=extractCurrent(ts,rcept_no,entry,correctionTables);
  if(skipped)warnings.push(`병합 셀·긴 문구 등 ${skipped}개 행은 자동 비교에서 제외했습니다. 원문을 확인하세요.`);
  if(current.ambiguous.length)warnings.push(`값이 여러 개 나온 항목(${current.ambiguous.join('·')})은 임의 선택하지 않았습니다.`);
  const name=text(markup.match(/<DOCUMENT-NAME\b[^>]*>([\s\S]*?)<\/DOCUMENT-NAME>/i)?.[1]||'');
  const company=text(markup.match(/<COMPANY-NAME\b[^>]*>([\s\S]*?)<\/COMPANY-NAME>/i)?.[1]||'');
  if(changes.length>12)warnings.push(`변경 ${changes.length}행 중 처음 12행을 표시합니다. 전체 내용은 원문을 확인하세요.`);
  const visible=changes.slice(0,12),fields=current.fields.slice(0,14);
  return {ok:true,version:VERSION,rcept_no,source_id:`dart:${rcept_no}`,url:urlFor(rcept_no),document_name:name,corp_name:company,entry,
    state:visible.length?'changes_extracted':hasTable?'comparison_incomplete':fields.length?'fields_extracted':'source_only',
    comparison_method:hasTable?'same_filing_correction_table':'not_compared',comparison_note:hasTable?'현재 공시의 정정 전·후 표를 읽었습니다. 다른 접수번호를 임의로 짝지어 비교하지 않았습니다.':'비교 가능한 정정표를 확보하지 못했습니다. 변경사항이 없다는 뜻은 아닙니다.',
    changes:visible,change_count:changes.length,current_fields:fields,questions:questionRows(visible,fields),warnings,
    read_at:new Date().toISOString(),content_hash:id(markup),policy:{public_only:true,canonical_write:false,article_judgment:false,private_notes_uploaded:false}};
}
async function fetchArchive(rcept,{fetchImpl=fetch,key:apiKey=process.env.DART_API_KEY}={}) {
  if(!apiKey)throw Error('DART_KEY_MISSING');
  const u=new URL('https://opendart.fss.or.kr/api/document.xml');u.search=new URLSearchParams({crtfc_key:apiKey,rcept_no:rcept});
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),14000);
  try {const r=await fetchImpl(u,{signal:ctrl.signal,redirect:'error'});if(!r.ok)throw Error('DART_HTTP_'+r.status);
    if(Number(r.headers.get('content-length')||0)>8000000)throw Error('DOCUMENT_SIZE');
    const chunks=[];let size=0;for await(const c of r.body){size+=c.length;if(size>8000000){ctrl.abort();throw Error('DOCUMENT_SIZE');}chunks.push(c);}const buf=Buffer.concat(chunks);
    if(buf[0]!==80||buf[1]!==75){const code=buf.toString('utf8').match(/<status>(\d+)<\/status>/i)?.[1];throw Error(code?'DART_STATUS_'+code:'DOCUMENT_NOT_ZIP');}
    const AdmZip=require('adm-zip'),zip=new AdmZip(buf);const entries=zip.getEntries();
    if(entries.length>200||entries.reduce((n,e)=>n+Number(e.header?.size||0),0)>32000000)throw Error('DOCUMENT_SIZE');
    const xmls=entries.filter(e=>!e.isDirectory&&/\.xml$/i.test(e.entryName)&&!/(?:^|\/)\.\.(?:\/|$)/.test(e.entryName));
    const exact=xmls.find(e=>e.entryName.split('/').pop()===rcept+'.xml');
    const primary=xmls.filter(e=>!/(?:attach|image|xbrl|첨부)/i.test(e.entryName));const entry=exact||(primary.length===1?primary[0]:null);
    if(!entry)throw Error('PRIMARY_DOCUMENT_AMBIGUOUS');if(entry.header.size>16000000)throw Error('DOCUMENT_SIZE');
    const data=entry.getData();let markup=data.toString('utf8');if(/encoding=["'](?:euc-kr|ks_c_5601-1987|cp949)/i.test(markup.slice(0,300))||markup.includes('�'))markup=require('iconv-lite').decode(data,'euc-kr');
    return {markup,entry:entry.entryName};
  } catch(e){if(e.name==='AbortError')throw Error('DART_TIMEOUT');throw e;} finally{clearTimeout(timer);}
}
const cache=new Map(),pending=new Map();
async function handleReview(req,res) {
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  const n=String(req.query.rcept_no||'');
  if(req.method!=='GET'||!/^\d{14}$/.test(n)||Object.keys(req.query).some(k=>!['action','rcept_no','_','_vercel_share','_vercel_no_cache'].includes(k))||(req.body&&Object.keys(req.body).length))return res.status(400).json({ok:false,error:'공개 공시 접수번호만 받을 수 있습니다.'});
  const old=cache.get(n);if(old&&Date.now()-old.at<1200000)return res.status(200).json({...old.result,cache_hit:true});
  if(pending.size>=3&&!pending.has(n)){res.setHeader('Retry-After','10');return res.status(429).json({ok:false,error:'다른 공시를 읽는 중입니다. 잠시 후 다시 눌러주세요.'});}
  if(!pending.has(n))pending.set(n,fetchArchive(n).then(d=>analyzeMarkup(d.markup,{rcept_no:n,entry:d.entry})).then(result=>{cache.set(n,{at:Date.now(),result});while(cache.size>40)cache.delete(cache.keys().next().value);return result;}).finally(()=>pending.delete(n)));
  try{return res.status(200).json(await pending.get(n));}catch(e){const code=/^(DART_|DOCUMENT_|PRIMARY_)/.test(e.message)?e.message:'READ_FAILED';return res.status(502).json({ok:false,rcept_no:n,url:urlFor(n),state:'unread',error:'공시 원문을 자동으로 읽지 못했습니다. 원문 링크에서 확인하세요.',error_code:code});}
}
module.exports={VERSION,text,tables,header,calendarDay,sameValue,analyzeMarkup,questionRows,fetchArchive,handleReview};
