import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const REGION_DATA = [
  { name: 'East Midlands',    lat: 52.6369, lng: -1.1398, risk: 'critical',  condition: 'Hypertension',    change: 34,  cases: 4821, color: '#DC2626', radius: 38 },
  { name: 'North West',       lat: 53.4808, lng: -2.2426, risk: 'critical',  condition: 'Type 2 Diabetes', change: 22,  cases: 6103, color: '#DC2626', radius: 42 },
  { name: 'North East',       lat: 54.9783, lng: -1.6178, risk: 'attention', condition: 'Obesity',         change: 18,  cases: 2987, color: '#D97706', radius: 30 },
  { name: 'Yorkshire',        lat: 53.8008, lng: -1.5491, risk: 'attention', condition: 'Mental Health',   change: 12,  cases: 3412, color: '#D97706', radius: 32 },
  { name: 'South East',       lat: 51.2787, lng: -0.5217, risk: 'attention', condition: 'Respiratory',     change: 10,  cases: 2190, color: '#D97706', radius: 35 },
  { name: 'West Midlands',    lat: 52.4862, lng: -1.8904, risk: 'attention', condition: 'Cardiovascular',  change: 8,   cases: 3750, color: '#D97706', radius: 33 },
  { name: 'London',           lat: 51.5074, lng: -0.1278, risk: 'healthy',   condition: 'Hypertension',    change: 2,   cases: 5210, color: '#16A34A', radius: 40 },
  { name: 'South West',       lat: 50.7772, lng: -3.9990, risk: 'healthy',   condition: 'Diabetes',        change: -3,  cases: 1820, color: '#16A34A', radius: 28 },
  { name: 'East of England',  lat: 52.2405, lng:  0.5050, risk: 'healthy',   condition: 'Obesity',         change: 1,   cases: 2100, color: '#16A34A', radius: 30 },
  { name: 'Wales',            lat: 52.1307, lng: -3.7837, risk: 'healthy',   condition: 'Diabetes',        change: -5,  cases: 1450, color: '#16A34A', radius: 25 },
  { name: 'Scotland',         lat: 56.4907, lng: -4.2026, risk: 'healthy',   condition: 'Obesity',         change: -8,  cases: 2340, color: '#16A34A', radius: 35 },
  { name: 'Northern Ireland', lat: 54.7877, lng: -6.4923, risk: 'healthy',   condition: 'Hypertension',    change: -2,  cases: 890,  color: '#16A34A', radius: 22 },
];

const HEAT_DATA = [
  [52.6369,-1.1398,0.95],[53.4808,-2.2426,0.88],[54.9783,-1.6178,0.72],
  [53.8008,-1.5491,0.68],[51.5074,-0.1278,0.45],[52.4862,-1.8904,0.65],
  [51.2787,-0.5217,0.58],[50.7772,-3.999,0.38], [52.2405, 0.505,0.42],
  [52.1307,-3.7837,0.35],[56.4907,-4.2026,0.32],[54.7877,-6.4923,0.28],
  [52.6200,-1.1200,0.85],[52.6500,-1.1500,0.78],[53.5000,-2.3000,0.82],
  [53.4500,-2.1000,0.75],[52.6300,-1.1600,0.90],[52.6100,-1.1000,0.70],
];

const HOSPITALS = [
  { name: 'Leicester Royal Infirmary',      lat: 52.6362, lng: -1.1388, type: 'Major A&E' },
  { name: 'Manchester Royal Infirmary',      lat: 53.4763, lng: -2.2355, type: 'Major A&E' },
  { name: 'Newcastle RVI',                   lat: 54.9793, lng: -1.6210, type: 'Major A&E' },
  { name: 'Leeds General Infirmary',         lat: 53.8008, lng: -1.5517, type: 'Major A&E' },
  { name: 'University Hospital Birmingham',  lat: 52.4490, lng: -1.9397, type: 'Major A&E' },
  { name: 'Kings College Hospital',          lat: 51.4679, lng: -0.0927, type: 'Major A&E' },
  { name: 'Southmead Hospital Bristol',      lat: 51.4989, lng: -2.5937, type: 'Major A&E' },
  { name: 'Edinburgh Royal Infirmary',       lat: 55.9228, lng: -3.1684, type: 'Major A&E' },
  { name: 'Cardiff University Hospital',     lat: 51.4816, lng: -3.2005, type: 'Major A&E' },
];

const CONDITIONS = ['All Conditions', 'Hypertension', 'Type 2 Diabetes', 'Obesity', 'Mental Health', 'Respiratory', 'Cardiovascular'];

export default function GovMap() {
  const navigate = useNavigate();
  const mapRef        = useRef(null);
  const heatLayerRef  = useRef(null);
  const hospLayerRef  = useRef(null);
  const regionLayersRef = useRef([]);
  const mapElRef      = useRef(null);

  const [heatOn,  setHeatOn]  = useState(false);
  const [hospOn,  setHospOn]  = useState(false);
  const [filter,  setFilter]  = useState('All Conditions');
  const [ready,   setReady]   = useState(false);

  useEffect(() => {
    const onClick = (e) => {
      const link = e.target.closest('.map-nav-link');
      if (!link) return;
      e.preventDefault();
      navigate(link.dataset.nav);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [navigate]);

  /* ── Load Leaflet + plugins via CDN, then init ── */
  useEffect(() => {
    const addCSS = (href) => {
      if (document.querySelector(`link[href="${href}"]`)) return;
      const l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = href;
      document.head.appendChild(l);
    };
    const loadScript = (src) => new Promise((res) => {
      if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
      const s = document.createElement('script');
      s.src = src; s.onload = res; document.head.appendChild(s);
    });

    addCSS('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
    addCSS('https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css');
    addCSS('https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css');

    loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js')
      .then(() => loadScript('https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js'))
      .then(() => loadScript('https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js'))
      .then(() => {
        const el = mapElRef.current;
        if (!el || el._leaflet_id) return;
        const L = window.L;

        const map = L.map(el, { center: [54.0, -2.5], zoom: 6, zoomControl: true });
        mapRef.current = map;

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; OpenStreetMap &copy; CartoDB', maxZoom: 18,
        }).addTo(map);

        // Region circles + labels
        const layers = REGION_DATA.map(r => {
          const circle = L.circleMarker([r.lat, r.lng], {
            radius: r.radius, color: '#fff', weight: 2,
            fillColor: r.color, fillOpacity: 0.75,
          });
          circle.bindPopup(buildPopup(r), { closeButton: false, maxWidth: 280 });
          circle.addTo(map);

          const labelIcon = L.divIcon({
            html: `<div style="font-family:Inter,sans-serif;font-size:11px;font-weight:700;color:${r.color};white-space:nowrap;text-shadow:0 0 5px #fff,0 0 5px #fff,0 0 5px #fff;">${r.name}</div>`,
            className: '', iconAnchor: [0, 0],
          });
          L.marker([r.lat - 0.45, r.lng], { icon: labelIcon }).addTo(map);
          return circle;
        });
        regionLayersRef.current = layers;

        // Heat layer (off by default)
        heatLayerRef.current = L.heatLayer(
          HEAT_DATA.map(d => [d[0], d[1], d[2]]),
          { radius: 50, blur: 35, maxZoom: 10, gradient: { 0.1: '#1565C0', 0.4: '#00B4D8', 0.65: '#D97706', 1.0: '#DC2626' } }
        );

        // Hospital cluster (off by default)
        const cluster = L.markerClusterGroup({ maxClusterRadius: 30 });
        HOSPITALS.forEach(h => {
          const icon = L.divIcon({
            html: `<div style="background:#0A1F44;color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3);">🏥</div>`,
            className: '', iconSize: [28, 28], iconAnchor: [14, 14],
          });
          const m = L.marker([h.lat, h.lng], { icon });
          m.bindPopup(`<div style="font-family:Inter,sans-serif;padding:12px 14px;min-width:200px;"><strong style="font-size:14px;color:#0A1F44;">${h.name}</strong><br><small style="color:#5E7A99;">${h.type}</small></div>`, { closeButton: false });
          cluster.addLayer(m);
        });
        hospLayerRef.current = cluster;

        setReady(true);
      });

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  /* ── Toggle heatmap ── */
  useEffect(() => {
    if (!ready || !heatLayerRef.current || !mapRef.current) return;
    if (heatOn) heatLayerRef.current.addTo(mapRef.current);
    else heatLayerRef.current.remove();
  }, [heatOn, ready]);

  /* ── Toggle hospitals ── */
  useEffect(() => {
    if (!ready || !hospLayerRef.current || !mapRef.current) return;
    if (hospOn) hospLayerRef.current.addTo(mapRef.current);
    else hospLayerRef.current.remove();
  }, [hospOn, ready]);

  /* ── Condition filter ── */
  useEffect(() => {
    if (!ready) return;
    const cond = filter === 'All Conditions' ? '' : filter.toLowerCase();
    regionLayersRef.current.forEach((layer, i) => {
      const r = REGION_DATA[i];
      layer.setStyle({ fillOpacity: (!cond || r.condition.toLowerCase().includes(cond)) ? 0.75 : 0.08 });
    });
  }, [filter, ready]);

  const flyTo = (lat, lng) => {
    if (mapRef.current) mapRef.current.flyTo([lat, lng], 9, { duration: 1.4 });
  };

  return (
    <div style={{ margin: '-24px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>
      {/* Controls bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 20px', background: '#fff', borderBottom: '1px solid var(--border)',
        flexShrink: 0, flexWrap: 'wrap', gap: 8,
      }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          <i className="fas fa-map-marked-alt" style={{ color: '#1565C0', marginRight: 6 }}></i>
          Regional Health Risk Map — UK &nbsp;·&nbsp; Anonymised DHSC Data
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            className={`btn btn-sm ${heatOn ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setHeatOn(v => !v)}
          >
            <i className="fas fa-fire" style={{ marginRight: 6 }}></i>
            {heatOn ? 'Hide Disease Heatmap' : 'Show Disease Heatmap'}
          </button>
          <button
            className={`btn btn-sm ${hospOn ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setHospOn(v => !v)}
          >
            <i className="fas fa-hospital" style={{ marginRight: 6 }}></i>
            {hospOn ? 'Hide Hospitals' : 'Show Hospitals'}
          </button>
          <button className="btn btn-sm btn-primary">
            <i className="fas fa-file-alt" style={{ marginRight: 6 }}></i>Draft Policy Brief
          </button>
        </div>
      </div>

      {/* Split: side panel + map */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Side Panel ── */}
        <div style={{
          width: 300, flexShrink: 0, background: '#fff',
          borderRight: '1px solid var(--border)', overflowY: 'auto',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Legend */}
          <div style={{ padding: 16, borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--text-muted)', marginBottom: 10 }}>
              Risk Level Legend
            </div>
            {[
              { color: '#DC2626', label: 'Critical — >20% above average' },
              { color: '#D97706', label: 'Attention — 5–20% above' },
              { color: '#16A34A', label: 'Healthy — Within range' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 12 }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: l.color, flexShrink: 0 }}></span>
                {l.label}
              </div>
            ))}
          </div>

          {/* Condition filter */}
          <div style={{ padding: 16, borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--text-muted)', marginBottom: 8 }}>
              Filter by Condition
            </div>
            <select
              className="form-control"
              style={{ fontSize: 12 }}
              value={filter}
              onChange={e => setFilter(e.target.value)}
            >
              {CONDITIONS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          {/* Region list */}
          <div style={{ padding: '14px 14px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--text-muted)', marginBottom: 10 }}>
              All Regions
            </div>
          </div>
          <div style={{ padding: '0 12px 12px', overflowY: 'auto' }}>
            {REGION_DATA.map(r => {
              const arrow = r.change > 0 ? '↑' : '↓';
              const ac = r.change > 15 ? '#DC2626' : r.change > 4 ? '#D97706' : '#16A34A';
              const dimmed = filter !== 'All Conditions' && !r.condition.toLowerCase().includes(filter.toLowerCase());
              return (
                <div
                  key={r.name}
                  onClick={() => flyTo(r.lat, r.lng)}
                  style={{
                    padding: '10px 12px', borderRadius: 8, marginBottom: 8, cursor: 'pointer',
                    border: '1px solid var(--border)', borderLeft: `4px solid ${r.color}`,
                    background: '#fff', opacity: dimmed ? 0.35 : 1,
                    transition: 'all .15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateX(4px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.12)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--primary)' }}>{r.name}</div>
                      <div style={{ fontSize: 11, color: r.color, fontWeight: 600 }}>{r.condition}</div>
                    </div>
                    <span style={{ color: ac, fontWeight: 900, fontSize: 14 }}>{arrow} {Math.abs(r.change)}%</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.cases.toLocaleString()} cases</span>
                    <span style={{ background: `${r.color}22`, color: r.color, padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700 }}>
                      {r.risk.charAt(0).toUpperCase() + r.risk.slice(1)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Map ── */}
        <div style={{ flex: 1, position: 'relative' }}>
          <div ref={mapElRef} style={{ width: '100%', height: '100%' }} />
          {!ready && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8faff', zIndex: 10 }}>
              <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3, margin: '0 auto 12px' }} />
                <div>Loading map…</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function buildPopup(r) {
  const arrow   = r.change > 0 ? '↑' : '↓';
  const urgency = r.risk === 'critical'
    ? '🚨 Requires immediate policy action'
    : r.risk === 'attention'
    ? '⚠️ Under monitoring'
    : '✅ Within safe range';
  return `
    <div style="font-family:Inter,sans-serif;border-radius:12px;overflow:hidden;min-width:240px;">
      <div style="background:${r.color};color:#fff;padding:14px 16px;">
        <div style="font-size:16px;font-weight:800;">${r.name}</div>
        <div style="font-size:12px;opacity:.85;">${r.condition} · ${r.risk.toUpperCase()}</div>
      </div>
      <div style="padding:14px 16px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
          <div>
            <div style="font-size:26px;font-weight:900;color:${r.color};">${arrow} ${Math.abs(r.change)}%</div>
            <div style="font-size:11px;color:#5E7A99;">vs national average</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:20px;font-weight:800;color:#0A1F44;">${r.cases.toLocaleString()}</div>
            <div style="font-size:11px;color:#5E7A99;">new cases</div>
          </div>
        </div>
        <div style="font-size:12px;color:#5E7A99;padding:8px;background:#F8FAFF;border-radius:6px;">${urgency}</div>
        <div style="display:flex;gap:8px;margin-top:10px;">
          <a href="#" class="map-nav-link" data-nav="/government/alerts" style="flex:1;text-align:center;background:${r.color};color:#fff;padding:7px;border-radius:6px;font-size:12px;font-weight:700;text-decoration:none;display:block;">View Alert</a>
          <span style="padding:7px 12px;border:1px solid #E2E8F0;border-radius:6px;font-size:12px;font-weight:600;color:#0A1F44;cursor:pointer;">Draft Policy</span>
        </div>
      </div>
    </div>`;
}
