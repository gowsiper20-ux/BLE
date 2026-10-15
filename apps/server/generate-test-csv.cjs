const fs = require('fs');
let csv = 'register_number,name,college_email,class\n';
for (let i = 1; i <= 25; i++) {
  const reg = `61782324106${i.toString().padStart(3, '0')}`;
  csv += `${reg},Student ${i},student${i}@college.edu,II IT-A\n`;
}
for (let i = 26; i <= 50; i++) {
  const reg = `61782324106${i.toString().padStart(3, '0')}`;
  csv += `${reg},Student ${i},student${i}@college.edu,II IT-B\n`;
}
fs.writeFileSync('test_50_students.csv', csv);
console.log('test_50_students.csv generated.');
