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
console.log('Header row:');
console.log(rows[0]);
