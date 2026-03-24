const fs = require('fs');
let text = fs.readFileSync('/Users/adarsh/MyRepo/Postcard/crm_frontend/src/pages/admin/UserManagement.tsx', `utf8`);

text = text.replace(/{ name: "", email: "", phone: "", password: "", roleId: "", reportsTo: "none" }/g, '{ name: "", email: "", phone: "", password: "", roleId: "", reportsTo: "none" } // No Team Type');

// Strip out lines referring to teamType initialization
text = text.replace(/teamType:\s*[\'\"]MANAGEMENT[\'\"]\,?\s*/g, '');
text = text.replace(/teamType:\s*form\.teamType\,?\s*/g, '');
text = text.replace(/teamType:\s*editingUser\.teamType\,?\s*/g, '');
text = text.replace(/,\s*teamType: string;/g, '');
text = text.replace(/teamType\??:\s*string;?/g, '');

fs.writeFileSync('/Users/adarsh/MyRepo/Postcard/crm_frontend/src/pages/admin/UserManagement.tsx', text);

