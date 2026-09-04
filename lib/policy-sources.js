const KSTARTUP_BASE = 'https://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01';
const KVIC_MANAGER_BASE = 'https://api.odcloud.kr/api/3060708/v1/uddi:83a33190-1dbf-4e2c-a1f7-90451b544ed5';
function clean(value) { return String(value ?? '').replace(/\s+/g, ' ').trim(); }
function first(source, keys) { for (const key of keys) if (source?.[key] != null) return source[key]; return null; }
function asList(value) { return !value ? [] : Array.isArray(value) ? value : [value]; }
function buildKstartupUrl(key, params = {}) { const url = new URL(KSTARTUP_BASE); url.searchParams.set('serviceKey', key); url.searchParams.set('page', String(params.page || 1)); url.searchParams.set('perPage', String(Math.min(Math.max(Number(params.perPage) || 100, 1), 100))); url.searchParams.set('returnType', 'json'); return url.toString(); }
function buildManagerUrl(key, params = {}) { const url = new URL(KVIC_MANAGER_BASE); url.searchParams.set('serviceKey', key); url.searchParams.set('page', String(params.page || 1)); url.searchParams.set('perPage', String(Math.min(Math.max(Number(params.perPage) || 100, 1), 100))); url.searchParams.set('returnType', 'JSON'); return url.toString(); }
function parseKstartup(payload) {
  const header = payload?.response?.header || payload?.header || {}; const code = clean(header.resultCode || header.resultCd || '');
  if (code && !['00', '0', 'NORMAL_CODE'].includes(code)) return { items: [], total: 0, error: clean(header.resultMsg || header.resultMessage || code) };
  const body = payload?.response?.body || payload?.body || payload || {}; const rows = asList(body?.items?.item || body?.items || body?.data);
  const items = rows.map(row => ({ id: clean(first(row,['pbanc_sn','announcementId','id'])), title: clean(first(row,['biz_pbanc_nm','pbanc_nm','announcementTitle','title'])), organization: clean(first(row,['sprv_inst','supt_biz_ancmnt_inst_nm','organizationName','inst_nm'])), start_date: clean(first(row,['pbanc_rcpt_bgng_dt','aply_bgng_dt','startDate'])), end_date: clean(first(row,['pbanc_rcpt_end_dt','aply_end_dt','endDate'])), posted_date: clean(first(row,['pbanc_dt','reg_dt','postedDate'])), category: clean(first(row,['supt_biz_clsfc','biz_category_cd','category'])), target: clean(first(row,['aply_trgt_ctnt','biz_trgt','target'])), status: clean(first(row,['rcrt_prgs_yn','recrt_prgs_yn','status'])), url: clean(first(row,['detl_pg_url','detailPageUrl','url'])), raw: row })).filter(item => item.title);
  return { items, total: Number(body.totalCount || body.total || items.length), error: null };
}
function parseManagers(payload) { const rows = asList(payload?.data || payload?.response?.body?.items?.item); const items = rows.map(row => ({ manager: clean(first(row,['대표운영사','대표운용사','manager'])), manager_type: clean(first(row,['운영사구분','운용사구분','manager_type'])), fund_size_million_krw: Number(String(first(row,['자조합 규모(백만원)','자조합규모(백만원)','fund_size']) || '').replace(/,/g,'')) || null })).filter(item => item.manager); return { items, total: Number(payload?.totalCount || payload?.matchCount || items.length), error: null }; }
module.exports = { buildKstartupUrl, buildManagerUrl, parseKstartup, parseManagers };
