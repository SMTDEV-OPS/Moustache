const fs = require('fs');

function fixForm() {
    let content = fs.readFileSync('src/pages/admin/UserManagement.tsx', 'utf8');
    
    // First, restore the `const [form, setForm]...` structure without teamType
    const formVarMatch = content.match(/const \[form, setForm\] = useState\(\{[\s\S]*?reportsTo:\s*"none"\s*\} \/\/ No Team Type\)/);
    
    if (formVarMatch) {
       // We're good, it's there.
    } else {
        // Find existing definition with reportsTo: ...  to replace.
        content = content.replace(/const \[form, setForm\] = useState\(\{[\s\S]*?reportsTo:\s*"none"[\s\S]*?\}\);/g, `const [form, setForm] = useState({
        name: "",
        email: "",
        phone: "",
        password: "",
        roleId: "",
        reportsTo: "none",
    });`);
    }

    // Now fix setForm({name: ... }) logic
    content = content.replace(/setForm\(\{[\s\S]*?reportsTo: editingUser.reportsTo \|\| "none"[\s\S]*?\}\);/g, `setForm({
                name: editingUser.name,
                email: editingUser.email,
                phone: editingUser.phone || "",
                password: "",
                roleId: editingUser.roleId || "",
                reportsTo: editingUser.reportsTo || "none",
            });`);
            
    // Next, fix the else part inside `useEffect` logic
    content = content.replace(/} else \{\s*setForm\(\{ name: "", email: "", phone: "", password: "", roleId: "", reportsTo: "none" \}\);/g, `} else {
            setForm({ name: "", email: "", phone: "", password: "", roleId: "", reportsTo: "none" });`);

    fs.writeFileSync('src/pages/admin/UserManagement.tsx', content);
}

fixForm();
