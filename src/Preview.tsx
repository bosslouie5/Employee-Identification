
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import QRCode from 'react-qr-code';
import { Employee } from './employeeSource';

function SmallLabel({ children }: { children: React.ReactNode }) {
  return <p className="preview-small-label">{children}</p>;
}

export default function Preview() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  const getStoredEmployee = (): Employee | null => {
    if (!id) return null;
    const stored = localStorage.getItem(`employee_${id}`);
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  };

  const initialEmployee = getStoredEmployee();
  const [employee, setEmployee] = useState<Employee | null>(initialEmployee);
  const [loading, setLoading] = useState(initialEmployee === null);
  const [error, setError] = useState('');

  useEffect(() => {
    let intervalId: number | null = null;

    async function load() {
      if (!id) {
        setError('No employee id provided');
        setLoading(false);
        return;
      }

      const stored = getStoredEmployee();
      if (stored) {
        setEmployee(stored);
        setError('');
        setLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/employees');
        if (!res.ok) throw new Error('Failed to fetch');
        const j = await res.json();
        const list: Employee[] = Array.isArray(j.employees) ? j.employees : [];
        const found = list.find((e) => e.id === id || e.qrCodeData === id);
        if (found) {
          setEmployee(found);
          setError('');
        } else {
          setError('Employee not found. (Tip: The profile will be available if you save the QR code.)');
        }
      } catch (apiErr) {
        if (!employee) {
          setError('Unable to load employee data. Check your connection or save the QR code for offline access.');
        }
      } finally {
        setLoading(false);
      }
    }

    if (initialEmployee === null) {
      setLoading(true);
    }
    load();
    intervalId = window.setInterval(load, 4000);

    return () => {
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [id]);

  if (loading) return <div className="preview-shell preview-state">Loading preview…</div>;
  if (error) return <div className="preview-shell preview-state">{error}</div>;
  if (!employee) return null;

  return (
    <div className="preview-shell">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="preview-card"
      >
        <div className="preview-top-row">
          <div className="preview-avatar-frame">
            <img src={employee.photoUrl || '/data/default.png'} alt="avatar" className="preview-avatar" />
          </div>

          <div className="preview-details">
            <SmallLabel>Employee Preview</SmallLabel>
            <h2 className="preview-heading">{employee.fullName}</h2>
            <p className="preview-subtitle">{employee.positionTitle || '—'}</p>
            <div className="preview-grid">
              <div>
                <SmallLabel>Name</SmallLabel>
                <p className="preview-field">{employee.fullName}</p>
              </div>
              <div>
                <SmallLabel>Department</SmallLabel>
                <p className="preview-field">{employee.department || '—'}</p>
              </div>
              <div>
                <SmallLabel>Company</SmallLabel>
                <p className="preview-field">{employee.companyName || '—'}</p>
              </div>
              <div>
                <SmallLabel>Location</SmallLabel>
                <p className="preview-field">{employee.location || '—'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="preview-action-row">
          <div>
            <SmallLabel>ID number</SmallLabel>
            <p className="preview-field preview-strong">{employee.id}</p>
            <SmallLabel>Email</SmallLabel>
            <p className="preview-field">{employee.emailAddress || '—'}</p>
          </div>

          <motion.div whileHover={{ scale: 1.03 }} className="preview-qr-panel">
            <div className="preview-qr-box">
              <QRCode value={window.location.href} size={136} bgColor="#ffffff" fgColor="#0f172a" />
            </div>
            <p className="preview-note">Scan to open this preview</p>
          </motion.div>
        </div>

        <div className="preview-button-row">
          <a href="/" className="preview-link">Open app</a>
          <button className="preview-print-button" onClick={() => window.print()}>
            Print
          </button>
        </div>
      </motion.div>
    </div>
  );
}
