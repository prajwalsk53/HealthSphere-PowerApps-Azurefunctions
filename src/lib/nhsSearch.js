// Client-side port of the backend's NHS facility search — geocodes a postcode via
// Nominatim then queries Overpass for nearby hospitals/GPs/pharmacies. Both are public,
// keyless OSM APIs, so this can run entirely in the browser.

function toRad(d) {
  return d * Math.PI / 180;
}

export async function nhsSearch(postcode, type = 'all') {
  const trimmed = (postcode || '').trim();
  if (!trimmed) return { error: 'Postcode required' };

  const geoUrl = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({ q: `${trimmed}, UK`, format: 'json', limit: '1', countrycodes: 'gb' })}`;
  const geoRes = await fetch(geoUrl);
  const geoData = await geoRes.json();
  if (!geoData?.length) return { error: 'Postcode not found' };

  const lat = parseFloat(geoData[0].lat);
  const lng = parseFloat(geoData[0].lon);
  const radius = 5000;

  const typeFilters = {
    hospital: '["amenity"="hospital"]',
    gp: '["amenity"="doctors"]',
    pharmacy: '["amenity"="pharmacy"]',
  }[type] || '["amenity"~"hospital|doctors|pharmacy|clinic"]';

  const query = `[out:json][timeout:12];
(
  node${typeFilters}(around:${radius},${lat},${lng});
  way${typeFilters}(around:${radius},${lat},${lng});
  relation${typeFilters}(around:${radius},${lat},${lng});
);
out center tags;`;

  const overpassRes = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(query),
  });
  const overpassData = await overpassRes.json();
  if (!overpassData?.elements?.length) {
    return { results: [], center: { lat, lng } };
  }

  const results = [];
  for (const el of overpassData.elements) {
    const tags = el.tags || {};
    const name = tags.name || tags.operator || '';
    if (!name) continue;

    const elLat = el.lat ?? el.center?.lat;
    const elLng = el.lon ?? el.center?.lon;
    if (!elLat || !elLng) continue;

    const amenity = tags.amenity || 'other';
    const typeLabel = { hospital: 'hospital', doctors: 'gp', pharmacy: 'pharmacy', clinic: 'gp' }[amenity] || 'other';

    const R = 6371;
    const dLat = toRad(elLat - lat);
    const dLng = toRad(elLng - lng);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(elLat)) * Math.sin(dLng / 2) ** 2;
    const dist = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 100) / 100;

    const isNHS = !!(tags.operator && tags.operator.toLowerCase().includes('nhs'));

    results.push({
      name,
      type: typeLabel,
      subtype: tags.healthcare || tags.amenity || '',
      lat: elLat,
      lng: elLng,
      address: [tags['addr:housenumber'], tags['addr:street'], tags['addr:city'], tags['addr:postcode']].filter(Boolean).join(', '),
      phone: tags.phone || tags['contact:phone'] || '',
      hours: tags.opening_hours || '',
      website: tags.website || tags['contact:website'] || '',
      nhs: isNHS,
      distance: dist,
      operator: tags.operator || '',
    });
  }

  results.sort((a, b) => a.distance - b.distance);

  return {
    results: results.slice(0, 25),
    center: { lat, lng },
    postcode: trimmed.toUpperCase(),
    total: results.length,
  };
}
