const fs = require('fs');

let t = fs.readFileSync('src/pages/admin/UserManagement.tsx', 'utf8');
t = t.replace(/teamType:\s*form\.teamType\s*,?\s*/g, '');
t = re.sub(r'teamType:\s*[\'"].*?[\'"],?\s*', '', t); // not defined
fs.writeFileSync('src/pages/admin/UserManagement.tsx', t);
