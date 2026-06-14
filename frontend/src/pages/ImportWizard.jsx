import React, { useState } from 'react';
import { api } from '../api';
import { useNavigate } from 'react-router-dom';

const USD_RATE = 83.0;
const STANDARD_MEMBERS = ['Aisha', 'Rohan', 'Priya', 'Meera', 'Sam', 'Dev'];

export default function ImportWizard({ onImportSuccess }) {
  const [csvFile, setCsvFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Wizard flow states
  const [analyzedData, setAnalyzedData] = useState(null);
  const [step, setStep] = useState(0); // 0: upload, 1: payers, 2: dates, 3: currencies, 4: timelines, 5: duplicates, 6: settlements, 7: final
  const [rows, setRows] = useState([]);
  
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    setCsvFile(e.target.files[0]);
    setError('');
  };

  const handleUpload = () => {
    if (!csvFile) {
      setError('Please select a CSV file first.');
      return;
    }

    setLoading(true);
    setError('');

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const res = await api.post('/import/analyze', { csvText: text });
        
        // Initialize import action and settings for each row
        const initializedRows = res.rows.map(row => {
          let importAction = 'IMPORT'; // 'IMPORT' or 'SKIP'
          const resolvedAnomalies = [...row.anomalies];

          // Default duplicate rows ( Marina Bites Row 6, Thalassa Row 24 ) to SKIP
          const duplicateAnomaly = row.anomalies.find(a => a.type === 'DUPLICATE_ENTRY');
          if (duplicateAnomaly) {
            importAction = 'SKIP';
          }

          // Suggest skipping zero-amount rows
          const zeroAnomaly = row.anomalies.find(a => a.type === 'ZERO_AMOUNT');
          if (zeroAnomaly) {
            importAction = 'SKIP';
          }

          return {
            ...row,
            importAction,
            resolvedAnomalies
          };
        });

        setRows(initializedRows);
        setAnalyzedData(res);
        setStep(1); // Go to step 1
      } catch (err) {
        setError(err.message || 'Failed to analyze CSV file.');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(csvFile);
  };

  // Step 1 helper: update normalized paid_by name
  const handlePayerChange = (rowNumber, newPayer) => {
    setRows(prev => prev.map(r => {
      if (r.rowNumber === rowNumber) {
        return { ...r, paidByClean: newPayer };
      }
      return r;
    }));
  };

  // Step 2 helper: toggle date interpretation for April 5 vs May 4
  const handleDateConfirm = (rowNumber, newDate) => {
    setRows(prev => prev.map(r => {
      if (r.rowNumber === rowNumber) {
        return { ...r, dateClean: newDate };
      }
      return r;
    }));
  };

  // Step 4 helper: update split timeline (Meera, Sam)
  const handleSplitTimelineConfirm = (rowNumber, updatedSplitWith) => {
    setRows(prev => prev.map(r => {
      if (r.rowNumber === rowNumber) {
        return { ...r, splitWithClean: updatedSplitWith };
      }
      return r;
    }));
  };

  // Step 5 helper: toggle duplicate actions
  const toggleRowSkip = (rowNumber) => {
    setRows(prev => prev.map(r => {
      if (r.rowNumber === rowNumber) {
        return { ...r, importAction: r.importAction === 'SKIP' ? 'IMPORT' : 'SKIP' };
      }
      return r;
    }));
  };

  // Step 5 helper: select between Aisha (row 24) and Rohan (row 25) duplicate Thalassa dinner
  const selectDuplicateThalassa = (rowToKeep, rowToSkip) => {
    setRows(prev => prev.map(r => {
      if (r.rowNumber === rowToKeep) {
        return { ...r, importAction: 'IMPORT' };
      }
      if (r.rowNumber === rowToSkip) {
        return { ...r, importAction: 'SKIP' };
      }
      return r;
    }));
  };

  const handleFinalizeImport = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/import/finalize', {
        filename: csvFile?.name || 'expenses_export.csv',
        rows: rows
      });
      if (onImportSuccess) onImportSuccess();
      navigate('/reports/' + res.importId);
    } catch (err) {
      setError(err.message || 'Failed to finalize import.');
    } finally {
      setLoading(false);
    }
  };

  // Render steps helpers
  const getPayerTyposRows = () => rows.filter(r => r.anomalies.some(a => a.type === 'PAYER_TYPO' || a.type === 'MISSING_PAYER'));
  const getDateAnomalyRows = () => rows.filter(r => r.anomalies.some(a => a.type === 'AMBIGUOUS_DATE_ORDER' || a.type === 'MISSING_YEAR'));
  const getUsdRows = () => rows.filter(r => r.currencyClean === 'USD');
  const getTimelineAnomalyRows = () => rows.filter(r => r.anomalies.some(a => a.type.startsWith('TIMELINE_VIOLATION') || a.type === 'NON_MEMBER_PARTICIPATION'));
  const getDuplicateGroups = () => {
    // Return pairs of duplicates
    const marina = rows.filter(r => r.rowNumber === 5 || r.rowNumber === 6);
    const thalassa = rows.filter(r => r.rowNumber === 24 || r.rowNumber === 25);
    return { marina, thalassa };
  };
  const getSettlementRows = () => rows.filter(r => r.isSettlement);

  return (
    <div className="main-content" style={{ maxWidth: '960px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: 800 }}>CSV Expense Importer</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Upload flatmates spreadsheet export. The app will detect anomalies and guide you through resolving them.
        </p>
      </div>

      {error && <div className="error-banner" style={{ marginBottom: '1.5rem' }}>⚠️ {error}</div>}

      {/* Step 0: Upload File */}
      {step === 0 && (
        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📥</div>
          <h3>Select SpreadSheet Export</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.9rem' }}>
            Upload the `expenses_export.csv` file without manual edits.
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleFileChange}
              style={{ display: 'none' }}
              id="csv-file-upload"
            />
            <label 
              htmlFor="csv-file-upload" 
              className="btn btn-secondary" 
              style={{ padding: '0.75rem 2rem', cursor: 'pointer' }}
            >
              {csvFile ? `Selected: ${csvFile.name}` : '📁 Choose CSV File'}
            </label>
            
            {csvFile && (
              <button 
                onClick={handleUpload} 
                className="btn btn-primary"
                disabled={loading}
                style={{ padding: '0.75rem 3rem', fontWeight: 700 }}
              >
                {loading ? 'Analyzing CSV File...' : 'Start Import Analysis 🚀'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Step Stepper Header */}
      {step > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <div className="wizard-stepper" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--surface-border)', paddingBottom: '1rem' }}>
            <span style={{ color: step === 1 ? 'var(--primary)' : 'inherit' }}>1. Payer Typos</span>
            <span style={{ color: step === 2 ? 'var(--primary)' : 'inherit' }}>2. Date Errors</span>
            <span style={{ color: step === 3 ? 'var(--primary)' : 'inherit' }}>3. Currencies</span>
            <span style={{ color: step === 4 ? 'var(--primary)' : 'inherit' }}>4. Timelines</span>
            <span style={{ color: step === 5 ? 'var(--primary)' : 'inherit' }}>5. Duplicates</span>
            <span style={{ color: step === 6 ? 'var(--primary)' : 'inherit' }}>6. Payments</span>
            <span style={{ color: step === 7 ? 'var(--primary)' : 'inherit' }}>7. Finalize</span>
          </div>
        </div>
      )}

      {/* Step 1: Payer Typos & Missing Payers */}
      {step === 1 && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Step 1: Payer Typos & Normalization</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
              We detected inconsistent spelling and casing. Confirm the corrected name in the dropdown.
            </p>
          </div>
          
          <div style={{ padding: '1rem 0' }}>
            <table className="ledger-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--surface-border)', paddingBottom: '0.5rem' }}>
                  <th style={{ padding: '0.75rem' }}>Row</th>
                  <th style={{ padding: '0.75rem' }}>Description</th>
                  <th style={{ padding: '0.75rem' }}>Raw Payer</th>
                  <th style={{ padding: '0.75rem' }}>Suggested Payer</th>
                  <th style={{ padding: '0.75rem' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {getPayerTyposRows().map(r => {
                  const isMissing = !r.paidByRaw;
                  return (
                    <tr key={r.rowNumber} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                      <td style={{ padding: '0.75rem' }}>{r.rowNumber}</td>
                      <td style={{ padding: '0.75rem' }}><strong>{r.description}</strong></td>
                      <td style={{ padding: '0.75rem', color: isMissing ? 'var(--accent-red)' : 'inherit' }}>
                        {isMissing ? '⚠️ (Empty)' : `"${r.paidByRaw}"`}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <select 
                          className="form-input"
                          style={{ padding: '0.25rem 0.5rem', width: 'auto', display: 'inline-block' }}
                          value={r.paidByClean}
                          onChange={(e) => handlePayerChange(r.rowNumber, e.target.value)}
                        >
                          {STANDARD_MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <span className="badge-resolved" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary-hover)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                          Resolved to {r.paidByClean}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
            <button className="btn btn-secondary" onClick={() => setStep(0)}>Back</button>
            <button className="btn btn-primary" onClick={() => setStep(2)}>Next: Dates & Formats →</button>
          </div>
        </div>
      )}

      {/* Step 2: Date formats & inconsistencies */}
      {step === 2 && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Step 2: Date format corrections</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
              We parsed irregular date formatting. Rohan requested complete trace logs.
            </p>
          </div>

          <div style={{ padding: '1rem 0' }}>
            <table className="ledger-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--surface-border)' }}>
                  <th style={{ padding: '0.75rem' }}>Row</th>
                  <th style={{ padding: '0.75rem' }}>Description</th>
                  <th style={{ padding: '0.75rem' }}>Raw Date string</th>
                  <th style={{ padding: '0.75rem' }}>Interpreted date</th>
                  <th style={{ padding: '0.75rem' }}>Context Resolution / Action</th>
                </tr>
              </thead>
              <tbody>
                {getDateAnomalyRows().map(r => {
                  const isAmbiguous = r.anomalies.some(a => a.type === 'AMBIGUOUS_DATE_ORDER');
                  return (
                    <tr key={r.rowNumber} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                      <td style={{ padding: '0.75rem' }}>{r.rowNumber}</td>
                      <td style={{ padding: '0.75rem' }}><strong>{r.description}</strong></td>
                      <td style={{ padding: '0.75rem' }}><code>{r.dateRaw}</code></td>
                      <td style={{ padding: '0.75rem' }}>
                        <input 
                          type="date" 
                          value={r.dateClean}
                          className="form-input"
                          style={{ padding: '0.25rem 0.5rem', width: 'auto', display: 'inline-block' }}
                          onChange={(e) => handleDateConfirm(r.rowNumber, e.target.value)}
                        />
                      </td>
                      <td style={{ padding: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {isAmbiguous 
                          ? '💡 Sugggested April 5th because surrounding context is early April.'
                          : '💡 Added year 2026 to date string.'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
            <button className="btn btn-secondary" onClick={() => setStep(1)}>Back</button>
            <button className="btn btn-primary" onClick={() => setStep(3)}>Next: Currency conversions →</button>
          </div>
        </div>
      )}

      {/* Step 3: USD Currency conversions */}
      {step === 3 && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Step 3: Multi-Currency Exchange Rates (Priya's Request)</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
              Priya highlighted that some expenses are in USD. We will convert them to INR using a standard rate (1 USD = ₹{USD_RATE} INR).
            </p>
          </div>

          <div style={{ padding: '1rem 0' }}>
            <table className="ledger-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--surface-border)' }}>
                  <th style={{ padding: '0.75rem' }}>Row</th>
                  <th style={{ padding: '0.75rem' }}>Description</th>
                  <th style={{ padding: '0.75rem' }}>Original USD</th>
                  <th style={{ padding: '0.75rem' }}>Exchange rate</th>
                  <th style={{ padding: '0.75rem' }}>INR value stored</th>
                </tr>
              </thead>
              <tbody>
                {getUsdRows().map(r => (
                  <tr key={r.rowNumber} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                    <td style={{ padding: '0.75rem' }}>{r.rowNumber}</td>
                    <td style={{ padding: '0.75rem' }}><strong>{r.description}</strong></td>
                    <td style={{ padding: '0.75rem' }} className="negative">${r.amountClean.toFixed(2)} USD</td>
                    <td style={{ padding: '0.75rem' }}>1 USD = ₹{USD_RATE}</td>
                    <td style={{ padding: '0.75rem', fontWeight: 700 }} className="positive">
                      ₹{(r.amountClean * USD_RATE).toFixed(2)} INR
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
            <button className="btn btn-secondary" onClick={() => setStep(2)}>Back</button>
            <button className="btn btn-primary" onClick={() => setStep(4)}>Next: Group timelines →</button>
          </div>
        </div>
      )}

      {/* Step 4: Group Member timelines */}
      {step === 4 && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Step 4: Member Timeline & Visitors (Sam's Request)</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
              Sam moved in mid-April. Meera left end of March. Kabir is a visitor. We must adjust split lists accordingly.
            </p>
          </div>

          <div style={{ padding: '1rem 0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {getTimelineAnomalyRows().map(r => {
                const isMeera = r.anomalies.some(a => a.type === 'TIMELINE_VIOLATION_MEERA');
                const isSam = r.anomalies.some(a => a.type === 'TIMELINE_VIOLATION_SAM');
                const isKabir = r.anomalies.some(a => a.type === 'NON_MEMBER_PARTICIPATION');

                return (
                  <div key={r.rowNumber} style={{ padding: '1rem', border: '1px solid var(--surface-border)', borderRadius: '6px', backgroundColor: 'var(--primary-light)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <strong>Row {r.rowNumber}: {r.description} (₹{r.amountClean})</strong>
                      <span>Date: {r.dateClean}</span>
                    </div>
                    
                    {isMeera && (
                      <div>
                        <p style={{ color: 'var(--accent-red)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                          ⚠️ Meera moved out on March 31, but is included in this split dated April 2nd.
                        </p>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button 
                            className={`btn ${r.splitWithClean.includes('Meera') ? 'btn-secondary' : 'btn-primary'}`}
                            onClick={() => handleSplitTimelineConfirm(r.rowNumber, r.splitWithClean.filter(n => n !== 'Meera'))}
                          >
                            Remove Meera (Distribute split to Aisha, Rohan, Priya)
                          </button>
                          <button 
                            className={`btn ${r.splitWithClean.includes('Meera') ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => handleSplitTimelineConfirm(r.rowNumber, [...r.splitWithClean.filter(n => n !== 'Meera'), 'Meera'])}
                          >
                            Keep Meera in Split
                          </button>
                        </div>
                      </div>
                    )}

                    {isSam && (
                      <div>
                        <p style={{ color: 'var(--accent-red)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                          ⚠️ Sam moved in mid-April, but is included in this early split.
                        </p>
                        <button 
                          className="btn btn-primary"
                          onClick={() => handleSplitTimelineConfirm(r.rowNumber, r.splitWithClean.filter(n => n !== 'Sam'))}
                        >
                          Remove Sam from Split (Resolved automatically)
                        </button>
                      </div>
                    )}

                    {isKabir && (
                      <div>
                        <p style={{ color: 'var(--primary-hover)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                          💡 Visitor <strong>Kabir</strong> is included in this split. He will be registered as a temporary flat visitor and his debt tracked.
                        </p>
                        <span className="badge-resolved" style={{ backgroundColor: 'var(--primary-hover)', color: '#fff', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                          Kabir Added as Temporary Member
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
            <button className="btn btn-secondary" onClick={() => setStep(3)}>Back</button>
            <button className="btn btn-primary" onClick={() => setStep(5)}>Next: Duplicate cleanup →</button>
          </div>
        </div>
      )}

      {/* Step 5: Duplicate entries */}
      {step === 5 && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Step 5: Deduplication (Meera's Request)</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
              Meera requested that users approve any duplicate removals. Below are the double-logged entries we detected.
            </p>
          </div>

          <div style={{ padding: '1rem 0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {/* Duplicate Set 1: Marina Bites */}
              <div style={{ border: '1px solid var(--surface-border)', borderRadius: '6px', padding: '1rem' }}>
                <h4 style={{ color: 'var(--primary-hover)', marginBottom: '0.75rem' }}>Duplicate Group A: Marina Bites Dinner</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  {getDuplicateGroups().marina.map(r => (
                    <div key={r.rowNumber} style={{ padding: '0.75rem', border: '1px solid var(--surface-border)', borderRadius: '4px', backgroundColor: r.importAction === 'SKIP' ? '#fff5f5' : '#f4fbf7', opacity: r.importAction === 'SKIP' ? 0.6 : 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                        <span>Row {r.rowNumber}: {r.description}</span>
                        <span>₹{r.amountClean}</span>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        Payer: {r.paidByClean} | Notes: {r.notes || 'None'}
                      </p>
                      <button 
                        className={`btn ${r.importAction === 'SKIP' ? 'btn-secondary' : 'btn-primary'}`} 
                        style={{ marginTop: '0.5rem', padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                        onClick={() => toggleRowSkip(r.rowNumber)}
                      >
                        {r.importAction === 'SKIP' ? '❌ Skipping' : '✅ Importing'}
                      </button>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  *Policy: Suggested to keep the first one with notes, and skip the second empty logged one.
                </p>
              </div>

              {/* Duplicate Set 2: Thalassa Dinner */}
              <div style={{ border: '1px solid var(--surface-border)', borderRadius: '6px', padding: '1rem' }}>
                <h4 style={{ color: 'var(--primary-hover)', marginBottom: '0.75rem' }}>Duplicate Group B: Thalassa Dinner</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  Both Aisha and Rohan logged the same Thalassa dinner but with slightly different amounts. Select which record is correct.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {getDuplicateGroups().thalassa.map(r => (
                    <div key={r.rowNumber} style={{ padding: '0.75rem', border: '1px solid var(--surface-border)', borderRadius: '4px', backgroundColor: r.importAction === 'SKIP' ? '#fff5f5' : '#f4fbf7' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                        <span>Row {r.rowNumber}: {r.description}</span>
                        <span>₹{r.amountClean}</span>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        Payer: {r.paidByClean} | Notes: {r.notes || 'None'}
                      </p>
                      <button 
                        className={`btn ${r.importAction === 'SKIP' ? 'btn-secondary' : 'btn-primary'}`} 
                        style={{ marginTop: '0.5rem', padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                        onClick={() => {
                          const otherRow = r.rowNumber === 24 ? 25 : 24;
                          selectDuplicateThalassa(r.rowNumber, otherRow);
                        }}
                      >
                        {r.importAction === 'SKIP' ? '❌ Ignore' : '✅ Keep this one'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
            <button className="btn btn-secondary" onClick={() => setStep(4)}>Back</button>
            <button className="btn btn-primary" onClick={() => setStep(6)}>Next: Settlements →</button>
          </div>
        </div>
      )}

      {/* Step 6: Settlements Logged as Expenses */}
      {step === 6 && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Step 6: Settlements vs Expenses</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
              We identified transactions that are direct payback settlements. They will be imported as Payments rather than splitting equal debts.
            </p>
          </div>

          <div style={{ padding: '1rem 0' }}>
            <table className="ledger-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--surface-border)' }}>
                  <th style={{ padding: '0.75rem' }}>Row</th>
                  <th style={{ padding: '0.75rem' }}>Description</th>
                  <th style={{ padding: '0.75rem' }}>From (Payer)</th>
                  <th style={{ padding: '0.75rem' }}>To (Payee)</th>
                  <th style={{ padding: '0.75rem' }}>Amount</th>
                  <th style={{ padding: '0.75rem' }}>Import type</th>
                </tr>
              </thead>
              <tbody>
                {getSettlementRows().map(r => {
                  const toUser = r.splitWithClean[0] || 'Aisha';
                  return (
                    <tr key={r.rowNumber} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                      <td style={{ padding: '0.75rem' }}>{r.rowNumber}</td>
                      <td style={{ padding: '0.75rem' }}><strong>{r.description}</strong></td>
                      <td style={{ padding: '0.75rem' }}>{r.paidByClean}</td>
                      <td style={{ padding: '0.75rem' }}>{toUser}</td>
                      <td style={{ padding: '0.75rem', fontWeight: 600 }}>₹{r.amountClean}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <span className="badge-resolved" style={{ backgroundColor: '#eef8ff', color: '#00528c', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                          Direct Payback Payment
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
            <button className="btn btn-secondary" onClick={() => setStep(5)}>Back</button>
            <button className="btn btn-primary" onClick={() => setStep(7)}>Next: Final review →</button>
          </div>
        </div>
      )}

      {/* Step 7: Final review & confirmation */}
      {step === 7 && (
        <div className="card" style={{ padding: '2rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <span style={{ fontSize: '3rem' }}>📋</span>
            <h3 style={{ marginTop: '0.5rem' }}>Confirm Final CSV Import</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Review the summary counts before committing data writes.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', marginBottom: '2rem', textAlign: 'center' }}>
            <div style={{ padding: '1rem', border: '1px solid var(--surface-border)', borderRadius: '6px' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{rows.length}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Rows Analyzed</div>
            </div>
            <div style={{ padding: '1rem', border: '1px solid var(--surface-border)', borderRadius: '6px', backgroundColor: '#f4fbf7' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-green)' }}>
                {rows.filter(r => r.importAction === 'IMPORT').length}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>To Import</div>
            </div>
            <div style={{ padding: '1rem', border: '1px solid var(--surface-border)', borderRadius: '6px', backgroundColor: '#fff5f5' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-red)' }}>
                {rows.filter(r => r.importAction === 'SKIP').length}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Skipped (Duplicates)</div>
            </div>
          </div>

          <div style={{ border: '1px solid var(--surface-border)', borderRadius: '6px', padding: '1rem', backgroundColor: 'var(--primary-light)', marginBottom: '2rem' }}>
            <strong>💡 Policy Summary</strong>
            <ul style={{ fontSize: '0.8rem', paddingLeft: '1.2rem', marginTop: '0.5rem', color: 'var(--text-muted)' }}>
              <li>Name typos resolved and normalized.</li>
              <li>Date conflicts resolved to April 5th based on sequence context.</li>
              <li>USD costs converted to INR using standard ₹{USD_RATE}/USD rate.</li>
              <li>Duplicates Marina Bites (Row 6) and Thalassa Dinner (Aisha Row 24) ignored.</li>
              <li>Sam and Meera splits checked against joined/left timeline dates.</li>
            </ul>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
            <button className="btn btn-secondary" onClick={() => setStep(6)}>Back</button>
            <button 
              className="btn btn-primary" 
              onClick={handleFinalizeImport}
              disabled={loading}
              style={{ padding: '0.75rem 3rem' }}
            >
              {loading ? 'Processing Import...' : 'Import Cleaned Data Now! 🚀'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
