
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import QRCode from 'react-qr-code';
import { Employee } from './employeeSource';

function SmallLabel({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: 0, color: '#94a3b8', fontSize: 12 }}>{children}</p>;
}

export default function Preview() {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let intervalId: number | null = null;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');
        if (!id) {
          setError('No employee id provided');
          setLoading(false);
          return;
        }

        // Try localStorage first for offline support
        const stored = localStorage.getItem(`employee_${id}`);
        if (stored) {
          try {
            const emp = JSON.parse(stored);
            setEmployee(emp);
            setLoading(false);
            return;
          } catch (e) {
            // ignore parse error
          }
        }

        // Fall back to API
        const res = await fetch('/api/employees');
        if (!res.ok) throw new Error('Failed to fetch');
        const j = await res.json();
        const list: Employee[] = Array.isArray(j.employees) ? j.employees : [];
        const found = list.find((e) => e.id === id || e.qrCodeData === id);
        if (!found) {
          setError('Employee not found');
        } else {
          setEmployee(found);
        }
      } catch (err) {
        setError('Unable to load employee data');
      } finally {
        setLoading(false);
      }
    }

    load();
    intervalId = setInterval(load, 4000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  if (loading) return <div style={{ padding: 32 }}>Loading preview…</div>;
  if (error) return <div style={{ padding: 32 }}>{error}</div>;
  if (!employee) return null;

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 28 }}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        style={{ width: 520, borderRadius: 20, padding: 26, background: 'linear-gradient(180deg,#071022, #051224)', border: '1px solid rgba(148,163,184,0.06)', boxShadow: '0 28px 120px rgba(2,8,20,0.5)' }}
      >
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <div style={{ width: 110, height: 110, borderRadius: 16, overflow: 'hidden', background: '#0f172a', border: '1px solid rgba(148,163,184,0.06)' }}>
            <img src={employee.photoUrl || '/data/default.png'} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#0f172a' }} />
          </div>

          <div style={{ flex: 1 }}>
            <SmallLabel>Employee Preview</SmallLabel>
            <h2 style={{ margin: '6px 0 2px' }}>{employee.fullName}</h2>
            <p style={{ margin: 0, color: '#cbd5e1' }}>{employee.positionTitle || '—'}</p>
            <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
              <div>
                <SmallLabel>Name</SmallLabel>
                <p style={{ margin: 6 }}>{employee.fullName}</p>
              </div>
              <div>
                <SmallLabel>Department</SmallLabel>
                <p style={{ margin: 6 }}>{employee.department || '—'}</p>
              </div>
              <div>
                <SmallLabel>Company</SmallLabel>
                <p style={{ margin: 6 }}>{employee.companyName || '—'}</p>
              </div>
              <div>
                <SmallLabel>Location</SmallLabel>
                <p style={{ margin: 6 }}>{employee.location || '—'}</p>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 18, marginTop: 18, alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <SmallLabel>ID number</SmallLabel>
            <p style={{ margin: 6, fontWeight: 700 }}>{employee.id}</p>
            <SmallLabel>Email</SmallLabel>
            <p style={{ margin: 6 }}>{employee.emailAddress || '—'}</p>
          </div>

          <motion.div whileHover={{ scale: 1.03 }} style={{ textAlign: 'center' }}>
            <div style={{ background: '#fff', padding: 10, borderRadius: 10 }}>
              <QRCode value={window.location.href} size={136} bgColor="#ffffff" fgColor="#0f172a" />
            </div>
            <p style={{ margin: '10px 0 0', color: '#94a3b8' }}>Scan to open this preview</p>
          </motion.div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
          <a href="/" style={{ padding: '10px 14px', borderRadius: 12, background: 'transparent', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.06)', textDecoration: 'none' }}>Open app</a>
          <button
            style={{ padding: '10px 14px', borderRadius: 12, background: 'linear-gradient(135deg,#38bdf8,#818cf8)', border: 'none', fontWeight: 700 }}
            onClick={() => window.print()}
          >Print</button>
        </div>
      </motion.div>
    </div>
  );
}
