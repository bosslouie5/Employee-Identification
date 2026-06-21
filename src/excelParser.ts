import * as XLSX from 'xlsx';
import { Employee } from './employeeSource';

function getColumnValue(row: unknown[], index: number) {
  if (index < 0) return '';
  const value = row[index];
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function formatBirthdate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  if (typeof value === 'number') {
    if (XLSX.SSF && typeof XLSX.SSF.parse_date_code === 'function') {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed) {
        const date = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      }
    }
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + value * 86400000);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  const normalized = String(value || '').trim();
  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  return normalized;
}

export async function parseExcelFile(file: File): Promise<Employee[]> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });

  if (rows.length < 2) return [];

  return rows.slice(1).reduce<Employee[]>((result, row) => {
    if (!row.some((cell) => String(cell || '').trim())) return result;

    const employeeId = getColumnValue(row, 1); // Column B
    const gender = getColumnValue(row, 9); // Column J
    const positionTitle = getColumnValue(row, 20); // Column U
    const dateOfBirth = formatBirthdate(row[22]); // Column W
    const department = getColumnValue(row, 16); // Column Q
    const nationality = getColumnValue(row, 12); // Column M
    const subDepartment = getColumnValue(row, 17); // Column R
    const division = getColumnValue(row, 15); // Column P
    const emailAddress = getColumnValue(row, 36); // Column AK
    const reportsTo = getColumnValue(row, 33); // Column AH
    const companyName = getColumnValue(row, 13); // Column N
    const location = getColumnValue(row, 31); // Column AF
    const fullName = getColumnValue(row, 2); // Column C if name is in C? fallback if source file has name in C

    const id = employeeId || `EMP-${result.length + 1}`;

    result.push({
      status: 'Active',
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
      homePage: 'http://www.masdar.co',
      emailAddress,
      gender,
      reportsTo,
      photoUrl: '',
      idPhoto1: '',
      idPhoto2: '',
      pdfFile: '',
      qrCodeData: employeeId || id,
    });

    return result;
  }, []);
}
