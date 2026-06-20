import { motion } from 'framer-motion';
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import QRCode from 'react-qr-code';
import { Employee, employees as defaultEmployees, searchEmployees } from './employeeSource';
import { parseExcelFile } from './excelParser';

const API_BASE = '/api';
const ADMIN_CODE = 'MTS-ADMIN-2026';
const DEFAULT_AVATAR =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="24" fill="%2310202e"/><circle cx="60" cy="40" r="24" fill="%2394a3b8"/><path d="M30 100c0-18 14-32 30-32s30 14 30 32" fill="%2394a3b8"/></svg>';

const isAdminRoute = typeof window !== 'undefined' && window.location.pathname === '/admin';

function App() {
  const [employees, setEmployees] = useState<Employee[]>(defaultEmployees);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<Employee | null>(null);
  const [uploadMessage, setUploadMessage] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [adminMessage, setAdminMessage] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const pageHeader = isAdminRoute ? 'Admin dashboard' : 'Public employee lookup';
  const pageSubTitle = isAdminRoute
    ? 'Upload source files and manage employee data. This area is restricted to admins only.'
    : 'Search employee records and view information. No upload or edit access is available here.';

  const filtered = useMemo(() => searchEmployees(employees, query), [employees, query]);
  
  useEffect(() => {
    if (filtered.length > 0 && !active) {
      setActive(filtered[0]);
    } else if (filtered.length > 0 && active && !filtered.find(e => e.id === active.id)) {
      setActive(filtered[0]);
    }
  }, [filtered, active]);

  const activeData = active || (query.trim() ? filtered[0] : null) || null;

  const reportsToManager = useMemo(() => {
    if (!activeData?.reportsTo) return null;
    return (
      employees.find(
        (item) => item.fullName.trim().toLowerCase() === activeData.reportsTo.trim().toLowerCase()
      ) || null
    );
  }, [employees, activeData]);

  const reportsToEmail = reportsToManager?.emailAddress || '';
  const heroPhotoUrl = activeData?.photoUrl?.trim() ? activeData.photoUrl : DEFAULT_AVATAR;

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    setFetchError('');

    try {
      const response = await fetch(`${API_BASE}/employees`);
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      const result = await response.json();
      if (Array.isArray(result.employees)) {
        setEmployees(result.employees);
        setActive(result.employees[0] || null);
        setUploadMessage('');
      }
    } catch (error) {
      console.error('Failed to fetch employees:', error);
      setFetchError('Unable to synchronize with the server. Using local sample data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchEmployees();
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchEmployees]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
      setUploadMessage('Please upload a valid Excel file (.xlsx or .xls).');
      return;
    }

    setUploadMessage('Parsing file and preparing the latest employee directory...');

    try {
      const parsedEmployees = await parseExcelFile(file);
      if (!parsedEmployees.length) {
        setUploadMessage('No valid records found in the uploaded Excel file.');
        return;
      }

      setEmployees(parsedEmployees);
      setActive(parsedEmployees[0] || null);
      setQuery('');

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        headers: {
          'x-admin-token': ADMIN_CODE,
        },
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) {
        setUploadMessage(
          result.error
            ? `Upload failed: ${result.error}`
            : 'Upload failed. The file data is previewed locally, but server sync is unavailable.'
        );
        return;
      }

      setUploadMessage(`Imported ${result.imported} records successfully.`);
      await fetchEmployees();
    } catch (error) {
      console.error('Upload failed:', error);
      setUploadMessage('Upload failed. The file data is previewed locally, but server sync is unavailable.');
    }
  };

  const handleDeleteSource = async () => {
    const confirmed = window.confirm('Delete the uploaded source file and clear server data?');
    if (!confirmed) return;

    setUploadMessage('Deleting uploaded source file...');

    try {
      const response = await fetch(`${API_BASE}/source`, {
        method: 'DELETE',
        headers: {
          'x-admin-token': ADMIN_CODE,
        },
      });

      const result = await response.json();
      if (!response.ok) {
        setUploadMessage(result.error || 'Delete failed. Confirm admin access.');
        return;
      }

      setEmployees([]);
      setActive(null);
      setQuery('');
      setUploadMessage(result.message || 'Source file deleted successfully.');
    } catch (error) {
      console.error('Delete source failed:', error);
      setUploadMessage('Delete failed. Check network and server status.');
    }
  };

  const handleAdminSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (adminPin.trim() === ADMIN_CODE) {
      setIsAdmin(true);
      setAdminMessage('Access granted. Excel upload enabled.');
      setAdminPin('');
      return;
    }

    setAdminMessage('Invalid access code. Upload is restricted to the admin only.');
  };

  const clearMessage = () => setUploadMessage('');

  return (
    <div className="page-shell">
      <motion.header
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        className="page-header"
      >
        <div>
          <p className="eyebrow">Employee Sync Hub</p>
          <h1>{pageHeader}</h1>
          <p className="subtitle">{pageSubTitle}</p>
          <p className={`status-banner ${fetchError ? 'warning' : loading ? 'loading' : 'success'}`}>
            {loading
              ? 'Synchronizing employee directory…'
              : fetchError
              ? fetchError
              : 'Live employee lookup is ready for any browser and device.'}
          </p>
        </div>
      </motion.header>

      <main className="layout-grid">
        <section className="panel panel-search">
          <div className="section-header">
            <span className="tag">Live Search</span>
            <h2>Auto-fill and lookup</h2>
          </div>

          {isAdminRoute ? (
            <div className="excel-upload">
              <div className="upload-meta">
                <p className="upload-title">Admin-only Excel upload</p>
                <p className="upload-description">
                  Excel import is restricted to admin access only. Use the upload panel to update the master employee source.
                </p>
              </div>

              {!isAdmin ? (
                <form className="admin-panel" onSubmit={handleAdminSubmit}>
                  <input
                    className="admin-input"
                    type="password"
                    value={adminPin}
                    onChange={(e) => setAdminPin(e.target.value)}
                    placeholder="Enter admin access code"
                  />
                  <button className="admin-button" type="submit">
                    Unlock upload
                  </button>
                  {adminMessage && <p className="admin-message">{adminMessage}</p>}
                </form>
              ) : (
                <>
                  <div className="upload-cta">
                    <label className="file-input-label" htmlFor="excel-upload">
                      Choose Excel file
                      <input
                        id="excel-upload"
                        className="file-input"
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleFileChange}
                      />
                    </label>
                    <p className="upload-note">Upload will update the employee list for all users in the current app session.</p>
                  </div>
                  <div className="admin-actions">
                    <button className="delete-button" type="button" onClick={handleDeleteSource}>
                      Delete uploaded source file
                    </button>
                  </div>
                  {uploadMessage && <p className="upload-message">{uploadMessage}</p>}
                </>
              )}
            </div>
          ) : (
            <div className="public-note">
              <p>Search employee records and view details. Upload and edit access is disabled for public users.</p>
            </div>
          )}

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="search-card"
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by status, name, ID, department, company or code"
            />

            <div className="search-results">
              {filtered.length ? (
                filtered.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={item.id === activeData?.id ? 'search-item active' : 'search-item'}
                    onClick={() => setActive(item)}
                  >
                    <strong>{item.fullName}</strong>
                    <span>{item.id}</span>
                  </button>
                ))
              ) : (
                <p className="empty-state">No records found. Try another keyword.</p>
              )}
            </div>
          </motion.div>
        </section>

        <section className="panel panel-details">
          <div className="section-header">
            <span className="tag">Profile</span>
            <h2>Employee information</h2>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="details-card"
          >
            <div className="hero-card">
              <div className="photo-frame">
                <img className="hero-photo" src={heroPhotoUrl} alt="Employee photo" />
              </div>
              <div className="hero-copy">
                <p className="detail-label">Current selection</p>
                <h3>{activeData?.fullName}</h3>

                <div className="selection-meta">
                  <span className="selection-role">{activeData?.positionTitle} · {activeData?.department}</span>
                </div>
                <p className="selection-status">{activeData?.status}</p>
              </div>
            </div>

            <div className="field-grid">
              <div className="field-block">
                <label>ID Number</label>
                <p>{activeData?.id}</p>
              </div>
              <div className="field-block">
                <label>Company</label>
                <p>{activeData?.companyDisplay}</p>
              </div>
            </div>

            <div className="field-grid">
              <div className="field-block">
                <label>Position Title</label>
                <p>{activeData?.positionTitle}</p>
              </div>
              <div className="field-block">
                <label>Department</label>
                <p>{activeData?.department}</p>
              </div>
            </div>

            <div className="field-grid">
              <div className="field-block">
                <label>Gender</label>
                <p>{activeData?.gender}</p>
              </div>
              <div className="field-block">
                <label>Sub Department</label>
                <p>{activeData?.subDepartment}</p>
              </div>
            </div>

            <div className="field-grid">
              <div className="field-block">
                <label>Phone</label>
                <p>{activeData?.phoneNumber}</p>
              </div>
              <div className="field-block">
                <label>Cost Centre Code</label>
                <p>{activeData?.costCentreCode}</p>
              </div>
            </div>

            <div className="field-grid">
              <div className="field-block">
                <label>Email</label>
                <p>{activeData?.emailAddress}</p>
              </div>
              <div className="field-block">
                <label>Location Group</label>
                <p>{activeData?.location}</p>
              </div>
            </div>

            <div className="field-grid">
              <div className="field-block">
                <label>Reports to</label>
                <div className="reports-to-display">
                  <p className="reports-to-name">{activeData?.reportsTo || '—'}</p>
                  {reportsToEmail ? (
                    <p className="reports-to-detail">{reportsToEmail}</p>
                  ) : null}
                </div>
              </div>
              <div className="field-block blank-field">&nbsp;</div>
            </div>

            <div className="upload-grid">
              <div className="upload-card">
                <label>Photo field</label>
                <div className="upload-placeholder">Drag or select file</div>
              </div>
              <div className="upload-card">
                <label>ID photo field 1</label>
                <div className="upload-placeholder">Upload front of ID</div>
              </div>
              <div className="upload-card">
                <label>ID photo field 2</label>
                <div className="upload-placeholder">Upload back of ID</div>
              </div>
              <div className="upload-card">
                <label>PDF field</label>
                <div className="upload-placeholder">Attach document</div>
              </div>
            </div>
          </motion.div>
        </section>

        <section className="panel panel-qr">
          <div className="section-header">
            <span className="tag">QR Asset</span>
            <h2>Smart access token</h2>
          </div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="qr-card"
          >
            <div className="qr-box">
              <QRCode value={activeData?.qrCodeData || 'N/A'} size={168} bgColor="#f8fafc" fgColor="#0f172a" />
            </div>
            <p className="qr-detail">Scan to preview the employee ID or synchronize the record instantly.</p>
            <div className="qr-meta">
              <span>{activeData?.id}</span>
              <span>{activeData?.location}</span>
            </div>
          </motion.div>
        </section>
      </main>
    </div>
  );
}

export default App;
