const fs = require('fs');

const f = '/Users/adarsh/MyRepo/Postcard/crm_frontend/src/pages/admin/UserManagement.tsx';
let txt = fs.readFileSync(f, 'utf8');

txt = txt.replace(/teamType: "MANAGEMENT",?/g, '');
txt = txt.replace(/teamType:\s*form\.teamType\s*,?/g, '');
txt = txt.replace(/teamType:\s*editingUser\.teamType\s*,?/g, '');
// Handle TS missing type object argument
txt = txt.replace(/const \[form, setForm\] = useState\(\{[\s\S]*?reportsTo: "none",[\s\n]*\}\);/, 
`    const [form, setForm] = useState({
        name: "",
        email: "",
        phone: "",
        password: "",
        roleId: "",
        reportsTo: "none",
    });`);

txt = txt.replace(/setForm\(\{[\s\S]*?reportsTo: editingUser.reportsTo \|\| "none",[\s\n]*\}\);/,
`            setForm({
                name: editingUser.name,
                email: editingUser.email,
                phone: editingUser.phone || "",
                password: "",
                roleId: editingUser.roleId || "",
                reportsTo: editingUser.reportsTo || "none",
            });`);


fs.writeFileSync(f, txt);
