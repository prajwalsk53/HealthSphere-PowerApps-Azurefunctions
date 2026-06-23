import { useState, useEffect, useMemo, useRef } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { Hs_documentsService } from '../../generated/services/Hs_documentsService';

const LEGACY_BLOB_BASE = 'https://healthspherestorage.blob.core.windows.net/documents';

function toDoc(r) {
  const rawPath = r.hs_ilepath || '';
  return {
    id: r.hs_documentid,
    title: r.hs_document1,
    description: r.hs_escription,
    docType: r.hs_octype,
    fileName: r.hs_ilename,
    filePath: /^https?:\/\//i.test(rawPath) ? rawPath : `${LEGACY_BLOB_BASE}/${rawPath}`,
    fileType: r.hs_iletype,
    fileSize: r.hs_ilesize,
    createdAt: r.createdon,
  };
}

const DOC_TYPES = {
  lab_report: 'Lab Report', prescription: 'Prescription', xray: 'X-Ray / Scan', scan: 'MRI / CT Scan',
  discharge: 'Discharge Summary', referral: 'Referral Letter', other: 'Other',
};
const DOC_ICONS = { lab_report: '🧪', prescription: '💊', xray: '🔬', scan: '🧠', discharge: '📋', referral: '📨', other: '📄' };
const DOC_COLORS = { lab_report: '#1565C0', prescription: '#16A34A', xray: '#7C3AED', scan: '#0891B2', discharge: '#D97706', referral: '#DC2626', other: '#5E7A99' };

function UploadModal({ userId, onClose, onUploaded }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState('other');
  const [description, setDescription] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!title.trim()) return setError('Please enter a title.');
    if (!file) return setError('Please select a file.');

    const fd = new FormData();
    fd.append('doc_file', file);

    setSubmitting(true);
    try {
      const { data: uploaded } = await api.post('/bridge/documents/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      await Hs_documentsService.create({
        'hs_User@odata.bind': `/hs_users(${userId})`,
        hs_document1: title.trim(),
        hs_escription: description.trim() || undefined,
        hs_octype: docType,
        hs_ilename: uploaded.fileName,
        hs_ilepath: uploaded.fileUrl,
        hs_iletype: uploaded.fileType,
        hs_ilesize: uploaded.fileSize,
      });
      onUploaded();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload document.');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h3><i className="fas fa-upload" /> Upload Medical Document</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {error && (
              <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: '#991B1B', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fas fa-exclamation-circle" /> {error}
              </div>
            )}

            <div
              className={`upload-zone${dragOver ? ' drag-over' : ''}${file ? ' has-file' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={e => { e.preventDefault(); setDragOver(false); }}
              onDrop={e => {
                e.preventDefault(); setDragOver(false);
                if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]);
              }}
            >
              <i className="fas fa-cloud-upload-alt" style={{ fontSize: 40, color: 'var(--primary-light)', marginBottom: 12 }} />
              {file ? (
                <div>
                  <i className="fas fa-file-check" style={{ color: '#16A34A', fontSize: 20 }} />{' '}
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#166534' }}>{file.name} ({(file.size / 1024).toFixed(0)} KB)</span>
                </div>
              ) : (
                <div>
                  <p style={{ fontWeight: 700, color: 'var(--primary)', margin: 0 }}>Click or drag &amp; drop your file</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>PDF, JPG, PNG &mdash; Max 10MB</p>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.gif" style={{ display: 'none' }}
                onChange={e => setFile(e.target.files?.[0] || null)} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 16 }}>
              <div className="form-group" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
                <label className="form-label">Document Title *</label>
                <input type="text" className="form-control" placeholder="e.g. Blood Test Results Oct 2025"
                  value={title} onChange={e => setTitle(e.target.value)} required />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
                <label className="form-label">Document Type</label>
                <select className="form-control" value={docType} onChange={e => setDocType(e.target.value)}>
                  {Object.entries(DOC_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
                <label className="form-label">Description (optional)</label>
                <textarea className="form-control" rows={2} placeholder="Brief notes about this document..."
                  value={description} onChange={e => setDescription(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Uploading...' : <><i className="fas fa-upload" /> Upload Document</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Documents() {
  const { user } = useAuth();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [search, setSearch] = useState('');
  const [view, setView] = useState('grid');
  const [showUpload, setShowUpload] = useState(false);

  const load = () => Hs_documentsService.getAll({ filter: `_hs_user_value eq ${user.id}`, orderBy: ['createdon desc'] })
    .then(r => setDocs((r.data || []).map(toDoc))).finally(() => setLoading(false));
  useEffect(() => { if (user?.id) load(); }, [user?.id]);

  const deleteDoc = async (id, filePath) => {
    if (!confirm('Delete this document?')) return;
    const blobName = (filePath || '').split('/').pop();
    if (blobName) await api.delete(`/bridge/documents/upload/${blobName}`).catch(() => {});
    await Hs_documentsService.delete(id);
    load();
  };

  const counts = useMemo(() => {
    const c = {};
    for (const d of docs) c[d.docType] = (c[d.docType] || 0) + 1;
    return c;
  }, [docs]);

  const totalMB = useMemo(() => {
    const bytes = docs.reduce((s, d) => s + (d.fileSize || 0), 0);
    return Math.round((bytes / 1024 / 1024) * 10) / 10;
  }, [docs]);
  const storagePct = Math.min(Math.round(totalMB), 100);

  const filtered = useMemo(() => {
    return docs.filter(d => {
      if (filterType && d.docType !== filterType) return false;
      if (search && !(d.title || '').toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [docs, filterType, search]);

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div>
      <div className="flex-between mb-4">
        <div>
          <h2 style={{ margin: 0 }}><i className="fas fa-folder-medical" style={{ color: 'var(--primary-light)' }} /> Medical Documents</h2>
          <div className="text-muted text-sm">Securely store and manage your health records &middot; {docs.length} documents</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowUpload(true)}>
          <i className="fas fa-upload" /> Upload Document
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20 }}>
        {/* Sidebar filters */}
        <div>
          <div className="card">
            <div style={{ padding: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>Filter by Type</div>
              <div className={`doc-filter-item${!filterType ? ' active' : ''}`} onClick={() => setFilterType('')}>
                <span>All Documents</span>
                <span className="doc-filter-count">{docs.length}</span>
              </div>
              {Object.entries(DOC_TYPES).map(([key, label]) => (
                <div key={key} className={`doc-filter-item${filterType === key ? ' active' : ''}`} onClick={() => setFilterType(key)}>
                  <span>{DOC_ICONS[key]} {label}</span>
                  {counts[key] > 0 && <span className="doc-filter-count">{counts[key]}</span>}
                </div>
              ))}

              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>Storage</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)' }}>{totalMB}MB</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>of 100MB used</div>
                <div style={{ background: 'var(--bg)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${storagePct}%`, background: 'var(--primary-light)', height: '100%', borderRadius: 4, transition: 'width 1s' }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Documents grid */}
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <i className="fas fa-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 13 }} />
              <input type="text" placeholder="Search documents..." className="form-control" style={{ paddingLeft: 34 }}
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button className={`btn btn-sm ${view === 'grid' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setView('grid')}><i className="fas fa-th" /></button>
            <button className={`btn btn-sm ${view === 'list' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setView('list')}><i className="fas fa-list" /></button>
          </div>

          {!docs.length ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 60, marginBottom: 16 }}>📁</div>
              <h4 style={{ color: 'var(--primary)', marginBottom: 8 }}>No Documents Yet</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Upload your lab reports, prescriptions, or medical scans to keep everything in one place.</p>
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowUpload(true)}>
                <i className="fas fa-upload" /> Upload First Document
              </button>
            </div>
          ) : !filtered.length ? (
            <div className="empty-state"><div className="empty-icon">🔍</div><p>No documents match your search.</p></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: view === 'list' ? '1fr' : 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
              {filtered.map(d => {
                const typeColor = DOC_COLORS[d.docType] || '#5E7A99';
                const isImage = (d.fileType || '').includes('image');
                const fileUrl = d.filePath;
                return (
                  <div className="doc-card" key={d.id}>
                    <div className="doc-type-bar" style={{ background: typeColor }} />
                    {isImage ? (
                      <img src={fileUrl} className="img-preview" alt={d.title} />
                    ) : (
                      <div className="pdf-preview" style={{ background: `${typeColor}18` }}>
                        <span>{DOC_ICONS[d.docType] || '📄'}</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ background: `${typeColor}18`, color: typeColor, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                        {DOC_TYPES[d.docType] || 'Document'}
                      </span>
                    </div>

                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--primary)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {d.title}
                    </div>
                    {d.description && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {d.description}
                      </div>
                    )}

                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, display: 'flex', gap: 10 }}>
                      <span><i className="fas fa-file" /> {d.fileSize ? `${Math.round(d.fileSize / 1024 * 10) / 10}KB` : '—'}</span>
                      <span><i className="fas fa-calendar" /> {new Date(d.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-primary" style={{ flex: 1, justifyContent: 'center', textDecoration: 'none' }}>
                        <i className="fas fa-eye" /> View
                      </a>
                      <a href={fileUrl} download={d.fileName} className="btn btn-sm btn-outline">
                        <i className="fas fa-download" />
                      </a>
                      <button className="btn btn-sm btn-danger" onClick={() => deleteDoc(d.id, d.filePath)}>
                        <i className="fas fa-trash" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Security notice */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 18px', marginTop: 20 }}>
        <i className="fas fa-lock" style={{ color: 'var(--primary-light)', fontSize: 18 }} />
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          <strong style={{ color: 'var(--primary)' }}>Your documents are private and secure.</strong>
          {' '}Only you and authorised doctors you share with can access these files. All data is end-to-end protected.
        </div>
      </div>

      {showUpload && <UploadModal userId={user.id} onClose={() => setShowUpload(false)} onUploaded={load} />}
    </div>
  );
}
