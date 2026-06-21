import { motion } from 'framer-motion';
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'react-qr-code';
import { Employee, employees as defaultEmployees, searchEmployees } from './employeeSource';
import { parseExcelFile } from './excelParser';

const API_BASE = '/api';
const ADMIN_CODE = 'Admin12345';
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
  const [defaultPhotoUrl, setDefaultPhotoUrl] = useState<string | null>(null);
  const [defaultPhotoPreview, setDefaultPhotoPreview] = useState<string | null>(null);
  const [photoFieldPreview, setPhotoFieldPreview] = useState<string | null>(null);
  const [defaultPhotoExists, setDefaultPhotoExists] = useState(false);
  const [qrMessage, setQrMessage] = useState('');
  const qrWrapperRef = useRef<HTMLDivElement | null>(null);

  const pageHeader = isAdminRoute ? 'Admin dashboard' : 'Public employee lookup';
  const pageSubTitle = isAdminRoute
    ? 'Upload source files and manage employee data. This area is restricted to admins only.'
    : 'Search employee records and view information. No upload or edit access is available here.';

  const filtered = useMemo(() => (query.trim() ? searchEmployees(employees, query) : []), [employees, query]);

  useEffect(() => {
    async function fetchDefault() {
      try {
        const res = await fetch(`${API_BASE}/admin/default-photo`, { headers: { 'x-admin-token': ADMIN_CODE } });
        if (!res.ok) return;
        const j = await res.json();
        setDefaultPhotoExists(!!j.exists);
        setDefaultPhotoUrl(j.url || null);
      } catch (err) {
        // ignore
      }
    }

    fetchDefault();
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setActive(null);
      return;
    }

    if (filtered.length > 0 && !active) {
      setActive(filtered[0]);
    } else if (filtered.length > 0 && active && !filtered.find((e) => e.id === active.id)) {
      setActive(filtered[0]);
    } else if (filtered.length === 0) {
      setActive(null);
    }
  }, [filtered, active, query]);

  useEffect(() => {
    setQrMessage('');
  }, [active?.id]);

  const activeData = active || null;

  const reportsToManager = useMemo(() => {
    if (!activeData?.reportsTo) return null;
    return (
      employees.find(
        (item) => item.fullName.trim().toLowerCase() === activeData.reportsTo.trim().toLowerCase()
      ) || null
    );
  }, [employees, activeData]);

  const reportsToEmail = reportsToManager?.emailAddress || '';
  const heroPhotoUrl = activeData?.photoUrl?.trim() ? activeData.photoUrl : defaultPhotoUrl || DEFAULT_AVATAR;
  const employeeCount = employees.length;
  const resultsCount = filtered.length;

  const buildQrUrl = (employeeId: string) => {
    if (typeof window === 'undefined') return '';
    const url = new URL(window.location.href);
    url.searchParams.set('id', employeeId);
    return url.toString();
  };

  const getActiveQrUrl = () => {
    if (!activeData) return '';
    return buildQrUrl(activeData.id);
  };

  const handleCopyQr = async () => {
    if (!activeData) return;
    try {
      await navigator.clipboard.writeText(getActiveQrUrl());
      setQrMessage('Profile QR link copied to clipboard.');
    } catch (err) {
      setQrMessage('Could not copy the QR link. Scan the code directly instead.');
    }
  };

  const handlePreviewProfile = () => {
    if (!activeData) return;
    window.open(getActiveQrUrl(), '_blank');
  };

  const handleSaveQr = () => {
    if (!activeData || !qrWrapperRef.current) return;

    const svg = qrWrapperRef.current.querySelector('svg');
    if (!svg) {
      setQrMessage('Unable to save QR code. Try again after selecting an employee.');
      return;
    }

    try {
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svg);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setQrMessage('Failed to save QR code. Browser canvas not supported.');
        return;
      }

      const img = new Image();
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
      const svgUrl = URL.createObjectURL(svgBlob);

      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(svgUrl);

        canvas.toBlob((blob) => {
          if (!blob) {
            setQrMessage('Failed to save QR code.');
            return;
          }
          const downloadUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = `${activeData.id}-employee-qr.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(downloadUrl);
          setQrMessage('QR code downloaded as PNG. Save this file for quick access.');
        }, 'image/png');
      };

      img.onerror = () => {
        URL.revokeObjectURL(svgUrl);
        setQrMessage('Failed to convert QR code to image.');
      };

      img.src = svgUrl;
    } catch (err) {
      setQrMessage('Error saving QR code. Try again.');
    }
  };

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
        setUploadMessage('');
        return result.employees;
      }
      return null;
    } catch (error) {
      console.error('Failed to fetch employees:', error);
      setFetchError('Unable to synchronize with the server. Using local sample data.');
      return null;
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

  const handleUploadDefaultPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setDefaultPhotoPreview(previewUrl);
    setDefaultPhotoUrl(previewUrl);
    setDefaultPhotoExists(true);

    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API_BASE}/admin/default-photo`, {
        method: 'POST',
        headers: { 'x-admin-token': ADMIN_CODE },
        body: fd,
      });
      const j = await res.json();
      if (res.ok) {
        setDefaultPhotoExists(true);
        setDefaultPhotoUrl(j.url || previewUrl);
        setDefaultPhotoPreview(null);
        setUploadMessage('Default photo uploaded successfully.');
      } else {
        setDefaultPhotoPreview(null);
        setDefaultPhotoUrl(defaultPhotoUrl);
        setUploadMessage(
          j.error ||
            'Failed to upload default photo. Confirm the admin server is running and the access code is correct.'
        );
      }
    } catch (err) {
      setDefaultPhotoPreview(null);
      setDefaultPhotoUrl(defaultPhotoUrl);
      setUploadMessage(
        'Failed to upload default photo. Check that the backend server is running at http://localhost:4000.'
      );
    }
  };

  const handleDeleteDefaultPhoto = async () => {
    if (!confirm('Delete the default photo?')) return;
    try {
      const res = await fetch(`${API_BASE}/admin/default-photo`, { method: 'DELETE', headers: { 'x-admin-token': ADMIN_CODE } });
      if (res.ok) {
        setDefaultPhotoExists(false);
        setDefaultPhotoUrl(null);
      } else {
        const j = await res.json();
        setUploadMessage(j.error || 'Failed to delete default photo');
      }
    } catch (err) {
      setUploadMessage('Failed to delete default photo');
    }
  };

  const handleUploadEmployeePhoto = async (field: string, file?: File) => {
    if (!activeData) return;
    const f = file;
    if (!f) return;

    const previewUrl = URL.createObjectURL(f);
    if (field === 'photo') {
      setPhotoFieldPreview(previewUrl);
    }

    try {
      const fd = new FormData();
      fd.append('file', f);
      const res = await fetch(`${API_BASE}/admin/photo/${activeData.id}?field=${field}`, {
        method: 'POST',
        headers: { 'x-admin-token': ADMIN_CODE },
        body: fd,
      });
      const j = await res.json();
      if (res.ok) {
        const newList = await fetchEmployees();
        if (newList && activeData) {
          const updated = newList.find((e: Employee) => e.id === activeData.id);
          if (updated) setActive(updated);
        }
        if (field === 'photo') {
          setPhotoFieldPreview(null);
        }
        if (j.updated === false) {
          setUploadMessage('Photo uploaded but employee record not found on server. Upload the Excel source via Admin first.');
        } else {
          setUploadMessage('Photo uploaded');
        }
      } else {
        if (field === 'photo') {
          setPhotoFieldPreview(null);
        }
        setUploadMessage(j.error || 'Failed to upload photo');
      }
    } catch (err) {
      if (field === 'photo') {
        setPhotoFieldPreview(null);
      }
      setUploadMessage('Failed to upload photo');
    }
  };

  const handleDeleteEmployeePhoto = async (field: string) => {
    if (!activeData) return;
    if (!confirm('Delete this photo?')) return;
    try {
      const res = await fetch(`${API_BASE}/admin/photo/${activeData.id}?field=${field}`, {
        method: 'DELETE',
        headers: { 'x-admin-token': ADMIN_CODE },
      });
      if (res.ok) {
        const j = await res.json();
        const newList = await fetchEmployees();
        if (newList && activeData) {
          const updated = newList.find((e: Employee) => e.id === activeData.id);
          if (updated) setActive(updated);
        }
        if (j.updated === false) {
          setUploadMessage('Photo removed from disk but employee record not found on server. Upload the Excel source via Admin first.');
        } else {
          setUploadMessage('Photo deleted');
        }
      } else {
        const j = await res.json();
        setUploadMessage(j.error || 'Failed to delete photo');
      }
    } catch (err) {
      setUploadMessage('Failed to delete photo');
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
          <div className="status-strip">
            <span className="status-pill">{loading ? 'Syncing...' : fetchError ? 'Warning' : 'Live'}</span>
            <p className={`status-banner ${fetchError ? 'warning' : loading ? 'loading' : 'success'}`}>
              {loading
                ? 'Synchronizing employee directory…'
                : fetchError
                ? fetchError
                : 'Live employee lookup is ready for any browser and device.'}
            </p>
          </div>
          <div className="metrics-row">
            <div className="metric-card">
              <p>Total employees</p>
              <strong>{employeeCount}</strong>
            </div>
            <div className="metric-card">
              <p>Search results</p>
              <strong>{query.trim() ? resultsCount : '-'}</strong>
            </div>
          </div>
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
                <motion.form
                  className="admin-panel"
                  onSubmit={handleAdminSubmit}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
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
                </motion.form>
              ) : (
                <>
                  <div className="upload-cta">
                    <label className="file-input-label" htmlFor="excel-upload">
                      <span>Choose Excel file</span>
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
                  <div className="default-photo-panel">
                    <p className="upload-title">Default profile photo</p>
                    <div className="default-photo-row">
                      <img src={defaultPhotoPreview || defaultPhotoUrl || DEFAULT_AVATAR} alt="Default" className="default-photo-preview" />
                      <div className="default-photo-actions">
                        <label className="file-input-label">
                          <span>Set default photo</span>
                          <input type="file" accept="image/*" className="file-input" onChange={handleUploadDefaultPhoto} />
                        </label>
                        <button className="delete-button" type="button" onClick={handleDeleteDefaultPhoto} disabled={!defaultPhotoExists}>
                          Delete default photo
                        </button>
                      </div>
                    </div>
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
              onChange={(e) => {
                setQuery(e.target.value);
              }}
              placeholder="Search by status, name, ID, department, company or code"
            />

            <div className="search-results">
              {!query.trim() ? (
                <p className="empty-state">Start typing to search the employee directory.</p>
              ) : filtered.length ? (
                filtered.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={item.id === activeData?.id ? 'search-item active' : 'search-item'}
                    onClick={() => setActive(item)}
                  >
                    <img src={item.photoUrl?.trim() ? item.photoUrl : (defaultPhotoUrl || DEFAULT_AVATAR)} alt="avatar" className="search-avatar" />
                    <div className="search-item-content">
                      <strong>{item.fullName}</strong>
                      <span>{item.id}</span>
                    </div>
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
          {activeData ? (
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
                  <h3>{activeData.fullName}</h3>

                  <div className="selection-meta">
                    <span className="selection-role">{activeData.positionTitle}</span>
                    <span>{activeData.department}</span>
                    <span>{activeData.location}</span>
                  </div>
                  <p className="selection-status">{activeData.status}</p>
                </div>
              </div>

              <div className="field-grid">
                <div className="field-block">
                  <label>ID Number</label>
                  <p>{activeData.id}</p>
                </div>
                <div className="field-block">
                  <label>Company</label>
                  <p>{activeData.companyName || '—'}</p>
                </div>
                <div className="field-block">
                  <label>Division</label>
                  <p>{activeData.division || '—'}</p>
                </div>
              </div>

              <div className="field-grid">
                <div className="field-block">
                  <label>Position Title</label>
                  <p>{activeData.positionTitle}</p>
                </div>
                <div className="field-block">
                  <label>Department</label>
                  <p>{activeData.department}</p>
                </div>
                <div className="field-block">
                  <label>Sub Department</label>
                  <p>{activeData.subDepartment || '—'}</p>
                </div>
              </div>

              <div className="field-grid">
                <div className="field-block">
                  <label>Gender</label>
                  <p>{activeData.gender}</p>
                </div>
                <div className="field-block">
                  <label>Nationality</label>
                  <p>{activeData.nationality || '—'}</p>
                </div>
                <div className="field-block">
                  <label>Date of Birth</label>
                  <p>{activeData.dateOfBirth || '—'}</p>
                </div>
              </div>

              <div className="field-grid">
                <div className="field-block">
                  <label>Email</label>
                  <p>{activeData.emailAddress || '—'}</p>
                </div>
                <div className="field-block">
                  <label>Location</label>
                  <p>{activeData.location}</p>
                </div>
              </div>

              <div className="field-grid">
                <div className="field-block">
                  <label>Reports to</label>
                  <div className="reports-to-display">
                    <p className="reports-to-name">{activeData.reportsTo || '—'}</p>
                    {reportsToEmail ? (
                      <p className="reports-to-detail">{reportsToEmail}</p>
                    ) : null}
                  </div>
                </div>
                <div className="field-block">
                  <label>Home page</label>
                  <p><a href={activeData.homePage || 'http://www.masdar.co'} target="_blank" rel="noreferrer">{activeData.homePage || 'http://www.masdar.co'}</a></p>
                </div>
                <div className="field-block blank-field">
                  <p>&nbsp;</p>
                </div>
              </div>

              <div className="upload-grid">
                <div className="upload-card photo-field-card">
                  <label>Photo field</label>
                  <div className="photo-field-row">
                    <div className="photo-field-preview">
                      <img
                        src={photoFieldPreview || activeData?.photoUrl || DEFAULT_AVATAR}
                        alt="Photo preview"
                      />
                    </div>
                    {isAdmin ? (
                      <div className="photo-field-actions photo-field-actions-bottom">
                        <label className="file-input-label">
                          <span>Set photo</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="file-input"
                            onChange={(e) => handleUploadEmployeePhoto('photo', e.target.files?.[0])}
                          />
                        </label>
                        <button className="delete-button" type="button" onClick={() => handleDeleteEmployeePhoto('photo')}>
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="upload-card">
                  <label>ID photo field 1</label>
                  {isAdmin ? (
                    <div className="upload-actions">
                      <label className="file-input-label">
                        <span>Upload ID front</span>
                        <input type="file" accept="image/*" className="file-input" onChange={(e) => handleUploadEmployeePhoto('id1', e.target.files?.[0])} />
                      </label>
                      <button className="delete-button" type="button" onClick={() => handleDeleteEmployeePhoto('id1')}>
                        Delete
                      </button>
                    </div>
                  ) : (
                    <div className="upload-placeholder">Upload front of ID</div>
                  )}
                </div>

                <div className="upload-card">
                  <label>ID photo field 2</label>
                  {isAdmin ? (
                    <div className="upload-actions">
                      <label className="file-input-label">
                        <span>Upload ID back</span>
                        <input type="file" accept="image/*" className="file-input" onChange={(e) => handleUploadEmployeePhoto('id2', e.target.files?.[0])} />
                      </label>
                      <button className="delete-button" type="button" onClick={() => handleDeleteEmployeePhoto('id2')}>
                        Delete
                      </button>
                    </div>
                  ) : (
                    <div className="upload-placeholder">Upload back of ID</div>
                  )}
                </div>

                <div className="upload-card">
                  <label>PDF field</label>
                  <div className="upload-placeholder">Attach document</div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="details-card details-placeholder"
            >
              <div className="placeholder-copy">
                <p className="detail-label">Employee profile is empty</p>
                <h3>Search to populate employee information.</h3>
                <p className="placeholder-note">The fields will remain blank until a valid search result is selected.</p>
              </div>
            </motion.div>
          )}
        </section>

        <section className="panel panel-qr">
          <div className="section-header">
            <span className="tag">QR Asset</span>
            <h2>Smart access token</h2>
          </div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className={activeData ? 'qr-card' : 'qr-card qr-placeholder'}
          >
            {activeData ? (
              <>
                <div className="qr-actions-row">
                  <button className="copy-button" type="button" onClick={handleCopyQr}>
                    Copy QR link
                  </button>
                  <button className="preview-button" type="button" onClick={handlePreviewProfile}>
                    Preview profile
                  </button>
                  <button className="save-button" type="button" onClick={handleSaveQr}>
                    Save QR code
                  </button>
                </div>

                <div className="qr-box" ref={qrWrapperRef}>
                  <QRCode value={getActiveQrUrl()} size={192} bgColor="#f8fafc" fgColor="#0f172a" />
                </div>
                <p className="qr-detail">
                  Scan this QR to open the employee profile directly.
                </p>
                {qrMessage ? <p className="qr-message">{qrMessage}</p> : null}
                <div className="qr-meta">
                  <span>{activeData.id}</span>
                  <span>{activeData.location}</span>
                </div>
              </>
            ) : (
              <div className="qr-empty-state">
                <p>QR profile is empty.</p>
                <span>Search or select an employee to view the profile QR.</span>
              </div>
            )}
          </motion.div>
        </section>
      </main>
    </div>
  );
}

export default App;
