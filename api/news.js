const { collectReportingSignals } = require('../lib/reporting-signals');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  try {
    const days = Math.min(Math.max(parseInt(req.query.days || '7', 10), 1), 14);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '100', 10), 10), 200);
    const collected = await collectReportingSignals({ days });
    const items = (collected.items || [])
      .filter((item) => ['domestic_news', 'press_release'].includes(item.source_type))
      .sort((a, b) => String(b.published_at || '').localeCompare(String(a.published_at || '')))
      .slice(0, limit)
      .map((item) => ({
        signal_id: item.signal_id,
        published_at: item.published_at,
        source_type: item.source_type,
        source_name: item.source_name,
        title: item.title,
        source_url: item.source_url,
        snippet: item.snippet || '',
        target: item.target || null,
        event_type: item.event_type,
        event_label: item.event_label,
        related_count: item.related_count || 1,
        related_sources: item.related_sources || [],
      }));
    return res.status(200).json({ ok: true, items, count: items.length, providers: collected.providers, range: { days }, fetched_at: new Date().toISOString() });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error.message || error) });
  }
};
