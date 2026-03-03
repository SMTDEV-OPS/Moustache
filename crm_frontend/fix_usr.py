
with open("src/pages/admin/UserManagement.tsx", "r") as f:
    text = f.read()

s1 = """    const [form, setForm] = useState({
        name: "",
        email: "",
        phone: "",
        password: "",
        roleId: "",
        reportsTo: "none",
    });"""

r1 = """    const [form, setForm] = useState({
        name: "",
        email: "",
        phone: "",
        password: "",
        teamType: "",
        roleId: "",
        reportsTo: "none",
    });"""

s2 = """            setForm({
                name: editingUser.name,
                email: editingUser.email,
                phone: editingUser.phone || "",
                password: "",
                roleId: editingUser.roleId || "",
                reportsTo: editingUser.reportsTo || "none",
            });"""

r2 = """            setForm({
                name: editingUser.name,
                email: editingUser.email,
                phone: editingUser.phone || "",
                password: "",
                roleId: editingUser.roleId || "",
                teamType: "",
                reportsTo: editingUser.reportsTo || "none",
            });"""

s3 = """setForm({ name: "", email: "", phone: "", password: "", roleId: "", reportsTo: "none" });"""
r3 = """setForm({ name: "", email: "", phone: "", password: "", teamType: "", roleId: "", reportsTo: "none" });"""

text = text.replace(s1, r1)
text = text.replace(s2, r2)
text = text.replace(s3, r3)

with open("src/pages/admin/UserManagement.tsx", "w") as f:
    f.write(text)

