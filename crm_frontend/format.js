const fs = require('fs');

let t = fs.readFileSync('src/pages/admin/UserManagement.tsx', 'utf8');

// Replace standard state assignments lacking teamType safely
t = t.replace(
    /setForm\(\{[\s\r\n]*name: "",[\s\r\n]*email: "",[\s\r\n]*phone: "",[\s\r\n]*password: "",[\s\r\n]*roleId: "",[\s\r\n]*reportsTo: "none"([^}]+)?\}\)/g, 
    'setForm({ name: "", email: "", phone: "", password: "", roleId: "", reportsTo: "none" })'
);

t = t.replace(
    /const \[form, setForm\] = useState\(\{[\s\r\n]*name: "",[\s\r\n]*email: "",[\s\r\n]*phone: "",[\s\r\n]*password: "",[\s\r\n]*roleId: "",[\s\r\n]*reportsTo: "none",?[\s\r\n]*\}\);/g,
    'const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", roleId: "", reportsTo: "none" });'
);

// We should also completely strip `export interface User {` fields that contains `teamType`.
t = t.replace(/teamType:\s*.*\b(form\.teamType|editingUser\.teamType|\"MANAGEMENT\")\b/g, '');

fs.writeFileSync('src/pages/admin/UserManagement.tsx', t);
