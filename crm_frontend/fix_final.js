const fs = require('fs');

function cleanEditStruct() {
    let text = fs.readFileSync('src/pages/admin/UserManagement.tsx', 'utf8');

    // Remove empty teamType variables and fix form.
    text = text.replace(/,\s*teamType:\s*['"]['"]/g, '');
    text = text.replace(/this\./g, 'this.'); // dummy edit
    
    // There are TS syntax errors regarding `useState`. Let's re-write `useState` dictionary correctly completely via regexp matching the structure.
    const search = `    const [form, setForm] = useState({
        name: "",
        email: "",
        phone: "",
        password: "",
        teamType: "",
        roleId: "",
        reportsTo: "none",
    });`;
    
    const replace = `    const [form, setForm] = useState({
        name: "",
        email: "",
        phone: "",
        password: "",
        roleId: "",
        reportsTo: "none",
    });`;

    text = text.replace(search, replace);

    const search2 = `            setForm({
                name: editingUser.name,
                email: editingUser.email,
                phone: editingUser.phone || "",
                password: "",
                roleId: editingUser.roleId || "",
                teamType: "",
                reportsTo: editingUser.reportsTo || "none",
            });`;

    const replace2 = `            setForm({
                name: editingUser.name,
                email: editingUser.email,
                phone: editingUser.phone || "",
                password: "",
                roleId: editingUser.roleId || "",
                reportsTo: editingUser.reportsTo || "none",
            });`;

    text = text.replace(search2, replace2);

    const search3 = `setForm({ name: "", email: "", phone: "", password: "", teamType: "", roleId: "", reportsTo: "none" });`;
    const replace3 = `setForm({ name: "", email: "", phone: "", password: "", roleId: "", reportsTo: "none" });`;
    text = text.replace(search3, replace3);

    fs.writeFileSync('src/pages/admin/UserManagement.tsx', text);
}

cleanEditStruct();

