const { app } = require('@azure/functions');
const axios = require('axios');

const NCBI = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

app.http('diseasesNlmSearch', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'bridge/diseases/nlm-search',
  handler: async (request) => {
    try {
      const q = request.query.get('q');
      const type = request.query.get('type');
      const slug = request.query.get('slug');
      const opts = { timeout: 12000 };

      if (type === 'detail') {
        const { data } = await axios.get(`${NCBI}/esummary.fcgi?db=medgen&id=${encodeURIComponent(slug)}&retmode=json`, opts);
        const uid = data.result?.uids?.[0];
        if (!uid) return { jsonBody: { error: 'Condition not found' } };
        const item = data.result[uid];
        const defs = Array.isArray(item.definitions)
          ? (item.definitions.find(d => d?.source === 'MSH') || item.definitions[0])
          : null;
        const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
        const aliases = Array.isArray(item.aliases) ? item.aliases : [];
        return {
          jsonBody: {
            name: str(item.title) || '',
            inheritance_label: null,
            genes: null,
            synonyms: aliases.slice(0, 4).map(a => typeof a === 'string' ? a : String(a)).join(', ') || null,
            symptoms: str(defs?.definition) || str(item.definition) || null,
            url: `https://www.ncbi.nlm.nih.gov/medgen/${uid}`,
            slug: String(uid),
          },
        };
      }

      if (!q) return { jsonBody: { results: [] } };
      const { data: sd } = await axios.get(`${NCBI}/esearch.fcgi?db=medgen&term=${encodeURIComponent(q)}+[Disease/Phenotype]&retmode=json&retmax=12`, opts);
      const ids = sd.esearchresult?.idlist || [];
      if (!ids.length) return { jsonBody: { results: [] } };

      const { data: sumd } = await axios.get(`${NCBI}/esummary.fcgi?db=medgen&id=${ids.join(',')}&retmode=json`, opts);
      const uids = sumd.result?.uids || [];
      const results = uids.map(uid => {
        const item = sumd.result[uid];
        const defs = item.definitions?.find(d => d.source === 'MSH') || item.definitions?.[0];
        return { name: item.title, snippet: defs?.definition?.slice(0, 150) || 'Click to load full details...', slug: uid };
      }).filter(r => r.name);

      return { jsonBody: { results } };
    } catch (err) {
      return { jsonBody: { error: 'MedlinePlus search failed: ' + err.message } };
    }
  },
});
