const { buildEntityDossier } = require('../lib/entity-dossier');
const { buildOntology } = require('../lib/ontology');
const { mergeCuratedGpKnowledge } = require('../lib/curated-gp-knowledge');
const { mergeDriveDossiers, searchDriveDossiers } = require('../lib/drive-dossiers');
const { collectReportingSignals } = require('../lib/reporting-signals');
const { getNuguMoneyProfile } = require('../lib/nugu-money');
const { loadRecentReportingLeads, persistOntology, persistReportingLeads } = require('../lib/supabase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');
  if (req.query.action === 'search') {
    const query = String(req.query.q || '').trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit || '12', 10), 1), 30);
    if (!query) return res.status(200).json({ ok:true, items:[], count:0 });
    const items = searchDriveDossiers(query, limit);
    return res.status(200).json({ ok:true, items, count:items.length });
  }
  const entityKey = String(req.query.entity_key || '').trim();
  if (!entityKey || entityKey.length > 120) return res.status(400).json({ ok:false, error:'확인할 기업·운용사·펀드·인물을 골라주세요.' });
  try {
    // 취재파일을 열 때마다 외부 사이트를 다시 읽지 않고 저장된 최근 단서를 먼저 쓴다.
    let items = await loadRecentReportingLeads(14).catch(() => []);
    if (!items.length) {
      const collected = await collectReportingSignals({ days: 14 });
      items = collected.items || [];
      await persistReportingLeads(items).catch(()=>({ready:false}));
    }
    const graph = mergeDriveDossiers(mergeCuratedGpKnowledge(buildOntology(items)));
    const storage = await persistOntology(graph).catch(()=>({ready:false}));
    const dossier = buildEntityDossier(graph, entityKey);
    if (!dossier) return res.status(404).json({ ok:false, error:'이 대상의 취재파일을 찾지 못했습니다.' });

    let nuguMoney = null;
    if (['pef', 'vc', 'ac'].includes(dossier.entity?.entity_type)) {
      nuguMoney = await getNuguMoneyProfile(dossier.entity.canonical_name, { reviewLimit: 3 })
        .catch((error) => {
          console.error('[nugu-money] collection failed', {
            name: error?.name || 'Error',
            message: String(error?.message || error),
            cause: error?.cause?.code || error?.code || null,
          });
          return {
            ready: false,
            found: false,
            provider: '누구머니',
            source_url: 'https://nugu.money/',
            error: '현재 누구머니 정보를 불러오지 못했습니다.',
          };
        });
    }

    return res.status(200).json({ ok:true, ...dossier, nugu_money:nuguMoney, storage, range:{days:14}, fetched_at:new Date().toISOString() });
  } catch (error) {
    return res.status(500).json({ ok:false, error:String(error.message||error) });
  }
};
