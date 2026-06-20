import * as XLSX from 'xlsx';
import { Employee } from './employeeSource';

const headerLookup = {
  employeeStatus: ['employee status'],
  employeeId: ['user/employee id', 'user employee id', 'employee id'],
  displayName: ['display name', 'name'],
  positionTitle: ['position title', 'title', 'position'],
  phoneNumber: ['mobile formatted phone number', 'mobile phone number', 'phone number', 'phone'],
  emailAddress: ['business email information email address', 'business email address', 'email address', 'email'],
  gender: ['gender'],
  reportsTo: ['reports to', 'manager', 'supervisor'],
  companyName: ['company', 'company name'],
  companyCode: ['company code', 'companyid', 'company id', 'company code '],
  department: ['department'],
  subDepartment: ['sub department', 'sub-department', 'sub department name'],
  costCentreCode: ['cost centre code', 'cost center code', 'cost centre', 'cost center'],
};

function normalizeHeader(value: unknown) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function buildHeaderMap(headerRow: unknown[]) {
  return headerRow.reduce<Record<string, number[]>>((map, rawValue, index) => {
    const normalized = normalizeHeader(rawValue);
    if (!normalized) return map;
    if (!map[normalized]) map[normalized] = [];
    map[normalized].push(index);
    return map;
  }, {});
}

function findHeaderIndex(headerMap: Record<string, number[]>, keys: string[]) {
  for (const key of keys) {
    const normalizedKey = normalizeHeader(key);
    if (headerMap[normalizedKey]?.length) {
      return headerMap[normalizedKey][0];
    }
  }

  return undefined;
}

function getCellValue(row: unknown[], headerMap: Record<string, number[]>, keys: string[]) {
  const index = findHeaderIndex(headerMap, keys);
  if (index === undefined) return '';
  return String(row[index] || '').trim();
}

function pickCompanyFields(row: unknown[], headerMap: Record<string, number[]>) {
  let companyName = getCellValue(row, headerMap, headerLookup.companyName);
  let companyCode = getCellValue(row, headerMap, headerLookup.companyCode);

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

  if (!companyName && companyCode && headerMap['company']?.length === 1) {
    companyName = getCellValue(row, headerMap, ['company name']);
  }

  const display = companyName && companyCode ? `${companyName} (${companyCode}-${companyName})` : companyName || companyCode || '';
  return { companyName, companyCode, companyDisplay: display };
}

export async function parseExcelFile(file: File): Promise<Employee[]> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });

  if (rows.length < 2) return [];

  const headerRow = rows[0];
  const headerMap = buildHeaderMap(headerRow);

  return rows.slice(1).reduce<Employee[]>((result, row) => {
    if (!row.some((cell) => String(cell || '').trim())) return result;

    const status = getCellValue(row, headerMap, headerLookup.employeeStatus);
    const employeeId = getCellValue(row, headerMap, headerLookup.employeeId);
    const fullName = getCellValue(row, headerMap, headerLookup.displayName);
    const positionTitle = getCellValue(row, headerMap, headerLookup.positionTitle);
    const phoneNumber = getCellValue(row, headerMap, headerLookup.phoneNumber);
    const emailAddress = getCellValue(row, headerMap, headerLookup.emailAddress);
    const gender = getCellValue(row, headerMap, headerLookup.gender);
    const reportsTo = getCellValue(row, headerMap, headerLookup.reportsTo);
    const department = getCellValue(row, headerMap, headerLookup.department);
    const subDepartment = getCellValue(row, headerMap, headerLookup.subDepartment);
    const costCentreCode = getCellValue(row, headerMap, headerLookup.costCentreCode);
    const { companyName, companyCode, companyDisplay } = pickCompanyFields(row, headerMap);

    const id = employeeId || `EMP-${result.length + 1}`;

    result.push({
      status,
      id,
      fullName,
      positionTitle,
      phoneNumber,
      emailAddress,
      gender,
      reportsTo,
      companyName,
      companyCode,
      companyDisplay,
      department,
      subDepartment,
      costCentreCode,
      photoUrl: '',
      idPhoto1: '',
      idPhoto2: '',
      pdfFile: '',
      qrCodeData: employeeId || id,
      role: positionTitle,
      location: companyDisplay || department,
    });

    return result;
  }, []);
}
