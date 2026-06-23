import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { Hs_wearabletokensService } from '../../generated/services/Hs_wearabletokensService';
import { Hs_googlefitdriveimportsService } from '../../generated/services/Hs_googlefitdriveimportsService';
import { Hs_healthmetricsService } from '../../generated/services/Hs_healthmetricsService';
import '../../assets/wearable.css';

function dateKey(d) {
  return new Date(d).toISOString().slice(0, 10);
}

function toWearableMetric(r) {
  return { id: r.hs_healthmetricid, recordedAt: r.hs_recordedat, steps: r.hs_steps, heartRate: r.hs_heartrate, sleepHours: r.hs_sleephours, caloriesBurned: r.hs_caloriesburned, weight: r.hs_weight };
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB');
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const STEPS = [
  ['1', 'Export from Google', 'Go to takeout.google.com → select Google Fit → Export'],
  ['2', 'Save to Google Drive', 'Move the Takeout ZIP to your designated Drive folder'],
  ['3', 'Click Sync Now', 'HealthSphere pulls the latest ZIP and imports your data'],
];

export default function Wearable() {
  const { user } = useAuth();
  const [status, setStatus] = useState({ isConnected: false, hasImportedData: false, lastSync: null, metrics: [] });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [banner, setBanner] = useState(null);
  const [syncResult, setSyncResult] = useState(null);

  const load = async () => {
    const [tokenRes, metricsRes] = await Promise.all([
      Hs_wearabletokensService.getAll({ filter: `_hs_user_value eq ${user.id} and hs_provider eq 'google_fit'` }),
      Hs_healthmetricsService.getAll({ filter: `_hs_user_value eq ${user.id} and hs_source eq 'wearable'`, orderBy: ['hs_recordedat desc'] }),
    ]);
    const token = tokenRes.data?.[0];
    const allMetrics = (metricsRes.data || []).map(toWearableMetric);
    const seen = new Set();
    const uniqueMetrics = allMetrics.filter(m => {
      const k = dateKey(m.recordedAt);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    setStatus({
      isConnected: !!(token && token.hs_accesstoken),
      hasImportedData: allMetrics.length > 0,
      lastSync: token?.hs_lastsync || null,
      metrics: uniqueMetrics,
    });
    setLoading(false);
  };
  useEffect(() => { if (user?.id) load(); }, [user?.id]);

  const connect = async () => {
    setConnecting(true);
    try {
      const existing = await Hs_wearabletokensService.getAll({ filter: `_hs_user_value eq ${user.id} and hs_provider eq 'google_fit'` });
      const token = crypto.getRandomValues(new Uint8Array(24)).reduce((s, b) => s + b.toString(16).padStart(2, '0'), '');
      if (existing.data?.[0]) {
        await Hs_wearabletokensService.update(existing.data[0].hs_wearabletokenid, { hs_accesstoken: token });
      } else {
        await Hs_wearabletokensService.create({ 'hs_User@odata.bind': `/hs_users(${user.id})`, hs_provider: 'google_fit', hs_accesstoken: token });
      }
      await load();
      setBanner({ type: 'success', text: 'Google Fit connected! Click "Sync Now" to import your health data.' });
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    if (!confirm('Disconnect Google Fit OAuth?')) return;
    const existing = await Hs_wearabletokensService.getAll({ filter: `_hs_user_value eq ${user.id} and hs_provider eq 'google_fit'` });
    await Promise.all((existing.data || []).map(t => Hs_wearabletokensService.delete(t.hs_wearabletokenid)));
    await load();
    setBanner({ type: 'error', text: 'Disconnected.' });
  };

  const syncNow = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const existingImport = (await Hs_googlefitdriveimportsService.getAll({ filter: `_hs_user_value eq ${user.id}`, orderBy: ['hs_modifiedtime desc'], top: 1 })).data?.[0];
      const { data } = await api.post('/bridge/wearable/sync', {
        knownDriveFileId: existingImport?.hs_drivefileid, knownModifiedTime: existingImport?.hs_modifiedtime,
      });
      if (!data.success) {
        setSyncResult({ type: 'error', message: data.error });
        return;
      }
      if (data.already_current) {
        setSyncResult({ type: 'success', message: data.message || 'Already up to date.' });
        return;
      }

      const dates = data.rows.map(r => new Date(r.metricDate + 'T12:00:00.000Z').toISOString());
      const existingMetrics = await Hs_healthmetricsService.getAll({ filter: `_hs_user_value eq ${user.id} and hs_source eq 'wearable'` });
      await Promise.all((existingMetrics.data || []).filter(m => dates.includes(m.hs_recordedat)).map(m => Hs_healthmetricsService.delete(m.hs_healthmetricid)));

      await Promise.all(data.rows.map((r, i) => Hs_healthmetricsService.create({
        'hs_uSER@odata.bind': `/hs_users(${user.id})`,
        hs_source: 'wearable',
        hs_heartrate: r.heartRate ?? undefined,
        hs_steps: r.steps,
        hs_distancekm: r.distanceKm,
        hs_caloriesburned: r.caloriesBurned,
        hs_weight: r.weight ?? undefined,
        hs_recordedat: dates[i],
      })));

      if (existingImport) {
        await Hs_googlefitdriveimportsService.update(existingImport.hs_googlefitdriveimportid, {
          hs_filename: data.file, hs_drivefileid: data.driveFileId, hs_modifiedtime: data.modifiedTime, hs_importedrows: data.rows.length, hs_latestdate: dates[0],
        });
      } else {
        await Hs_googlefitdriveimportsService.create({
          'hs_User@odata.bind': `/hs_users(${user.id})`,
          hs_filename: data.file, hs_drivefileid: data.driveFileId, hs_modifiedtime: data.modifiedTime, hs_importedrows: data.rows.length, hs_latestdate: dates[0],
        });
      }

      const tokenRes = await Hs_wearabletokensService.getAll({ filter: `_hs_user_value eq ${user.id} and hs_provider eq 'google_fit'` });
      if (tokenRes.data?.[0]) {
        await Hs_wearabletokensService.update(tokenRes.data[0].hs_wearabletokenid, { hs_lastsync: new Date().toISOString() });
      } else {
        await Hs_wearabletokensService.create({ 'hs_User@odata.bind': `/hs_users(${user.id})`, hs_provider: 'google_fit', hs_lastsync: new Date().toISOString() });
      }

      setSyncResult({ type: 'success', message: 'Imported successfully' });
      await load();
    } catch (err) {
      setSyncResult({ type: 'error', message: 'Sync failed — please try again.' });
    } finally {
      setSyncing(false);
    }
  };

  const { isConnected, hasImportedData, lastSync, metrics } = status;
  const connectedColor = (isConnected || hasImportedData) ? '#16A34A' : '#9CA3AF';
  const connectedLabel = isConnected ? 'Connected' : (hasImportedData ? 'Takeout imported' : 'Not connected');

  if (loading) return <div className="wear-page" style={{ padding: 24 }}>Loading…</div>;

  return (
    <div className="wear-page" style={{ maxWidth: 960, margin: '0 auto' }}>
      <div className="wear-actionbar">
        {isConnected ? (
          <a href="#" className="wear-link-disconnect" onClick={(e) => { e.preventDefault(); disconnect(); }}>
            <i className="fas fa-unlink"></i> Disconnect
          </a>
        ) : (
          <button className="wear-btn wear-btn-google" onClick={connect} disabled={connecting}>
            <i className="fab fa-google"></i> {connecting ? 'Connecting…' : 'Connect Google Fit'}
          </button>
        )}
        <button className="wear-btn wear-btn-sync" onClick={syncNow} disabled={syncing}>
          <i className={`fas fa-sync-alt ${syncing ? 'fa-spin' : ''}`}></i> {syncing ? 'Syncing from Drive...' : 'Sync Now'}
        </button>
      </div>

      {banner && (
        <div className={`wear-banner ${banner.type}`}>
          <i className={`fas ${banner.type === 'success' ? 'fa-check-circle' : 'fa-unlink'}`} style={{ color: banner.type === 'success' ? '#16A34A' : '#DC2626' }}></i>
          <span style={{ fontWeight: 700, color: banner.type === 'success' ? '#15803D' : '#991B1B' }}>{banner.text}</span>
        </div>
      )}

      {syncResult && (
        <div className={`wear-banner ${syncResult.type}`} style={{ color: syncResult.type === 'error' ? '#991B1B' : undefined }}>
          <i className={`fas ${syncResult.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`} style={{ color: syncResult.type === 'success' ? '#16A34A' : undefined }}></i>
          <span style={{ fontWeight: 700, color: syncResult.type === 'success' ? '#15803D' : '#991B1B' }}>{syncResult.message}</span>
        </div>
      )}

      {/* Status bar */}
      <div className="hs-card" style={{ marginBottom: 16 }}>
        <div className="hs-card-body" style={{ padding: '14px 20px' }}>
          <div className="wear-status">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="wear-status-icon">🏃</div>
              <div>
                <div className="wear-status-name">Google Fit</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: connectedColor }}>
                  <span className="wear-status-dot" style={{ background: connectedColor }}></span>
                  {connectedLabel}
                </div>
              </div>
            </div>
            {isConnected && lastSync && (
              <div style={{ fontSize: 12, color: 'var(--hs-muted)' }}>Last sync: <strong>{timeAgo(lastSync)}</strong></div>
            )}
            <div className="wear-status-meta">
              <span>👣 Steps</span><span>❤️ Heart Rate</span><span>😴 Sleep</span><span>🔥 Calories</span><span>⚖️ Weight</span>
              <span className="wear-drive-badge"><i className="fab fa-google-drive"></i> Drive Sync</span>
            </div>
          </div>
        </div>
      </div>

      {!isConnected && !hasImportedData ? (
        <div className="hs-card">
          <div className="hs-card-body wear-setup">
            <div className="wear-setup-emoji">🏃</div>
            <h3>Set Up Google Drive Sync</h3>
            <p>
              Export your Google Fit data via Google Takeout, save the ZIP to a Google Drive folder,<br />
              then click <strong>Sync Now</strong> — HealthSphere will automatically pull the latest data.
            </p>
            <div className="wear-steps">
              {STEPS.map(([n, title, desc]) => (
                <div className="wear-step" key={n}>
                  <div className="wear-step-num">{n}</div>
                  <div className="wear-step-title">{title}</div>
                  <div className="wear-step-desc">{desc}</div>
                </div>
              ))}
            </div>
            <button className="wear-sync-cta" onClick={syncNow} disabled={syncing}>
              <i className={`fas fa-sync-alt ${syncing ? 'fa-spin' : ''}`}></i> Sync Now from Google Drive
            </button>
            <div className="wear-oauth-row">
              Or connect via Google Fit OAuth for live sync:
              <a href="#" onClick={(e) => { e.preventDefault(); connect(); }}><i className="fab fa-google"></i> Connect Google Fit</a>
            </div>
          </div>
        </div>
      ) : (
        <div className="hs-card">
          <div className="hs-card-header">
            <span className="card-title"><i className="fas fa-history"></i> Synced Health Data</span>
            <span style={{ fontSize: 12, color: 'var(--hs-muted)' }}>Source: Google Fit / Takeout · {metrics.length} days</span>
          </div>
          {metrics.length ? (
            <div className="hs-card-body p-0">
              <table className="hs-table">
                <thead>
                  <tr><th>Date</th><th>👣 Steps</th><th>❤️ Heart Rate</th><th>😴 Sleep</th><th>🔥 Calories</th><th>⚖️ Weight</th></tr>
                </thead>
                <tbody>
                  {metrics.map(m => (
                    <tr key={m.id}>
                      <td><strong>{formatDate(m.recordedAt)}</strong></td>
                      <td>{m.steps ? `${Number(m.steps).toLocaleString()} steps` : <span className="wear-empty-cell">—</span>}</td>
                      <td>{m.heartRate ? `${m.heartRate} bpm` : <span className="wear-empty-cell">—</span>}</td>
                      <td>{m.sleepHours ? `${m.sleepHours} hrs` : <span className="wear-empty-cell">—</span>}</td>
                      <td>{m.caloriesBurned ? `${Number(m.caloriesBurned).toLocaleString()} kcal` : <span className="wear-empty-cell">—</span>}</td>
                      <td>{m.weight ? `${m.weight} kg` : <span className="wear-empty-cell">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="hs-card-body wear-empty">
              <i className="fas fa-sync"></i>
              <p>No data synced yet. Click <strong>Sync Now</strong> above.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
