import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useParams, Link } from 'react-router-dom';

export default function ImportReports() {
  const { id } = useParams();
  const [reports, setReports] = useState([]);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchReports = async () => {
    setLoading(true);
    try {
      const data = await api.get('/import/reports');
      setReports(data.reports || []);
    } catch (err) {
      setError('Failed to load import reports.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDetail = async (reportId) => {
    setLoading(true);
    try {
      const data = await api.get(`/import/reports/${reportId}`);
      setDetail(data);
    } catch (err) {
      setError('Failed to load report details.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchDetail(id);
    } else {
      fetchReports();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="main-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', animation: 'spin 1.5s linear infinite' }}>🔄</div>
          <p style={{ marginTop: '0.5rem', fontWeight: 600, color: 'var(--text-muted)' }}>Loading reports...</p>
        </div>
      </div>
    );
  }

  // --- DETAIL VIEW ---
  if (id && detail) {
    const { report, anomalies } = detail;
    return (
      <div className="main-content" style={{ maxWidth: '960px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <Link to="/reports" style={{ textDecoration: 'none', color: 'var(--primary)', fontWeight: 600, fontSize: '0.85rem' }}>
              ← Back to reports list
            </Link>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '0.5rem' }}>Import Report</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Filename: <code>{report.filename}</code> | Imported at: {new Date(report.imported_at).toLocaleString()}
            </p>
          </div>
          <Link to="/" className="btn btn-primary" style={{ padding: '0.5rem 1.5rem', fontSize: '0.85rem' }}>
            Go to Dashboard 🚀
          </Link>
        </div>

        {/* Stats Summary cards */}
        <div className="dashboard-summary-cards" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
          <div className="summary-card" style={{ borderLeft: '5px solid var(--primary)' }}>
            <span className="summary-card-title">Total rows analyzed</span>
            <span className="summary-card-value neutral">{report.total_rows}</span>
          </div>
          <div className="summary-card" style={{ borderLeft: '5px solid var(--accent-green)' }}>
            <span className="summary-card-title">Successfully imported</span>
            <span className="summary-card-value positive">{report.imported_rows}</span>
          </div>
          <div className="summary-card" style={{ borderLeft: '5px solid var(--accent-red)' }}>
            <span className="summary-card-title">Anomalies logs logged</span>
            <span className="summary-card-value negative">{report.anomalies_count}</span>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Deliberate Anomalies Log (Import Report)</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
              Every anomaly detected by the CSV engine and the deliberate action applied during import.
            </p>
          </div>

          <div style={{ padding: '1rem 0' }}>
            {anomalies.length === 0 ? (
              <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No anomalies were logged for this import.
              </p>
            ) : (
              <table className="ledger-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--surface-border)' }}>
                    <th style={{ padding: '0.75rem' }}>Row</th>
                    <th style={{ padding: '0.75rem' }}>Description</th>
                    <th style={{ padding: '0.75rem' }}>Anomaly type</th>
                    <th style={{ padding: '0.75rem' }}>Action Taken / Policy Applied</th>
                  </tr>
                </thead>
                <tbody>
                  {anomalies.map(an => (
                    <tr key={an.id} style={{ borderBottom: '1px solid var(--surface-border)', fontSize: '0.85rem' }}>
                      <td style={{ padding: '0.75rem' }}>{an.row_number}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <strong>{an.description_raw}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Raw Date: {an.date_raw}</div>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <span style={{ 
                          fontFamily: 'monospace', 
                          fontSize: '0.75rem', 
                          padding: '0.2rem 0.4rem', 
                          borderRadius: '4px',
                          backgroundColor: '#ffebeb',
                          color: '#b30000'
                        }}>
                          {an.anomaly_type}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ fontWeight: 600, color: an.action_taken === 'SKIPPED' ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                          {an.action_taken}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{an.resolved_value}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- LIST VIEW ---
  return (
    <div className="main-content" style={{ maxWidth: '960px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: 800 }}>Import Reports</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Historical reports produced during spreadsheets imports.
        </p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <div style={{ padding: '1rem 0' }}>
          {reports.length === 0 ? (
            <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📊</p>
              <p style={{ fontWeight: 600 }}>No import reports found</p>
              <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                Go to the "Import CSV Data" page in the sidebar and upload a spreadsheet.
              </p>
              <Link to="/import" className="btn btn-primary" style={{ marginTop: '1.5rem', display: 'inline-block' }}>
                📥 Go to Importer
              </Link>
            </div>
          ) : (
            <table className="ledger-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--surface-border)' }}>
                  <th style={{ padding: '0.75rem' }}>Import Date</th>
                  <th style={{ padding: '0.75rem' }}>Filename</th>
                  <th style={{ padding: '0.75rem' }}>Rows analyzed</th>
                  <th style={{ padding: '0.75rem' }}>Rows imported</th>
                  <th style={{ padding: '0.75rem' }}>Anomalies count</th>
                  <th style={{ padding: '0.75rem' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {reports.map(rep => (
                  <tr key={rep.id} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                    <td style={{ padding: '0.75rem' }}>{new Date(rep.imported_at).toLocaleString()}</td>
                    <td style={{ padding: '0.75rem' }}><code>{rep.filename}</code></td>
                    <td style={{ padding: '0.75rem' }}>{rep.total_rows}</td>
                    <td style={{ padding: '0.75rem', fontWeight: 600, color: 'var(--accent-green)' }}>{rep.imported_rows}</td>
                    <td style={{ padding: '0.75rem', color: 'var(--accent-red)' }}>{rep.anomalies_count}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <Link to={`/reports/${rep.id}`} className="btn btn-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', textDecoration: 'none' }}>
                        View Report
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
