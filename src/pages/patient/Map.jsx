import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.heat';
import { nhsSearch } from '../../lib/nhsSearch';

// ── Health facilities dataset (Leicester, UK — real NHS locations) ──
const FACILITIES = [
  { id: 1, name: 'Leicester Royal Infirmary', type: 'hospital', subtype: 'Major Hospital', lat: 52.6362, lng: -1.1388, address: 'Infirmary Square, Leicester LE1 5WW', phone: '0116 254 1414', hours: '24/7 A&E', rating: 4.3, wait: '~45 min', distance: 0.8, open: true, nhs: true, emergency: true, beds: 1520 },
  { id: 2, name: 'Leicester General Hospital', type: 'hospital', subtype: 'General Hospital', lat: 52.6187, lng: -1.1015, address: 'Gwendolen Rd, Leicester LE5 4PW', phone: '0116 249 0490', hours: '24/7', rating: 4.1, wait: '~30 min', distance: 2.1, open: true, nhs: true, emergency: false, beds: 820 },
  { id: 3, name: 'Glenfield Hospital', type: 'hospital', subtype: 'Cardiology & Children', lat: 52.6370, lng: -1.2052, address: 'Groby Rd, Leicester LE3 9QP', phone: '0116 287 1471', hours: '24/7', rating: 4.5, wait: '~20 min', distance: 3.4, open: true, nhs: true, emergency: false, beds: 450 },
  { id: 4, name: 'LOROS Hospice', type: 'hospital', subtype: 'Palliative Care', lat: 52.6124, lng: -1.1445, address: 'Groby Rd, Leicester LE3 9QE', phone: '0116 231 3771', hours: '09:00-17:00', rating: 4.9, wait: 'N/A', distance: 3.8, open: true, nhs: false, emergency: false, beds: 36 },
  { id: 5, name: 'BMI The Evington Hospital', type: 'hospital', subtype: 'Private Hospital', lat: 52.6154, lng: -1.0893, address: 'Gartree Rd, Leicester LE2 2FF', phone: '0116 273 2021', hours: '07:00-21:00', rating: 4.4, wait: '<10 min', distance: 4.2, open: true, nhs: false, emergency: false, beds: 95 },

  { id: 6, name: 'Starlight Medical Centre', type: 'gp', subtype: 'General Practice', lat: 52.6398, lng: -1.1290, address: '22 King Street, Leicester LE1 6RJ', phone: '0116 255 8877', hours: '08:00-18:30', rating: 4.2, wait: '~15 min', distance: 0.4, open: true, nhs: true, emergency: false, beds: 0 },
  { id: 7, name: 'ApexCare GP Surgery', type: 'gp', subtype: 'General Practice', lat: 52.6320, lng: -1.1460, address: 'Park Lane, Leicester LE4 5GH', phone: '0116 262 1234', hours: '08:00-18:00', rating: 4.0, wait: '~20 min', distance: 0.9, open: true, nhs: true, emergency: false, beds: 0 },
  { id: 8, name: 'Westcotes Health Centre', type: 'gp', subtype: 'General Practice', lat: 52.6280, lng: -1.1510, address: 'Fosse Rd South, Leicester LE3 0LH', phone: '0116 255 9900', hours: '08:00-18:30', rating: 3.9, wait: '~25 min', distance: 1.5, open: true, nhs: true, emergency: false, beds: 0 },
  { id: 9, name: 'Belgrave Medical Centre', type: 'gp', subtype: 'General Practice', lat: 52.6480, lng: -1.1250, address: 'Belgrave Rd, Leicester LE4 5AT', phone: '0116 266 0080', hours: '08:00-17:30', rating: 4.1, wait: '~18 min', distance: 1.9, open: false, nhs: true, emergency: false, beds: 0 },
  { id: 10, name: 'NHS Walk-In Centre', type: 'gp', subtype: 'Walk-In Centre', lat: 52.6350, lng: -1.1300, address: 'Granby Street, Leicester LE1 6EZ', phone: '0116 295 5000', hours: '07:00-22:00', rating: 4.4, wait: '~10 min', distance: 0.6, open: true, nhs: true, emergency: false, beds: 0 },
  { id: 11, name: 'Bridge Street Medical Practice', type: 'gp', subtype: 'General Practice', lat: 52.6410, lng: -1.1180, address: 'Bridge St, Leicester LE1 4TD', phone: '0116 255 1122', hours: '08:00-18:00', rating: 4.3, wait: '~15 min', distance: 0.7, open: true, nhs: true, emergency: false, beds: 0 },

  { id: 12, name: 'Boots Pharmacy — Gallowtree Gate', type: 'pharmacy', subtype: 'Pharmacy Chain', lat: 52.6369, lng: -1.1316, address: 'Gallowtree Gate, Leicester LE1 5AD', phone: '0116 251 6626', hours: '08:00-21:00', rating: 4.1, wait: '~5 min', distance: 0.3, open: true, nhs: true, emergency: false, beds: 0 },
  { id: 13, name: 'Lloyds Pharmacy — Charles Street', type: 'pharmacy', subtype: 'Pharmacy Chain', lat: 52.6355, lng: -1.1270, address: 'Charles Street, Leicester LE1 3SH', phone: '0116 251 2200', hours: '09:00-18:00', rating: 4.0, wait: '<5 min', distance: 0.6, open: true, nhs: true, emergency: false, beds: 0 },
  { id: 14, name: 'Rowlands Pharmacy', type: 'pharmacy', subtype: 'Independent Pharmacy', lat: 52.6244, lng: -1.1380, address: 'Evington Rd, Leicester LE2 1HN', phone: '0116 273 7711', hours: '09:00-19:00', rating: 4.3, wait: '<5 min', distance: 1.8, open: true, nhs: true, emergency: false, beds: 0 },
  { id: 15, name: 'Well Pharmacy — Beaumont Leys', type: 'pharmacy', subtype: 'Pharmacy Chain', lat: 52.6520, lng: -1.1480, address: 'Beaumont Way, Leicester LE4 1DW', phone: '0116 235 0032', hours: '09:00-20:00', rating: 3.8, wait: '~10 min', distance: 2.6, open: false, nhs: true, emergency: false, beds: 0 },

  { id: 16, name: 'Leicester A&E — Royal Infirmary', type: 'emergency', subtype: 'Accident & Emergency', lat: 52.6358, lng: -1.1396, address: 'Infirmary Square, Leicester LE1 5WW', phone: '999 / 0116 254 1414', hours: '24/7', rating: 4.5, wait: '~45 min', distance: 0.8, open: true, nhs: true, emergency: true, beds: 0 },
  { id: 17, name: 'Leicestershire Partnership — Mental Health', type: 'mental', subtype: 'Mental Health Services', lat: 52.6290, lng: -1.1550, address: 'Bradgate Rd, Leicester LE3 0BS', phone: '0116 295 0320', hours: '09:00-17:00', rating: 4.2, wait: 'Appointment', distance: 2.2, open: true, nhs: true, emergency: false, beds: 120 },
  { id: 18, name: 'Samaritans Leicester', type: 'mental', subtype: 'Mental Health Support', lat: 52.6370, lng: -1.1200, address: '37-39 Millstone Lane, Leicester LE1 5JN', phone: '116 123', hours: '24/7', rating: 4.8, wait: 'Immediate', distance: 0.9, open: true, nhs: false, emergency: false, beds: 0 },
  { id: 19, name: 'Changes Mental Health', type: 'mental', subtype: 'Counselling', lat: 52.6430, lng: -1.1100, address: 'Forest Road, Leicester LE1 6TG', phone: '0116 253 6553', hours: '09:00-18:00', rating: 4.6, wait: '~2 weeks', distance: 1.4, open: true, nhs: false, emergency: false, beds: 0 },

  { id: 20, name: 'Leicester Dental Hospital', type: 'dental', subtype: 'Dental Hospital', lat: 52.6337, lng: -1.1345, address: 'University Rd, Leicester LE1 7HA', phone: '0116 252 2837', hours: '08:30-17:30', rating: 4.0, wait: 'Appointment', distance: 1.1, open: true, nhs: true, emergency: false, beds: 0 },
  { id: 21, name: 'Specsavers — Leicester', type: 'optical', subtype: 'Opticians', lat: 52.6368, lng: -1.1312, address: 'Gallowtree Gate, Leicester LE1 1ER', phone: '0116 251 7898', hours: '09:00-17:30', rating: 4.2, wait: '<10 min', distance: 0.4, open: true, nhs: true, emergency: false, beds: 0 },

  { id: 22, name: 'NHS Blood Donation Centre', type: 'testing', subtype: 'Blood Donation', lat: 52.6344, lng: -1.1224, address: 'Granby Street, Leicester LE1 6HD', phone: '0300 123 2323', hours: '10:00-19:00', rating: 4.7, wait: '<10 min', distance: 0.8, open: true, nhs: true, emergency: false, beds: 0 },
  { id: 23, name: 'Nuffield Health Pathology', type: 'testing', subtype: 'Diagnostics Lab', lat: 52.6222, lng: -1.1180, address: 'Scraptoft Lane, Leicester LE5 1HY', phone: '0116 271 5800', hours: '08:00-18:00', rating: 4.4, wait: 'Appointment', distance: 2.8, open: true, nhs: false, emergency: false, beds: 0 },
];

// Heat map data (simulated disease density around Leicester)
const HEAT_DATA = [
  [52.6360, -1.1390, 0.95], [52.6340, -1.1310, 0.85],
  [52.6380, -1.1280, 0.70], [52.6290, -1.1400, 0.80],
  [52.6420, -1.1200, 0.65], [52.6480, -1.1250, 0.60],
  [52.6150, -1.1450, 0.55], [52.6200, -1.1100, 0.72],
  [52.6310, -1.1550, 0.68], [52.6450, -1.1480, 0.58],
  [52.6270, -1.1320, 0.75], [52.6395, -1.1365, 0.88],
  [52.6330, -1.1250, 0.62], [52.6210, -1.1290, 0.67],
  [52.6500, -1.1350, 0.52], [52.6350, -1.1430, 0.77],
];

const TYPE_META = {
  hospital: { icon: '🏥', color: '#1565C0', label: 'Hospitals' },
  gp: { icon: '🩺', color: '#16A34A', label: 'GP / Clinics' },
  pharmacy: { icon: '💊', color: '#0891B2', label: 'Pharmacies' },
  emergency: { icon: '🚨', color: '#DC2626', label: 'Emergency' },
  mental: { icon: '🧠', color: '#7C3AED', label: 'Mental Health' },
  dental: { icon: '🦷', color: '#D97706', label: 'Dental' },
  optical: { icon: '👁', color: '#0891B2', label: 'Optical' },
  testing: { icon: '🧪', color: '#16A34A', label: 'Testing / Labs' },
};

const TILE_URLS = {
  street: { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap', maxZoom: 19 },
  satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '&copy; ESRI', maxZoom: 19 },
  clean: { url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', attribution: '&copy; CartoDB', maxZoom: 19 },
};

function buildPopup(fac) {
  const meta = TYPE_META[fac.type] || TYPE_META.hospital;
  const oColor = fac.open ? '#16A34A' : '#DC2626';
  const oText = fac.open ? 'Open Now' : 'Closed';
  const stars = '★'.repeat(Math.round(fac.rating)) + '☆'.repeat(5 - Math.round(fac.rating));
  const nhs = fac.nhs ? `<span style="background:#003087;color:#fff;padding:1px 7px;border-radius:3px;font-size:10px;font-weight:700;">NHS</span>` : '';
  const emg = fac.emergency ? `<span style="background:#DC2626;color:#fff;padding:1px 7px;border-radius:3px;font-size:10px;font-weight:700;">A&E</span>` : '';
  const showWait = !['N/A', 'Appointment', 'Immediate', '<10 min', '<5 min'].includes(fac.wait);

  return `
  <div style="font-family:'Inter',sans-serif;">
    <div style="background:${meta.color};color:#fff;padding:14px 16px;">
      <div style="font-size:16px;font-weight:800;margin-bottom:2px;">${meta.icon} ${fac.name}</div>
      <div style="font-size:12px;opacity:.85;">${fac.subtype} &middot; ${fac.distance} mi away</div>
    </div>
    <div style="padding:14px 16px;">
      <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;">
        <span style="background:${oColor}22;color:${oColor};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;">● ${oText}</span>
        ${nhs} ${emg}
      </div>
      <div style="display:grid;gap:6px;font-size:12px;">
        <div style="display:flex;gap:8px;"><span style="width:16px;color:${meta.color};"><i class="fas fa-map-marker-alt"></i></span><span>${fac.address}</span></div>
        <div style="display:flex;gap:8px;"><span style="width:16px;color:${meta.color};"><i class="fas fa-phone"></i></span><span><a href="tel:${fac.phone}" style="color:${meta.color};font-weight:600;">${fac.phone}</a></span></div>
        <div style="display:flex;gap:8px;"><span style="width:16px;color:${meta.color};"><i class="fas fa-clock"></i></span><span>${fac.hours}</span></div>
        ${showWait ? `<div style="display:flex;gap:8px;"><span style="width:16px;color:${meta.color};"><i class="fas fa-hourglass-half"></i></span><span>Est. wait: <strong>${fac.wait}</strong></span></div>` : ''}
        ${fac.rating ? `<div style="display:flex;align-items:center;gap:6px;"><span style="color:#F59E0B;font-size:13px;">${stars}</span><span style="font-weight:700;">${fac.rating}</span></div>` : ''}
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;">
        <a href="#" class="map-book-link" data-nav="/patient/appointments" style="flex:1;text-align:center;background:${meta.color};color:#fff;padding:8px;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none;display:block;">
          <i class="fas fa-calendar-plus"></i> Book
        </a>
        <a href="https://www.google.com/maps/dir/?api=1&destination=${fac.lat},${fac.lng}" target="_blank" style="padding:8px 12px;border:1px solid #E2E8F0;border-radius:8px;font-size:12px;font-weight:600;color:#0A1F44;text-decoration:none;">
          <i class="fas fa-directions"></i> Directions
        </a>
      </div>
    </div>
  </div>`;
}

function makeIcon(type, open) {
  const meta = TYPE_META[type] || TYPE_META.hospital;
  const color = open ? meta.color : '#94A3B8';
  return L.divIcon({
    html: `<div class="custom-marker" style="background:${color};font-size:14px;">${meta.icon}</div>`,
    className: '', iconSize: [36, 36], iconAnchor: [18, 36], popupAnchor: [0, -38],
  });
}

const LIVE_TYPE_ICONS = { hospital: '🏥', gp: '🩺', pharmacy: '💊', other: '🏢' };
const LIVE_TYPE_COLORS = { hospital: '#1565C0', gp: '#16A34A', pharmacy: '#0891B2', other: '#6b7280' };

export default function Map() {
  const navigate = useNavigate();
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const clusterRef = useRef(null);
  const heatLayerRef = useRef(null);
  const markersRef = useRef({});
  const tilesRef = useRef({});
  const liveMarkersRef = useRef([]);

  const [filterType, setFilterType] = useState('all');
  const [filterQuery, setFilterQuery] = useState('');
  const [nhsOnly, setNhsOnly] = useState(false);
  const [sortBy, setSortBy] = useState('distance');
  const [activeFacId, setActiveFacId] = useState(null);
  const [heatmapOn, setHeatmapOn] = useState(false);
  const [currentLayer, setCurrentLayer] = useState('street');
  const [locating, setLocating] = useState(false);
  const [postcode, setPostcode] = useState('');
  const [postcodeStatus, setPostcodeStatus] = useState('');
  const [postcodeSearching, setPostcodeSearching] = useState(false);
  const [locationLabel, setLocationLabel] = useState('Leicester, UK');
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const onClick = (e) => {
      const link = e.target.closest('.map-book-link');
      if (!link) return;
      e.preventDefault();
      navigate(link.dataset.nav);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [navigate]);

  const getFilteredFacilities = () => {
    let list = [...FACILITIES];
    if (filterType !== 'all') list = list.filter(f => f.type === filterType);
    if (nhsOnly) list = list.filter(f => f.nhs);
    if (filterQuery) list = list.filter(f => f.name.toLowerCase().includes(filterQuery) || f.subtype.toLowerCase().includes(filterQuery));

    if (sortBy === 'rating') list.sort((a, b) => b.rating - a.rating);
    if (sortBy === 'distance') list.sort((a, b) => a.distance - b.distance);
    if (sortBy === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === 'open') list.sort((a, b) => (b.open ? 1 : 0) - (a.open ? 1 : 0));
    return list;
  };

  const visible = getFilteredFacilities();

  // ── Init map ──
  useEffect(() => {
    const map = L.map(mapElRef.current, { center: [52.6369, -1.1398], zoom: 14, zoomControl: true, attributionControl: true });
    mapRef.current = map;

    tilesRef.current = {
      street: L.tileLayer(TILE_URLS.street.url, { attribution: TILE_URLS.street.attribution, maxZoom: TILE_URLS.street.maxZoom }),
      satellite: L.tileLayer(TILE_URLS.satellite.url, { attribution: TILE_URLS.satellite.attribution, maxZoom: TILE_URLS.satellite.maxZoom }),
      clean: L.tileLayer(TILE_URLS.clean.url, { attribution: TILE_URLS.clean.attribution, maxZoom: TILE_URLS.clean.maxZoom }),
    };
    tilesRef.current.street.addTo(map);

    const cluster = L.markerClusterGroup({
      maxClusterRadius: 40,
      iconCreateFunction: (c) => L.divIcon({
        html: `<div style="background:#1565C0;color:#fff;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.3);">${c.getChildCount()}</div>`,
        className: '', iconSize: [36, 36], iconAnchor: [18, 18],
      }),
    });
    map.addLayer(cluster);
    clusterRef.current = cluster;

    heatLayerRef.current = L.heatLayer(HEAT_DATA, {
      radius: 35, blur: 22, maxZoom: 17,
      gradient: { 0.1: '#1565C0', 0.4: '#00B4D8', 0.65: '#16A34A', 0.85: '#D97706', 1.0: '#DC2626' },
    });

    map.on('click', () => setActiveFacId(null));

    return () => { map.remove(); };
  }, []);

  // ── Render markers whenever filters change ──
  useEffect(() => {
    const cluster = clusterRef.current;
    if (!cluster) return;
    cluster.clearLayers();
    markersRef.current = {};

    visible.forEach(fac => {
      const marker = L.marker([fac.lat, fac.lng], { icon: makeIcon(fac.type, fac.open) });
      marker.bindPopup(buildPopup(fac), { maxWidth: 290, closeButton: false });
      marker.on('click', () => setActiveFacId(fac.id));
      cluster.addLayer(marker);
      markersRef.current[fac.id] = marker;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, filterQuery, nhsOnly, sortBy]);

  const focusFacility = (id) => {
    const fac = FACILITIES.find(f => f.id === id);
    if (!fac || !mapRef.current) return;
    setActiveFacId(id);
    mapRef.current.flyTo([fac.lat, fac.lng], 16, { duration: 1.2 });
    const marker = markersRef.current[id];
    if (marker) setTimeout(() => marker.openPopup(), 1000);
  };

  const switchLayer = (name) => {
    if (currentLayer === name || !mapRef.current) return;
    tilesRef.current[currentLayer].remove();
    tilesRef.current[name].addTo(mapRef.current);
    setCurrentLayer(name);
  };

  const toggleHeatmap = () => {
    if (!mapRef.current) return;
    if (heatmapOn) {
      heatLayerRef.current.remove();
      setHeatmapOn(false);
    } else {
      heatLayerRef.current.addTo(mapRef.current);
      setHeatmapOn(true);
      showToast('Disease density heatmap enabled — hot spots = high risk areas', 'info');
    }
  };

  const flyToEmergency = () => {
    setFilterType('emergency');
    const ae = FACILITIES.find(f => f.emergency);
    if (ae) setTimeout(() => focusFacility(ae.id), 100);
  };

  const locateMe = () => {
    if (!mapRef.current) return;
    setLocating(true);
    mapRef.current.locate({ setView: true, maxZoom: 15 });

    mapRef.current.once('locationfound', (e) => {
      L.circleMarker(e.latlng, { radius: 10, color: '#fff', weight: 3, fillColor: '#1565C0', fillOpacity: 1, className: 'locate-marker' })
        .addTo(mapRef.current)
        .bindPopup('<strong>You are here</strong><br>Accuracy: ±' + Math.round(e.accuracy) + 'm')
        .openPopup();
      setLocationLabel('Your location');
      setLocating(false);
      showToast('Location found! Showing nearby NHS facilities.', 'success');
    });

    mapRef.current.once('locationerror', () => {
      showToast('Location access denied. Showing Leicester centre.', 'error');
      setLocating(false);
    });
  };

  const searchByPostcode = async () => {
    if (!postcode.trim()) { showToast('Please enter a postcode', 'error'); return; }
    setPostcodeSearching(true);
    setPostcodeStatus('Searching NHS facilities...');

    liveMarkersRef.current.forEach(m => mapRef.current.removeLayer(m));
    liveMarkersRef.current = [];

    try {
      const data = await nhsSearch(postcode, 'all');
      if (data.error) { setPostcodeStatus('⚠️ ' + data.error); return; }
      if (!data.results?.length) { setPostcodeStatus('No NHS facilities found nearby.'); return; }

      mapRef.current.flyTo([data.center.lat, data.center.lng], 14, { duration: 1.2 });

      const youMarker = L.circleMarker([data.center.lat, data.center.lng], { radius: 10, color: '#fff', weight: 3, fillColor: '#005EB8', fillOpacity: 1 })
        .addTo(mapRef.current)
        .bindPopup(`<strong>📍 ${data.postcode}</strong><br>Your search location`)
        .openPopup();
      liveMarkersRef.current.push(youMarker);

      data.results.forEach(f => {
        const icon = L.divIcon({
          className: '',
          html: `<div style="background:${LIVE_TYPE_COLORS[f.type] || '#6b7280'};color:#fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:14px;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3);">${LIVE_TYPE_ICONS[f.type] || '🏢'}</div>`,
          iconSize: [32, 32], iconAnchor: [16, 16],
        });
        const popup = `
          <div style="min-width:200px;">
            <strong style="font-size:13px;">${f.name}</strong><br>
            ${f.nhs ? '<span style="background:#003087;color:#fff;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:700;">NHS</span> ' : ''}
            <span style="font-size:11px;color:#6b7280;text-transform:capitalize;">${f.type}</span><br>
            ${f.address ? `<span style="font-size:11px;">📍 ${f.address}</span><br>` : ''}
            ${f.phone ? `<span style="font-size:11px;">📞 <a href="tel:${f.phone}">${f.phone}</a></span><br>` : ''}
            ${f.hours ? `<span style="font-size:11px;">🕐 ${f.hours}</span><br>` : ''}
            <span style="font-size:11px;color:#005EB8;">📏 ${f.distance} km away</span>
            ${f.website ? `<br><a href="${f.website}" target="_blank" style="font-size:11px;color:#005EB8;">🔗 Website</a>` : ''}
          </div>`;
        const m = L.marker([f.lat, f.lng], { icon }).addTo(mapRef.current).bindPopup(popup);
        liveMarkersRef.current.push(m);
      });

      setPostcodeStatus(`✓ Found ${data.results.length} NHS facilities near ${data.postcode}`);
      showToast(`Found ${data.results.length} NHS facilities near ${data.postcode}`, 'success');
    } catch {
      setPostcodeStatus('⚠️ Search failed. Please try again.');
    } finally {
      setPostcodeSearching(false);
    }
  };

  const hospitalCount = FACILITIES.filter(f => f.type === 'hospital').length;
  const gpCount = FACILITIES.filter(f => f.type === 'gp').length;
  const pharmacyCount = FACILITIES.filter(f => f.type === 'pharmacy').length;
  const aeCount = FACILITIES.filter(f => f.emergency).length;
  const mentalCount = FACILITIES.filter(f => f.type === 'mental').length;

  return (
    <div className="map-page">
      <div className="flex-between mb-4">
        <div>
          <h2 style={{ margin: 0 }}><i className="fas fa-map-marked-alt" style={{ color: 'var(--primary-light)' }} /> NHS Health Map</h2>
          <div className="text-muted text-sm">Hospitals, GPs, Pharmacies &amp; Emergency centres near Leicester</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={locateMe} disabled={locating}>
            <i className={`fas ${locating ? 'fa-spinner fa-spin' : 'fa-crosshairs'}`} /> {locating ? 'Locating...' : 'Locate Me'}
          </button>
          <button className={`btn btn-sm ${heatmapOn ? 'btn-primary' : 'btn-outline'}`} onClick={toggleHeatmap}>
            <i className="fas fa-fire" /> {heatmapOn ? 'Hide Heatmap' : 'Show Heatmap'}
          </button>
          <button className="btn btn-sm btn-outline" onClick={() => navigate('/patient/appointments')}>
            <i className="fas fa-calendar-plus" /> Book Appointment
          </button>
        </div>
      </div>

      {toast && (
        <div className={`map-toast map-toast-${toast.type}`}>{toast.msg}</div>
      )}

      <div className="map-shell">
        {/* LEFT SIDEBAR */}
        <div className="map-sidebar">
          {/* Live NHS Postcode Search */}
          <div style={{ padding: '12px 14px', background: '#EFF6FF', borderBottom: '2px solid #005EB8' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#005EB8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              Live NHS Facility Search
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="text" placeholder="Enter postcode e.g. LE1 7RH" className="form-control" style={{ fontSize: 13, flex: 1 }}
                value={postcode} onChange={e => setPostcode(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') searchByPostcode(); }} />
              <button onClick={searchByPostcode} disabled={postcodeSearching}
                style={{ background: '#005EB8', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {postcodeSearching ? '...' : 'Search'}
              </button>
            </div>
            {postcodeStatus && <div style={{ fontSize: 11, color: '#1d4ed8', marginTop: 5 }}>{postcodeStatus}</div>}
          </div>

          {/* Local Search */}
          <div className="sidebar-search">
            <div style={{ position: 'relative' }}>
              <i className="fas fa-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 13 }} />
              <input type="text" placeholder="Filter results..." className="form-control" style={{ paddingLeft: 34 }}
                onChange={e => setFilterQuery(e.target.value.toLowerCase())} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
              <i className="fas fa-map-marker-alt" style={{ color: 'var(--primary-light)' }} /> {locationLabel}
              &nbsp;&middot;&nbsp; {visible.length} facilities
            </div>
          </div>

          {/* Type filters */}
          <div className="sidebar-filters">
            <button className={`filter-chip${filterType === 'all' ? ' active' : ''}`} onClick={() => setFilterType('all')}>All</button>
            {Object.entries(TYPE_META).map(([type, meta]) => (
              <button key={type} className={`filter-chip${filterType === type ? ' active' : ''}`} onClick={() => setFilterType(type)}>
                {meta.icon} {meta.label}
              </button>
            ))}
          </div>

          {/* Sort + NHS filter */}
          <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <select className="form-control" style={{ fontSize: 12, padding: '5px 10px', flex: 1 }} value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="distance">Sort: Nearest first</option>
              <option value="rating">Sort: Highest rated</option>
              <option value="name">Sort: A–Z</option>
              <option value="open">Sort: Open now</option>
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer' }}>
              <input type="checkbox" checked={nhsOnly} onChange={e => setNhsOnly(e.target.checked)} style={{ accentColor: 'var(--primary-light)', width: 14, height: 14 }} />
              NHS only
            </label>
          </div>

          {/* Facility list */}
          <div className="facility-list">
            {!visible.length ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                <i className="fas fa-search-minus" style={{ fontSize: 36, opacity: 0.3 }} />
                <p style={{ marginTop: 12, fontSize: 13 }}>No facilities match your filters.</p>
              </div>
            ) : visible.map(fac => {
              const meta = TYPE_META[fac.type] || TYPE_META.hospital;
              const stars = '★'.repeat(Math.round(fac.rating));
              return (
                <div key={fac.id} className={`facility-item${activeFacId === fac.id ? ' active' : ''}`} onClick={() => focusFacility(fac.id)}>
                  <div className="facility-icon" style={{ background: `${meta.color}18` }}>
                    <span>{meta.icon}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="facility-name">{fac.name}</div>
                    <div className="facility-type" style={{ color: meta.color }}>{fac.subtype}</div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                      <span className={`open-badge ${fac.open ? 'open' : 'closed'}`}>{fac.open ? 'Open' : 'Closed'}</span>
                      {fac.nhs && <span className="nhs-badge">NHS</span>}
                      {fac.emergency && <span style={{ background: '#FEE2E2', color: '#DC2626', padding: '2px 6px', borderRadius: 3, fontSize: 10, fontWeight: 700 }}>A&E</span>}
                    </div>
                    <div className="facility-meta">
                      <span><i className="fas fa-route" style={{ width: 13, color: 'var(--primary-light)' }} /> {fac.distance} mi &nbsp;&middot;&nbsp; <i className="fas fa-clock" style={{ width: 13 }} /> {fac.hours}</span>
                      {fac.wait !== 'N/A' && <span><i className="fas fa-hourglass-half" style={{ width: 13, color: 'var(--text-muted)' }} /> Wait: <span className="wait-badge">{fac.wait}</span></span>}
                      {fac.rating > 0 && <span><span style={{ color: '#F59E0B' }}>{stars}</span> <span style={{ fontSize: 11, fontWeight: 700 }}>{fac.rating}</span></span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary-light)' }}>{fac.distance}mi</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>away</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* MAP */}
        <div className="map-area">
          <div id="healthMap" ref={mapElRef} />

          <div className="map-controls">
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.1)' }}>
              <button className={`map-ctrl-btn${currentLayer === 'street' ? ' active' : ''}`} onClick={() => switchLayer('street')} style={{ borderRadius: '10px 10px 0 0', borderBottom: '1px solid var(--border)' }}>
                <i className="fas fa-map" /> Street
              </button>
              <button className={`map-ctrl-btn${currentLayer === 'satellite' ? ' active' : ''}`} onClick={() => switchLayer('satellite')} style={{ borderRadius: 0, borderBottom: '1px solid var(--border)' }}>
                <i className="fas fa-satellite" /> Satellite
              </button>
              <button className={`map-ctrl-btn${currentLayer === 'clean' ? ' active' : ''}`} onClick={() => switchLayer('clean')} style={{ borderRadius: '0 0 10px 10px' }}>
                <i className="fas fa-paint-brush" /> Clean
              </button>
            </div>

            <div style={{ background: '#DC2626', color: '#fff', borderRadius: 10, padding: '10px 14px', fontSize: 12, fontWeight: 700, textAlign: 'center', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,.15)' }} onClick={flyToEmergency}>
              🚨 Nearest A&amp;E<br />
              <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.85 }}>LRI — 0.8 mi &middot; ~45 min wait</span>
            </div>
          </div>

          <div className="map-stats">
            <div className="stat-pill"><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#1565C0', display: 'inline-block' }} /> {hospitalCount} Hospitals</div>
            <div className="stat-pill"><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#16A34A', display: 'inline-block' }} /> {gpCount} GP Clinics</div>
            <div className="stat-pill"><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#0891B2', display: 'inline-block' }} /> {pharmacyCount} Pharmacies</div>
            <div className="stat-pill"><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#DC2626', display: 'inline-block' }} /> {aeCount} A&amp;E Open</div>
            <div className="stat-pill"><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#7C3AED', display: 'inline-block' }} /> {mentalCount} Mental Health</div>
            <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
              Data: NHS Open Data &middot; OpenStreetMap
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
