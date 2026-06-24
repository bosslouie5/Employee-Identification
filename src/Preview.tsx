
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import QRCode from 'react-qr-code';
import html2canvas from 'html2canvas';
import { Employee } from './employeeSource';

async function waitForImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll<HTMLImageElement>('img'));
  await Promise.all(
    images.map((img) => {
      img.crossOrigin = 'anonymous';
      if (img.complete && img.naturalWidth !== 0) {
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        img.addEventListener('load', () => resolve(), { once: true });
        img.addEventListener('error', () => resolve(), { once: true });
      });
    })
  );
}

async function fetchDataUrl(url: string) {
  if (!url || url.startsWith('data:')) return url;
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return url;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to convert image to data URL'));
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    return url;
  }
}

async function inlineImageSources(root: HTMLElement) {
  const originalSrcs: Array<{ img: HTMLImageElement; src: string }> = [];
  const images = Array.from(root.querySelectorAll<HTMLImageElement>('img'));
  await Promise.all(
    images.map(async (img) => {
      const src = img.src;
      if (!src || src.startsWith('data:')) return;
      try {
        const dataUrl = await fetchDataUrl(src);
        if (dataUrl && dataUrl.startsWith('data:')) {
          originalSrcs.push({ img, src });
          img.src = dataUrl;
        }
      } catch {
        // keep original source if conversion fails
      }
    })
  );
  return originalSrcs;
}

function restoreImageSources(images: Array<{ img: HTMLImageElement; src: string }>) {
  for (const { img, src } of images) {
    img.src = src;
  }
}

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
      const parsed = JSON.parse(stored);
      return {
        status: parsed.status || 'Active',
        id: parsed.id || id,
        fullName: parsed.fullName || '',
        positionTitle: parsed.positionTitle || '',
        department: parsed.department || '',
        subDepartment: parsed.subDepartment || '',
        division: parsed.division || '',
        companyName: parsed.companyName || '',
        location: parsed.location || '',
        nationality: parsed.nationality || '',
        dateOfBirth: parsed.dateOfBirth || '',
        homePage: parsed.homePage || 'http://www.masdar.co',
        emailAddress: parsed.emailAddress || '',
        gender: parsed.gender || '',
        reportsTo: parsed.reportsTo || '',
        phoneNumber: parsed.phoneNumber || '',
        photoUrl: parsed.photoUrl || '/data/default.png',
        idPhoto1: parsed.idPhoto1 || '',
        idPhoto2: parsed.idPhoto2 || '',
        pdfFile: parsed.pdfFile || '',
        qrCodeData: parsed.qrCodeData || parsed.id || id,
      };
    } catch {
      return null;
    }
  };

  const initialEmployee = getStoredEmployee();
  const [employee, setEmployee] = useState<Employee | null>(initialEmployee);
  const [loading, setLoading] = useState(initialEmployee === null);
  const [error, setError] = useState('');
  const employeeRef = useRef<Employee | null>(initialEmployee);

  useEffect(() => {
    employeeRef.current = employee;
  }, [employee]);

  const isEmployeeEqual = (a: Employee, b: Employee) => {
    return (
      a.id === b.id &&
      a.fullName === b.fullName &&
      a.positionTitle === b.positionTitle &&
      a.companyName === b.companyName &&
      a.location === b.location &&
      a.emailAddress === b.emailAddress &&
      a.phoneNumber === b.phoneNumber &&
      a.homePage === b.homePage &&
      a.photoUrl === b.photoUrl &&
      a.qrCodeData === b.qrCodeData
    );
  };

  const cacheUpdatedPreview = async (updated: Employee) => {
    try {
      localStorage.setItem(`employee_${updated.id}`, JSON.stringify(updated));
    } catch (err) {
      console.warn('Could not cache updated preview', err);
    }
  };

  useEffect(() => {
    async function load() {
      if (!id) {
        setError('No employee id provided');
        setLoading(false);
        return;
      }

      const stored = getStoredEmployee();
      if (stored && (!employeeRef.current || !isEmployeeEqual(employeeRef.current, stored))) {
        setEmployee(stored);
        setError('');
        setLoading(false);
      }

      try {
        const res = await fetch('/api/employees');
        if (!res.ok) {
          const text = await res.text().catch(() => res.statusText || 'Unknown error');
          console.error('API /api/employees error', res.status, text);
          if (!stored) {
            setError(`API error ${res.status}: ${text}`);
          }
          setLoading(false);
          return;
        }
        const j = await res.json();
        const list: Employee[] = Array.isArray(j.employees) ? j.employees : [];
        const found = list.find((e) => e.id === id || e.qrCodeData === id);
        if (found) {
          const merged = { ...found };
          if (stored?.photoUrl && stored.photoUrl.startsWith('data:') && !found.photoUrl) {
            merged.photoUrl = stored.photoUrl;
          }
          if (stored?.idPhoto1 && stored.idPhoto1.startsWith('data:') && !found.idPhoto1) {
            merged.idPhoto1 = stored.idPhoto1;
          }
          if (stored?.idPhoto2 && stored.idPhoto2.startsWith('data:') && !found.idPhoto2) {
            merged.idPhoto2 = stored.idPhoto2;
          }
          if (!employeeRef.current || !isEmployeeEqual(employeeRef.current, merged)) {
            setEmployee(merged);
            await cacheUpdatedPreview(merged);
          }
          setError('');
        } else if (!stored) {
          setError('Employee not found. (Tip: The profile will be available if you save the QR code.)');
        }
      } catch (apiErr) {
        console.error('Failed fetching /api/employees', apiErr);
        if (!employee) {
          const message = apiErr instanceof Error ? apiErr.message : String(apiErr || 'Unable to load employee data.');
          setError(message);
        }
      } finally {
        setLoading(false);
      }
    }

    if (initialEmployee === null) {
      setLoading(true);
    }
    load();
  }, [id]);

  if (loading) return <div className="preview-shell preview-state">Loading preview…</div>;
  if (error) return <div className="preview-shell preview-state">{error}</div>;
  if (!employee) return null;

  const usingDefaultPhoto = !employee.photoUrl || employee.photoUrl === '/data/default.png';

  const contactValue = (() => {
    try {
      const parts = employee.fullName.trim().split(/\s+/);
      const first = parts[0] || '';
      let middle = '';
      let last = '';
      if (parts.length === 1) {
        last = '';
      } else if (parts.length === 2) {
        last = parts[1];
      } else {
        last = parts[parts.length - 1];
        middle = parts.slice(1, parts.length - 1).join(' ');
      }
      const title = employee.positionTitle || '';
      const tel = employee.phoneNumber || '';
      const email = employee.emailAddress || '';
      // Use fixed company display per requirements
      const org = 'Masdar Building Materials';
      const url = employee.homePage || '';
      // Prepare photo: only include external photo URLs in vCard, not data URIs
      let photoLine = '';
      const photo = employee.photoUrl || '';
      if (photo && !photo.startsWith('data:')) {
        const absolute = photo.startsWith('/') ? `${window.location.origin}${photo}` : photo;
        photoLine = `PHOTO;VALUE=URI:${absolute}`;
      }
      const nField = `${last};${first};${middle}`;
      return [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `N:${nField}`,
        `FN:${employee.fullName}`,
        `TITLE:${title}`,
        `TEL;TYPE=CELL:${tel}`,
        `EMAIL:${email}`,
        `ORG:${org}`,
        ...(photoLine ? [photoLine] : []),
        `URL:${url}`,
        'END:VCARD',
      ].join('\n');
    } catch (e) {
      return window.location.href;
    }
  })();

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
              <img
                src={employee.photoUrl || '/data/default.png'}
                alt="avatar"
                className="preview-avatar"
                crossOrigin="anonymous"
              />
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
                <SmallLabel>Company</SmallLabel>
                <p className="preview-field">Masdar Building Materials</p>
              </div>
              <div>
                <SmallLabel>Address</SmallLabel>
                <p className="preview-field">P.O. Box 40444, Riyadh 11499</p>
                <p className="preview-field">Kingdom of Saudi Arabia</p>
              </div>
              <div>
                <SmallLabel>Home Page</SmallLabel>
                <p className="preview-field">{employee.homePage || '—'}</p>
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
            <SmallLabel>Mobile</SmallLabel>
            <p className="preview-field">{employee.phoneNumber || '—'}</p>
          </div>

          <motion.div whileHover={{ scale: 1.03 }} className="preview-qr-panel">
            <div className="preview-qr-box">
              <QRCode value={contactValue} size={136} bgColor="#ffffff" fgColor="#0f172a" />
            </div>
            <p className="preview-note">Scan to add this contact</p>
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
