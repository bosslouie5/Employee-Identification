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
const DIST_DIR = path.join(__dirname, '..', 'dist');
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'Admin12345';

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadEmployeesFromDisk() {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    console.error('Failed to load employee data from disk:', error);
    return [];
  }
}

function saveEmployeesToDisk(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to persist employee data to disk:', error);
  }
}

let employees = loadEmployeesFromDisk();

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
  for (const key of keys) {
    const normalizedKey = normalizeHeader(key);
    if (headerMap[normalizedKey]?.length) {
      return headerMap[normalizedKey][0];
    }
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
  const headerRow = rows[0];
  const headerMap = buildHeaderMap(headerRow);

  return rows.slice(1).reduce((result, row) => {
    if (!row.some((cell) => String(cell || '').trim())) return result;

    const status = getCellValue(row, headerMap, ['employee status']);
    const employeeId = getCellValue(row, headerMap, ['user/employee id', 'user employee id', 'employee id']);
    const fullName = getCellValue(row, headerMap, ['display name', 'name']);
    const positionTitle = getCellValue(row, headerMap, ['position title', 'title', 'position']);
    const phoneNumber = getCellValue(row, headerMap, ['mobile formatted phone number', 'mobile phone number', 'phone number', 'phone']);
    const emailAddress = getCellValue(row, headerMap, ['business email information email address', 'business email address', 'email address', 'email']);
    const gender = getCellValue(row, headerMap, ['gender']);
    const reportsTo = getCellValue(row, headerMap, ['reports to', 'manager', 'supervisor']);
    const department = getCellValue(row, headerMap, ['department']);
    const subDepartment = getCellValue(row, headerMap, ['sub department', 'sub-department', 'sub department name']);
    const costCentreCode = getCellValue(row, headerMap, ['cost centre code', 'cost center code', 'cost centre', 'cost center']);
    const { companyName, companyCode, companyDisplay } = pickCompanyFields(row, headerMap);

    const id = employeeId || `EMP-${result.length + 1}`;

    result.push({
      status,
      id,
      fullName,
      positionTitle,
      department,
      subDepartment,
      costCentreCode,
      phoneNumber,
      emailAddress,
      gender,
      reportsTo,
      companyName,
      companyCode,
      companyDisplay,
      role: positionTitle,
      location: companyDisplay || department,
      photoUrl: '',
      idPhoto1: '',
      idPhoto2: '',
      pdfFile: '',
      qrCodeData: employeeId || id,
    });

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
  res.json({ employees });
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
    employees = parseRows(rows);
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
    const ext = path.extname(req.file.originalname) || '.png';
    const nameMap = { photo: `${empId}-photo${ext}`, id1: `${empId}-id1${ext}`, id2: `${empId}-id2${ext}` };
    const fileName = nameMap[field] || `${empId}-photo${ext}`;
    const dest = path.join(photosDir, fileName);
    fs.writeFileSync(dest, req.file.buffer);

    // update employee record
    let updated = false;
    const emp = employees.find((e) => e.id === empId);
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
    if (fs.existsSync(DATA_FILE)) {
      fs.unlinkSync(DATA_FILE);
    }
    employees = [];
    saveEmployeesToDisk(employees);
    return res.json({ success: true, message: 'Source file deleted and employee data cleared.' });
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
