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
const headers = rows[0] || [];
const findIndex = (name) => headers.findIndex(h => String(h || '').toLowerCase().replace(/\s+/g,' ').includes(name.toLowerCase().replace(/\s+/g,' ')));
console.log('Header indexes:');
['Mobile Formatted Phone Number','Mobile  Phone Information Phone Number','Mobile  Phone Information Phone Number'.replace(/\s+/g,' ')].forEach(h => console.log(h, '->', findIndex(h)));

for (let i=1;i<rows.length;i++){
  const row = rows[i];
  const id = String(row[1] || '').trim();
  if (id === '60003078'){
    console.log('Found row', i);
    const v1 = row[findIndex('Mobile Formatted Phone Number')];
    const v2 = row[findIndex('Mobile  Phone Information Phone Number')];
    console.log('Mobile Formatted:', v1);
    console.log('Mobile Info Phone:', v2);
    console.log('Full row snippet:', row.slice(0,50));
    break;
  }
}
