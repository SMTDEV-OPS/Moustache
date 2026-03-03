import fs from 'fs';

const filepath = 'src/pages/admin/UserManagement.tsx';
let content = fs.readFileSync(filepath, 'utf8');

const stateHookRegex = /const \[form, setForm\] = useState\(\{[\s\S]*?reportsTo: "none",?[\s\n]*\}\);/g;
const fixedStateHook = `const [form, setForm] = useState({
        name: "",
        email: "",
        phone: "",
        password: "",
        roleId: "",
        reportsTo: "none",
    });`;

const setFormRegex = /setForm\(\{[\s\S]*?reportsTo: editingUser.reportsTo \|\| "none",?[\s\n]*\}\);/g;
const fixedSetForm = `setForm({
                name: editingUser.name,
                email: editingUser.email,
                phone: editingUser.phone || "",
                password: "",
                roleId: editingUser.roleId || "",
                reportsTo: editingUser.reportsTo || "none",
            });`;

const emptyFormRegex = /\}\s*else\s*\{\s*setForm\(\{[\s\S]*?reportsTo:\s*"none"\,?\s*\}\);\s*\}/g;
const fixedEmptyForm = `} else {
            setForm({ name: "", email: "", phone: "", password: "",  roleId: "", reportsTo: "none" });
        }`;


content = content.replace(stateHookRegex, fixedStateHook);
content = content.replace(setFormRegex, fixedSetForm);
content = content.replace(emptyFormRegex, fixedEmptyForm);

fs.writeFileSync(filepath, content);
