import re

file_path = 'src/pages/admin/UserManagement.tsx'
with open(file_path, 'r') as f:
    text = f.read()

# I will replace the initialization object fully.
text = re.sub(
    r'const\s*\[form,\s*setForm\]\s*=\s*useState\(\{[\s\S]*?reportsTo:\s*"none"\,?\s*\}\);',
    'const [form, setForm] = useState({\\n        name: "",\\n        email: "",\\n        phone: "",\\n        password: "",\\n        roleId: "",\\n        reportsTo: "none",\\n    });',
    text
)

text = re.sub(
    r'} else \{\s*setForm\(\{[\s\S]*?reportsTo:\s*"none"\s*\}\);\s*\}',
    '} else {\\n            setForm({ name: "", email: "", phone: "", password: "", roleId: "", reportsTo: "none" });\\n        }',
    text
)

text = re.sub(
    r'setForm\(\{[\s\S]*?reportsTo:\s*editingUser\.reportsTo \|\| "none"\,?\s*\}\);',
    'setForm({\\n                name: editingUser.name,\\n                email: editingUser.email,\\n                phone: editingUser.phone || "",\\n                password: "",\\n                roleId: editingUser.roleId || "",\\n                reportsTo: editingUser.reportsTo || "none",\\n            });',
    text
)

with open(file_path, 'w') as f:
    f.write(text)

