const { buildEntityDossier } = require('../lib/entity-dossier');
const { fetchLatestEntityNews } = require('../lib/entity-news');
const { buildOntology } = require('../lib/ontology');
const { mergeCuratedGpKnowledge } = require('../lib/curated-gp-knowledge');
const { mergeDriveDossiers, searchDriveDossiers, matchDossiersInText } = require('../lib/drive-dossiers');
const { getInstitutionBasicInfo } = require('../lib/institution-basic-data');
const { getInstitutionBasicOverride } = require('../lib/institution-basic-overrides');
const { getInstitutionBasicFinalOverride } = require('../lib/institution-basic-final-overrides');
const { getInstitutionBasicLatestOverride } = require('../lib/institution-basic-latest-overrides');
const { getInstitutionHomepageOverride } = require('../lib/institution-homepage-overrides');
const { getNuguMoneyProfile } = require('../lib/nugu-money');
const { loadRecentReportingLeads } = require('../lib/supabase');
const { createEntityService } = require('../lib/entity-service');

function applyBasicInfo(dossier) {
  const base = getInstitutionBasicInfo(dossier?.company_id, dossier?.entity?.canonical_name) || {};
  const override = getInstitutionBasicOverride(dossier?.company_id) || {};
  const finalOverride = getInstitutionBasicFinalOverride(dossier?.company_id) || {};
  const latestOverride = getInstitutionBasicLatestOverride(dossier?.company_id) || {};
  const homepageOverride = getInstitutionHomepageOverride(dossier?.company_id);
  const basic = { ...base, ...override, ...finalOverride, ...latestOverride };
  if (!Object.keys(basic).length && !homepageOverride) return dossier;
  const current = dossier.profile_overview || {};
  dossier.profile_overview = {
    ...current,
    category: basic.category || current.category,
    aliases: basic.aliases?.length ? basic.aliases : current.aliases,
    founded_year: basic.founded_year || current.founded_year,
    representatives: basic.representatives?.length ? basic.representatives : current.representatives,
    assets_under_management: basic.assets_under_management || current.assets_under_management,
    portfolio_count: basic.portfolio_count || current.portfolio_count,
    investment_count: basic.investment_count || current.investment_count || null,
    homepage: homepageOverride || basic.homepage || current.homepage || null,
    basis_date: basic.basis_date || current.basis_date,
    basic_source_url: basic.source_url || current.basic_source_url || null,
  };
  return dossier;
}

const service = createEntityService({
  loadRecentReportingLeads,
  buildGraph: (items) => mergeDriveDossiers(mergeCuratedGpKnowledge(buildOntology(items))),
  buildEntityDossier, applyBasicInfo, fetchLatestEntityNews, getNuguMoneyProfile,
});

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
  if (req.query.action === 'match') {
    const text = String(req.query.text || '').trim().slice(0, 2000);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '3', 10), 1), 6);
    if (!text) return res.status(200).json({ ok:true, items:[], count:0 });
    const items = matchDossiersInText(text, limit);
    return res.status(200).json({ ok:true, items, count:items.length });
  }
  const entityKey = String(req.query.entity_key || '').trim();
  if (!entityKey || entityKey.length > 120) return res.status(400).json({ ok:false, error:'확인할 기업·운용사·펀드·인물을 골라주세요.' });
  try {
    const action = String(req.query.action || 'full');
    let data;
    if (action === 'base') {
      data = await service.base(entityKey);
    } else if (action === 'news' || action === 'profile') {
      const dossier = await service.base(entityKey);
      if (!dossier) return res.status(404).json({ ok:false, error:'이 대상의 취재파일을 찾지 못했습니다.' });
      data = { ok: true, entity_key: entityKey, ...await service[action](entityKey, dossier) };
    } else {
      // Existing consumers keep receiving the complete dossier. New drawers
      // request the base and the two external providers independently.
      data = await service.full(entityKey);
    }
    if (!data) return res.status(404).json({ ok:false, error:'이 대상의 취재파일을 찾지 못했습니다.' });
    const incomplete = data.latest_news_ready === false || data.profile_ready === false || data.enrichment?.reporting_leads === 'unavailable';
    res.setHeader('Cache-Control', incomplete ? 'no-store' : action === 'base' ? 's-maxage=60, stale-while-revalidate=120' : 's-maxage=600, stale-while-revalidate=1200');
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ ok:false, error:String(error.message||error) });
  }
};
