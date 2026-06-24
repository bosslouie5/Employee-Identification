import XLSX from 'xlsx';
import fs from 'fs';
const src = './server/data/source.xlsx';
if (!fs.existsSync(src)) {
  console.error('source.xlsx not found');
  process.exit(2);
}
const wb = XLSX.readFile(src);
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
const headerRow = rows[0] || [];
function normalizeHeader(value) { return String(value || '').trim().toLowerCase().replace(/\s+/g,' '); }
const headerMap = headerRow.reduce((map, rawValue, index) => {
  const normalized = normalizeHeader(rawValue);
  if (!normalized) return map;
  if (!map[normalized]) map[normalized] = [];
  map[normalized].push(index);
  return map;
}, {});
console.log(Object.keys(headerMap).slice(0,200));
console.log('mobile formatted' in headerMap, headerMap['mobile formatted phone number']);
console.log('mobile phone information phone number' in headerMap, headerMap['mobile phone information phone number']);
console.log('mobile phone' in headerMap, headerMap['mobile phone']);
