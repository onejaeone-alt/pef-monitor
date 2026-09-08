'use strict';
const { clean, norm, hash, sourceKey, matchCase } = require('./preflight-core');
// Only these public hosts may be fetched, including every redirect and attachment.
const OFFICIAL = ['kvic.or.kr','k-vic.co.kr','vcs.go.kr','fund.nps.or.kr','nps.or.kr','kgrowth.or.kr','kdb.co.kr','mss.go.kr','korea.kr','fsc.go.kr','fss.or.kr'];
const MEDIA = ['edaily.co.kr','thebell.co.kr','dealsite.co.kr','hankyung.com','mk.co.kr','sedaily.com','newsis.com','yna.co.kr','yonhapnewstv.co.kr','platum.kr','venturesquare.net','mt.co.kr','fnnews.com','bloter.net'];
const SEARCH = ['news.google.com','openapi.naver.com'];
function domainIn(host, list) { return list.some(d => host === d || host.endsWith('.' + d)); }
function publicKind(value) {
  try { const u = new URL(value); if (!['http:','https:'].includes(u.protocol) || u.username || u.password || u.port) return 'blocked';
    if (domainIn(u.hostname, OFFICIAL)) return 'official';
    if (domainIn(u.hostname, MEDIA)) return 'media';
    if (SEARCH.includes(u.hostname)) return 'search';
  } catch (_) {}
  return 'blocked';
}
function safeUrl(value) {
  try { const u = new URL(value); if (publicKind(value) === 'blocked') return null;
    if (/(?:^|\/)(?:admin|login|signin|logout|mypage)(?:[/.?]|$)/i.test(u.pathname)) return null;
    if ([...u.searchParams.keys()].some(k => /^(?:key|api_key|token|access_token|crtfc_key|serviceKey|auth)$/i.test(k))) return null;
    // HTTPS only for all outgoing traffic. Never forward cookies or authorization.
    u.protocol = 'https:'; return u.toString();
  } catch (_) { return null; }
}
function decode(v) { return String(v || '').replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (m,k) => {
  if (k[0] === '#') { const n = k[1].toLowerCase() === 'x' ? parseInt(k.slice(2),16) : Number(k.slice(1)); return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ''; }
  return ({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '})[k.toLowerCase()] || m;
}); }
function htmlBlocks(html) {
  const noChrome = String(html).replace(/<(script|style|nav|header|footer)\b[\s\S]*?<\/\1>/gi, ' ');
  const core = noChrome.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] || noChrome.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || noChrome.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || noChrome;
  const text = decode(core.replace(/<\/(?:p|div|li|tr|h[1-6]|section)>|<br\s*\/?\s*>/gi,'\n').replace(/<\/(?:td|th)>/gi,' | ').replace(/<[^>]*>/g,' '))
    .split(/\n+/).map(clean).filter(Boolean).join('\n').slice(0, 90000);
  return [{ location: '웹 본문', text }];
}
function readLinks(html, base) {
  const out = [];
  for (const m of String(html).matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let url; try { url = safeUrl(new URL(decode(m[1]), base).toString()); } catch (_) { continue; }
    const label = clean(decode(m[2].replace(/<[^>]*>/g, ' ')));
    if (!url || publicKind(url) !== 'official' || /목록|이전글|다음글/.test(label)) continue;
    if (/\.pdf|\.hwpx?|첨부|다운로드|내려받기|공고|선정|연장|벤처펀드/.test(label + ' ' + url)) out.push({ url, title: label, parent_url: base });
  }
  return out.slice(0, 12);
}
async function boundedFetch(value, { deadline, maxBytes = 2000000, headers = {}, redirects = 0 } = {}) {
  const url = safeUrl(value); if (!url) throw new Error('PUBLIC_HOST_NOT_ALLOWED');
  const remaining = Math.min(6500, (deadline || Date.now() + 6500) - Date.now());
  if (remaining <= 0) throw new Error('RESEARCH_TIME_LIMIT');
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), remaining);
  try {
    const r = await fetch(url, { signal: controller.signal, redirect: 'manual', headers: { 'User-Agent': 'IB-Reporting-Radar/1.0 (public source review)', ...headers } });
    if ([301,302,303,307,308].includes(r.status)) {
      if (redirects >= 2) throw new Error('REDIRECT_LIMIT');
      const next = safeUrl(new URL(r.headers.get('location') || '', url).toString());
      if (!next) throw new Error('REDIRECT_NOT_PUBLIC');
      await r.body?.cancel();
      // Credentials for a search provider must never follow redirects.
      return boundedFetch(next, { deadline, maxBytes, redirects: redirects + 1 });
    }
    if (!r.ok) { await r.body?.cancel(); throw new Error(`HTTP_${r.status}`); }
    if (Number(r.headers.get('content-length') || 0) > maxBytes) { await r.body?.cancel(); throw new Error('DOCUMENT_TOO_LARGE'); }
    const chunks = []; let size = 0;
    for await (const chunk of r.body) { size += chunk.length; if (size > maxBytes) { controller.abort(); throw new Error('DOCUMENT_TOO_LARGE'); } chunks.push(chunk); }
    return { buffer: Buffer.concat(chunks), contentType: r.headers.get('content-type') || '', url };
  } catch (e) { throw new Error(e.name === 'AbortError' ? 'SOURCE_TIMEOUT' : e.message); }
  finally { clearTimeout(timer); }
}
function metaSource(meta) {
  const url = sourceKey(meta.url || meta.source_url);
  return { source_id: hash(url), url, title: clean(meta.title || meta.label || '공개자료'), published_at: meta.published_at || meta.date || null,
    kind: publicKind(url), publisher: domainIn(new URL(url || 'https://invalid.local').hostname, ['kvic.or.kr','k-vic.co.kr']) ? '한국벤처투자' : domainIn(new URL(url || 'https://invalid.local').hostname, ['nps.or.kr']) ? '국민연금공단 기금운용본부' : clean(meta.publisher || ''), found_by: meta.found_by || 'canonical_reference', snippet: clean(meta.snippet || ''), read_ok: false, access: 'link_only', text: '', blocks: [] };
}
const docs = new Map();
async function readDocument(meta, deadline) {
  const source = metaSource(meta), key = sourceKey(source.url);
  if (docs.has(key) && docs.get(key).expires > Date.now()) return { ...source, ...docs.get(key).document, cache_hit: true };
  if (source.kind === 'blocked') return { ...source, access: 'not_fetched', read_error: 'PUBLIC_HOST_NOT_ALLOWED' };
  if (source.kind === 'search') return { ...source, access: 'headline_only', read_error: 'ORIGINAL_URL_UNRESOLVED' };
  if (/\.hwp(?:x)?(?:$|[?#])/i.test(source.url + ' ' + source.title)) return { ...source, access: 'attachment_unread', read_error: 'HWP_NOT_SUPPORTED' };
  try {
    const r = await boundedFetch(source.url, { deadline, maxBytes: 5000000 });
    const pdf = /application\/pdf/i.test(r.contentType) || r.buffer.subarray(0,5).toString() === '%PDF-';
    let blocks, links = [], pageCount = null, truncated = false;
    if (pdf) {
      const parse = require('pdf-parse'); blocks = [];
      const parsed = await parse(r.buffer, { max: 24, pagerender: async page => {
        const content = await page.getTextContent(); const lines = []; let y = null, text = '';
        for (const item of content.items) { const yy = item.transform?.[5]; if (y !== null && Math.abs(yy - y) > 2) { lines.push(clean(text)); text = ''; } text += ' ' + item.str; y = yy; }
        if (text) lines.push(clean(text)); const txt = lines.join('\n');
        blocks.push({ location: `PDF ${page.pageNumber}쪽`, text: txt }); return txt;
      } });
      pageCount = parsed.numpages; truncated = pageCount > 24;
    } else {
      if (!/text\/(?:html|plain)|application\/(?:xhtml\+xml|xml)/i.test(r.contentType)) throw new Error('FORMAT_NOT_SUPPORTED');
      const html = r.buffer.toString('utf8');
      if (/captcha|access denied|just a moment|로그인이 필요|회원만 열람|접근 권한이 없/i.test(html)) throw new Error('ACCESS_LIMITED');
      blocks = htmlBlocks(html); links = readLinks(html, source.url);
      if (domainIn(new URL(source.url).hostname, ['kvic.or.kr'])) {
        try { const detail = require('./kvic-notices').parseDetailPage(html, { source_url: source.url });
          links.push(...(detail.attachments || []).filter(x => safeUrl(x.url)).map(x => ({ url: x.url, title: x.filename || x.label, parent_url: source.url })));
        } catch (_) { /* Page extraction remains available if an attachment format is unknown. */ }
      }
    }
    const text = blocks.map(b => b.text).join('\n');
    if (text.replace(/\s/g,'').length < 50) throw new Error(pdf ? 'SCANNED_OR_EMPTY_PDF' : 'BODY_UNREADABLE');
    const doc = { ...source, url: r.url, blocks, text, read_ok: true, access: 'body', links, page_count: pageCount, truncated,
      content_hash: hash(r.buffer.toString('base64')), retrieved_at: new Date().toISOString() };
    docs.set(key, { expires: Date.now() + 600000, document: doc });
    while (docs.size > 24) docs.delete(docs.keys().next().value);
    return doc;
  } catch (e) { return { ...source, access: 'unread', read_error: clean(e.message).slice(0,80), retrieved_at: new Date().toISOString() }; }
}
async function search(query, purpose, deadline) {
  const rssUrl = 'https://news.google.com/rss/search?' + new URLSearchParams({ q: query, hl: 'ko', gl: 'KR', ceid: 'KR:ko' });
  const tasks = [boundedFetch(rssUrl, { deadline }).then(r => require('./context-sources').parseGoogleNewsRss(r.buffer.toString('utf8'), 'domestic', 'ko'))];
  const names = ['google_news_rss'];
  const id = process.env.NAVER_CLIENT_ID, secret = process.env.NAVER_CLIENT_SECRET;
  if (id && secret) {
    const headers = { 'X-Naver-Client-Id': id, 'X-Naver-Client-Secret': secret };
    for (const kind of ['news','webkr']) {
      names.push(`naver_${kind}`);
      const simple = query.replace(/\([^)]*\)/g, ' ').replace(/["()]/g, ' ').replace(/\s+/g, ' ').trim();
      const url = `https://openapi.naver.com/v1/search/${kind}.json?` + new URLSearchParams({ query: simple, display: '10', ...(kind === 'news' ? { sort: 'date' } : {}) });
      tasks.push(boundedFetch(url, { deadline, headers }).then(r => {
        const p = JSON.parse(r.buffer.toString('utf8'));
        return (p.items || []).map(x => ({ title: clean(decode(String(x.title || '').replace(/<[^>]*>/g,''))), source_url: x.originallink || x.link,
          published_at: x.pubDate && Number.isFinite(Date.parse(x.pubDate)) ? new Date(x.pubDate).toISOString() : null,
          snippet: clean(decode(String(x.description || '').replace(/<[^>]*>/g,''))) }));
      }));
    }
  }
  const results = await Promise.allSettled(tasks), records = [], log = [];
  results.forEach((result, i) => {
    log.push({ provider: names[i], purpose, query, status: result.status === 'fulfilled' ? 'ok' : 'failed', count: result.status === 'fulfilled' ? result.value.length : 0,
      error: result.status === 'rejected' ? clean(result.reason?.message).slice(0,80) : null });
    if (result.status === 'fulfilled') records.push(...result.value.map(x => ({ ...x, url: x.source_url, found_by: names[i], search_purpose: purpose })));
  });
  if (!id || !secret) log.push({ provider: 'naver', purpose, status: 'not_configured', count: 0 });
  return { records, log };
}
function historyRecords(rows, seeds) {
  const out = [];
  for (const r of rows || []) {
    if (publicKind(r.source_url) === 'blocked') continue;
    // No raw_data notes, interpretations or contact fields leave storage.
    const m = { url: r.source_url, title: clean(r.title), publisher: clean(r.source_name), published_at: r.published_at || null, found_by: 'public_source_index' };
    const title = norm(m.title);
    const hit = seeds.some(s => {
      if (title.includes(norm(s.gp || s.lp))) return true;
      if (publicKind(m.url) !== 'official' || !title.includes(s.year)) return false;
      if (s.tokens.some(t => title.includes(norm(t)))) return true;
      const selected = s.baseline.previous.match(/20\d{2}-\d{2}-\d{2}/)?.[0];
      const gap = Math.abs(Date.parse(m.published_at) - Date.parse(selected));
      return norm(m.publisher) === norm(s.lp) && Number.isFinite(gap) && gap <= 45 * 86400000;
    });
    if (!hit) continue;
    out.push(m);
  }
  // Nearby LP notices are read as candidates only; paragraph matching still gates evidence.
  const distance = r => Math.min(...seeds.map(s => {const d = s.baseline.previous.match(/20\d{2}-\d{2}-\d{2}/)?.[0];const gap=Math.abs(Date.parse(r.published_at)-Date.parse(d));return Number.isFinite(gap)?gap:Infinity;}));
  return out.sort((a,b) => distance(a)-distance(b)).slice(0, 20);
}
function fundCandidates(items, seed) {
  if (!seed.gp) return [];
  return (items || []).filter(f => norm(f.manager).includes(norm(seed.gp))).slice(0,8).map(f => ({
    manager: clean(f.manager), association_name: clean(f.association_name), year: clean(f.year), field: clean(f.field),
    match_status: '동일 GP의 공개목록 등재 펀드 · 해당 선정분과 동일한지는 미확인',
    source: '한국벤처투자 공개 펀드 API', source_url: 'https://www.kvic.or.kr/',
    // Never treat amt/ca/expiry/year as paid-in amount or registration date.
  }));
}
module.exports = { OFFICIAL, MEDIA, publicKind, safeUrl, htmlBlocks, readLinks, boundedFetch, readDocument, search, historyRecords, fundCandidates, metaSource };
