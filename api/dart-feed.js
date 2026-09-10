'use strict';
const LIST_URL='https://opendart.fss.or.kr/api/list.json';
const DISPLAY_EVENT_IDS=new Set(['control_change','equity_acquisition','equity_disposal','merger_restructuring','distress_legal','capital_raise','capital_reduction','mezzanine','financing_support','related_party_equity','related_party_funding','bond_retirement','ownership_report','fund_change','performance_risk','group_disclosure','periodic']);
const DISPLAY_TIERS=new Set(['core','change','followup','reference','other']);
function kstDate(offset=0,now=Date.now()){const d=new Date(now+9*3600000);d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10).replace(/-/g,'');}
function boundedInt(v,def,min,max){const n=Number(v);return Number.isInteger(n)?Math.min(max,Math.max(min,n)):def;}
function safeRecord(item){
  const out={};
  for(const k of ['rcept_no','rcept_dt','report_nm','corp_name','corp_code','corp_cls','stock_code','flr_nm','rm','group_id','group_label','is_correction'])if(item[k]!==undefined)out[k]=item[k];
  const analysis=item&&typeof item.analysis==='object'&&!Array.isArray(item.analysis)?item.analysis:null;
  const eventId=analysis&&typeof analysis.event_id==='string'?analysis.event_id:'';
  if(DISPLAY_EVENT_IDS.has(eventId)){
    for(const k of ['family_id','base_report_nm','tier_label','monitor_reason','next_check'])if(typeof item[k]==='string'&&item[k])out[k]=item[k];
    if(typeof item.tier==='string'&&DISPLAY_TIERS.has(item.tier))out.tier=item.tier;
    out.event_id=eventId;
    if(typeof analysis.event_label==='string'&&analysis.event_label)out.event_label=analysis.event_label;
  }
  return out;
}
function createHandler(deps={}) {
  return async(req,res)=>{
    res.setHeader('Access-Control-Allow-Origin','*');
    const fresh=req.query.fresh==='1';res.setHeader('Cache-Control',fresh?'no-store':'s-maxage=180, stale-while-revalidate=600');
    try{
      if(req.query.action==='review')return (deps.handleReview||require('../lib/dart-review').handleReview)(req,res);
      if(req.query.action==='storage-status'){res.setHeader('Cache-Control','no-store');const storage=await(deps.loadStorageStatus||require('../lib/supabase').loadStorageStatus)();return res.status(200).json({ok:true,storage,checked_at:new Date().toISOString()});}
      if(req.method&&req.method!=='GET')return res.status(405).json({ok:false,error:'GET 요청만 지원합니다.'});
      const apiKey=deps.key||process.env.DART_API_KEY;if(!apiKey)return res.status(503).json({ok:false,error:'DART_API_KEY 설정이 필요합니다.'});
      const engine=deps.engine||require('../lib/story-engine'),monitor=deps.monitor||require('../lib/dart-monitor');
      const days=boundedInt(req.query.days,3,1,14),limit=boundedInt(req.query.limit,500,50,800),now=Date.now(),deadline=now+42000;
      const bgn=kstDate(-(days-1),now),end=kstDate(0,now);
      async function page(pageNo){
        const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),Math.max(1,Math.min(12000,deadline-Date.now())));
        try{const params=new URLSearchParams({crtfc_key:apiKey,bgn_de:bgn,end_de:end,last_reprt_at:'N',page_no:String(pageNo),page_count:'100',sort:'date',sort_mth:'desc'});
          const r=await(deps.fetch||fetch)(`${LIST_URL}?${params}`,{signal:ctrl.signal,cache:'no-store'});if(!r.ok)throw Error('DART_HTTP_'+r.status);return await r.json();
        }finally{clearTimeout(timer);}
      }
      const first=await page(1);
      if(first.status==='013')return res.status(200).json({ok:true,items:[],families:[],scanned:0,matched:0,correction_families:0,range:{bgn,end,days},coverage:{complete:true,failed_pages:[],skipped_pages:[],returned_items:0},fetched_at:new Date().toISOString()});
      if(first.status!=='000')return res.status(502).json({ok:false,error:`DART 조회 실패 (${first.status})`});
      const reportedPages=Math.max(1,Number(first.total_page)||1),totalPage=Math.min(reportedPages,100),all=[...(first.list||[])],failed=[],skipped=[];let pagesRead=1;
      for(let start=2;start<=totalPage;start+=8){if(Date.now()>deadline-1000){for(let p=start;p<=totalPage;p++)skipped.push(p);break;}
        const nums=Array.from({length:Math.min(8,totalPage-start+1)},(_,i)=>start+i);
        const results=await Promise.all(nums.map(async n=>{try{const d=await page(n);if(d.status!=='000'||!Array.isArray(d.list)){failed.push(n);return [];}pagesRead++;return d.list;}catch(_){failed.push(n);return [];}}));
        all.push(...results.flat());
      }
      const seen=new Set(),items=[],q=String(req.query.q||'').trim().toLowerCase().slice(0,100);
      for(const raw of all){if(!/^\d{14}$/.test(raw?.rcept_no||'')||seen.has(raw.rcept_no))continue;seen.add(raw.rcept_no);const m=engine.toMonitoredItem(raw);if(monitor.shouldKeep(m)){const item=safeRecord(monitor.enrich(m));if(!q||[item.corp_name,item.report_nm,item.flr_nm].join(' ').toLowerCase().includes(q))items.push(item);}}
      items.sort((a,b)=>String(b.rcept_no).localeCompare(String(a.rcept_no)));
      const limitedItems=items.slice(0,limit),families=require('../dart-desk').buildGroups(limitedItems).map(g=>({latest:g.latest,items:g.items,notice_count:g.items.length,correction_count:g.items.filter(x=>/\[(?:기재정정|첨부정정|정정)\]/.test(x.report_nm||'')).length,grouping:'company_title_filer_only',transaction_verified:false})),counts=field=>limitedItems.reduce((a,x)=>{a[x[field]]=(a[x[field]]||0)+1;return a;},{});
      const complete=!failed.length&&!skipped.length&&reportedPages<=100;
      return res.status(200).json({ok:true,items:limitedItems,families,scanned:seen.size,matched:items.length,group_counts:counts('group_id'),family_count:families.length,correction_families:families.filter(x=>x.correction_count>0).length,
        family_scope:'회사·공시명·제출자 기준의 검색 묶음입니다. 동일 거래로 검증한 사건 수가 아닙니다.',range:{bgn,end,days},fetched_at:new Date().toISOString(),
        coverage:{complete,reported_pages:reportedPages,read_pages:pagesRead,failed_pages:failed.sort((a,b)=>a-b),skipped_pages:skipped,scan_capped:reportedPages>100,display_limited:items.length>limit,matched_items:items.length,returned_items:limitedItems.length}});
    }catch(_){return res.status(502).json({ok:false,error:'DART 응답 지연 또는 조회 오류입니다. 잠시 후 다시 시도하세요.'});}
  };
}
module.exports=createHandler();module.exports.createHandler=createHandler;module.exports.kstDate=kstDate;module.exports.safeRecord=safeRecord;
