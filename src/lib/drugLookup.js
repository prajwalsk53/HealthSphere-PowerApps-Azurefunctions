// Client-side port of the backend's OpenFDA drug lookup proxy. OpenFDA is
// public, keyless, and sends permissive CORS headers, so this can call the
// API directly from the browser — no bridge needed.

function truncate(s, n = 500) {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n) + '…' : t;
}

async function fetchFda(url, params) {
  try {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${url}?${qs}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function drugLookup(q, type = 'label') {
  const term = String(q || '').replace(/[^\w\s-]/g, '').trim();
  if (!term) return { error: 'No drug name provided' };
  const enc = `"${term}"`;

  if (type === 'recall') {
    let data = await fetchFda('https://api.fda.gov/drug/recall.json', { search: `product_description:${enc}`, limit: 5 });
    if (!data?.results?.length) data = await fetchFda('https://api.fda.gov/drug/recall.json', { search: `product_description:${term}`, limit: 5 });
    const recalls = (data?.results || []).map(r => ({
      date: (r.report_date || '').slice(0, 8),
      reason: r.reason_for_recall || '',
      status: r.status || '',
      product: r.product_description || '',
      classification: r.classification || '',
    }));
    return { type: 'recall', drug: term, recalls, count: recalls.length };
  }

  let data = await fetchFda('https://api.fda.gov/drug/label.json', { search: `(openfda.brand_name:${enc}+openfda.generic_name:${enc})`, limit: 1 });
  if (!data?.results?.length) data = await fetchFda('https://api.fda.gov/drug/label.json', { search: term, limit: 1 });
  const r = data?.results?.[0];
  if (!r) return { error: `No FDA label found for "${term}". Try the generic or brand name.` };

  const openfda = r.openfda || {};
  const field = (key, max = 500) => r[key]?.length ? truncate(r[key].join(' '), max) : null;

  return {
    type: 'label',
    drug: term,
    brand_name: openfda.brand_name?.[0] || null,
    generic_name: openfda.generic_name?.[0] || null,
    manufacturer: openfda.manufacturer_name?.[0] || null,
    route: openfda.route?.[0] || null,
    indications: field('indications_and_usage'),
    warnings: field('warnings', 400),
    adverse_reactions: field('adverse_reactions', 400),
    dosage: field('dosage_and_administration', 300),
    drug_interactions: field('drug_interactions', 400),
    contraindications: field('contraindications', 400),
    purpose: field('purpose', 200),
  };
}
