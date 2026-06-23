const { app } = require('@azure/functions');
const axios = require('axios');

function stripTags(s) {
  return (s || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ');
}

app.http('aiNhsMedicine', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'bridge/ai/nhs-medicine',
  handler: async (request) => {
    try {
      const drug = String(request.query.get('drug') || '').trim();
      if (!drug) return { jsonBody: { error: 'No drug name provided' } };

      const slug = drug.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '');
      const url = `https://www.nhs.uk/medicines/${slug}/`;

      const { data: html, status } = await axios.get(url, {
        timeout: 8000, validateStatus: () => true,
        headers: { 'User-Agent': 'HealthSphere/1.0' },
      });

      if (status === 404 || !html) {
        return { jsonBody: { error: `'${drug}' not found. Try searching by generic name (e.g. 'ibuprofen' instead of 'Nurofen').` } };
      }

      const metaM = html.match(/<meta[^>]+name=["']description["'][^>]+content=["'](.*?)["']/i);
      const description = (metaM?.[1] || '').replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/&quot;/g, '"');

      const sections = [];
      const sectionRe = /<h2[^>]*>(.*?)<\/h2>([\s\S]*?)(?=<h2|<\/article|$)/gi;
      let m, count = 0;
      while ((m = sectionRe.exec(html)) && count < 8) {
        const heading = stripTags(m[1]);
        const pMatches = [...m[2].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].slice(0, 3).map(p => stripTags(p[1]));
        const content = pMatches.join(' ').replace(/\s+/g, ' ').trim();
        if (heading.length > 2 && content.length > 30) { sections.push({ heading, content: content.slice(0, 450) }); count++; }
      }

      const titleM = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
      const name = stripTags(titleM?.[1] || slug.replace(/-/g, ' '));

      return { jsonBody: { source: 'nhs_scrape', name, description: description.slice(0, 400), url, sections } };
    } catch {
      return { jsonBody: { error: 'Failed to reach NHS medicines database.' } };
    }
  },
});
