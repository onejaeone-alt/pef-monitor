'use strict';
// Recover original links through the publisher's own public search API.
// No cached article copy is substituted and only exact title matches are accepted.
function titleKey(value) {
  return String(value || '').replace(/<[^>]*>/g,' ').replace(/&#(?:0*39|x0*27);|&apos;/gi,"'").replace(/&quot;|&ldquo;|&rdquo;/gi,'"').replace(/&amp;/gi,'&').replace(/&lsquo;|&rsquo;/gi,"'").replace(/\s*[-–|]\s*(?:플래텀(?:\(Platum\))?|Platum)\s*$/i,'').toLowerCase().replace(/[^a-z0-9가-힣]/g,'');
}
async function resolveFromPublisher(meta, transport, deadline) {
  const publisher = String(meta.publisher || meta.source_name || '');
  if (!/플래텀|platum/i.test(publisher)) return null;
  const title = String(meta.title || ''), expected = titleKey(title);
  if (expected.length < 12) return null;
  const words = (title.match(/[가-힣a-zA-Z0-9]+/g)||[]).filter(t=>t.length>=3 && !/Platum|플래텀/i.test(t));
  const terms = [...new Set(words)].slice(0,4).join(' ');
  if (!terms) return null;
  const url = 'https://platum.kr/wp-json/wp/v2/posts?' + new URLSearchParams({search:terms,per_page:'8',_fields:'link,title'});
  const r = await transport(url,{deadline:Math.min(deadline,Date.now()+4500),maxBytes:150000});
  const posts = JSON.parse(r.buffer.toString('utf8'));
  if (!Array.isArray(posts)) return null;
  const matches=posts.filter(p=>titleKey(p.title?.rendered)===expected);
  const links=[...new Set(matches.map(p=>p.link))];
  if (links.length!==1) return null;
  const target=new URL(links[0]);
  if(target.protocol!=='https:' || !['platum.kr','www.platum.kr'].includes(target.hostname) || target.username || target.password || target.port || !/^\/archives\/\d+\/?$/.test(target.pathname))return null;
  return target.href;
}
module.exports={titleKey,resolveFromPublisher};
