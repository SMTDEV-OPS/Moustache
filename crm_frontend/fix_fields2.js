const fs = require('fs');

function fixContent(filepath) {
    let content = fs.readFileSync(filepath, 'utf8');

    // 1. Initial State hook matching
    const stateHookRegex = /const \[form,\s*setForm\]\s*=\s*useState\(\{[\s\S]*?reportsTo:\s*\"none\"[\s\n\,]*\}\);/;
    const fixedStateHook = `const [form, setForm] = useState({
        name: "",
        email: "",
        phone: "",
        password: "",
        roleId: "",
        reportsTo: "none",
    });`;
    
    // 2. Editing User logic
    const setFormRegex = /setForm\(\{[\s\S]*?reportsTo:\s*editingUser\.reportsTo\s*\|\|\s*"none"[\s\n\,]*\}\);/;
    const fixedSetForm = `setForm({
                name: editingUser.name,
                email: editingUser.email,
                phone: editingUser.phone || "",
                password: "",
                roleId: editingUser.roleId || "",
                reportsTo: editingUser.reportsTo || "none",
            });`;

    // 3. Clear/Else form logic
    const emptyFormRegex = /\}\s+else\s+\{\s*setForm\(\{[\s\S]*?reportsTo:\s*"none"\s*\}\);\s*\}/;
    const fixedEmptyForm = `} else {
            setForm({ name: "", email: "", phone: "", password: "", roleId: "", reportsTo: "none" });
        }`;

    // Apply the replacements
    content = content.replace(stateHookRegex, fixedStateHook);
    content = content.replace(setFormRegex, fixedSetForm);
    content = content.replace(emptyFormRegex, fixedEmptyForm);

    fs.writeFileSync(filepath, content);
}

fixContent('src/pages/admin/UserManagement.tsx');
