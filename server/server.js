import express from 'express';
import cors from 'cors';
import multer from 'multer';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const PORT = process.env.PORT || 4000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'employees.json');
const SOURCE_FILE = path.join(DATA_DIR, 'source.xlsx');
const DIST_DIR = path.join(__dirname, '..', 'dist');
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'Admin12345';

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function normalizeEmployeeRecord(record) {
  return {
    status: record.status || 'Active',
    id: record.id || '',
    fullName: record.fullName || record.name || record.displayName || '',
    positionTitle: record.positionTitle || record.title || '',
    department: record.department || '',
    subDepartment: record.subDepartment || record.sub_department || '',
    division: record.division || '',
    companyName: record.companyName || record.company || record.companyDisplay || '',
    companyCode: record.companyCode || '',
    companyDisplay: record.companyDisplay || record.companyName || '',
    location: record.location || '',
    nationality: record.nationality || '',
    dateOfBirth: record.dateOfBirth || '',
    homePage: record.homePage || 'http://www.masdar.co',
    phoneNumber: record.phoneNumber || '',
    emailAddress: record.emailAddress || record.email || '',
    gender: record.gender || '',
    reportsTo: record.reportsTo || record.manager || '',
    photoUrl: record.photoUrl || '',
    idPhoto1: record.idPhoto1 || '',
    idPhoto2: record.idPhoto2 || '',
    pdfFile: record.pdfFile || '',
    qrCodeData: record.qrCodeData || record.id || '',
  };
}

function loadEmployeesFromDisk() {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeEmployeeRecord);
  } catch (error) {
    console.error('Failed to load employee data from disk:', error);
    return [];
  }
}

function normalizeEmployeeId(value) {
  return String(value ?? '').trim().toLowerCase();
}

function saveEmployeesToDisk(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to persist employee data to disk:', error);
  }
}

function attachPhotosToEmployees(employeesList) {
  const photosDir = path.join(DATA_DIR, 'photos');
  const available = fs.existsSync(photosDir) ? fs.readdirSync(photosDir) : [];
  return employeesList.map((emp) => {
    const updated = { ...emp };
    if (!updated.photoUrl) {
      const match = available.find((name) => name.startsWith(`${emp.id}-photo`));
      if (match) updated.photoUrl = `/data/photos/${match}`;
    }
    if (!updated.idPhoto1) {
      const match = available.find((name) => name.startsWith(`${emp.id}-id1`));
      if (match) updated.idPhoto1 = `/data/photos/${match}`;
    }
    if (!updated.idPhoto2) {
      const match = available.find((name) => name.startsWith(`${emp.id}-id2`));
      if (match) updated.idPhoto2 = `/data/photos/${match}`;
    }
    return updated;
  });
}

let employees = attachPhotosToEmployees(loadEmployeesFromDisk());

app.use(cors());
app.use(express.json());

// Serve static frontend files from dist folder
app.use(express.static(DIST_DIR));
// Expose uploaded data (employees.json, photos, default.png) to be served
app.use('/data', express.static(DATA_DIR));

function normalizeHeader(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function buildHeaderMap(headerRow) {
  return headerRow.reduce((map, rawValue, index) => {
    const normalized = normalizeHeader(rawValue);
    if (!normalized) return map;
    if (!map[normalized]) map[normalized] = [];
    map[normalized].push(index);
    return map;
  }, {});
}

function findHeaderIndex(headerMap, keys) {
  // Try multiple normalizations: normalized (spaces collapsed) and a simplified alphanumeric-only form
  const simplifiedMap = Object.keys(headerMap).reduce((m, k) => {
    const simple = k.replace(/[^a-z0-9]/g, '');
    m[simple] = headerMap[k];
    return m;
  }, {});

  for (const key of keys) {
    const normalizedKey = normalizeHeader(key);
    if (headerMap[normalizedKey]?.length) return headerMap[normalizedKey][0];
    const simpleKey = normalizedKey.replace(/[^a-z0-9]/g, '');
    if (simplifiedMap[simpleKey]?.length) return simplifiedMap[simpleKey][0];
  }
  return undefined;
}

function getCellValue(row, headerMap, keys) {
  const index = findHeaderIndex(headerMap, keys);
  if (index === undefined) return '';
  return String(row[index] || '').trim();
}

function pickCompanyFields(row, headerMap) {
  let companyName = getCellValue(row, headerMap, ['company', 'company name']);
  let companyCode = getCellValue(row, headerMap, ['company code', 'companyid', 'company id', 'company code ']);

  if (!companyCode) {
    const companyIndexes = headerMap['company'] || [];
    if (companyIndexes.length >= 2) {
      const candidates = companyIndexes.map((idx) => String(row[idx] || '').trim());
      const firstNumeric = candidates.find((value) => /^\d+$/.test(value));
      const firstText = candidates.find((value) => value && !/^\d+$/.test(value));
      if (!companyName && firstText) companyName = firstText;
      if (firstNumeric) companyCode = firstNumeric;
    }
  }

  const display = companyName && companyCode ? `${companyName} (${companyCode}-${companyName})` : companyName || companyCode || '';
  return { companyName, companyCode, companyDisplay: display };
}

function parseRows(rows) {
  const headerMap = buildHeaderMap(rows[0] || []);

  return rows.slice(1).reduce((result, row) => {
    if (!row.some((cell) => String(cell || '').trim())) return result;

    const employeeId = String(row[1] || '').trim(); // Column B
    const fullName = String(row[2] || '').trim() || String(row[0] || '').trim();
    const gender = String(row[9] || '').trim(); // Column J
    const positionTitle = String(row[20] || '').trim(); // Column U
    const dateOfBirthRaw = row[22]; // Column W
    const department = String(row[16] || '').trim(); // Column Q
    const nationality = String(row[12] || '').trim(); // Column M
    const subDepartment = String(row[17] || '').trim(); // Column R
    const division = String(row[15] || '').trim(); // Column P
    const emailAddress = String(row[36] || '').trim(); // Column AK
    const reportsTo = String(row[33] || '').trim(); // Column AH
    const companyName = String(row[13] || '').trim(); // Column N
    const location = String(row[31] || '').trim(); // Column AF
    // Attempt to read mobile phone from header-mapped columns (flexible keys)
    const mobile = getCellValue(row, headerMap, [
      'mobile formatted phone number',
      'mobile  phone information phone number',
      'mobile phone information phone number',
      'mobile phone',
      'mobile number',
      'mobile'
    ]);
    const status = 'Active';
    const homePage = 'http://www.masdar.co';

    const dateOfBirth = (() => {
      if (dateOfBirthRaw instanceof Date && !Number.isNaN(dateOfBirthRaw.getTime())) {
        return dateOfBirthRaw.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      }
      if (typeof dateOfBirthRaw === 'number') {
        const excelEpoch = new Date(Date.UTC(1899, 11, 30));
        const date = new Date(excelEpoch.getTime() + dateOfBirthRaw * 86400000);
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      }
      const text = String(dateOfBirthRaw || '').trim();
      const parsed = new Date(text);
      return !Number.isNaN(parsed.getTime())
        ? parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        : text;
    })();

    const id = employeeId || `EMP-${result.length + 1}`;

    result.push(normalizeEmployeeRecord({
      status,
      id,
      fullName: fullName || `Employee ${result.length + 1}`,
      positionTitle,
      department,
      subDepartment,
      division,
      companyName,
      location,
      nationality,
      dateOfBirth,
      homePage,
      emailAddress,
      phoneNumber: mobile || '',
      gender,
      reportsTo,
      photoUrl: '',
      idPhoto1: '',
      idPhoto2: '',
      pdfFile: '',
      qrCodeData: employeeId || id,
    }));

    return result;
  }, []);
}

app.get('/', (req, res) => {
  res.json({
    message: 'Employee API server is running. Use /api/employees for data or /api/upload for admin upload.',
    endpoints: ['/api/employees', '/api/upload']
  });
});

app.get('/api/employees', (req, res) => {
  res.json({ employees: employees.map(normalizeEmployeeRecord) });
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  const token = req.header('x-admin-token');
  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    // Save the uploaded source file separately so photos stay preserved even when source is deleted
    fs.writeFileSync(SOURCE_FILE, req.file.buffer);
    // Preserve current employees so we can merge existing photos
    const previousEmployees = Array.isArray(employees) ? employees.slice() : [];
    employees = parseRows(rows);

    // Ensure photos directory exists
    const photosDir = path.join(DATA_DIR, 'photos');
    const available = fs.existsSync(photosDir) ? fs.readdirSync(photosDir) : [];

    // For each newly parsed employee, try to preserve any existing photo references
    employees = employees.map((emp) => {
      const prev = previousEmployees.find((p) => p.id === emp.id);
      if (prev) {
        if (prev.photoUrl) emp.photoUrl = prev.photoUrl;
        if (prev.idPhoto1) emp.idPhoto1 = prev.idPhoto1;
        if (prev.idPhoto2) emp.idPhoto2 = prev.idPhoto2;
        // preserve phone number from previous dataset if the new import didn't include it
        if (!emp.phoneNumber && prev.phoneNumber) emp.phoneNumber = prev.phoneNumber;
      }

      // If no previous record contained photo links, probe the photos folder for matching files
      if (!emp.photoUrl) {
        const match = available.find((n) => n.startsWith(`${emp.id}-photo`));
        if (match) emp.photoUrl = `/data/photos/${match}`;
      }
      if (!emp.idPhoto1) {
        const match = available.find((n) => n.startsWith(`${emp.id}-id1`));
        if (match) emp.idPhoto1 = `/data/photos/${match}`;
      }
      if (!emp.idPhoto2) {
        const match = available.find((n) => n.startsWith(`${emp.id}-id2`));
        if (match) emp.idPhoto2 = `/data/photos/${match}`;
      }

      return emp;
    });
    saveEmployeesToDisk(employees);
    return res.json({ success: true, imported: employees.length });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to parse Excel file' });
  }
});

// Admin: get default photo info
app.get('/api/admin/default-photo', (req, res) => {
  const token = req.header('x-admin-token');
  if (token !== ADMIN_TOKEN) return res.status(401).json({ error: 'Unauthorized' });

  const defaultPath = path.join(DATA_DIR, 'default.png');
  const exists = fs.existsSync(defaultPath);
  return res.json({ exists, url: exists ? '/data/default.png' : null });
});

// Admin: upload default photo
app.post('/api/admin/default-photo', upload.single('file'), (req, res) => {
  const token = req.header('x-admin-token');
  if (token !== ADMIN_TOKEN) return res.status(401).json({ error: 'Unauthorized' });

  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const dest = path.join(DATA_DIR, 'default.png');
    fs.writeFileSync(dest, req.file.buffer);
    return res.json({ success: true, url: '/data/default.png' });
  } catch (err) {
    console.error('Failed to save default photo:', err);
    return res.status(500).json({ error: 'Failed to save default photo' });
  }
});

// Admin: delete default photo
app.delete('/api/admin/default-photo', (req, res) => {
  const token = req.header('x-admin-token');
  if (token !== ADMIN_TOKEN) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const dest = path.join(DATA_DIR, 'default.png');
    if (fs.existsSync(dest)) fs.unlinkSync(dest);
    return res.json({ success: true });
  } catch (err) {
    console.error('Failed to delete default photo:', err);
    return res.status(500).json({ error: 'Failed to delete default photo' });
  }
});

// Admin: upload per-employee photo (field: photo, id1, id2)
app.post('/api/admin/photo/:id', upload.single('file'), (req, res) => {
  const token = req.header('x-admin-token');
  if (token !== ADMIN_TOKEN) return res.status(401).json({ error: 'Unauthorized' });

  const empId = req.params.id;
  const field = req.query.field || 'photo';
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const photosDir = path.join(DATA_DIR, 'photos');
    if (!fs.existsSync(photosDir)) fs.mkdirSync(photosDir, { recursive: true });
    const rawExt = path.extname(req.file.originalname || '').toLowerCase();
    const safeExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(rawExt) ? rawExt : '.png';
    const nameMap = { photo: `${empId}-photo${safeExt}`, id1: `${empId}-id1${safeExt}`, id2: `${empId}-id2${safeExt}` };
    const fileName = nameMap[field] || `${empId}-photo${safeExt}`;
    const dest = path.join(photosDir, fileName);
    fs.writeFileSync(dest, req.file.buffer);

    // update employee record
    let updated = false;
    const targetId = normalizeEmployeeId(empId);
    const emp = employees.find((e) => normalizeEmployeeId(e.id) === targetId || normalizeEmployeeId(e.qrCodeData) === targetId);
    if (emp) {
      const urlPath = `/data/photos/${fileName}`;
      if (field === 'id1') emp.idPhoto1 = urlPath;
      else if (field === 'id2') emp.idPhoto2 = urlPath;
      else emp.photoUrl = urlPath;
      saveEmployeesToDisk(employees);
      updated = true;
    } else {
      console.warn(`Uploaded photo for ${empId} but no matching employee record found.`);
    }

    return res.json({ success: true, url: `/data/photos/${fileName}`, updated });
  } catch (err) {
    console.error('Failed to upload employee photo:', err);
    return res.status(500).json({ error: 'Failed to upload photo' });
  }
});

// Admin: delete per-employee photo
app.delete('/api/admin/photo/:id', (req, res) => {
  const token = req.header('x-admin-token');
  if (token !== ADMIN_TOKEN) return res.status(401).json({ error: 'Unauthorized' });

  const empId = req.params.id;
  const field = req.query.field || 'photo';
  try {
    const photosDir = path.join(DATA_DIR, 'photos');
    const possible = fs.existsSync(photosDir) ? fs.readdirSync(photosDir) : [];
    const match = possible.find((n) => n.startsWith(`${empId}-${field === 'id1' ? 'id1' : field === 'id2' ? 'id2' : 'photo'}`));
    if (match) {
      const dest = path.join(photosDir, match);
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
    }

    // update employee record
    let updated = false;
    const emp = employees.find((e) => e.id === empId);
    if (emp) {
      if (field === 'id1') emp.idPhoto1 = '';
      else if (field === 'id2') emp.idPhoto2 = '';
      else emp.photoUrl = '';
      saveEmployeesToDisk(employees);
      updated = true;
    } else {
      console.warn(`Deleted photo for ${empId} but no matching employee record found.`);
    }

    return res.json({ success: true, updated });
  } catch (err) {
    console.error('Failed to delete employee photo:', err);
    return res.status(500).json({ error: 'Failed to delete photo' });
  }
});

app.delete('/api/source', (req, res) => {
  const token = req.header('x-admin-token');
  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    if (fs.existsSync(SOURCE_FILE)) {
      fs.unlinkSync(SOURCE_FILE);
    }
    if (fs.existsSync(DATA_FILE)) {
      fs.unlinkSync(DATA_FILE);
    }
    employees = [];
    saveEmployeesToDisk(employees);
    return res.json({ success: true, message: 'Source file and employee data deleted. Saved QR profiles remain accessible.' });
  } catch (error) {
    console.error('Failed to delete source file:', error);
    return res.status(500).json({ error: 'Failed to delete source file' });
  }
});

// Serve SPA catch-all route for client-side routing
app.use((req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
