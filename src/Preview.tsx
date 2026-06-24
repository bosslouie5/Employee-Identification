
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

async function createImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (evt) => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
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
  const [savingImage, setSavingImage] = useState(false);
  const [qrGenerated, setQrGenerated] = useState(false);
  const [exportError, setExportError] = useState('');
  const employeeRef = useRef<Employee | null>(initialEmployee);
  const previewCardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    employeeRef.current = employee;
  }, [employee]);

  useEffect(() => {
    if (employee && !qrGenerated) {
      setQrGenerated(true);
    }
  }, [employee, qrGenerated]);

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
  const qrDefaultPhotoUrl = '/data/default.png';

  const getVCardPhotoLine = (photoUrl: string) => {
    if (!photoUrl) return '';
    const source = photoUrl.startsWith('http') || photoUrl.startsWith('data:')
      ? photoUrl
      : `${window.location.origin}${photoUrl}`;

    if (source.startsWith('data:')) {
      const match = source.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (!match) return '';
      const [, mimeType, base64Data] = match;
      const type = mimeType.split('/')[1].toUpperCase();
      return `PHOTO;ENCODING=b;TYPE=${type}:${base64Data}`;
    }

    return `PHOTO;VALUE=URI:${source}`;
  };

  const contactValue = (() => {
    // Build a vCard payload so scanning the QR will save the contact with
    // First name, 2nd name, 3rd name, Last name, Title, Company, Mobile, Email, Homepage, and Photo
    if (!employee) return '';
    const full = (employee.fullName || '').trim();
    const parts = full ? full.split(/\s+/) : [];
    let first = '';
    let second = '';
    let third = '';
    let last = '';
    if (parts.length === 1) {
      first = parts[0];
    } else if (parts.length === 2) {
      first = parts[0];
      last = parts[1];
    } else if (parts.length === 3) {
      first = parts[0];
      second = parts[1];
      last = parts[2];
    } else if (parts.length >= 4) {
      first = parts[0];
      second = parts[1];
      third = parts[2];
      last = parts.slice(3).join(' ');
    }

    const additional = [second, third].filter(Boolean).join(' ').trim();
    const esc = (s: string) => (s || '').replace(/\r?\n/g, ' ').replace(/[,;\\]/g, '\\$&');
    const photoLine = getVCardPhotoLine(qrDefaultPhotoUrl);

    const vcardLines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      // N:Family;Given;Additional;Prefix;Suffix
      `N:${esc(last)};${esc(first)};${esc(additional)};;`,
      `FN:${esc(employee.fullName || '')}`,
      `ORG:${esc('MASDAR BUILDING MATERIALS')}`,
      `TITLE:${esc(employee.positionTitle || '')}`,
    ];

    if (photoLine) {
      vcardLines.push(photoLine);
    }
    if (employee.phoneNumber) {
      vcardLines.push(`TEL;TYPE=CELL:${esc(employee.phoneNumber)}`);
    }
    if (employee.emailAddress) {
      vcardLines.push(`EMAIL:${esc(employee.emailAddress)}`);
    }
    if (employee.homePage) {
      vcardLines.push(`URL:${esc(employee.homePage)}`);
    }

    vcardLines.push('END:VCARD');

    return vcardLines.join('\r\n');
  })();

  const handleGenerateQr = () => {
    setExportError('');
    setQrGenerated(true);
  };

  const handleDownloadVCard = () => {
    if (!employee) return;
    const vcfData = contactValue;
    const blob = new Blob([vcfData], { type: 'text/vcard;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${employee.id || 'contact'}.vcf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const handleExportImage = async () => {
    if (!previewCardRef.current || !employee) return;
    if (!qrGenerated) {
      setExportError('Generate QR code first before saving the image.');
      return;
    }
    setExportError('');
    setSavingImage(true);

    const qrBox = previewCardRef.current.querySelector<HTMLDivElement>('.preview-qr-box');
    const originalQrChildren = qrBox ? Array.from(qrBox.childNodes) : [];
    let qrReplacementImage: HTMLImageElement | null = null;

    const createQrCompositeDataUrl = async () => {
      if (!qrBox) return null;
      const svgElement = qrBox.querySelector<SVGSVGElement>('svg');
      const overlayElement = qrBox.querySelector<HTMLDivElement>('.qr-overlay');
      const overlayImg = overlayElement?.querySelector<HTMLImageElement>('img');
      if (!svgElement || !overlayElement || !overlayImg) return null;

      const qrRect = svgElement.getBoundingClientRect();
      const overlayRect = overlayElement.getBoundingClientRect();
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(qrRect.width * scale);
      canvas.height = Math.round(qrRect.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const svgData = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);
      const svgImage = await createImage(svgUrl);
      URL.revokeObjectURL(svgUrl);
      ctx.drawImage(svgImage, 0, 0, canvas.width, canvas.height);

      const overlaySrc = await fetchDataUrl(overlayImg.src);
      const overlayImage = await createImage(overlaySrc);
      const overlayX = Math.round((overlayRect.left - qrRect.left) * scale);
      const overlayY = Math.round((overlayRect.top - qrRect.top) * scale);
      const overlayW = Math.round(overlayRect.width * scale);
      const overlayH = Math.round(overlayRect.height * scale);

      const radius = Math.round(10 * scale);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(overlayX + radius, overlayY);
      ctx.lineTo(overlayX + overlayW - radius, overlayY);
      ctx.quadraticCurveTo(overlayX + overlayW, overlayY, overlayX + overlayW, overlayY + radius);
      ctx.lineTo(overlayX + overlayW, overlayY + overlayH - radius);
      ctx.quadraticCurveTo(overlayX + overlayW, overlayY + overlayH, overlayX + overlayW - radius, overlayY + overlayH);
      ctx.lineTo(overlayX + radius, overlayY + overlayH);
      ctx.quadraticCurveTo(overlayX, overlayY + overlayH, overlayX, overlayY + overlayH - radius);
      ctx.lineTo(overlayX, overlayY + radius);
      ctx.quadraticCurveTo(overlayX, overlayY, overlayX + radius, overlayY);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.lineWidth = Math.round(2 * scale);
      ctx.stroke();

      ctx.drawImage(overlayImage, overlayX, overlayY, overlayW, overlayH);

      return canvas.toDataURL('image/png');
    };

    try {
      // Hide interactive UI (buttons, links) so they are not included in exported image
      const buttonRow = previewCardRef.current.querySelector<HTMLDivElement>('.preview-button-row');
      const prevDisplay = buttonRow ? buttonRow.style.display : null;
      if (buttonRow) buttonRow.style.display = 'none';

      if (qrBox) {
        const qrDataUrl = await createQrCompositeDataUrl();
        if (qrDataUrl) {
          qrReplacementImage = document.createElement('img');
          qrReplacementImage.src = qrDataUrl;
          qrReplacementImage.alt = 'QR preview';
          qrReplacementImage.style.width = '100%';
          qrReplacementImage.style.height = 'auto';
          qrReplacementImage.style.display = 'block';
          qrBox.replaceChildren(qrReplacementImage);
        }
      }

      await waitForImages(previewCardRef.current);
      const originalSrcs = await inlineImageSources(previewCardRef.current);
      const canvas = await html2canvas(previewCardRef.current, {
        backgroundColor: '#0f172a',
        useCORS: true,
        scale: 2,
      });

      // restore interactive UI after canvas capture
      if (buttonRow) buttonRow.style.display = prevDisplay || '';
      if (qrBox && originalQrChildren.length > 0) {
        qrBox.replaceChildren(...originalQrChildren);
      }

      restoreImageSources(originalSrcs);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) {
        throw new Error('Unable to create image blob');
      }

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${employee.id}-employee-preview.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error('Image export failed', err);
      setExportError('Failed to export image. Try again.');
      if (qrBox && originalQrChildren.length > 0) {
        qrBox.replaceChildren(...originalQrChildren);
      }
    } finally {
      setSavingImage(false);
    }
  };

  return (
    <div className="preview-shell">
      <motion.div
        ref={previewCardRef}
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
              {qrGenerated ? (
                <>
                  <QRCode value={contactValue} size={136} level="H" bgColor="#ffffff" fgColor="#0f172a" />
                  <div className="qr-overlay">
                    <img src={qrDefaultPhotoUrl} alt="Logo" className="qr-overlay-image" crossOrigin="anonymous" />
                  </div>
                </>
              ) : (
                <div className="preview-skeleton">
                  QR code not generated yet
                </div>
              )}
            </div>
            <p className="preview-note">{qrGenerated ? 'Scan to add this contact' : 'Generate the QR code first'}</p>
          </motion.div>
        </div>

        <div className="preview-button-row">
          <a href="/" className="preview-link">Open app</a>
          <button className="preview-print-button" onClick={handleDownloadVCard} disabled={!qrGenerated || savingImage}>
            Add Contact
          </button>
          {!qrGenerated ? (
            <button className="preview-print-button" onClick={handleGenerateQr} disabled={savingImage}>
              Generate QR
            </button>
          ) : null}
          <button
            className="preview-print-button"
            onClick={handleExportImage}
            disabled={savingImage || !qrGenerated}
          >
            {savingImage ? 'Exporting…' : 'Save image'}
          </button>
        </div>
        {exportError && <p className="preview-error-message">{exportError}</p>}
      </motion.div>
    </div>
  );
}
