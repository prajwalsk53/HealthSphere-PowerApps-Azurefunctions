// Client-side port of the backend's Wikipedia-based condition lookup. The REST
// summary endpoint sends permissive CORS headers by default; the action API
// needs `origin=*` to get them. Both are public and keyless.

export async function nhsCondition(condition) {
  const term = String(condition || '').trim();
  if (!term) return { error: 'Condition required' };

  const searchTerm = term.replace(/\s+allergy$/i, '').trim();

  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?${new URLSearchParams({
      action: 'query', list: 'search', srsearch: `${searchTerm} (medical condition)`,
      format: 'json', srlimit: '1', origin: '*',
    })}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    const hit = searchData?.query?.search?.[0];
    if (!hit) return { error: 'Information not found' };

    const title = hit.title;
    const summaryRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    const summaryData = await summaryRes.json();
    if (!summaryData?.extract) return { error: 'Information not found' };

    return {
      name: summaryData.title || title,
      summary: summaryData.extract,
      url: summaryData.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
      sections: [],
    };
  } catch (err) {
    return { error: err.message };
  }
}
